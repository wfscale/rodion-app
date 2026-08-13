'use client';

import { motion } from 'framer-motion';
import { Maximize2, Minimize2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { LockedFeature } from '@/components/LockedFeature';
import { OfferCard } from '@/components/OfferCard';
import { OfferSheet, type OfferDraft } from '@/components/OfferSheet';
import { ContactCards } from '@/components/outreach/ContactCards';
import { ContactSheet, type ContactDraft } from '@/components/outreach/ContactSheet';
import { ContactTable, type TableSort } from '@/components/outreach/ContactTable';
import { FollowUpList } from '@/components/outreach/FollowUpList';
import { FunnelChart, type FunnelTarget } from '@/components/outreach/FunnelChart';
import { PulseBar } from '@/components/PulseBar';
import { Button, EmptyState, FilterChips, FullPageLoader, PageTitle, Segmented } from '@/components/ui';
import { useOffers } from '@/hooks/useOffers';
import {
  CALL_STATUSES,
  REPLIED_STATUSES,
  SENT_STATUSES,
  type ContactStatus,
  type Offer,
  type OutreachContact,
} from '@/lib/types';
import { FEATURE_LEVEL, unlocked } from '@/lib/xp';

type Tab = 'contacts' | 'offers';
type StatusFilter = ContactStatus | 'all' | 'rejected';
type ViewMode = 'cards' | 'table';

export default function OutreachPage() {
  const { t, tf } = useLanguage();
  const app = useApp();
  const offersApi = useOffers();

  const [tab, setTab] = useState<Tab>('contacts');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('cards');
  const [fullscreen, setFullscreen] = useState(false);
  const [sort, setSort] = useState<TableSort | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openContact, setOpenContact] = useState<OutreachContact | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [openOffer, setOpenOffer] = useState<Offer | null>(null);

  const level = app.levelInfo.level;
  const canOffers = unlocked('offers', level);
  const canNiches = unlocked('niches', level);
  const canSpeed = unlocked('speed', level);

  /* ------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const contacts = app.contacts;
    const sent = contacts.filter((c) => SENT_STATUSES.includes(c.status)).length;
    const replied = contacts.filter((c) => REPLIED_STATUSES.includes(c.status)).length;
    const calls = contacts.filter((c) => CALL_STATUSES.includes(c.status)).length;
    const closed = contacts.filter((c) => c.status === 'closed').length;
    return { sent, replied, calls, closed };
  }, [app.contacts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return app.contacts.filter((c) => {
      if (filter === 'rejected') {
        if (c.status !== 'refused') return false;
      } else if (filter !== 'all' && c.status !== filter) {
        return false;
      }
      if (needle && !c.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [app.contacts, filter, query]);

  /** Разбор по нишам — открывается на 3-м уровне. Ниша свободная, поэтому
   *  группируем по нормализованному ключу, а показываем исходное написание. */
  const nicheRows = useMemo(() => {
    const map = new Map<string, { label: string; sent: number; replied: number }>();

    for (const c of app.contacts) {
      const label = (c.niche ?? '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const row = map.get(key) ?? { label, sent: 0, replied: 0 };
      if (SENT_STATUSES.includes(c.status)) row.sent += 1;
      if (REPLIED_STATUSES.includes(c.status)) row.replied += 1;
      map.set(key, row);
    }

    return Array.from(map.values())
      .filter((r) => r.sent > 0)
      .map((r) => ({ ...r, rate: Math.round((r.replied / r.sent) * 100) }))
      .sort((a, b) => b.rate - a.rate || b.sent - a.sent);
  }, [app.contacts]);

  const visibleOffers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return offersApi.offers;
    return offersApi.offers.filter(
      (o) => o.title.toLowerCase().includes(needle) || o.content.toLowerCase().includes(needle),
    );
  }, [offersApi.offers, query]);

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

  const funnelHint =
    stats.replied === 0
      ? t.outreach.hintNoReplies
      : stats.replied / Math.max(1, stats.sent) > 0.1
        ? t.outreach.hintAboveAverage
        : tf(t.outreach.hintNextReply, { n: Math.round(stats.sent / stats.replied) });

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
      <GlassCard delay={1}>
        <FunnelChart
          sent={stats.sent}
          replied={stats.replied}
          calls={stats.calls}
          closed={stats.closed}
          onLevelClick={(target: FunnelTarget) => setFilter(target as StatusFilter)}
        />
        <p className="mt-3 text-center text-sm text-muted">{funnelHint}</p>
      </GlassCard>

      {/* Кому написать сегодня — рабочий список, выше таблицы */}
      <FollowUpList
        contacts={app.contacts}
        today={app.today}
        onTouch={(c) => void app.touchContact(c)}
        onMute={(id, muted) => void app.muteContact(id, muted)}
        onOpen={(c) => {
          setOpenContact(c);
          setSheetOpen(true);
        }}
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

      {/* Поиск */}
      <label className="relative block">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.outreach.searchPh}
          className="field pl-11"
        />
      </label>

      <FilterChips<StatusFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t.common.all, count: app.contacts.length },
          { value: 'sent', label: t.statuses.sent },
          { value: 'replied', label: t.statuses.replied },
          { value: 'call', label: t.statuses.call },
          { value: 'closed', label: t.statuses.closed },
          { value: 'rejected', label: t.outreach.filterIgnored },
        ]}
      />

      {/* Переключатель вида */}
      <Segmented<ViewMode>
        value={view}
        onChange={setView}
        options={[
          { value: 'cards', label: t.outreach.viewCards },
          { value: 'table', label: t.outreach.viewTable },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState text={app.contacts.length === 0 ? t.outreach.empty : t.outreach.emptyFiltered} />
      ) : view === 'table' ? (
        <ContactTable
          contacts={visible}
          onOpenContact={(c) => {
            setOpenContact(c);
            setSheetOpen(true);
          }}
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
          contacts={visible}
          onOpenContact={(c) => {
            setOpenContact(c);
            setSheetOpen(true);
          }}
          highlightId={highlightId}
        />
      )}

      {/* Аналитика по нишам — 3-й уровень */}
      {canNiches ? (
        <GlassCard delay={3}>
          <CardTitle>{t.offers.analytics}</CardTitle>
          {nicheRows.length === 0 ? (
            <p className="py-3 text-sm text-muted">{t.offers.analyticsEmpty}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-white/35">
                  <th className="pb-2 font-semibold">{t.offers.colNiche}</th>
                  <th className="pb-2 text-center font-semibold">{t.offers.colSent}</th>
                  <th className="pb-2 text-center font-semibold">{t.offers.colReplied}</th>
                  <th className="pb-2 text-right font-semibold">{t.offers.colRate}</th>
                </tr>
              </thead>
              <tbody>
                {nicheRows.map((row) => (
                  <tr key={row.label} className="border-t border-divider">
                    <td className="py-2.5 text-sm">{row.label}</td>
                    <td className="py-2.5 text-center text-sm text-white/60">{row.sent}</td>
                    <td className="py-2.5 text-center text-sm text-white/60">{row.replied}</td>
                    <td className="py-2.5 text-right text-sm font-extrabold">{row.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCard>
      ) : (
        <LockedFeature featureKey="niches" requiredLevel={FEATURE_LEVEL.niches} />
      )}
    </>
  );

  return (
    <div
      className={
        fullscreen ? 'fixed inset-0 z-50 space-y-4 overflow-y-auto bg-ink p-4' : 'space-y-4'
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
        canSaveToOffers={canOffers}
        showNextStep={canSpeed}
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
