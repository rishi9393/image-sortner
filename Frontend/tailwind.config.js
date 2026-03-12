/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg':           '#0f1117',
        'app-card':         '#1a1d27',
        'app-card2':        '#20232f',
        'app-border':       '#2e3140',
        'app-border-hover': '#4a4f66',
        'app-text':         '#e8eaf0',
        'app-text-sec':     '#8b90a8',
        'app-text-muted':   '#555b72',
        'app-accent':       '#6c63ff',
        'app-accent-h':     '#7c74ff',
        'app-success':      '#22c55e',
        'app-warning':      '#f59e0b',
        'app-error':        '#ef4444',
        'app-info':         '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        toastSlide: {
          from: { opacity: '0', transform: 'translateX(-50%) translateY(12px)' },
          to:   { opacity: '1', transform: 'translateX(-50%) translateY(0)' },
        },
      },
      animation: {
        'fade-up':    'fadeUp 0.35s ease both',
        'toast-slide':'toastSlide 0.3s ease both',
        'spin-fast':  'spin 1s linear infinite',
      },
    },
  },
  plugins: [],
}
