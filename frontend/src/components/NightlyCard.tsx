import { useState } from 'react'
import { latestNightly, saveSchool, updateSchool } from '../api'
import { t, type Lang } from '../i18n/strings'
import { loadSaved, storeSaved } from '../storage'
import type { NightlyResult, SavedSchool, Timetable } from '../types'
import { NoticeCard } from './NoticeCard'
import { PlanResult } from './PlanResult'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function NightlyCard({ lang, timetable, canSave }: { lang: Lang; timetable: Timetable; canSave: boolean }) {
  const [saved, setSaved] = useState<SavedSchool | null>(() => loadSaved())
  const [busy, setBusy] = useState<'save' | 'update' | 'load' | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [err, setErr] = useState<{ kind: 'save' | 'update' | 'load'; text: string } | null>(null)
  const [result, setResult] = useState<NightlyResult | null>(null)

  async function act(kind: 'save' | 'update' | 'load', fn: () => Promise<void>) {
    setBusy(kind)
    setErr(null)
    setInfo(null)
    try {
      await fn()
    } catch (e) {
      setErr({ kind, text: message(e) })
      if (message(e) === 'school not found') {
        storeSaved(null)
        setSaved(null)
      }
    } finally {
      setBusy(null)
    }
  }

  const onSave = () => act('save', async () => {
    const s = await saveSchool(timetable)
    storeSaved(s)
    setSaved(s)
  })
  const onUpdate = () => act('update', async () => {
    if (!saved) return
    await updateSchool(saved, timetable)
    setInfo(t(lang, 'updated'))
  })
  const onLoad = () => act('load', async () => {
    if (!saved) return
    setResult(null)
    setResult(await latestNightly(saved.id))
  })

  const button = 'rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-60'

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-lg font-semibold">{t(lang, 'nightlyTitle')}</h2>
        <p className="mb-3 text-sm text-stone-600">{t(lang, 'nightlyHelp')}</p>

        {!saved ? (
          <button type="button" onClick={onSave} disabled={!canSave || busy !== null} className={button}>
            {busy === 'save' ? t(lang, 'saving') : t(lang, 'saveSchool')}
          </button>
        ) : (
          <>
            <p className="text-sm">{t(lang, 'savedAs')}: <code className="rounded bg-stone-100 px-1">{saved.id}</code></p>
            <p className="mt-1 text-xs text-amber-800">{t(lang, 'keyWarning')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onUpdate} disabled={!canSave || busy !== null} className={button}>
                {busy === 'update' ? t(lang, 'saving') : t(lang, 'updateSaved')}
              </button>
              <button type="button" onClick={onLoad} disabled={busy !== null} className={button}>
                {busy === 'load' ? t(lang, 'loadingNightly') : t(lang, 'showNightly')}
              </button>
            </div>
          </>
        )}
        {info && <p className="mt-2 text-sm text-emerald-800">{info}</p>}
        {err?.kind === 'load' && err.text.startsWith('no nightly plan') && (
          <p className="mt-2 text-sm text-stone-700">{t(lang, 'nightlyNone')}</p>
        )}
        {err && !(err.kind === 'load' && err.text.startsWith('no nightly plan')) && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {t(lang, err.kind === 'load' ? 'loadError' : 'saveError')}: {err.text}
          </p>
        )}

        {result && (
          <p className="mt-3 text-xs text-stone-500">
            {t(lang, 'planFor')} {result.date} · {t(lang, 'nightlyMadeAt')} {new Date(result.created_at * 1000).toLocaleString()}
          </p>
        )}
        {result?.status === 'no_school' && <p className="mt-1 text-sm">{t(lang, 'nightlyNoSchool')}</p>}
        {result?.status === 'error' && (
          <p role="alert" className="mt-1 text-sm text-red-700">{t(lang, 'nightlyFailed')}: {result.reason}</p>
        )}
      </div>
      {result?.status === 'planned' && result.plan && <PlanResult plan={result.plan} lang={lang} />}
      {result?.status === 'planned' && result.plan && result.notice && (
        <NoticeCard lang={lang} notice={{ ...result.notice, label: result.plan.label }} />
      )}
    </section>
  )
}
