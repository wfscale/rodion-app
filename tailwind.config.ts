import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /*
         * Фон — почти чёрный, не тёмно-серый.
         * Имя намеренно не «base»: из цвета base Tailwind сгенерировал бы
         * утилиту text-base, которая перекрывает встроенный размер шрифта
         * text-base (16px). Текст тогда красится в #0A0A0A на #0A0A0A фоне.
         */
        ink: '#0A0A0A',
        // Поверхность стекла и её границы.
        glass: 'rgba(255,255,255,0.06)',
        'glass-strong': 'rgba(255,255,255,0.10)',
        'glass-border': 'rgba(255,255,255,0.10)',
        divider: 'rgba(255,255,255,0.08)',
        accent: '#FFFFFF',
        'accent-weak': 'rgba(255,255,255,0.15)',
        muted: 'rgba(255,255,255,0.5)',
        faint: 'rgba(255,255,255,0.3)',
        // Смысловые акценты — приглушённые, чтобы не спорить с монохромом.
        success: '#64FF8C',
        danger: '#FF6B6B',
        warn: '#FFD166',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Базовый текст 16px, минимум в интерфейсе — 14px.
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['22px', { lineHeight: '30px' }],
        '2xl': ['28px', { lineHeight: '34px' }],
        '3xl': ['36px', { lineHeight: '42px' }],
        '4xl': ['48px', { lineHeight: '52px' }],
        '5xl': ['64px', { lineHeight: '66px' }],
      },
      borderRadius: {
        glass: '20px',
        sheet: '28px',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.35)',
        'glow-green': '0 0 20px rgba(100,255,100,0.10)',
        'glow-white': '0 0 24px rgba(255,255,255,0.12)',
      },
      spacing: {
        // Высота нижней навигации + запас под FAB.
        nav: '64px',
        'nav-safe': 'calc(64px + env(safe-area-inset-bottom))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-fire': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pulse-fire': 'pulse-fire 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
