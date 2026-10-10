import { useState } from 'react'
import { CompareView } from '../components/CompareView'
import { NoticePane } from '../components/NoticePane'
import { SetupRail } from '../components/SetupRail'
import { TimetableEditor } from '../components/TimetableEditor'
import { Button, Notice, Spinner, Tabs } from '../components/ui'
import { useLang } from '../i18n/lang'
import { tomorrow, weekdayLabel } from '../lib/format'
import { usePlanner } from '../state/usePlanner'

type Pane = 'setup' | 'timetable' | 'compare' | 'notice'

export function PlanView() {
  const { t, lang } = useLang()
  const p = usePlanner()
  const [pane, setPane] = useState<Pane>('timetable')
  const [sampleErr, setSampleErr] = useState(false)

  const make = async () => {
    if (await p.makePlan()) setPane('compare')
  }
  const sample = async () => {
    setSampleErr(false)
    const ok = await p.loadSampleData()
    if (!ok) setSampleErr(true)
    else setPane('timetable')
  }

  // On wide screens the rail is always visible, so "setup" falls back to the timetable.
  const shown: Pane = pane

  return (
    <div className="mx-auto flex h-full max-w-[1280px] min-h-0">
      <aside
        className={
          'min-h-0 w-full border-line bg-paper lg:block lg:w-[320px] lg:shrink-0 lg:border-r ' +
          (shown === 'setup' ? 'block' : 'hidden')
        }
      >
        <SetupRail p={p} onMake={make} onSample={sample} />
      </aside>

      <section
        className={'min-h-0 min-w-0 flex-1 flex-col lg:flex ' + (shown === 'setup' ? 'hidden' : 'flex')}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-2 lg:px-4">
          <Tabs<Pane>
            label="Plan"
            value={shown === 'setup' ? 'timetable' : shown}
            onChange={setPane}
            items={[
              { id: 'setup', label: t('paneSetup'), className: 'lg:hidden' },
              { id: 'timetable', label: t('paneTimetable') },
              { id: 'compare', label: t('paneCompare') },
              { id: 'notice', label: t('paneNotice') },
            ]}
            className="-ml-1 overflow-x-auto"
          />
          <span className="hidden shrink-0 text-sm text-muted sm:inline">
            {t('tomorrow')}: {tomorrow(lang)}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {p.error && (
            <div className="space-y-2 p-4 pb-0">
              <Notice tone="bad">
                {t('planFailed')} {t(p.error.key)}
                {p.error.detail && <> {t('serverSaid', { msg: p.error.detail })}</>}
              </Notice>
            </div>
          )}

          {shown === 'timetable' || shown === 'setup' ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4">
                <h2 className="text-lg font-semibold">{p.active.name || t('className')}</h2>
                {p.sampleDay && (
                  <span className="text-sm font-medium text-warn">
                    {t('sampleNoteDay', { day: weekdayLabel(p.sampleDay, lang) })}
                  </span>
                )}
              </div>
              {sampleErr && (
                <div className="px-4 pt-2">
                  <Notice tone="warn">{t('sampleFailed')}</Notice>
                </div>
              )}
              <TimetableEditor
                cls={p.active}
                onChange={(fn) => p.updateClass(p.active.id, fn)}
                onLoadSample={sample}
              />
            </div>
          ) : !p.plan ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="max-w-sm text-muted">{t('noPlanYet')}</p>
              {p.blocker && <p className="text-xs text-muted">{t(p.blocker)}</p>}
              <Button variant="primary" disabled={!!p.blocker || p.planning} onClick={make}>
                {p.planning ? (
                  <>
                    <Spinner /> {t('planning')}
                  </>
                ) : (
                  t('makePlan')
                )}
              </Button>
              <Button variant="quiet" onClick={() => setPane('timetable')}>
                {t('paneTimetable')}
              </Button>
            </div>
          ) : shown === 'compare' ? (
            <CompareView plan={p.plan} />
          ) : (
            <NoticePane p={p} />
          )}
        </div>

        {(shown === 'timetable' || shown === 'setup') && (
          <div className="shrink-0 border-t border-line bg-surface px-4 py-3 lg:hidden">
            {p.blocker && <p className="mb-2 text-xs text-muted">{t(p.blocker)}</p>}
            <Button variant="primary" className="w-full" disabled={!!p.blocker || p.planning} onClick={make}>
              {p.planning ? (
                <>
                  <Spinner /> {t('planning')}
                </>
              ) : (
                t('makePlan')
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
