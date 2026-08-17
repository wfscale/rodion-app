'use client';

import { motion } from 'framer-motion';
import { ChevronDown, Maximize2, Minimize2, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { OfferCard } from '@/components/OfferCard';
import { OfferSheet, type OfferDraft } from '@/components/OfferSheet';
import { BlueprintCard } from '@/components/outreach/BlueprintCard';
import { ContactCards } from '@/components/outreach/ContactCards';
import { ContactSheet, type ContactDraft } from '@/components/outreach/ContactSheet';
import { ContactTable, type TableSort } from '@/components/outreach/ContactTable';
import { ConversationSheet } from '@/components/outreach/ConversationSheet';
import { DialogueCard } from '@/components/outreach/DialogueCard';
import { FollowUpList } from '@/components/outreach/FollowUpList';
import { FunnelChart, type FunnelTarget } from '@/components/outreach/FunnelChart';
import { HourlyCard } from '@/components/outreach/HourlyCard';
import { NicheAnalytics } from '@/components/outreach/NicheAnalytics';
import { OutreachFilters } from '@/components/outreach/OutreachFilters';
import { PatternsCard } from '@/components/outreach/PatternsCard';
import { PrimeList } from '@/components/outreach/PrimeList';
import { PulseBar } from '@/components/PulseBar';
import { ReminderSheet } from '@/components/reminders/ReminderSheet';
import { Button, Collapsible, EmptyState, FullPageLoader, PageTitle, Segmented } from '@/components/ui';
import { useOffers } from '@/hooks/useOffers';
import {
  applyOutreachFilters,
  EMPTY_FILTERS,
  nicheOptions,
  type OutreachFilters as Filters,
} from '@/lib/outreach-filter';
import {
  CALL_STATUSES,
  normalizeStatus,
  REPLIED_STATUSES,
  SENT_STATUSES,
  type ContactStatus,
  type Offer,
  type OutreachContact,
} from '@/lib/types';
import { FEATURE_LEVEL } from '@/lib/xp';

type Tab = 'contacts' | 'offers';
type ViewMode = 'cards' | 'table';

/** По сколько строк подгружается список при нажатии «показать ещё». */
const PAGE_SIZE = 15;

export default function OutreachPage() {
  const { t, tf } = useLanguage();
  const app = useApp();
  const offersApi = useOffers();

  const [tab, setTab] = useState<Tab>('contacts');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>('cards');
  const [fullscreen, setFullscreen] = useState(false);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openContact, setOpenContact] = useState<OutreachContact | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [openOffer, setOpenOffer] = useState<Offer | null>(null);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderContactId, setReminderContactId] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatContactId, setChatContactId] = useState<string | null>(null);

  const canOffers = app.can('offers');
  const canNiches = app.can('niches');
  const canSpeed = app.can('speed');
  const canPrime = app.can('prime');
  const canHourly = app.can('hourly');

  /* ------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const contacts = app.contacts;
    return {
      sent: contacts.filter((c) => SENT_STATUSES.includes(c.status)).length,
      replied: contacts.filter((c) => REPLIED_STATUSES.includes(c.status)).length,
      calls: contacts.filter((c) => CALL_STATUSES.includes(c.status)).length,
      closed: contacts.filter((c) => c.status === 'closed').length,
    };
  }, [app.contacts]);

  const visible = useMemo(
    () =>
      applyOutreachFilters({
        contacts: app.contacts,
        query,
        filters,
        today: app.today,
      }),
    [app.contacts, query, filters, app.today],
  );

  const niches = useMemo(() => nicheOptions(app.contacts), [app.contacts]);

  // Контакт для шторки переписки берётся из списка по id, а не хранится
  // копией: после сохранения список обновляется, и снимок стал бы устаревшим.
  const chatContact = useMemo(
    () => app.contacts.find((contact) => contact.id === chatContactId) ?? null,
    [app.contacts, chatContactId],
  );

  // Список режется по limit: 25+ карточек отодвигали аналитику далеко вниз.
  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);

  const visibleOffers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return offersApi.offers;
    return offersApi.offers.filter(
      (o) => o.title.toLowerCase().includes(needle) || o.content.toLowerCase().includes(needle),
    );
  }, [offersApi.offers, query]);

  /** Вход для разбора паттернов: текст оффера + исход. */
  const patternSamples = useMemo(
    () =>
      offersApi.offers
        .filter((offer) => (offer.content ?? '').trim().length > 0)
        .map((offer) => ({ content: offer.content, result: normalizeStatus(offer.result) })),
    [offersApi.offers],
  );

  if (app.loading || !app.profile) return <FullPageLoader />;

  /* ------------------------------------------------------------------ */

  async function saveContact(draft: ContactDraft) {
    if (openContact) {
      await app.updateContact(openContact.id, {
        name: draft.name,
        niche: draft.niche || null,
        telegram_handle: draft.telegram_handle || null,
        instagram_url: draft.instagram_url || null,
        comment: draft.comment || null,
        next_step: draft.next_step || null,
        first_contact_date: draft.first_contact_date,
      });
      if (draft.status !== openContact.status) {
        await app.setStatus(openContact, draft.status);
      }
    } else {
      const created = await app.addContact(draft);
      if (created) {
        setHighlightId(created.id);
        setTimeout(() => setHighlightId(null), 1400);
      }
    }
    setSheetOpen(false);
    setOpenContact(null);
  }

  function openForContact(contact: OutreachContact) {
    setOpenContact(contact);
    setSheetOpen(true);
  }

  /** Тап по уровню воронки — это фильтр по статусу, а не отдельный режим. */
  function filterByFunnel(target: FunnelTarget) {
    setLimit(PAGE_SIZE);
    if (target === 'all') {
      setFilters((current) => ({ ...current, statuses: [] }));
      return;
    }
    const group: Record<string, ContactStatus[]> = {
      replied: ['replied', 'replied_no', 'call', 'closed'],
      call: ['call', 'closed'],
      closed: ['closed'],
    };
    setFilters((current) => ({ ...current, statuses: group[target] ?? [target as ContactStatus] }));
  }

  const body = (
    <>
      {/* Быстрый ввод и кнопка новой рассылки — всегда наверху. */}
      <div className="flex gap-2">
        <Button
          full
          onClick={() => {
            setOpenContact(null);
            setSheetOpen(true);
          }}
        >
          <Plus size={18} />
          {t.outreach.newOutreach}
        </Button>

        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? t.outreach.exitFullscreen : t.outreach.fullscreen}
          className="btn-ghost hidden w-14 shrink-0 md:flex"
        >
          {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Воронка */}
      <FunnelChart
        sent={stats.sent}
        replied={stats.replied}
        calls={stats.calls}
        closed={stats.closed}
        onLevelClick={filterByFunnel}
      />

      {/* Кому написать сегодня — рабочий список, выше таблицы */}
      <FollowUpList
        contacts={app.contacts}
        reminders={app.reminders}
        today={app.today}
        now={app.now}
        onTouch={(c) => void app.touchContact(c)}
        onMute={(id, muted) => void app.muteContact(id, muted)}
        onOpen={openForContact}
        onCompleteReminder={(id) => void app.toggleReminder(id)}
      />

      {/* Квота дня */}
      <GlassCard delay={2}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-sm font-bold">
            {t.common.today}{' '}
            <span className={app.quota.closed ? 'text-success' : 'text-white'}>
              {app.quota.sent}
            </span>
            <span className="text-white/35"> / {app.quota.quota}</span>
          </p>
          <span className="text-xs text-white/35">
            {t.home.record}: {app.quota.record}
          </span>
        </div>
        <PulseBar pct={app.quota.pct} color={app.quota.closed ? '#64FF8C' : '#FFFFFF'} />
      </GlassCard>

      {/*
        Аналитика стоит ВЫШЕ списка экспертов намеренно. Список растёт
        бесконечно, аналитика — нет; если оставить её внизу, то на тридцатом
        контакте до неё уже никто не долистает.
      */}
      {canNiches ? (
        <NicheAnalytics contacts={app.contacts} />
      ) : (
        <LockedFeature featureKey="niches" requiredLevel={FEATURE_LEVEL.niches} />
      )}

      {canPrime && (
        <PrimeList contacts={app.contacts} today={app.today} onOpen={openForContact} />
      )}

      {canHourly && <HourlyCard contacts={app.contacts} />}

      {/* Поиск */}
      <label className="relative block">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder={t.outreach.searchPh}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="field pl-11 pr-11"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t.common.reset}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/35 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </label>

      <OutreachFilters
        filters={filters}
        onChange={(next) => {
          setFilters(next);
          setLimit(PAGE_SIZE);
        }}
        niches={niches}
      />

      {/*
        Список экспертов — сворачивается целиком.

        Контейнер намеренно не .glass: внутри лежат стеклянные карточки
        контактов и таблица со стеклянной шапкой, а вложенный backdrop-filter
        в Safari на iOS схлопывается в непрозрачный белый прямоугольник.
        Рамка и еле заметный фон дают ту же группировку без blur.
      */}
      <div className="rounded-glass border border-glass-border bg-white/[0.025] p-4">
        <Collapsible
          storageKey="rodion.outreach.list"
          defaultOpen
          title={t.outreach.listTitle}
          right={
            <span className="shrink-0 text-xs tabular-nums text-white/35">
              {tf(t.outreach.listShown, { shown: shown.length, total: visible.length })}
            </span>
          }
        >
          <div className="space-y-3">
            <Segmented<ViewMode>
              value={view}
              onChange={setView}
              options={[
                { value: 'cards', label: t.outreach.viewCards },
                { value: 'table', label: t.outreach.viewTable },
              ]}
            />

            {visible.length === 0 ? (
              <EmptyState
                text={app.contacts.length === 0 ? t.outreach.empty : t.outreach.emptyFiltered}
              />
            ) : view === 'table' ? (
              <ContactTable
                contacts={shown}
                onOpenContact={openForContact}
                onStatusChange={(c, s) => void app.setStatus(c, s)}
                onInlineAdd={(draft) => void saveContact(draft)}
                highlightId={highlightId}
                showSpeed={canSpeed}
                showNextStep={canSpeed}
                sort={sort}
                onSortChange={setSort}
              />
            ) : (
              <ContactCards
                contacts={shown}
                onOpenContact={openForContact}
                highlightId={highlightId}
              />
            )}

            {visible.length > shown.length && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="btn-ghost w-full text-sm font-bold"
              >
                <ChevronDown size={16} />
                {tf(t.outreach.listExpand, {
                  n: Math.min(PAGE_SIZE, visible.length - shown.length),
                })}
              </button>
            )}

            {limit > PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setLimit(PAGE_SIZE)}
                className="min-h-[44px] w-full text-sm font-semibold text-white/35 transition-colors hover:text-white"
              >
                {t.outreach.listCollapseAll}
              </button>
            )}
          </div>
        </Collapsible>
      </div>
    </>
  );

  return (
    <div
      /* В полноэкранном режиме контент всё равно держим в рамках: таблица
         на всю ширину монитора читается хуже, глаз теряет строку. */
      className={
        fullscreen
          ? 'fixed inset-0 z-50 mx-auto max-w-6xl space-y-4 overflow-y-auto bg-ink px-6 py-6'
          : 'space-y-4'
      }
    >
      <PageTitle>{t.outreach.title}</PageTitle>

      {/* Вкладки: библиотека офферов открывается со 2-го уровня. */}
      <div className="flex rounded-2xl bg-white/[0.05] p-1">
        {(
          [
            { key: 'contacts', label: t.outreach.tabContacts },
            { key: 'offers', label: t.outreach.tabOffers },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setQuery('');
            }}
            className="relative min-h-[44px] flex-1 rounded-xl text-sm font-bold"
          >
            {tab === item.key && (
              <motion.span
                layoutId="outreach-tab"
                className="absolute inset-0 rounded-xl bg-white"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${tab === item.key ? 'text-ink' : 'text-white/50'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {tab === 'contacts' ? (
        body
      ) : canOffers ? (
        <>
          <Button
            full
            onClick={() => {
              setOpenOffer(null);
              setOfferSheetOpen(true);
            }}
          >
            <Plus size={18} />
            {t.offers.addTitle}
          </Button>

          {/* Разбор стоит над библиотекой: смысл вкладки не в том, чтобы
              хранить тексты, а в том, чтобы понимать, какие работают.
              Порядок внутри — от вывода к данным: сначала «что писать»,
              потом «почему именно так», потом сами цифры. */}
          <BlueprintCard samples={patternSamples} />
          <PatternsCard samples={patternSamples} />
          {app.conversationsReady && <DialogueCard contacts={app.contacts} />}

          {visibleOffers.length === 0 ? (
            <EmptyState text={t.offers.empty} />
          ) : (
            <div className="space-y-2">
              {visibleOffers.map((offer, i) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={i}
                  onOpen={() => {
                    setOpenOffer(offer);
                    setOfferSheetOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <LockedFeature featureKey="offers" requiredLevel={FEATURE_LEVEL.offers} />
      )}

      <ContactSheet
        contact={openContact}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setOpenContact(null);
        }}
        onSave={saveContact}
        onDelete={(id) => {
          void app.deleteContact(id);
          setSheetOpen(false);
          setOpenContact(null);
        }}
        onSaveToOffers={(contact) =>
          offersApi.saveFromContact({
            title: contact.name,
            niche: contact.niche,
            content: contact.comment ?? '',
          })
        }
        onAddReminder={
          app.remindersReady
            ? (contact) => {
                setReminderContactId(contact.id);
                setSheetOpen(false);
                setReminderOpen(true);
              }
            : undefined
        }
        onOpenConversation={
          app.conversationsReady
            ? (contact) => {
                setChatContactId(contact.id);
                setSheetOpen(false);
                setChatOpen(true);
              }
            : undefined
        }
        canSaveToOffers={canOffers}
        showNextStep={canSpeed}
      />

      {/* id не сбрасывается на закрытии: пока шторка уезжает вниз, ей нужен
          контакт, иначе на прощание мигает пустой заголовок. */}
      <ConversationSheet
        contact={chatContact}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onSave={(id, messages) => app.saveConversation(id, messages)}
      />

      <ReminderSheet
        open={reminderOpen}
        reminder={null}
        contacts={app.contacts}
        presetContactId={reminderContactId}
        onClose={() => {
          setReminderOpen(false);
          setReminderContactId(null);
        }}
        onSave={async (draft) => {
          await app.addReminder(draft);
        }}
      />

      <OfferSheet
        open={offerSheetOpen}
        offer={openOffer}
        contacts={app.contacts}
        onClose={() => {
          setOfferSheetOpen(false);
          setOpenOffer(null);
        }}
        onSave={(draft: OfferDraft, id) => offersApi.save(draft, id)}
        onDelete={offersApi.remove}
      />
    </div>
  );
}
