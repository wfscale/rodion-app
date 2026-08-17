'use client';

import { useMemo } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { CHAT_ISSUE_IDS, digestChats } from '@/lib/conversation';
import type { OutreachContact } from '@/lib/types';

/**
 * Разбор переписок целиком.
 *
 * Оффер отвечает на вопрос «почему не отвечают», переписка — на вопрос
 * «почему ответили и всё равно не купили». Вторая половина воронки дороже
 * первой: там уже есть интерес, и терять его обиднее всего.
 */
export function DialogueCard({ contacts }: { contacts: OutreachContact[] }) {
  const { t, tf } = useLanguage();

  const digest = useMemo(
    () => digestChats(contacts.map((contact) => contact.conversation ?? [])),
    [contacts],
  );

  return (
    <GlassCard delay={3}>
      <CardTitle
        right={
          digest.chats > 0 ? (
            <span className="shrink-0 text-sm font-extrabold tabular-nums">
              {digest.averageScore}
            </span>
          ) : undefined
        }
      >
        {t.chatDigest.title}
      </CardTitle>

      {digest.chats === 0 ? (
        <p className="text-sm leading-relaxed text-muted">{t.chatDigest.empty}</p>
      ) : (
        <>
          <p className="text-sm leading-snug">
            {tf(t.chatDigest.summary, { n: digest.chats })}
          </p>

          {/* Ждут ответа — первое, что должно попасться на глаза: это не
              разбор прошлого, а список того, что горит прямо сейчас. */}
          {digest.waiting > 0 && (
            <p className="mt-2 rounded-2xl border border-[rgba(255,209,102,0.3)] bg-[rgba(255,209,102,0.07)] px-3 py-2.5 text-sm font-bold leading-snug text-warn">
              {tf(t.chatDigest.waiting, { n: digest.waiting })}
            </p>
          )}

          <ul className="mt-3 space-y-2 border-t border-divider pt-3">
            {CHAT_ISSUE_IDS.filter((id) => digest.counts[id] > 0).map((id) => (
              <li key={id} className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-bold leading-snug ${
                      id === digest.worst ? 'text-danger' : 'text-white/75'
                    }`}
                  >
                    {t.chat.issues[id]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-white/35">
                    {t.chat.fixes[id]}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-white/50">
                  {digest.counts[id]}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
