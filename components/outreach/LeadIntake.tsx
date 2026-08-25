'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field } from '@/components/ui';
import { parseLeads, summarizeIntake } from '@/lib/leads';

type LeadIntakeProps = {
  /** Ники, которые уже есть: и в базе, и среди написанных. */
  known: string[];
  onAdd: (leads: { name: string; instagram_url: string }[], niche: string) => Promise<number>;
  delay?: number;
};

/**
 * Сбор базы.
 *
 * Вставка списком, а не по одному человеку: «найти двадцать аккаунтов» —
 * это одно занятие, и разбивать его на двадцать форм значит превращать его
 * в двадцать занятий. Разбор терпит любой вид ссылки, потому что вставляют
 * как придётся, а чистить руками — ровно та работа, от которой список и
 * должен избавлять.
 */
export function LeadIntake({ known, onAdd, delay = 0 }: LeadIntakeProps) {
  const { t, tf } = useLanguage();

  const [text, setText] = useState('');
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const parsed = useMemo(() => parseLeads(text, known), [text, known]);
  const summary = useMemo(() => summarizeIntake(text, parsed), [text, parsed]);

  async function submit() {
    if (parsed.length === 0) return;
    setBusy(true);
    try {
      const added = await onAdd(
        parsed.map((lead) => ({ name: `@${lead.handle}`, instagram_url: lead.instagram_url })),
        niche,
      );
      if (added > 0) {
        setText('');
        setDone(added);
        setTimeout(() => setDone(null), 3000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard delay={delay}>
      <CardTitle>{t.leads.title}</CardTitle>

      <div className="space-y-3">
        <Field
          label={t.leads.niche}
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder={t.leads.nichePh}
          autoComplete="off"
        />

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-white/70">{t.leads.hint}</span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.leads.ph}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="field font-mono text-sm"
          />
        </label>

        {/* Сколько разобралось — видно до нажатия: вставили двадцать строк,
            а лидов вышло три, и понять это надо сразу, а не после. */}
        {text.trim() && (
          <p className="text-sm text-white/45">
            {tf(t.leads.parsed, { n: parsed.length })}
            {summary.skipped > 0 && (
              <span className="text-white/25"> · {tf(t.leads.skipped, { n: summary.skipped })}</span>
            )}
          </p>
        )}

        <Button full onClick={() => void submit()} disabled={parsed.length === 0 || busy}>
          <Plus size={18} />
          {parsed.length > 0 ? tf(t.leads.add, { n: parsed.length }) : t.leads.addEmpty}
        </Button>

        {done !== null ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-semibold text-success"
          >
            {tf(t.leads.added, { n: done })}
          </motion.p>
        ) : (
          <p className="text-xs leading-relaxed text-white/25">{t.leads.duplicates}</p>
        )}
      </div>
    </GlassCard>
  );
}
