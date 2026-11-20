import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  Building2,
  ClipboardCheck,
  Compass,
  LayoutDashboard,
  Lock,
  Menu,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { navigate, useRoute } from './router'
import { initials } from '../lib/format'
import { Badge, Button, selectClass } from '../components/ui'

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'opportunities', label: 'Opportunities', icon: Compass },
  { key: 'optimizer', label: 'Budget Optimizer', icon: SlidersHorizontal },
  { key: 'recommendations', label: 'Recommendations', icon: ClipboardCheck },
  { key: 'suppliers', label: 'Suppliers', icon: Building2 },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-light via-brand to-brand-dark text-[11px] font-bold tracking-wide text-white shadow-[0_8px_18px_-8px_rgba(59,91,219,0.85)] ring-1 ring-inset ring-white/20">
        TBO
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold tracking-tight text-ink">Inventory Intelligence</span>
        <span className="block text-2xs text-ink-muted">Procurement decision support</span>
      </span>
    </div>
  )
}

function Sidebar({ route, onNavigate }: { route: string; onNavigate: () => void }) {
  const { profile, effectiveRole, sessionLocked } = useApp()

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-white">
      <div className="border-b border-line px-4 py-4">
        <Logo />
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {NAV.map((item) => {
          const active =
            route === item.key || (item.key === 'opportunities' && (route === 'opportunity' || route === 'detail'))
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                navigate(`/${item.key}`)
                onNavigate()
              }}
              className={clsx(
                'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200',
                active ? 'bg-brand-soft text-brand-dark' : 'text-ink-muted hover:translate-x-0.5 hover:bg-canvas hover:text-ink',
              )}
            >
              {active ? (
                <span className="animate-scale-in absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
              ) : null}
              <Icon className={clsx('h-4 w-4', active ? 'text-brand' : 'text-ink-soft')} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <button
          type="button"
          onClick={() => {
            navigate('/settings')
            onNavigate()
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-canvas"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-2xs font-semibold text-white">
            {initials(profile.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-ink">{profile.name}</span>
            <span className="block truncate text-2xs text-ink-muted">{effectiveRole}{sessionLocked ? ' · locked' : ''}</span>
          </span>
          <Settings className="h-3.5 w-3.5 text-ink-soft" />
        </button>
      </div>
    </aside>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { dataset, plan, setPlan, profile, sessionLocked, unlockSession } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-lg border border-line bg-white p-1.5 text-ink-muted lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-soft">Planning window</span>
          <select
            value={plan.horizonWeeks}
            onChange={(event) => setPlan({ horizonWeeks: Number(event.target.value) })}
            className={`${selectClass} h-7 py-0 text-2xs`}
            aria-label="Planning horizon in weeks"
          >
            <option value={8}>Next 8 weeks</option>
            <option value={12}>Next 12 weeks</option>
            <option value={16}>Next 16 weeks</option>
          </select>
          <select
            value={plan.currency}
            onChange={(event) => setPlan({ currency: event.target.value as 'INR' | 'USD' })}
            className={`${selectClass} h-7 py-0 text-2xs`}
            aria-label="Display currency"
          >
            <option value="INR">INR</option>
            <option value="USD">USD</option>
          </select>
          <span className="hidden text-2xs leading-none text-ink-muted xl:inline">Data as of {dataset.generatedAt.slice(0, 10)}</span>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        {sessionLocked ? (
          <button
            type="button"
            onClick={unlockSession}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-warn/30 bg-warn-soft px-2.5 text-2xs font-medium text-warn-dark"
            title="Unlock the session to restore privileged actions"
          >
            <Lock className="h-3 w-3" /> Session locked
          </button>
        ) : null}
        <Badge tone="brand" className="hidden h-7 items-center xl:inline-flex">
          <ShieldCheck className="h-3 w-3" /> Approval required
        </Badge>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="hidden h-8 sm:inline-flex">
          <Settings className="h-3.5 w-3.5" /> Settings
        </Button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg border border-line bg-white py-1 pl-1 pr-2.5"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-2xs font-semibold text-white">
            {initials(profile.name)}
          </span>
          <span className="hidden text-left text-2xs leading-tight sm:block">
            <span className="block font-medium text-ink">{profile.name}</span>
            <span className="block text-ink-muted">{profile.role}</span>
          </span>
        </button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="animate-scale-in absolute right-0 top-11 z-20 w-52 rounded-lg border border-line bg-white p-1 shadow-pop">
              <button
                type="button"
                onClick={() => {
                  navigate('/settings')
                  setMenuOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-ink hover:bg-canvas"
              >
                <Settings className="h-3.5 w-3.5 text-ink-soft" /> Data, profile & settings
              </button>
              <p className="border-t border-line px-2.5 py-2 text-2xs leading-relaxed text-ink-muted">
                Recommendations require approval. No purchase is executed by this workspace.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}

function Toasts() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className={clsx(
            'animate-slide-in rounded-lg border bg-white px-3.5 py-3 shadow-[0_16px_40px_-16px_rgba(22,32,44,0.35)]',
            toast.tone === 'success' && 'border-ok/30',
            toast.tone === 'error' && 'border-bad/30',
            toast.tone === 'info' && 'border-line',
          )}
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{toast.description}</p> : null}
            </div>
            <button type="button" onClick={() => dismissToast(toast.id)} className="text-ink-soft hover:text-ink" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Layout({ route, children }: { route: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [route])

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar route={route} onNavigate={() => undefined} />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="animate-slide-in relative h-full">
            <Sidebar route={route} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main key={route} className="animate-fade-in mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
        <footer className="border-t border-line bg-white/40 px-6 py-4 text-2xs text-ink-muted">
          Synthetic dataset for demonstration · All commitments require human approval · No purchases are executed.
        </footer>
      </div>
      <Toasts />
    </div>
  )
}
