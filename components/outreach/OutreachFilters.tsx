'use client';

import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { statusTone } from '@/components/outreach/ContactSheet';
import { Collapsible } from '@/components/ui';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  type OutreachFilters as Filters,
  type SortMode,
} from '@/lib/outreach-filter';
import { CONTACT_STATUSES, type ContactStatus } from '@/lib/types';

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** Ниши, реально встречающиеся в списке. */
  niches: { key: string; label: string; count: number }[];
};

/** Один переключатель-таблетка. Единственная форма всех фильтров ниже. */
function Chip({
  active,
  label,
  count,
  tone = 'default',
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-full border px-3 text-sm font-semibold transition-colors ${
        active
          ? tone === 'danger'
            ? 'border-[#FF6B6B] bg-[rgba(255,107,107,0.16)] text-danger'
            : 'border-white bg-white text-ink'
          : 'border-glass-border bg-white/[0.05] text-white/55 hover:bg-white/10'
      }`}
    >
      {label}
      {typeof count === 'number' && (
        <span className={active && tone !== 'danger' ? 'ml-1.5 text-black/45' : 'ml-1.5 text-white/30'}>
          {count}
        </span>
      )}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/35">{label}</p>
      <div className="no-scrollbar -mx-1 flex flex-wrap gap-2 px-1">{children}</div>
    </div>
  );
}

/**
 * Панель фильтров.
 *
 * Свёрнута по умолчанию: в обычный день фильтры не нужны, а развёрнутая
 * панель на шесть рядов отодвигала бы сам список за край экрана. Число
 * активных фильтров всегда видно в шапке — иначе легко забыть, почему
 * список внезапно короткий.
 */
export function OutreachFilters({ filters, onChange, niches }: Props) {
  const { t, tf } = useLanguage();
  const active = activeFilterCount(filters);

  const toggleStatus = (status: ContactStatus) =>
    onChange({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status],
    });

  const toggleNiche = (key: string) =>
    onChange({
      ...filters,
      // Выбор конкретной ниши и «без ниши» взаимно исключают друг друга.
      noNiche: false,
      niches: filters.niches.includes(key)
        ? filters.niches.filter((n) => n !== key)
        : [...filters.niches, key],
    });

  const sorts: { value: SortMode; label: string }[] = [
    { value: 'new', label: t.outreach.sortNew },
    { value: 'old', label: t.outreach.sortOld },
    { value: 'name', label: t.outreach.sortName },
    { value: 'status', label: t.outreach.sortStatus },
    { value: 'touch', label: t.outreach.sortTouch },
  ];

  const periods = [
    { value: 7, label: t.outreach.period7 },
    { value: 30, label: t.outreach.period30 },
    { value: 90, label: t.outreach.period90 },
    { value: 0, label: t.outreach.periodAll },
  ];

  return (
    <div className="glass p-4">
      <Collapsible
        storageKey="rodion.outreach.filters"
        defaultOpen={false}
        title={t.outreach.filtersTitle}
        right={
          active > 0 ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-glass-border bg-white/[0.05] px-3 text-xs font-bold text-white/60 transition-colors hover:text-white"
            >
              <RotateCcw size={13} />
              {tf(t.outreach.filtersActive, { n: active })}
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4 pt-1">
          <Row label={t.outreach.filterStatus}>
            {CONTACT_STATUSES.map((status) => (
              <Chip
                key={status}
                active={filters.statuses.includes(status)}
                label={t.statuses[status]}
                tone={statusTone(status) === 'danger' ? 'danger' : 'default'}
                onClick={() => toggleStatus(status)}
              />
            ))}
          </Row>

          {niches.length > 0 && (
            <Row label={t.outreach.filterNiche}>
              {niches.map((niche) => (
                <Chip
                  key={niche.key}
                  active={filters.niches.includes(niche.key)}
                  label={niche.label}
                  count={niche.count}
                  onClick={() => toggleNiche(niche.key)}
                />
              ))}
              <Chip
                active={filters.noNiche}
                label={t.outreach.filterNoNiche}
                onClick={() =>
                  onChange({ ...filters, noNiche: !filters.noNiche, niches: [] })
                }
              />
            </Row>
          )}

          <Row label={t.outreach.filterState}>
            <Chip
              active={filters.needsTouch}
              label={t.outreach.filterNeedsTouch}
              onClick={() => onChange({ ...filters, needsTouch: !filters.needsTouch })}
            />
            <Chip
              active={filters.cold}
              label={t.outreach.filterCold}
              onClick={() => onChange({ ...filters, cold: !filters.cold })}
            />
            <Chip
              active={filters.muted}
              label={t.outreach.filterMuted}
              onClick={() => onChange({ ...filters, muted: !filters.muted })}
            />
            <Chip
              active={filters.hasTelegram}
              label={t.outreach.filterHasTelegram}
              onClick={() => onChange({ ...filters, hasTelegram: !filters.hasTelegram })}
            />
            <Chip
              active={filters.hasInstagram}
              label={t.outreach.filterHasInstagram}
              onClick={() => onChange({ ...filters, hasInstagram: !filters.hasInstagram })}
            />
            <Chip
              active={filters.hasOffer}
              label={t.outreach.filterHasOffer}
              onClick={() => onChange({ ...filters, hasOffer: !filters.hasOffer })}
            />
          </Row>

          <Row label={t.outreach.filterPeriod}>
            {periods.map((period) => (
              <Chip
                key={period.value}
                active={filters.period === period.value}
                label={period.label}
                onClick={() => onChange({ ...filters, period: period.value })}
              />
            ))}
          </Row>

          <Row label={t.outreach.sortBy}>
            {sorts.map((sort) => (
              <Chip
                key={sort.value}
                active={filters.sort === sort.value}
                label={sort.label}
                onClick={() => onChange({ ...filters, sort: sort.value })}
              />
            ))}
          </Row>
        </div>
      </Collapsible>
    </div>
  );
}
