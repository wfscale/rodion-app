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
import { pushStatus, subscribeToPush, unsubscribeFromPush, type PushStatus } from '@/lib/push-client';
import { createClient } from '@/lib/supabase/client';
import type { GoogleIntegration, Language } from '@/lib/types';

const APP_VERSION = '1.0.0';

function SettingsContent() {
  const { t, lang, setLang } = useLanguage();
  const { profile, user, loading, updateProfile, signOut, reload } = useApp();
  const params = useSearchParams();

  const [username, setUsername] = useState('');
  const [deadline, setDeadline] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [integration, setIntegration] = useState<GoogleIntegration | null>(null);
  const [sheetId, setSheetId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [push, setPush] = useState<PushStatus>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? '');
    setDeadline(profile.deadline_date ?? '');
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

  // Статус разрешения читается только в браузере.
  useEffect(() => {
    setPush(pushStatus());
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushNote(null);
    try {
      if (profile?.push_enabled) {
        await unsubscribeFromPush();
        await updateProfile({ push_enabled: false });
        setPush(pushStatus());
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setPushNote(t.settings.pushUnsupported);
        return;
      }

      const result = await subscribeToPush(key);
      if (result.ok) {
        await updateProfile({ push_enabled: true });
        setPushNote(t.settings.pushOn);
      } else if (result.reason === 'needs-install') {
        setPushNote(t.settings.pushUnsupported);
      } else if (result.reason === 'denied') {
        setPushNote(t.settings.pushDenied);
      } else {
        setPushNote(t.common.error);
      }
      setPush(pushStatus());
    } finally {
      setPushBusy(false);
    }
  }

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

      {/* ---------------------------- Ставки ----------------------------- */}
      <GlassCard delay={1}>
        <CardTitle>{t.settings.goals}</CardTitle>

        <div className="space-y-5">
          {/* Дедлайн задаёт счётчик в трезвом режиме — поэтому он редактируемый. */}
          <label className="block">
            <Label hint={t.settings.deadlineHint}>{t.settings.deadline}</Label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onBlur={() => {
                if (deadline && deadline !== profile.deadline_date) {
                  void updateProfile({ deadline_date: deadline });
                  flashSaved();
                }
              }}
              className="field"
            />
          </label>

          {/* Квота не задаётся вручную: она растёт от выполнения, иначе теряет смысл. */}
          <div>
            <Label hint={t.settings.quotaInfoHint}>{t.settings.quotaInfo}</Label>
            <p className="field flex items-center justify-between">
              <span className="text-xl font-extrabold tabular-nums">
                {profile.current_quota ?? 5}
              </span>
              <span className="text-sm text-muted">
                {t.home.record}: {profile.daily_record ?? 0}
              </span>
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ---------------------------- Отдача ----------------------------- */}
      <GlassCard delay={2}>
        <CardTitle>{t.settings.feedback}</CardTitle>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold">{t.settings.sounds}</p>
            <p className="mt-0.5 text-sm text-muted">{t.settings.soundsHint}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(profile.sound_enabled)}
            onClick={() => {
              void updateProfile({ sound_enabled: !profile.sound_enabled });
              flashSaved();
            }}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              profile.sound_enabled ? 'bg-white' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full transition-all ${
                profile.sound_enabled ? 'left-7 bg-ink' : 'left-1 bg-white/60'
              }`}
            />
          </button>
        </div>
      </GlassCard>

      {/* -------------------------- Уведомления --------------------------- */}
      <GlassCard delay={3}>
        <CardTitle>{t.settings.push}</CardTitle>

        <p className="mb-3 text-sm text-muted">{t.settings.pushHint}</p>

        <Button
          variant={profile.push_enabled ? 'ghost' : 'primary'}
          full
          onClick={togglePush}
          disabled={pushBusy || push === 'unsupported'}
        >
          {pushBusy ? <Spinner /> : null}
          {profile.push_enabled ? t.settings.pushDisable : t.settings.pushEnable}
        </Button>

        {(pushNote || push === 'needs-install' || push === 'denied') && (
          <p className="mt-3 rounded-xl border border-glass-border bg-white/[0.04] px-3 py-2.5 text-sm leading-relaxed text-white/70">
            {pushNote ??
              (push === 'needs-install' ? t.settings.pushUnsupported : t.settings.pushDenied)}
          </p>
        )}
      </GlassCard>

      {/* -------------------------- Интеграции --------------------------- */}
      <GlassCard delay={4}>
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
      <GlassCard delay={5}>
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
      <GlassCard delay={6}>
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
