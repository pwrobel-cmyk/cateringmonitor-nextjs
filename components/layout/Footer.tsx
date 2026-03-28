export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          &copy; {new Date().getFullYear()} CateringMonitor &mdash; monitoring rynku
          cateringowego
        </span>
        <span className="flex items-center gap-3">
          <span>v1.0.0</span>
          <span className="w-px h-3 bg-slate-200" />
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Wszystkie systemy sprawne
          </span>
        </span>
      </div>
    </footer>
  );
}
