'use client';

import { Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import type { FeatureKey } from '@/lib/xp';

type LockedFeatureProps = {
  featureKey: FeatureKey;
  requiredLevel: number;
};

/**
 * Заглушка закрытой фичи.
 *
 * Показываем название и что именно откроется: закрытая дверь работает только
 * тогда, когда видно, что за ней. Сам уровень не расписывается — список
 * уровней пользователь не видит нигде.
 */
export function LockedFeature({ featureKey, requiredLevel }: LockedFeatureProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-start gap-3 rounded-glass border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="mt-0.5 shrink-0 text-white/25">
        <Lock size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-base font-extrabold leading-snug text-white/45">
          {t.features[featureKey]}
        </p>
        <p className="mt-1 text-sm leading-snug text-white/30">
          {t.features[`${featureKey}Desc`]}
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/25">
          {`${t.common.locked} ${requiredLevel}`}
        </p>
      </div>
    </div>
  );
}
