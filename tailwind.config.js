/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Corporate Trust Palette ──────────────────────
        primary:   '#4F46E5', // Indigo 600
        secondary: '#7C3AED', // Violet 600
        accent:    '#10B981', // Emerald 500
        surface:   '#FFFFFF',
        base:      '#F8FAFC', // Slate 50
        textMain:  '#0F172A', // Slate 900
        textMuted: '#64748B', // Slate 500
        bdr:       '#E2E8F0', // Slate 200
        danger:    '#EF4444',
        warning:   '#F97316',
        info:      '#3B82F6',
        success:   '#10B981',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        // Colored shadows — the visual DNA of Corporate Trust
        'soft':     '0 4px 20px -2px rgba(79, 70, 229, 0.10)',
        'elevated': '0 10px 25px -5px rgba(79, 70, 229, 0.15), 0 8px 10px -6px rgba(79, 70, 229, 0.10)',
        'btn':      '0 4px 14px 0 rgba(79, 70, 229, 0.30)',
        'glow':     '0 0 20px rgba(79, 70, 229, 0.45)',
        'danger':   '0 4px 14px 0 rgba(239, 68, 68, 0.30)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}
