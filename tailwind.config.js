/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F7FB',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#16202C',
          deep: '#0C1520',
          muted: '#475569',
          soft: '#64748B',
        },
        line: '#E2E8F0',
        brand: {
          DEFAULT: '#3B5BDB',
          light: '#6C84EE',
          soft: '#EEF2FF',
          dark: '#2B43A6',
        },
        ok: { DEFAULT: '#0F8B7E', dark: '#0B6C62', soft: '#E7F6F3' },
        warn: { DEFAULT: '#B26A00', dark: '#8A5200', soft: '#FDF2E2' },
        bad: { DEFAULT: '#C64747', dark: '#A23535', soft: '#FCEDEC' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 32, 44, 0.05)',
        pop: '0 12px 32px rgba(22, 32, 44, 0.14)',
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
    },
  },
  plugins: [],
}
