'use client';

import { ChevronDown, Maximize2, Minimize2, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { GlassCard } from '@/components/GlassCard';
import { ShieldCard } from '@/components/guard/ShieldCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { ContactCards } from '@/components/outreach/ContactCards';
import { ContactSheet, type ContactDraft } from '@/components/outreach/ContactSheet';
import { ContactTable, type TableSort } from '@/components/outreach/ContactTable';
import { ForecastCard } from '@/components/outreach/ForecastCard';
import { FollowUpList } from '@/components/outreach/FollowUpList';
import { FunnelChart, type FunnelTarget } from '@/components/outreach/FunnelChart';
import { LeadIntake } from '@/components/outreach/LeadIntake';
import { LeadList } from '@/components/outreach/LeadList';
import { OfferBoard } from '@/components/outreach/OfferBoard';
import { SentToday } from '@/components/outreach/SentToday';
import { HourlyCard } from '@/components/outreach/HourlyCard';
import { NicheAnalytics } from '@/components/outreach/NicheAnalytics';
import { OutreachFilters } from '@/components/outreach/OutreachFilters';
import { PrimeList } from '@/components/outreach/PrimeList';
import { PulseBar } from '@/components/PulseBar';
import { SprintPicker } from '@/components/session/SprintPicker';
import { useFocusSession } from '@/components/session/SessionProvider';
import { ReminderSheet } from '@/components/reminders/ReminderSheet';
import {
  Button,
  Collapsible,
  DeskColumns,
  EmptyState,
  FullPageLoader,
  PageTitle,
  Segmented,
} from '@/components/ui';
import { useSnippets } from '@/hooks/useSnippets';
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
  type OutreachContact,
} from '@/lib/types';
import { FEATURE_LEVEL } from '@/lib/xp';

type ViewMode = 'cards' | 'table';

/** По сколько строк подгружается список при нажатии «показать ещё». */
const PAGE_SIZE = 15;

/**
 * Рассылки — одна страница вместо трёх вкладок.
 *
 * Вкладки делили один заход на куски: собрал базу — переключился, написал —
 * переключился посмотреть человека, вернулся. Каждое переключение сбрасывало
 * место в списке и стоило внимания, а за один заход их набиралось сорок.
 *
 * Теперь сверху вниз идёт ровно тот порядок, в котором всё и происходит:
 * пополнить базу → пройти по ней → посмотреть, кому написал сегодня →
 * дожать тех, кто молчит → покопаться в общем списке. Цифры стоят сбоку и
 * не двигаются.
 */
export default function OutreachPage() {
  const { t, tf } = useLanguage();
  const app = useApp();

  const snippets = useSnippets();
  const focus = useFocusSession();
  /*
   * Выбранный оффер живёт на странице, а не в панели: копируют его и из
   * панели, и из каждой строки базы, и это обязан быть один и тот же текст.
   */
  const [offerId, setOfferId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<ViewMode>('cards');
  const [fullscreen, setFullscreen] = useState(false);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openContact, setOpenContact] = useState<OutreachContact | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderContactId, setReminderContactId] = useState<string | null>(null);

  const canNiches = app.can('niches');
  const canSpeed = app.can('speed');
  const canPrime = app.can('prime');
  const canHourly = app.can('hourly');
  const canOwnOffer = app.can('ownOffer');

  /* ------------------------------------------------------------------ */

  // Воронка считает только написанных: собранная база — это ещё не рассылка,
  // и попадать в «Отправлено» она не должна.
  const stats = useMemo(() => {
    const contacts = app.contacts;
    return {
      sent: contacts.filter((c) => SENT_STATUSES.includes(c.status)).length,
      replied: contacts.filter((c) => REPLIED_STATUSES.includes(c.status)).length,
      calls: contacts.filter((c) => CALL_STATUSES.includes(c.status)).length,
      closed: contacts.filter((c) => c.status === 'closed').length,
    };
  }, [app.contacts]);

  /**
   * База — контакты со статусом «ещё не написал».
   *
   * Отдельной таблицы у неё нет: статус not_sent был в шкале с самого
   * начала, и человек уходит из базы в общий список ровно тем, что ему
   * написали. Никакого переноса строк между сущностями.
   */
  const leads = useMemo(
    () => app.contacts.filter((c) => normalizeStatus(c.status) === 'not_sent'),
    [app.contacts],
  );

  /** Написанные: всё, что уже дошло до адресата. Базы здесь быть не должно. */
  const written = useMemo(
    () => app.contacts.filter((c) => normalizeStatus(c.status) !== 'not_sent'),
    [app.contacts],
  );

  /**
   * Написанные сегодня — те, к кому ещё вернутся в ближайший час.
   *
   * Порядок обратный порядку списка: последний написанный сверху, потому
   * что именно он ещё в голове.
   */
  const sentToday = useMemo(
    () =>
      written
        .filter((c) => c.first_contact_date === app.today)
        .slice()
        .reverse(),
    [written, app.today],
  );

  /** Ники, которые уже заведены: по ним отсеиваются повторы при вставке. */
  const knownHandles = useMemo(
    () =>
      app.contacts
        .map((c) => c.instagram_url || c.name)
        .filter((value): value is string => Boolean(value)),
    [app.contacts],
  );

  /** Список отсортирован по частоте — по умолчанию берём самый рабочий. */
  const activeOffer = useMemo(
    () => snippets.snippets.find((s) => s.id === offerId) ?? snippets.snippets[0] ?? null,
    [snippets.snippets, offerId],
  );

  const visible = useMemo(
    () =>
      applyOutreachFilters({
        contacts: written,
        query,
        filters,
        today: app.today,
      }),
    [written, query, filters, app.today],
  );

  const niches = useMemo(() => nicheOptions(app.contacts), [app.contacts]);

  // Список режется по limit: 25+ карточек отодвигали аналитику далеко вниз.
  const shown = useMemo(() => visible.slice(0, limit), [visible, limit]);

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

  /*
   * Правая колонка: то, на что смотрят, а не то, чем работают.
   *
   * Оффер стоит первым и остаётся на виду, пока листаешь базу, — он нужен
   * на каждом человеке. Ниже цифры в порядке важности: воронка за всё время,
   * цена созвона и закрытия, страховка серии, разбор по нишам.
   */
  const side = (
    <>
      <OfferBoard
        snippets={snippets.snippets}
        active={activeOffer}
        onPick={setOfferId}
        onUse={(id) => void snippets.use(id)}
        delay={2}
      />

      <FunnelChart
        sent={stats.sent}
        replied={stats.replied}
        calls={stats.calls}
        closed={stats.closed}
        onLevelClick={filterByFunnel}
      />

      {/* Цена события в рассылках: воронка говорит «сколько уже»,
          эта карточка — «сколько ещё». */}
      <ForecastCard contacts={written} delay={4} />

      {/*
        Страховка серии — под цифрами дня. Решение «сегодня не вытяну»
        принимается после того, как посмотрел на квоту и на остаток, а не
        первым делом при заходе на страницу.
      */}
      <ShieldCard
        guard={app.guard}
        sent={app.quota.sent}
        quota={app.quota.quota}
        streak={app.quota.streak}
        onArm={() => void app.armShield()}
        onDisarm={() => void app.disarmShield()}
        onPause={(on) => void app.setPause(on)}
        onAuto={(value) => void app.setShieldAuto(value)}
        delay={3}
      />

      {canNiches ? (
        <NicheAnalytics contacts={written} />
      ) : (
        <LockedFeature featureKey="niches" requiredLevel={FEATURE_LEVEL.niches} />
      )}

      {canPrime && <PrimeList contacts={written} today={app.today} onOpen={openForContact} />}

      {canHourly && <HourlyCard contacts={written} />}
    </>
  );

  /*
   * Левая колонка — весь заход сверху вниз, в порядке действий.
   */
  const main = (
    <>
      {/* 1. Пополнить базу. Свёрнуто, пока в базе есть люди. */}
      <LeadIntake known={knownHandles} leadCount={leads.length} onAdd={app.addLeads} />

      {/* 2. Пройти по базе — главная работа страницы. */}
      <LeadList
        leads={leads}
        offer={activeOffer}
        onPatch={(id, patch) => void app.updateContact(id, patch)}
        onSent={(lead, offerText) => void app.markSent(lead, offerText)}
        onDrop={(id) => void app.deleteContact(id)}
        onUseOffer={() => activeOffer && void snippets.use(activeOffer.id)}
        canOwnOffer={canOwnOffer}
        delay={1}
      />

      {/* 3. Кому написал сегодня — ссылки и статус под рукой, чтобы после
             «Написал» не уходить искать человека в общем списке. */}
      <SentToday
        contacts={sentToday}
        onOpen={openForContact}
        onStatus={(contact, status) => void app.setStatus(contact, status)}
        delay={2}
      />

      {/* 4. Кого дожать — те, кто молчит дольше положенного. */}
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

      {/* 5. Общий список — сюда лезут по делу, поэтому он ниже всего и
             сворачивается целиком. */}
      <div className="rounded-glass border border-glass-border bg-white/[0.025] p-4">
        {/*
          Контейнер намеренно не .glass: внутри лежат стеклянные карточки
          контактов и таблица со стеклянной шапкой, а вложенный backdrop-filter
          в Safari на iOS схлопывается в непрозрачный белый прямоугольник.
        */}
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
                text={written.length === 0 ? t.outreach.empty : t.outreach.emptyFiltered}
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

      {/*
        Квота — над колонками, во всю ширину.

        Раньше она лежала в правой колонке и на телефоне уезжала либо выше
        всей работы, либо ниже неё. Это единственное число, которое нужно
        видеть постоянно, поэтому у него своё место, не зависящее от того,
        как схлопнулись колонки.
      */}
      <GlassCard delay={0}>
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
        Кнопка стоит НАД колонками: добавить рассылку — главное действие
        страницы, и оно обязано быть под рукой сразу. На мониторе она не
        тянется во всю ширину — белая полоса в 1200px весит больше, чем
        действие.
      */}
      <div className="flex gap-2">
        <Button
          full
          className="lg:w-auto lg:flex-none lg:px-8"
          onClick={() => {
            setOpenContact(null);
            setSheetOpen(true);
          }}
        >
          <Plus size={18} />
          {t.outreach.newOutreach}
        </Button>

        {/* Спринт — маленькая кнопка рядом с главным действием: заход
            начинают ровно перед тем, как сесть писать. */}
        <SprintPicker
          recordCount={app.profile?.sprint_record ?? 0}
          recordMinutes={app.profile?.sprint_record_minutes ?? 0}
          running={Boolean(focus.session)}
          onStart={(minutes) =>
            focus.start({
              kind: 'outreach',
              label: t.outreach.title,
              minutes,
              sentAtStart: app.quota.sent,
            })
          }
        />

        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? t.outreach.exitFullscreen : t.outreach.fullscreen}
          className="btn-ghost hidden w-14 shrink-0 md:flex"
        >
          {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* stickySide: работа слева длинная, и оффер с цифрами обязаны
          оставаться на виду, пока её листаешь. */}
      <DeskColumns stickySide main={main} side={side} />

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
        onAddReminder={
          app.remindersReady
            ? (contact) => {
                setReminderContactId(contact.id);
                setSheetOpen(false);
                setReminderOpen(true);
              }
            : undefined
        }
        showNextStep={canSpeed}
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
    </div>
  );
}
