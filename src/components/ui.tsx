import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

const variants = {
  primary: 'bg-gain text-[var(--gain-ink)]',
  secondary: 'border border-stroke bg-[var(--field)] text-fg',
  ghost: 'bg-transparent text-fg',
  danger: 'bg-[var(--danger-soft)] text-danger',
} as const

const sizes = {
  large: 'h-14 w-full text-base',
  regular: 'h-10 px-3 text-sm',
} as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({ variant = 'primary', size = 'large', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-2xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gain ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[24px] border border-stroke bg-card p-4 ${className}`}>{children}</section>
}

export function PageHeader({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
        <h1 className="text-[32px] leading-none font-semibold tracking-tight">{title}</h1>
        {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
      </div>
      {action}
    </header>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
    </label>
  )
}

export const fieldClass = 'w-full rounded-xl bg-[var(--field)] px-3 py-3 text-fg outline-none'

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gain text-[var(--gain-ink)]"
    >
      {children}
    </button>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-stroke bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="sticky top-0 z-10 -mx-5 flex h-8 items-center justify-center bg-card">
          <span className="h-1.5 w-10 rounded-full bg-[var(--track)]" />
        </div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-[28px] border border-stroke bg-card p-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
