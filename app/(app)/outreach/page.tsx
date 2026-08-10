'use client';

import { motion } from 'framer-motion';
import { Search, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { ContactCard } from '@/components/ContactCard';
import { AddContactSheet, ContactSheet } from '@/components/ContactSheet';
import { FocusTimer } from '@/components/FocusTimer';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { OfferCard } from '@/components/OfferCard';
import { OfferSheet, type OfferDraft } from '@/components/OfferSheet';
import { EmptyState, Fab, FilterChips, FullPageLoader, PageTitle, Spinner } from '@/components/ui';
import { ProgressBar } from '@/components/XpBar';
import { useDaily } from '@/hooks/useDaily';
import { useOutreach } from '@/hooks/useOutreach';
import { CONTACT_STATUSES, NICHES, type ContactStatus, type Niche, type Offer, type OutreachContact } from '@/lib/types';
import { featureUnlocked } from '@/lib/unlocks';
import { onceKey, XP } from '@/lib/xp';

type Tab = 'contacts' | 'offers';
type StatusFilter = ContactStatus | 'all';

export default function OutreachPage() {
  const { t, tf } = useLanguage();
  const { profile, loading: appLoading, unlockLevel, awardXp, today } = useApp();
  const outreach = useOutreach();
  const daily = useDaily();

  const [tab, setTab] = useState<Tab>('contacts');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const [addingContact, setAddingContact] = useState(false);
  const [openContact, setOpenContact] = useState<OutreachContact | null>(null);

  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [openOffer, setOpenOffer] = useState<Offer | null>(null);

  const goalAwarded = useRef(false);

  const dailyGoal = profile?.daily_goal ?? 10;
  const goalReached = outreach.sentToday >= dailyGoal;

  // Дневная цель взята: разовый бонус + отметка задачи в чеклисте главной.
  useEffect(() => {
    if (!goalReached || goalAwarded.current || outreach.loading) return;
    goalAwarded.current = true;

    void (async () => {
      await awardXp(XP.DAILY_GOAL, 'dailyGoal', onceKey.dailyGoal(today));
      await daily.markTaskDone('outreach');
    })();
  }, [goalReached, outreach.loading, awardXp, today, daily]);

  /* ------------------------------------------------------------------ */
  /*  Фильтрация                                                         */
  /* ------------------------------------------------------------------ */

  const visibleContacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return outreach.contacts.filter((contact) => {
      if (filter !== 'all' && contact.status !== filter) return false;
      if (needle && !contact.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [outreach.contacts, filter, query]);

  const visibleOffers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return outreach.offers;
    return outreach.offers.filter(
      (offer) =>
        offer.title.toLowerCase().includes(needle) ||
        offer.content.toLowerCase().includes(needle),
    );
  }, [outreach.offers, query]);

  /** Разбор офферов по нишам: сколько отправлено и какая доля ответов. */
  const offerAnalytics = useMemo(() => {
    const rows = NICHES.map((niche) => {
      const inNiche = outreach.offers.filter((offer) => offer.niche === niche);
      const sent = inNiche.filter((offer) => offer.result !== 'not_sent');
      const replied = inNiche.filter((offer) =>
        ['replied', 'call', 'closed'].includes(offer.result),
      );

      return {
        niche: niche as Niche,
        total: inNiche.length,
        sent: sent.length,
        replyRate: sent.length ? Math.round((replied.length / sent.length) * 100) : 0,
      };
    }).filter((row) => row.total > 0);

    return rows.sort((a, b) => b.replyRate - a.replyRate || b.total - a.total);
  }, [outreach.offers]);

  if (appLoading || !profile) return <FullPageLoader />;

  const showFunnel = featureUnlocked.funnelStats(unlockLevel);
  const showFocus = featureUnlocked.focusMode(unlockLevel);

  async function handleSaveOffer(draft: OfferDraft, id: string | null) {
    if (id) await outreach.updateOffer(id, draft);
    else await outreach.addOffer(draft);
  }

  return (
    <div className="space-y-4">
      <PageTitle>{t.outreach.title}</PageTitle>

      {/* Вкладки */}
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
        <>
          {/* Статистика воронки */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: outreach.stats.sent, label: t.outreach.statSent },
              { value: outreach.stats.replied, label: t.outreach.statReplied },
              { value: outreach.stats.calls, label: t.outreach.statCall },
              { value: outreach.stats.closed, label: t.outreach.statClosed },
            ].map((cell, i) => (
              <motion.div
                key={cell.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass px-2 py-3 text-center"
              >
                <p className="text-xl font-extrabold">{cell.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/40">{cell.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Конверсия — разблокировка недели 2 */}
          {showFunnel && outreach.stats.sent > 0 && (
            <p className="text-center text-sm text-muted">
              {outreach.stats.replyRate}% {t.outreach.convReply} · {outreach.stats.callRate}%{' '}
              {t.outreach.convCall}
            </p>
          )}

          {/* Дневная цель */}
          <GlassCard delay={1}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold">
                {t.outreach.dailyGoal}{' '}
                <span className={goalReached ? 'text-success' : 'text-white'}>
                  {outreach.sentToday}
                </span>
                <span className="text-white/35"> / {dailyGoal}</span>
              </p>

              {goalReached && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-extrabold text-success"
                >
                  +{XP.DAILY_GOAL} XP · {t.outreach.goalReached}
                </motion.span>
              )}
            </div>

            <ProgressBar
              pct={(outreach.sentToday / dailyGoal) * 100}
              color={goalReached ? '#64FF8C' : '#FFFFFF'}
            />
          </GlassCard>

          {/* Режим фокуса — разблокировка недели 3 */}
          {showFocus && <FocusTimer today={today} />}

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

          {/* Фильтры статусов */}
          <FilterChips<StatusFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t.common.all, count: outreach.contacts.length },
              ...CONTACT_STATUSES.map((status) => ({
                value: status as StatusFilter,
                label: t.statuses[status],
                count: outreach.statusCounts[status] ?? 0,
              })),
            ]}
          />

          {/* Список */}
          {outreach.loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visibleContacts.length === 0 ? (
            <EmptyState
              icon={<Send size={34} />}
              text={
                outreach.contacts.length === 0 ? t.outreach.empty : t.outreach.emptyFiltered
              }
            />
          ) : (
            <div className="space-y-2">
              {visibleContacts.map((contact, i) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  index={i}
                  onOpen={() => setOpenContact(contact)}
                />
              ))}
            </div>
          )}

          <Fab onClick={() => setAddingContact(true)} label={t.outreach.addTitle} />
        </>
      ) : (
        <>
          {/* Поиск по офферам */}
          <label className="relative block">
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.notes.searchPh}
              className="field pl-11"
            />
          </label>

          {outreach.loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visibleOffers.length === 0 ? (
            <EmptyState icon={<Sparkles size={34} />} text={t.offers.empty} />
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

          {/* Аналитика по нишам */}
          <GlassCard delay={2}>
            <CardTitle>{t.offers.analytics}</CardTitle>

            {offerAnalytics.length === 0 ? (
              <p className="py-3 text-sm text-muted">{t.offers.analyticsEmpty}</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-white/35">
                    <th className="pb-2 font-semibold">{t.offers.colNiche}</th>
                    <th className="pb-2 text-center font-semibold">{t.offers.colCount}</th>
                    <th className="pb-2 text-right font-semibold">{t.offers.colReply}</th>
                  </tr>
                </thead>
                <tbody>
                  {offerAnalytics.map((row) => (
                    <tr key={row.niche} className="border-t border-divider">
                      <td className="py-2.5 text-sm">{t.niches[row.niche]}</td>
                      <td className="py-2.5 text-center text-sm text-white/60">
                        {row.total}
                        <span className="text-white/25"> · {row.sent} {t.offers.sentCount}</span>
                      </td>
                      <td className="py-2.5 text-right text-sm font-extrabold">
                        {row.replyRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassCard>

          <Fab
            onClick={() => {
              setOpenOffer(null);
              setOfferSheetOpen(true);
            }}
            label={t.offers.addTitle}
          />
        </>
      )}

      {/* Шторки */}
      <AddContactSheet
        open={addingContact}
        onClose={() => setAddingContact(false)}
        onSubmit={async (input) => {
          await outreach.addContact(input);
        }}
      />

      <ContactSheet
        contact={openContact}
        onClose={() => setOpenContact(null)}
        onStatus={async (contact, status) => {
          await outreach.setStatus(contact, status);
          setOpenContact((current) =>
            current && current.id === contact.id ? { ...current, status } : current,
          );
        }}
        onSaveNote={(id, note) => outreach.updateContact(id, { note })}
        onDelete={outreach.deleteContact}
      />

      <OfferSheet
        open={offerSheetOpen}
        offer={openOffer}
        contacts={outreach.contacts}
        onClose={() => {
          setOfferSheetOpen(false);
          setOpenOffer(null);
        }}
        onSave={handleSaveOffer}
        onDelete={outreach.deleteOffer}
      />

      {/* Подсказка про порог разблокировки — видна, пока фишки закрыты */}
      {!showFunnel && (
        <p className="pt-2 text-center text-xs text-white/25">
          {tf(t.unlocks.requirement, { n: 70 })}
        </p>
      )}
    </div>
  );
}
