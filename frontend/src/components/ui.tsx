import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const inputCls =
  'h-9 w-full rounded-[4px] border border-line bg-surface px-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-wash disabled:text-muted'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet'
  small?: boolean
}

export function Button({ variant = 'secondary', small, className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[4px] font-medium transition-colors disabled:opacity-50 '
  const size = small ? 'h-8 px-2.5 text-sm ' : 'h-10 px-4 text-[15px] '
  const look =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-dark'
      : variant === 'secondary'
        ? 'border border-line bg-surface text-ink hover:bg-wash'
        : 'text-accent hover:bg-accent-wash'
  return <button type="button" className={base + size + look + ' ' + className} {...rest} />
}

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={'block ' + className}>
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export interface TabItem<T extends string> {
  id: T
  label: string
  disabled?: boolean
  className?: string
}

/** Underlined tabs. Used for the main nav and the Plan panes. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={'flex gap-1 ' + className}>
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            role="tab"
            type="button"
            aria-selected={on}
            disabled={it.disabled}
            onClick={() => onChange(it.id)}
            className={
              'relative h-11 whitespace-nowrap px-3 text-[15px] font-medium disabled:text-muted/50 ' +
              (on ? 'text-accent' : 'text-muted hover:text-ink') +
              ' ' +
              (it.className ?? '')
            }
          >
            {it.label}
            {on && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}

/** Small two-or-more option switch. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={'inline-flex overflow-hidden rounded-[4px] border border-line bg-surface ' + className}
    >
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          aria-pressed={it.id === value}
          onClick={() => onChange(it.id)}
          className={
            'h-8 px-3 text-sm font-medium ' +
            (i > 0 ? 'border-l border-line ' : '') +
            (it.id === value ? 'bg-accent text-white' : 'text-ink hover:bg-wash')
          }
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'bad'
  children: ReactNode
}) {
  const cls =
    tone === 'bad'
      ? 'border-bad/40 bg-[#f7e6e6] text-bad'
      : tone === 'warn'
        ? 'border-warn/30 bg-warn-wash text-warn'
        : 'border-line bg-wash text-muted'
  return <div className={'rounded-[4px] border px-3 py-2 text-sm ' + cls}>{children}</div>
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
