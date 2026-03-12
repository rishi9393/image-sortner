export default function Header() {
  return (
    <header className="bg-app-card border-b border-app-border">
      <div className="max-w-4xl mx-auto px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">📚</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#6c63ff] to-[#a78bfa] bg-clip-text text-transparent">
            Smart Notes Sorter
          </span>
        </div>
        <p className="text-app-text-sec text-sm">
          Upload shuffled note images → get them sorted automatically
        </p>
      </div>
    </header>
  )
}
