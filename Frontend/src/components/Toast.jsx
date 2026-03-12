export default function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]
                 bg-app-card border border-app-border text-app-text
                 px-6 py-3 rounded-full text-sm shadow-[0_4px_24px_rgba(0,0,0,0.4)]
                 animate-toast-slide whitespace-nowrap"
    >
      {message}
    </div>
  )
}
