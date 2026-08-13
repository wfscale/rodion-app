'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { createClient } from '@/lib/supabase/client';
import { syncSheets } from '@/lib/sheets-client';
import type { Offer } from '@/lib/types';
import type { OfferDraft } from '@/components/OfferSheet';

/** Библиотека офферов — открывается со 2-го уровня. */
export function useOffers() {
  const { user } = useApp();
  const supabase = useMemo(() => createClient(), []);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setOffers((data as Offer[]) ?? []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (draft: OfferDraft, id: string | null) => {
      if (!user) return;

      if (id) {
        setOffers((previous) =>
          previous.map((o) => (o.id === id ? { ...o, ...draft, updated_at: new Date().toISOString() } : o)),
        );
        await supabase.from('offers').update(draft as never).eq('id', id);
      } else {
        const { data } = await supabase
          .from('offers')
          .insert({ user_id: user.id, ...draft } as never)
          .select('*')
          .single();
        if (data) setOffers((previous) => [data as Offer, ...previous]);
      }

      void syncSheets();
    },
    [supabase, user],
  );

  /** Быстрое сохранение текста рассылки в библиотеку прямо из карточки контакта. */
  const saveFromContact = useCallback(
    async (input: { title: string; niche: string | null; content: string }) => {
      if (!user || !input.content.trim()) return;
      const { data } = await supabase
        .from('offers')
        .insert({
          user_id: user.id,
          title: input.title,
          niche: input.niche,
          content: input.content,
          result: 'not_sent',
        } as never)
        .select('*')
        .single();
      if (data) setOffers((previous) => [data as Offer, ...previous]);
    },
    [supabase, user],
  );

  const remove = useCallback(
    async (id: string) => {
      setOffers((previous) => previous.filter((o) => o.id !== id));
      await supabase.from('offers').delete().eq('id', id);
      void syncSheets();
    },
    [supabase],
  );

  return { offers, loading, save, saveFromContact, remove, reload: load };
}
