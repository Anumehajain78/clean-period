import { useState } from 'react'
import { useLang } from '../i18n/lang'
import type { Planner } from '../state/usePlanner'
import { Button, Field, Notice, Spinner, inputCls } from './ui'

export function SetupRail({
  p,
  onMake,
  onSample,
}: {
  p: Planner
  onMake: () => void
  onSample: () => void
}) {
  const { t } = useLang()
  const [locErr, setLocErr] = useState(false)

  const useLocation = () => {
    setLocErr(false)
    if (!navigator.geolocation) return setLocErr(true)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        p.setSchool({
          lat: pos.coords.latitude.toFixed(4),
          lng: pos.coords.longitude.toFixed(4),
        }),
      () => setLocErr(true),
      { timeout: 8000 },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section aria-labelledby="sch">
          <h2 id="sch" className="mb-2 text-sm font-semibold text-ink">
            {t('school')}
          </h2>
          <div className="space-y-3">
            <Field label={t('schoolName')}>
              <input className={inputCls} value={p.school.name} onChange={(e) => p.setSchool({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('latitude')}>
                <input
                  className={inputCls + ' num'}
                  inputMode="decimal"
                  placeholder="28.5629"
                  value={p.school.lat}
                  onChange={(e) => p.setSchool({ lat: e.target.value })}
                />
              </Field>
              <Field label={t('longitude')}>
                <input
                  className={inputCls + ' num'}
                  inputMode="decimal"
                  placeholder="77.1678"
                  value={p.school.lng}
                  onChange={(e) => p.setSchool({ lng: e.target.value })}
                />
              </Field>
            </div>
            <Button small variant="quiet" onClick={useLocation} className="-ml-2.5">
              {t('useMyLocation')}
            </Button>
            {locErr && <Notice tone="warn">{t('locationFailed')}</Notice>}
            <p className="text-xs text-muted">{t('forecastAreaNote')}</p>
          </div>
        </section>

        <details className="group rounded-[4px] border border-line bg-surface">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold">
            {t('assumptions')}
            <span className="text-xs font-medium text-warn">{t('assumption')}</span>
          </summary>
          <div className="space-y-3 border-t border-line p-3">
            <Field label={t('groundCapacity')} hint={t('groundCapacityHelp')}>
              <input
                className={inputCls + ' num'}
                inputMode="numeric"
                placeholder="–"
                value={p.school.groundCapacity}
                onChange={(e) => p.setSchool({ groundCapacity: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted">{t('backendAssumptionsNote')}</p>
          </div>
        </details>

        <section aria-labelledby="cls">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="cls" className="text-sm font-semibold">
              {t('classes')}
            </h2>
            <Button small variant="quiet" onClick={p.addClass}>
              + {t('addClass')}
            </Button>
          </div>
          <ul className="divide-y divide-line rounded-[4px] border border-line bg-surface">
            {p.classes.map((c) => {
              const on = c.id === p.active.id
              return (
                <li key={c.id} className={'flex items-center gap-2 ' + (on ? 'bg-accent-wash' : '')}>
                  {on ? (
                    <input
                      aria-label={t('className')}
                      value={c.name}
                      onChange={(e) => p.updateClass(c.id, (x) => ({ ...x, name: e.target.value }))}
                      className="h-10 min-w-0 flex-1 bg-transparent px-3 text-[15px] font-medium focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => p.setActiveId(c.id)}
                      className="h-10 min-w-0 flex-1 truncate px-3 text-left text-[15px] hover:bg-wash"
                    >
                      {c.name || t('className')}
                    </button>
                  )}
                  <span className="num shrink-0 text-xs text-muted">{c.periods.length === 1 ? t('periodsOne') : t('periodsCount', { n: c.periods.length })}</span>
                  {p.classes.length > 1 ? (
                    <button
                      type="button"
                      aria-label={t('removeClass')}
                      title={t('removeClass')}
                      onClick={() => p.removeClass(c.id)}
                      className="mr-1 h-8 w-8 shrink-0 rounded-[4px] text-lg leading-none text-muted hover:bg-wash hover:text-bad"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="mr-1 w-8" />
                  )}
                </li>
              )
            })}
          </ul>
          <Button small variant="quiet" onClick={onSample} className="-ml-2.5 mt-1">
            {t('loadSample')}
          </Button>
        </section>
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
