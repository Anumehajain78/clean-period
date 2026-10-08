import { useState } from 'react'
import { currentPosition, round4, searchPlaces, type Place } from '../geo'
import { t, type Lang } from '../i18n/strings'
import type { School } from '../types'
import { input } from '../ui'

export function SchoolCard({ lang, school, onChange }: {
  lang: Lang
  school: School
  onChange: (patch: Partial<School>) => void
}) {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState<'search' | 'locate' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy('search')
    setErr(null)
    try {
      setPlaces(await searchPlaces(query.trim()))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function onLocate() {
    setBusy('locate')
    setErr(null)
    try {
      const p = await currentPosition()
      onChange({ latitude: round4(p.latitude), longitude: round4(p.longitude) })
      setPlaces(null)
    } catch (e) {
      setErr(`${t(lang, 'locationError')}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const hasLocation = school.latitude !== null && school.longitude !== null

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="mb-3 text-lg font-semibold">{t(lang, 'school')}</h2>
      <label className="block text-xs text-stone-600">
        {t(lang, 'schoolName')}
        <input className={input} value={school.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>

      <form onSubmit={onSearch} className="mt-3 flex gap-2">
        <label className="flex-1 text-xs text-stone-600">
          {t(lang, 'searchPlace')}
          <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="New Delhi" />
        </label>
        <button type="submit" disabled={busy !== null}
          className="self-end rounded-md bg-stone-800 px-3 py-1.5 text-sm text-white disabled:opacity-60">
          {busy === 'search' ? t(lang, 'searching') : t(lang, 'find')}
        </button>
      </form>
      {places && places.length === 0 && <p className="mt-2 text-xs text-stone-600">{t(lang, 'noPlaces')}</p>}
      {places && places.length > 0 && (
        <ul className="mt-2 divide-y divide-stone-100 rounded-md border border-stone-200">
          {places.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full px-2 py-1.5 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  onChange({ latitude: round4(p.latitude), longitude: round4(p.longitude), timezone: p.timezone })
                  setPlaces(null)
                  setQuery(p.name)
                }}>
                {p.name}{p.admin1 ? `, ${p.admin1}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onLocate} disabled={busy !== null}
        className="mt-2 text-sm font-medium text-emerald-800 underline disabled:opacity-60">
        {busy === 'locate' ? t(lang, 'locating') : t(lang, 'useMyLocation')}
      </button>
      {err && <p role="alert" className="mt-1 text-xs text-red-700">{err}</p>}

      <p className="mt-3 text-sm">
        {t(lang, 'locationNow')}:{' '}
        <span className={hasLocation ? 'tabular-nums' : 'text-red-700'}>
          {hasLocation ? `${school.latitude}, ${school.longitude}` : t(lang, 'noLocation')}
        </span>
      </p>
      <p className="mt-1 text-xs text-stone-500">{t(lang, 'cityEnough')} {t(lang, 'placeSource')}</p>
    </div>
  )
}
