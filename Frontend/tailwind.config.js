/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg':           '#f0f2f5',
        'app-card':         '#ffffff',
        'app-card2':        '#f8fafc',
        'app-card3':        '#eef2ff',
        'app-border':       '#e2e8f0',
        'app-border-hover': '#cbd5e1',
        'app-text':         '#111827',
        'app-text-sec':     '#6b7280',
        'app-text-muted':   '#9ca3af',
        'app-accent':       '#2563eb',
        'app-accent-h':     '#1d4ed8',
        'app-accent-light': '#dbeafe',
        'app-success':      '#16a34a',
        'app-success-bg':   '#dcfce7',
        'app-warning':      '#d97706',
        'app-warning-bg':   '#fef3c7',
        'app-error':        '#dc2626',
        'app-error-bg':     '#fee2e2',
        'app-info':         '#2563eb',
        'app-info-bg':      '#dbeafe',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        toastSlide: {
          from: { opacity: '0', transform: 'translateX(-50%) translateY(12px)' },
          to:   { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease both',
        'fade-in':    'fadeIn 0.3s ease both',
        'toast-slide':'toastSlide 0.3s ease both',
        'spin-fast':  'spin 0.9s linear infinite',
        'shimmer':    'shimmer 2s infinite linear',
      },
      boxShadow: {
        'card':   '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md':'0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg':'0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
        'blue':   '0 4px 14px rgba(37,99,235,0.30)',
      },
    },
  },
  plugins: [],
}
