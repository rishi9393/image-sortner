export default function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]
                 bg-white border border-app-border text-app-text
                 px-6 py-3 rounded-full text-sm shadow-card-lg
                 animate-toast-slide whitespace-nowrap flex items-center gap-2"
    >
      {message}
    </div>
  )
}
