'use client';

import { Check, Download, ExternalLink, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { CardTitle, GlassCard } from '@/components/GlassCard';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, FullPageLoader, Label, Segmented, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/date';
import { setSheetsConnected, syncSheetsNow } from '@/lib/sheets-client';
import { createClient } from '@/lib/supabase/client';
import type { GoogleIntegration, Language } from '@/lib/types';

const APP_VERSION = '1.0.0';

function SettingsContent() {
  const { t, lang, setLang } = useLanguage();
  const { profile, user, loading, updateProfile, signOut, reload } = useApp();
  const params = useSearchParams();

  const [username, setUsername] = useState('');
  const [goal, setGoal] = useState(10);
  const [threshold, setThreshold] = useState(70);
  const [savedFlash, setSavedFlash] = useState(false);

  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? '');
    setGoal(profile.daily_goal ?? 10);
    setThreshold(profile.streak_threshold ?? 70);
  }, [profile]);

  /* ------------------------------------------------------------------ */
  /*  Google Sheets                                                      */
  /* ------------------------------------------------------------------ */

  const loadIntegration = useCallback(async () => {
    if (!user) return;

    // refresh_token клиенту не выдаётся грантами — запрашиваем только разрешённое.
    const supabase = createClient();
    const { data } = await supabase
      .from('google_integrations')
      .select('user_id, google_email, sheet_id, last_synced_at, last_sync_status, connected_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const row = (data as GoogleIntegration) ?? null;
    setIntegration(row);
    setSheetId(row?.sheet_id ?? '');
    setSheetsConnected(Boolean(row));
  }, [user]);

  useEffect(() => {
    void loadIntegration();
  }, [loadIntegration]);

  // Сообщения после возврата из OAuth-редиректа.
  useEffect(() => {
    const status = params.get('google');
    if (!status) return;

    if (status === 'connected') setSyncMessage(t.settings.googleConnected);
    else if (status === 'not_configured') setSyncMessage(t.settings.googleNotConfigured);
    else setSyncMessage(`${t.common.error}: ${params.get('reason') ?? status}`);
  }, [params, t]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncSheetsNow();
      setSyncMessage(result.ok ? t.common.saved : `${t.common.error}: ${result.message}`);
      await loadIntegration();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    await fetch('/api/google/disconnect', { method: 'POST' });
    setSheetsConnected(false);
    setIntegration(null);
    setSheetId('');
    setSyncMessage(null);
  }

  async function saveSheetId() {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('google_integrations')
      .update({ sheet_id: sheetId.trim() || null })
      .eq('user_id', user.id);
    flashSaved();
  }

  /* ------------------------------------------------------------------ */
  /*  Данные                                                             */
  /* ------------------------------------------------------------------ */

  async function exportJson() {
    if (!user) return;
    setExporting(true);

    try {
      const supabase = createClient();
      const [profiles, logs, contacts, offers, notes, xp] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id),
        supabase.from('daily_logs').select('*').eq('user_id', user.id),
        supabase.from('outreach_contacts').select('*').eq('user_id', user.id),
        supabase.from('offers').select('*').eq('user_id', user.id),
        supabase.from('notes').select('*').eq('user_id', user.id),
        supabase.from('xp_transactions').select('*').eq('user_id', user.id),
      ]);

      const dump = {
        exported_at: new Date().toISOString(),
        version: APP_VERSION,
        profile: profiles.data?.[0] ?? null,
        daily_logs: logs.data ?? [],
        outreach_contacts: contacts.data ?? [],
        offers: offers.data ?? [],
        notes: notes.data ?? [],
        xp_transactions: xp.data ?? [],
      };

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rodion-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function clearOutreach() {
    if (!user) return;
    setClearing(true);

    try {
      const supabase = createClient();
      await supabase.from('outreach_contacts').delete().eq('user_id', user.id);
      setConfirmClear(false);
      setSyncMessage(t.settings.cleared);
      await reload();
    } finally {
      setClearing(false);
    }
  }

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  }

  if (loading || !profile) return <FullPageLoader />;

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{t.settings.title}</h1>
        {savedFlash && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <Check size={15} />
            {t.common.saved}
          </span>
        )}
      </div>

      {/* ---------------------------- Профиль ---------------------------- */}
      <GlassCard>
        <CardTitle>{t.settings.profile}</CardTitle>

        <div className="space-y-4">
          <Field
            label={t.settings.username}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => {
              if (username.trim() !== (profile.username ?? '')) {
                void updateProfile({ username: username.trim() || null });
                flashSaved();
              }
            }}
            placeholder={t.settings.usernamePh}
          />

          <div>
            <Label>{t.settings.email}</Label>
            <p className="field flex items-center text-muted">{user?.email ?? '—'}</p>
          </div>

          <Button variant="ghost" full onClick={() => void signOut()}>
            <LogOut size={16} />
            {t.settings.signOut}
          </Button>
        </div>
      </GlassCard>

      {/* ----------------------------- Цели ------------------------------ */}
      <GlassCard delay={1}>
        <CardTitle>{t.settings.goals}</CardTitle>

        <div className="space-y-5">
          <div>
            <Label hint={t.settings.dailyGoalHint}>{t.settings.dailyGoal}</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={goal}
                onChange={(e) => setGoal(Number(e.target.value))}
                onMouseUp={() => {
                  void updateProfile({ daily_goal: goal });
                  flashSaved();
                }}
                onTouchEnd={() => {
                  void updateProfile({ daily_goal: goal });
                  flashSaved();
                }}
                className="h-11 flex-1 accent-white"
              />
              <span className="w-12 shrink-0 text-right text-xl font-extrabold tabular-nums">
                {goal}
              </span>
            </div>
          </div>

          <div>
            <Label hint={t.settings.streakThresholdHint}>{t.settings.streakThreshold}</Label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={60}
                max={90}
                step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onMouseUp={() => {
                  void updateProfile({ streak_threshold: threshold });
                  flashSaved();
                }}
                onTouchEnd={() => {
                  void updateProfile({ streak_threshold: threshold });
                  flashSaved();
                }}
                className="h-11 flex-1 accent-white"
              />
              <span className="w-12 shrink-0 text-right text-xl font-extrabold tabular-nums">
                {threshold}%
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* -------------------------- Интеграции --------------------------- */}
      <GlassCard delay={2}>
        <CardTitle>{t.settings.integrations}</CardTitle>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold">{t.settings.googleSheets}</p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {integration
                  ? (integration.google_email ?? t.settings.googleConnected)
                  : t.settings.sheetIdHint}
              </p>
            </div>

            {integration ? (
              <Button variant="ghost" onClick={() => void handleDisconnect()}>
                {t.settings.googleDisconnect}
              </Button>
            ) : (
              <Button onClick={() => window.location.assign('/api/google/connect')}>
                {t.settings.googleConnect}
              </Button>
            )}
          </div>

          {integration && (
            <>
              <div>
                <Field
                  label={t.settings.sheetId}
                  hint={t.common.optional}
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  onBlur={saveSheetId}
                  placeholder="1AbC…"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {sheetId && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white"
                  >
                    <ExternalLink size={14} />
                    docs.google.com
                  </a>
                )}
              </div>

              <Button variant="ghost" full onClick={handleSync} disabled={syncing}>
                {syncing ? <Spinner /> : <RefreshCw size={16} />}
                {syncing ? t.settings.syncing : t.settings.syncNow}
              </Button>

              <p className="text-sm text-muted">
                {t.settings.lastSync}:{' '}
                {integration.last_synced_at
                  ? formatDateTime(integration.last_synced_at, lang)
                  : t.settings.neverSynced}
              </p>
            </>
          )}

          {syncMessage && (
            <p className="rounded-xl border border-glass-border bg-white/[0.04] px-3 py-2.5 text-sm leading-relaxed text-white/70">
              {syncMessage}
            </p>
          )}
        </div>
      </GlassCard>

      {/* ----------------------------- Язык ------------------------------ */}
      <GlassCard delay={3}>
        <CardTitle>{t.settings.language}</CardTitle>

        <Segmented<Language>
          value={lang}
          onChange={(next) => {
            setLang(next);
            void updateProfile({ language: next });
            flashSaved();
          }}
          options={[
            { value: 'ru', label: t.settings.languageRu },
            { value: 'en', label: t.settings.languageEn },
          ]}
        />
      </GlassCard>

      {/* ----------------------------- Данные ---------------------------- */}
      <GlassCard delay={4}>
        <CardTitle>{t.settings.data}</CardTitle>

        <div className="space-y-3">
          <Button variant="ghost" full onClick={exportJson} disabled={exporting}>
            {exporting ? <Spinner /> : <Download size={16} />}
            {exporting ? t.settings.exporting : t.settings.exportJson}
          </Button>

          {confirmClear ? (
            <div className="space-y-3 rounded-2xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.06)] p-3">
              <p className="text-sm leading-relaxed text-danger">
                {t.settings.clearOutreachConfirm}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={clearOutreach}
                  disabled={clearing}
                >
                  {clearing ? <Spinner /> : t.common.delete}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirmClear(false)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" full onClick={() => setConfirmClear(true)}>
              <Trash2 size={16} />
              {t.settings.clearOutreach}
            </Button>
          )}
        </div>
      </GlassCard>

      {/* -------------------------- О приложении ------------------------- */}
      <GlassCard delay={5}>
        <CardTitle right={<span className="text-sm text-white/35">{APP_VERSION}</span>}>
          {t.settings.about}
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted">{t.settings.aboutText}</p>
      </GlassCard>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <SettingsContent />
    </Suspense>
  );
}
