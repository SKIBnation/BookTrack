import { CalendarDays, Search, Settings, BookOpen } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookProvider, useLiveBookData } from '../hooks/useBookData.tsx'

const tabs = [
  { to: '/', label: 'Today', icon: BookOpen, end: true },
  { to: '/diary', label: 'Diary', icon: CalendarDays, end: false },
  { to: '/find', label: 'Find', icon: Search, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

const titles: Record<string, string> = {
  '/': 'Today',
  '/diary': 'Diary',
  '/find': 'Find',
  '/settings': 'Settings',
}

export function AppShell() {
  const data = useLiveBookData()

  useEffect(() => {
    if (!data.settings) return
    const root = document.documentElement
    root.dataset.theme = data.settings.theme
    const color = data.settings.theme === 'light' ? '#f2f2f7' : '#000000'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    try {
      localStorage.setItem('booktrack-theme', data.settings.theme)
    } catch {
      /* The theme is still stored in IndexedDB. */
    }
  }, [data.settings])

  if (data.loading || !data.settings) {
    return (
      <div className="app-frame mx-auto flex max-w-[480px] items-center justify-center bg-black text-white">
        <p className="text-sm text-white/70">Opening the book…</p>
      </div>
    )
  }

  return (
    <BookProvider settings={data.settings} bookings={data.bookings} tables={data.tables}>
      <ShellFrame />
    </BookProvider>
  )
}

function ShellFrame() {
  const location = useLocation()

  useEffect(() => {
    document.title = `${titles[location.pathname] ?? 'BookTrack'} · BookTrack`
  }, [location.pathname])

  return (
    <div className="app-frame relative mx-auto flex max-w-[480px] flex-col overflow-hidden bg-bg text-fg">
      <div className="shrink-0" style={{ height: 'env(safe-area-inset-top)' }} />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 pt-4 pb-8">
          <Outlet />
        </div>
      </main>
      <nav
        aria-label="Primary"
        className="shrink-0 border-t border-stroke bg-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[10px] leading-none font-medium tracking-tight ${isActive ? 'text-gain' : 'text-muted'}`
              }
            >
              <tab.icon size={22} strokeWidth={2} aria-hidden="true" />
              <span className="max-w-full truncate">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
