import { useState, type FormEvent } from 'react'
import { useLang } from '../i18n/lang'
import { round4, searchPlaces, type Place } from '../lib/geo'
import type { Planner } from '../state/usePlanner'
import { Button, Field, Notice, Spinner, inputCls } from './ui'

function SectionTitle({ children }: { children: string }) {
  return <h2 className="display mb-3 text-[17px] font-semibold text-ink">{children}</h2>
}

function LocationPicker({ p }: { p: Planner }) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null)
  const [err, setErr] = useState<'search' | 'locate' | null>(null)
  const [editing, setEditing] = useState(false)
  const [manual, setManual] = useState(false)
  const s = p.school
  const has = s.lat.trim() !== '' && s.lng.trim() !== ''

  const search = async (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setBusy('search')
    setErr(null)
    try {
      setPlaces(await searchPlaces(query.trim()))
    } catch {
      setErr('search')
    } finally {
      setBusy(null)
    }
  }

  const pick = (pl: Place) => {
    p.setSchool({
      lat: round4(pl.latitude),
      lng: round4(pl.longitude),
      timezone: pl.timezone || 'Asia/Kolkata',
      place: pl.admin1 ? `${pl.name}, ${pl.admin1}` : pl.name,
    })
    setPlaces(null)
    setQuery('')
    setEditing(false)
  }

  const locate = () => {
    setErr(null)
    if (!navigator.geolocation) return setErr('locate')
    setBusy('locate')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        p.setSchool({ lat: round4(pos.coords.latitude), lng: round4(pos.coords.longitude), place: t('myLocation') })
        setBusy(null)
        setEditing(false)
      },
      () => {
        setErr('locate')
        setBusy(null)
      },
      { timeout: 10000 },
    )
  }

  if (has && !editing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-medium">{s.place || t('locationSet')}</p>
          <p className="num text-xs text-muted">
            {s.lat}, {s.lng}
          </p>
        </div>
        <Button small variant="quiet" onClick={() => setEditing(true)} className="-mr-1 shrink-0">
          {t('changeLocation')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <form onSubmit={search} className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('placeSearch')}</span>
          <input
            className={inputCls}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeSearchPlaceholder')}
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={busy !== null || !query.trim()}>
          {busy === 'search' ? <Spinner /> : t('find')}
        </Button>
      </form>

      {places && places.length === 0 && <p className="text-sm text-muted">{t('noPlaces')}</p>}
      {places && places.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {places.map((pl) => (
            <li key={pl.id}>
              <button type="button" onClick={() => pick(pl)} className="w-full px-3 py-2 text-left hover:bg-accent-wash">
                <span className="font-medium">{pl.name}</span>
                {pl.admin1 && <span className="text-muted">, {pl.admin1}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {err === 'search' && <Notice tone="warn">{t('placeFailed')}</Notice>}

      <div className="flex flex-wrap items-center gap-x-1">
        <Button small variant="quiet" onClick={locate} disabled={busy !== null} className="-ml-2.5">
          {busy === 'locate' ? <Spinner /> : null} {t('useMyLocation')}
        </Button>
        <Button small variant="quiet" onClick={() => setManual((m) => !m)}>
          {t('enterCoordinates')}
        </Button>
        {has && (
          <Button small variant="quiet" onClick={() => setEditing(false)}>
            {t('cancel')}
          </Button>
        )}
      </div>
      {err === 'locate' && <Notice tone="warn">{t('locationFailed')}</Notice>}

      {manual && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('latitude')}>
            <input
              className={inputCls + ' num'}
              inputMode="decimal"
              value={s.lat}
              onChange={(e) => p.setSchool({ lat: e.target.value, place: '' })}
            />
          </Field>
          <Field label={t('longitude')}>
            <input
              className={inputCls + ' num'}
              inputMode="decimal"
              value={s.lng}
              onChange={(e) => p.setSchool({ lng: e.target.value, place: '' })}
            />
          </Field>
        </div>
      )}
    </div>
  )
}

export function SetupRail({ p, onMake, onPickClass }: { p: Planner; onMake: () => void; onPickClass?: () => void }) {
  const { t } = useLang()

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
        <section>
          <SectionTitle>{t('school')}</SectionTitle>
          <div className="space-y-3">
            <Field label={t('schoolName')}>
              <input
                className={inputCls}
                value={p.school.name}
                placeholder={t('schoolNamePlaceholder')}
                onChange={(e) => p.setSchool({ name: e.target.value })}
              />
            </Field>
            <div>
              <span className="mb-1 block text-[13px] font-medium text-muted">{t('locationLabel')}</span>
              <LocationPicker p={p} />
              <p className="mt-2 text-xs text-muted">{t('forecastAreaNote')}</p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <SectionTitle>{t('classes')}</SectionTitle>
            <Button small variant="quiet" onClick={p.addClass} className="-mr-2">
              + {t('addClass')}
            </Button>
          </div>
          <ul className="space-y-1.5">
            {p.classes.map((c) => {
              const on = c.id === p.active.id
              const outdoor = c.periods.filter((x) => x.activity === 'pe').length
              return (
                <li key={c.id}>
                  <div
                    className={
                      'group flex items-center rounded-lg border transition-colors ' +
                      (on ? 'border-accent bg-accent-wash' : 'border-line bg-surface hover:border-muted/40')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        p.setActiveId(c.id)
                        onPickClass?.()
                      }}
                      aria-current={on}
                      className="min-w-0 flex-1 px-3 py-2 text-left"
                    >
                      <span className={'block truncate font-medium ' + (c.name.trim() ? '' : 'italic text-muted')}>
                        {c.name.trim() || t('unnamedClass')}
                      </span>
                      <span className="num block text-xs text-muted">
                        {c.periods.length === 1 ? t('periodsOne') : t('periodsCount', { n: c.periods.length })}
                        {outdoor > 0 && <> · {t('outdoorCount', { n: outdoor })}</>}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('removeClass')}
                      title={t('removeClass')}
                      onClick={() => {
                        if (!c.periods.length || window.confirm(t('removeClassConfirm'))) p.removeClass(c.id)
                      }}
                      className="mr-1.5 h-8 w-8 shrink-0 rounded-md text-lg leading-none text-muted opacity-60 hover:bg-wash hover:text-bad hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {p.classes.length > 0 && <p className="mt-2 text-xs text-muted">{t('addClassHint')}</p>}
        </section>

        <details className="group rounded-lg border border-line bg-surface">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
            {t('moreSettings')}
            <span className="text-muted transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-3 border-t border-line p-3">
            <Field label={t('groundCapacity')} hint={t('groundCapacityHelp')}>
              <input
                className={inputCls + ' num'}
                inputMode="numeric"
                placeholder={t('noLimit')}
                value={p.school.groundCapacity}
                onChange={(e) => p.setSchool({ groundCapacity: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted">{t('backendAssumptionsNote')}</p>
          </div>
        </details>
      </div>

      <div className="shrink-0 space-y-2 border-t border-line bg-surface px-4 py-3">
        {p.blocker && <p className="text-xs text-muted">{t(p.blocker)}</p>}
        <Button variant="primary" className="w-full" disabled={!!p.blocker || p.planning} onClick={onMake}>
          {p.planning ? (
            <>
              <Spinner /> {t('planning')}
            </>
          ) : (
            t('makePlan')
          )}
        </Button>
      </div>
    </div>
  )
}
