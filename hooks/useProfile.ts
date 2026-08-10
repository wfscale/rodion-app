'use client';

import { useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { getLevelInfo } from '@/lib/xp';

/** Профиль + вычисленный уровень для хедера и страницы прогресса. */
export function useProfile() {
  const { profile, user, streak, updateProfile, awardXp, signOut, loading } = useApp();
  const { t } = useLanguage();

  const levelInfo = useMemo(
    () => getLevelInfo(profile?.total_xp ?? 0, t),
    [profile?.total_xp, t],
  );

  return {
    profile,
    user,
    loading,
    levelInfo,
    streak,
    dailyGoal: profile?.daily_goal ?? 10,
    threshold: profile?.streak_threshold ?? 70,
    updateProfile,
    awardXp,
    signOut,
  };
}
