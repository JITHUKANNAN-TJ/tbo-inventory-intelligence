import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowDownRight, ArrowUpRight, Info, Minus, X } from 'lucide-react'
import type { ActionType, DecisionStatus, Priority } from '../types'

/** Smoothly counts to a new value. Respects the user's reduced-motion setting. */
export function AnimatedNumber({
  value,
  format = (current) => Math.round(current).toLocaleString('en-IN'),
  duration = 750,
  className,
}: {
  value: number
  format?: (value: number) => string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const currentRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const clearTimers = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const finish = () => {
      currentRef.current = value
      setDisplay(value)
      clearTimers()
    }

    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || !Number.isFinite(value)) {
      finish()
      return
    }

    const from = currentRef.current
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (value - from) * eased
      currentRef.current = current
      setDisplay(current)
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else finish()
    }

    clearTimers()
    frameRef.current = requestAnimationFrame(tick)
    // Safety net for background tabs where animation frames are throttled.
    timeoutRef.current = window.setTimeout(finish, duration + 150)

    return clearTimers
  }, [value, duration])

  return <span className={clsx('tabular-nums', className)}>{format(display)}</span>
}

export function Card({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={clsx('surface', className)} style={style}>{children}</div>
}

export function CardHeader({
  title,
  description,
  action,
  eyebrow,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  eyebrow?: string
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 border-b border-line bg-gradient-to-b from-white to-canvas/30 px-5 py-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.1em] text-brand/80">{eyebrow}</p>
        ) : null}
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p> : null}
        {meta ? <p className="mt-1.5 text-2xs text-ink-soft">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md'

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-[13px]',
        variant === 'primary' && 'bg-gradient-to-b from-brand-light to-brand text-white shadow-[0_6px_16px_-8px_rgba(59,91,219,0.85)] hover:from-brand hover:to-brand-dark hover:shadow-[0_8px_20px_-8px_rgba(59,91,219,0.95)]',
        variant === 'secondary' && 'border border-line bg-gradient-to-b from-white to-canvas/70 text-ink hover:border-brand/30 hover:from-white hover:to-brand-soft/50',
        variant === 'ghost' && 'text-ink-muted hover:bg-canvas hover:text-ink',
        variant === 'danger' && 'border border-bad/30 bg-gradient-to-b from-white to-bad-soft/30 text-bad hover:bg-bad-soft',
        variant === 'success' && 'bg-gradient-to-b from-ok to-ok-dark text-white shadow-[0_6px_16px_-8px_rgba(15,139,126,0.75)] hover:from-ok hover:to-ok hover:brightness-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'outline'
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap ring-1 ring-inset',
        tone === 'neutral' && 'bg-canvas text-ink-muted ring-ink/5',
        tone === 'brand' && 'bg-brand-soft text-brand-dark ring-brand/10',
        tone === 'success' && 'bg-ok-soft text-ok-dark ring-ok/10',
        tone === 'warning' && 'bg-warn-soft text-warn-dark ring-warn/10',
        tone === 'danger' && 'bg-bad-soft text-bad-dark ring-bad/10',
        tone === 'outline' && 'border border-line bg-white text-ink-muted ring-transparent',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = priority === 'High' ? 'danger' : priority === 'Medium' ? 'warning' : 'neutral'
  return <Badge tone={tone}>{priority}</Badge>
}

const STATUS_TONE: Record<DecisionStatus, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Monitoring: 'brand',
  Completed: 'neutral',
}

export function StatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>
}

const ACTION_TONE: Record<ActionType, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  'Commit allotment': 'success',
  'Negotiate allotment': 'brand',
  'Negotiate access': 'brand',
  'Prioritise live supply': 'warning',
  Monitor: 'neutral',
  Avoid: 'danger',
}

export function ActionBadge({ action }: { action: ActionType }) {
  return <Badge tone={ACTION_TONE[action]}>{action}</Badge>
}

export function Term({ children, definition }: { children: ReactNode; definition: string }) {
  return (
    <span className="group relative inline-flex cursor-help items-center gap-1 border-b border-dashed border-ink-soft/70 text-inherit">
      {children}
      <Info className="h-3 w-3 text-ink-soft" aria-hidden />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-2xs font-normal leading-relaxed text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100">
        {definition}
      </span>
    </span>
  )
}

const GRADE_CLASS: Record<'default' | 'brand' | 'success' | 'warning' | 'danger', string> = {
  default: 'grade-default',
  brand: 'grade-brand',
  success: 'grade-success',
  warning: 'grade-warning',
  danger: 'grade-danger',
}

const TONE_BORDER: Record<'default' | 'brand' | 'success' | 'warning' | 'danger', string> = {
  default: 'rgba(22, 32, 44, 0.10)',
  brand: 'rgba(59, 91, 219, 0.34)',
  success: 'rgba(15, 139, 126, 0.32)',
  warning: 'rgba(178, 106, 0, 0.34)',
  danger: 'rgba(198, 71, 71, 0.32)',
}

const TONE_ICON_CLASS: Record<'default' | 'brand' | 'success' | 'warning' | 'danger', string> = {
  default: 'bg-canvas text-ink-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-ok-soft text-ok-dark',
  warning: 'bg-warn-soft text-warn-dark',
  danger: 'bg-bad-soft text-bad-dark',
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
  delta,
  delay = 0,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
  delta?: { label: string; tone?: 'success' | 'danger' | 'neutral' }
  delay?: number
}) {
  const DeltaIcon = delta?.tone === 'success' ? ArrowUpRight : delta?.tone === 'danger' ? ArrowDownRight : Minus
  return (
    <Card
      className={clsx('surface-hover animate-fade-up px-4 py-3.5', GRADE_CLASS[tone])}
      style={{
        borderTopColor: TONE_BORDER[tone],
        ...(delay ? { animationDelay: `${delay}ms` } : {}),
      }}
    >
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon ? (
          <span
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ring-black/5 transition-transform duration-300',
              TONE_ICON_CLASS[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{value}</p>
        {delta ? (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-medium tabular-nums',
              delta.tone === 'success' && 'bg-ok-soft text-ok-dark',
              delta.tone === 'danger' && 'bg-bad-soft text-bad-dark',
              (delta.tone === 'neutral' || !delta.tone) && 'bg-canvas text-ink-muted',
            )}
          >
            <DeltaIcon className="h-3 w-3" aria-hidden />
            {delta.label}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-2xs leading-relaxed text-ink-muted">{hint}</p> : null}
    </Card>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="animate-fade-up mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="mb-1 flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-gradient-ink text-[22px] font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-ink-soft">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-ink-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const titleId = 'modal-title'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-fade-in absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className={clsx('animate-scale-in relative w-full rounded-xl border border-line bg-white shadow-[0_24px_70px_-20px_rgba(22,32,44,0.4)]', width)}
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-ink">
        <span>{label}</span>
        {hint ? <span className="text-2xs font-normal text-ink-muted">{hint}</span> : null}
      </label>
      {children}
    </div>
  )
}

export const inputClass =
  'h-9 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15'

export const selectClass = `${inputClass} cursor-pointer pr-8`

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-[6px] font-medium transition-all duration-200 active:scale-[0.98]',
            size === 'sm' ? 'px-2.5 py-1 text-2xs' : 'px-3 py-1.5 text-xs',
            value === option.value
              ? 'bg-gradient-to-b from-ink to-ink-deep text-white shadow-[0_4px_10px_-6px_rgba(22,32,44,0.8)]'
              : 'text-ink-muted hover:bg-canvas hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'brand',
  className,
}: {
  value: number
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-canvas', className)}>
      <div
        className={clsx(
          'animate-grow-x h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'brand' && 'bg-gradient-to-r from-brand to-brand-light',
          tone === 'success' && 'bg-gradient-to-r from-ok-dark to-ok',
          tone === 'warning' && 'bg-gradient-to-r from-warn-dark to-warn',
          tone === 'danger' && 'bg-gradient-to-r from-bad-dark to-bad',
        )}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

export function Th({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={clsx(
        'whitespace-nowrap border-b border-line bg-canvas/60 px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.04em] text-ink-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, align = 'left' }: { children?: ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={clsx(
        'border-b border-line/70 px-4 py-3 text-[13px] text-ink',
        align === 'right' && 'text-right tabular-nums',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full min-w-[720px] border-collapse">{children}</table>
    </div>
  )
}

export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number
  pageCount: number
  total: number
  onPage: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-2xs text-ink-muted">
        {total.toLocaleString('en-IN')} records · page {page} of {Math.max(1, pageCount)}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export function Notice({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warning' | 'success'; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-l-[3px] px-3.5 py-3 text-xs leading-relaxed',
        tone === 'info' && 'border-brand/20 border-l-brand bg-brand-soft/60 text-brand-dark',
        tone === 'warning' && 'border-warn/25 border-l-warn bg-warn-soft/70 text-warn-dark',
        tone === 'success' && 'border-ok/20 border-l-ok bg-ok-soft/70 text-ok-dark',
        className,
      )}
    >
      {children}
    </div>
  )
}
