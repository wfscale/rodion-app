'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { getLogicalDate } from '@/lib/date';
import { createClient } from '@/lib/supabase/client';
import { syncSheets } from '@/lib/sheets-client';
import type {
  ContactStatus,
  Offer,
  OfferResult,
  OutreachContact,
  StatusHistoryEntry,
} from '@/lib/types';
import { onceKey, XP } from '@/lib/xp';

/** Сколько XP даёт переход в статус. Остальные статусы — без награды. */
const STATUS_XP: Partial<Record<ContactStatus, { amount: number; reason: string }>> = {
  replied: { amount: XP.REPLIED, reason: 'replied' },
  call: { amount: XP.CALL, reason: 'call' },
  closed: { amount: XP.CLOSED, reason: 'closed' },
};

export function useOutreach() {
  const { user, awardXp, today } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const [contactsRes, offersRes] = await Promise.all([
      supabase
        .from('outreach_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (contactsRes.error) setError(contactsRes.error.message);
    if (offersRes.error) setError(offersRes.error.message);

    setContacts((contactsRes.data as OutreachContact[]) ?? []);
    setOffers((offersRes.data as Offer[]) ?? []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------------------------------------------ */
  /*  Контакты                                                           */
  /* ------------------------------------------------------------------ */

  const addContact = useCallback(
    async (input: {
      name: string;
      niche: string | null;
      audience_size: string | null;
      platform: string | null;
      note: string | null;
    }): Promise<OutreachContact | null> => {
      if (!user) return null;

      const history: StatusHistoryEntry[] = [
        { status: 'sent', at: new Date().toISOString() },
      ];

      const { data, error: insertError } = await supabase
        .from('outreach_contacts')
        .insert({
          user_id: user.id,
          name: input.name,
          niche: input.niche,
          audience_size: input.audience_size,
          platform: input.platform,
          note: input.note,
          status: 'sent',
          status_history: history,
        } as never)
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      const contact = data as OutreachContact;
      setContacts((previous) => [contact, ...previous]);

      await awardXp(XP.OUTREACH_SENT, 'contactAdded', onceKey.contactStatus(contact.id, 'sent'));
      void syncSheets();

      return contact;
    },
    [supabase, user, awardXp],
  );

  const setStatus = useCallback(
    async (contact: OutreachContact, status: ContactStatus) => {
      if (contact.status === status) return;

      const history: StatusHistoryEntry[] = [
        ...(contact.status_history ?? []),
        { status, at: new Date().toISOString() },
      ];

      setContacts((previous) =>
        previous.map((c) =>
          c.id === contact.id
            ? { ...c, status, status_history: history, updated_at: new Date().toISOString() }
            : c,
        ),
      );

      const { error: updateError } = await supabase
        .from('outreach_contacts')
        .update({ status, status_history: history } as never)
        .eq('id', contact.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // XP за продвижение по воронке — один раз на контакт и статус,
      // иначе можно было бы фармить, переключая статус туда-обратно.
      const reward = STATUS_XP[status];
      if (reward) {
        await awardXp(reward.amount, reward.reason, onceKey.contactStatus(contact.id, status));
      }

      void syncSheets();
    },
    [supabase, awardXp],
  );

  const updateContact = useCallback(
    async (id: string, patch: Partial<OutreachContact>) => {
      setContacts((previous) =>
        previous.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );

      const { error: updateError } = await supabase
        .from('outreach_contacts')
        .update(patch as never)
        .eq('id', id);

      if (updateError) setError(updateError.message);
      else void syncSheets();
    },
    [supabase],
  );

  const deleteContact = useCallback(
    async (id: string) => {
      setContacts((previous) => previous.filter((c) => c.id !== id));
      const { error: deleteError } = await supabase
        .from('outreach_contacts')
        .delete()
        .eq('id', id);

      if (deleteError) setError(deleteError.message);
      else void syncSheets();
    },
    [supabase],
  );

  /* ------------------------------------------------------------------ */
  /*  Офферы                                                             */
  /* ------------------------------------------------------------------ */

  const addOffer = useCallback(
    async (input: {
      title: string;
      niche: string | null;
      content: string;
      result: OfferResult;
      note: string | null;
      contact_id: string | null;
    }) => {
      if (!user) return null;

      const { data, error: insertError } = await supabase
        .from('offers')
        .insert({ user_id: user.id, ...input } as never)
        .select('*')
        .single();

      if (insertError) {
        setError(insertError.message);
        return null;
      }

      setOffers((previous) => [data as Offer, ...previous]);
      void syncSheets();
      return data as Offer;
    },
    [supabase, user],
  );

  const updateOffer = useCallback(
    async (id: string, patch: Partial<Offer>) => {
      setOffers((previous) =>
        previous.map((offer) =>
          offer.id === id
            ? { ...offer, ...patch, updated_at: new Date().toISOString() }
            : offer,
        ),
      );

      const { error: updateError } = await supabase
        .from('offers')
        .update(patch as never)
        .eq('id', id);

      if (updateError) setError(updateError.message);
      else void syncSheets();
    },
    [supabase],
  );

  const deleteOffer = useCallback(
    async (id: string) => {
      setOffers((previous) => previous.filter((offer) => offer.id !== id));
      const { error: deleteError } = await supabase.from('offers').delete().eq('id', id);
      if (deleteError) setError(deleteError.message);
      else void syncSheets();
    },
    [supabase],
  );

  /* ------------------------------------------------------------------ */
  /*  Статистика воронки                                                 */
  /* ------------------------------------------------------------------ */

  const stats = useMemo(() => {
    const sent = contacts.length;
    // Каждый следующий этап включает предыдущие: ответил → созвон → закрыт.
    const replied = contacts.filter((c) =>
      ['replied', 'call', 'closed'].includes(c.status),
    ).length;
    const calls = contacts.filter((c) => ['call', 'closed'].includes(c.status)).length;
    const closed = contacts.filter((c) => c.status === 'closed').length;

    return {
      sent,
      replied,
      calls,
      closed,
      replyRate: sent ? Math.round((replied / sent) * 100) : 0,
      callRate: sent ? Math.round((calls / sent) * 100) : 0,
    };
  }, [contacts]);

  /** Сколько целей добавлено сегодня — считаем по логическому дню. */
  const sentToday = useMemo(
    () => contacts.filter((c) => getLogicalDate(new Date(c.created_at)) === today).length,
    [contacts, today],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const contact of contacts) {
      counts[contact.status] = (counts[contact.status] ?? 0) + 1;
    }
    return counts;
  }, [contacts]);

  return {
    contacts,
    offers,
    loading,
    error,
    stats,
    sentToday,
    statusCounts,
    addContact,
    setStatus,
    updateContact,
    deleteContact,
    addOffer,
    updateOffer,
    deleteOffer,
    reload: load,
  };
}
