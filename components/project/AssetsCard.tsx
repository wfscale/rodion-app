'use client';

import { Pencil } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { assetsOf, formatNumber, hasAssets } from '@/lib/project';
import { Button, Field, Label } from '@/components/ui';
import { ASSET_KEYS, type AssetKey, type ProjectAssets } from '@/lib/types';

/** Короткие подписи: в двух колонках цифр длинному названию места нет. */
const SHORT_LABEL: Record<AssetKey, 'igShort' | 'igReachShort' | 'tgShort' | 'tgReachShort'> = {
  ig_followers: 'igShort',
  ig_reach: 'igReachShort',
  tg_subs: 'tgShort',
  tg_reach: 'tgReachShort',
};

type AssetsCardProps = {
  start: ProjectAssets;
  now: ProjectAssets;
  onSave: (start: ProjectAssets, now: ProjectAssets) => void;
};

/**
 * «С чего начали — к чему пришли».
 *
 * Единственная цифра, которой продюсер отчитывается за работу. Замер на
 * старте делается один раз и потом уже не восстанавливается — поэтому пустой
 * блок не молчит, а просит его заполнить.
 */
export function AssetsCard({ start, now, onSave }: AssetsCardProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);

  const startValues = assetsOf(start);
  const nowValues = assetsOf(now);
  const measured = hasAssets(startValues) || hasAssets(nowValues);

  return (
    <>
      <GlassCard>
        <CardTitle
          right={
            measured ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t.common.edit}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Pencil size={16} />
              </button>
            ) : undefined
          }
        >
          {t.project.assets}
        </CardTitle>

        {measured ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2.5">
            <span aria-hidden="true" />
            <span className="min-w-[54px] text-right text-xs text-white/35">
              {t.project.assetsStart}
            </span>
            <span className="min-w-[54px] text-right text-xs text-white/35">
              {t.project.assetsNow}
            </span>

            {ASSET_KEYS.map((key) => {
              const from = startValues[key];
              const to = nowValues[key];
              // Зелёным — только рост: это и есть результат работы продюсера.
              const grew = typeof from === 'number' && typeof to === 'number' && to > from;

              return (
                <Fragment key={key}>
                  <span className="truncate text-xs text-white/50">
                    {t.project[SHORT_LABEL[key]]}
                  </span>
                  <span className="text-right text-sm font-bold tabular-nums text-white/45">
                    {typeof from === 'number' ? formatNumber(from) : t.common.none}
                  </span>
                  <span
                    className={`text-right text-sm font-bold tabular-nums ${
                      grew ? 'text-success' : 'text-white'
                    }`}
                  >
                    {typeof to === 'number' ? formatNumber(to) : t.common.none}
                  </span>
                </Fragment>
              );
            })}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-relaxed text-muted">{t.project.assetsEmpty}</p>
            <Button variant="ghost" full className="mt-3" onClick={() => setEditing(true)}>
              {t.project.assetsFill}
            </Button>
          </div>
        )}
      </GlassCard>

      {/* Шторка живёт рядом с карточкой, а не внутри: вложенный backdrop-filter
          в Safari iOS схлопывается в белый прямоугольник. */}
      <AssetsSheet
        open={editing}
        start={startValues}
        now={nowValues}
        onClose={() => setEditing(false)}
        onSave={(nextStart, nextNow) => {
          onSave(nextStart, nextNow);
          setEditing(false);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Правка замеров                                                             */
/* -------------------------------------------------------------------------- */

type Draft = Record<AssetKey, string>;

function toDraft(assets: ProjectAssets): Draft {
  return ASSET_KEYS.reduce((acc, key) => {
    const value = assets[key];
    acc[key] = typeof value === 'number' ? String(value) : '';
    return acc;
  }, {} as Draft);
}

/** Пустое поле — это «не замеряли», а не ноль: ноль подписчиков тоже бывает. */
function fromDraft(draft: Draft): ProjectAssets {
  return ASSET_KEYS.reduce<ProjectAssets>((acc, key) => {
    acc[key] = draft[key] === '' ? null : Number(draft[key]);
    return acc;
  }, {});
}

function AssetsSheet({
  open,
  start,
  now,
  onClose,
  onSave,
}: {
  open: boolean;
  start: ProjectAssets;
  now: ProjectAssets;
  onClose: () => void;
  onSave: (start: ProjectAssets, now: ProjectAssets) => void;
}) {
  const { t } = useLanguage();

  const [startDraft, setStartDraft] = useState<Draft>(() => toDraft(start));
  const [nowDraft, setNowDraft] = useState<Draft>(() => toDraft(now));

  // Черновик набирается заново при каждом открытии: между открытиями цифры
  // могли уехать — например, после правки с другого устройства.
  useEffect(() => {
    if (!open) return;
    setStartDraft(toDraft(start));
    setNowDraft(toDraft(now));
  }, [open, start, now]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.project.assets}
      footer={
        <Button full onClick={() => onSave(fromDraft(startDraft), fromDraft(nowDraft))}>
          {t.common.save}
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <Label>{t.project.assetsStart}</Label>
          <div className="grid grid-cols-2 gap-3">
            {ASSET_KEYS.map((key) => (
              <Field
                key={key}
                label={t.project[SHORT_LABEL[key]]}
                inputMode="numeric"
                value={startDraft[key]}
                onChange={(e) =>
                  setStartDraft({ ...startDraft, [key]: e.target.value.replace(/\D/g, '') })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <Label>{t.project.assetsNow}</Label>
          <div className="grid grid-cols-2 gap-3">
            {ASSET_KEYS.map((key) => (
              <Field
                key={key}
                label={t.project[SHORT_LABEL[key]]}
                inputMode="numeric"
                value={nowDraft[key]}
                onChange={(e) =>
                  setNowDraft({ ...nowDraft, [key]: e.target.value.replace(/\D/g, '') })
                }
              />
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
