import { Component, type ReactNode, useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell.tsx'
import { LoadingScreen } from './components/LoadingScreen.tsx'
import { db } from './lib/db.ts'
import { DiaryPage } from './pages/DiaryPage.tsx'
import { FindPage } from './pages/FindPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { TodayPage } from './pages/TodayPage.tsx'

export default function App() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    db.open()
      .then(() => setState('ready'))
      .catch(() => setState('error'))
  }, [])

  if (!introDone || state === 'loading') return <LoadingScreen onDone={() => setIntroDone(true)} />

  if (state === 'error') {
    return (
      <div className="app-frame mx-auto flex max-w-[480px] flex-col justify-center bg-black px-6 text-white">
        <p className="text-2xl font-semibold">BookTrack can’t open its storage</p>
        <p className="mt-2 text-sm leading-6 text-white/70">
          On-device storage is blocked. Leave private browsing, allow site data, then open BookTrack again.
        </p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="diary" element={<DiaryPage />} />
            <Route path="find" element={<FindPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : 'Something went wrong.' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="app-frame mx-auto flex max-w-[480px] flex-col justify-center bg-black px-6 text-white">
          <p className="text-2xl font-semibold">BookTrack hit a problem</p>
          <p className="mt-2 text-sm leading-6 text-white/70">{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
