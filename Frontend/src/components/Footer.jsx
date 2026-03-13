export default function Footer() {
  return (
    <footer className="bg-white border-t border-app-border py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-app-text-muted">
        <span>© 2024 Smart Notes Image Sorter. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <span className="hover:text-app-accent cursor-pointer transition-colors">Privacy Policy</span>
          <span className="hover:text-app-accent cursor-pointer transition-colors">Terms of Service</span>
          <span className="hover:text-app-accent cursor-pointer transition-colors">API Status</span>
        </div>
      </div>
    </footer>
  )
}
