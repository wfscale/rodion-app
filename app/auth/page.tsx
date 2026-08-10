'use client';

import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { Button, Field, Spinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

function AuthForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setNotice(null);
  };

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t.auth.emailInvalid;
    }
    if (password.length < 6) {
      next.password = t.auth.passwordShort;
    }
    if (mode === 'signup' && password !== confirm) {
      next.confirm = t.auth.passwordMismatch;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!validate()) return;

    setBusy(true);
    const supabase = createClient();

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrors({
            form:
              error.message.toLowerCase().includes('invalid')
                ? t.auth.invalidCredentials
                : error.message,
          });
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrors({
            form: error.message.toLowerCase().includes('already')
              ? t.auth.userExists
              : error.message,
          });
          return;
        }

        // Если в Supabase включено подтверждение email, сессии не будет.
        // Приложение задумано без писем — подсказываем, что выключить.
        if (!data.session) {
          setNotice(
            'В Supabase включено подтверждение email. Authentication → Sign In / Providers → Email → выключи «Confirm email», затем войди.',
          );
          return;
        }
      }

      // Полная перезагрузка: middleware должен увидеть свежие куки сессии.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrors({ form: t.common.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">{t.auth.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.auth.subtitle}</p>
        </div>

        <div className="glass p-5">
          {/* Переключатель режимов */}
          <div className="mb-5 flex rounded-2xl bg-white/[0.05] p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className="relative min-h-[44px] flex-1 rounded-xl text-sm font-bold"
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-xl bg-white"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${mode === m ? 'text-ink' : 'text-white/50'}`}
                >
                  {m === 'signin' ? t.auth.signIn : t.auth.signUp}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field
              label={t.auth.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              placeholder="you@mail.com"
            />

            <Field
              label={t.auth.password}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              placeholder="••••••"
            />

            {mode === 'signup' && (
              <Field
                label={t.auth.confirmPassword}
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors.confirm}
                placeholder="••••••"
              />
            )}

            {errors.form && (
              <p className="rounded-xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.08)] px-3 py-2.5 text-sm text-danger">
                {errors.form}
              </p>
            )}

            {notice && (
              <p className="rounded-xl border border-[rgba(255,209,102,0.25)] bg-[rgba(255,209,102,0.08)] px-3 py-2.5 text-sm leading-relaxed text-warn">
                {notice}
              </p>
            )}

            <Button type="submit" full disabled={busy}>
              {busy ? (
                <>
                  <Spinner />
                  {t.auth.processing}
                </>
              ) : mode === 'signin' ? (
                t.auth.submitSignIn
              ) : (
                t.auth.submitSignUp
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
