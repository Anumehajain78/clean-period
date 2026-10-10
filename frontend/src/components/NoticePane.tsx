import { useEffect, useState } from 'react'
import { useLang } from '../i18n/lang'
import type { Planner } from '../state/usePlanner'
import { Button, Notice, Segmented, Spinner } from './ui'

function NoticeBox({ title, text, lang }: { title: string; text: string; lang: 'en' | 'hi' }) {
  const { t } = useLang()
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      /* clipboard blocked: user can still select the text */
    }
  }
  return (
    <section className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button small onClick={copy}>
          {done ? t('copied') : t('copy')}
        </Button>
      </div>
      <div
        lang={lang}
        className="whitespace-pre-wrap rounded-[4px] border border-line bg-surface p-3 text-[15px] leading-relaxed"
      >
        {text}
      </div>
    </section>
  )
}

export function NoticePane({ p }: { p: Planner }) {
  const { t } = useLang()
  const [side, setSide] = useState<'en' | 'hi'>('en')
  const { plan, notice, noticeState, loadNotice } = p

  useEffect(() => {
    if (plan && !notice && noticeState === 'idle') void loadNotice()
  }, [plan, notice, noticeState, loadNotice])

  if (!plan) return <div className="p-6 text-muted">{t('noPlanYet')}</div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('noticeFor')}</h2>
        {notice && (
          <span className="text-xs text-muted">
            {notice.source === 'ai' ? t('noticeWritten') : t('noticeTemplate')}
          </span>
        )}
      </div>

      {notice?.fallback_reason && (
        <Notice tone="warn">{t('noticeFallback', { reason: notice.fallback_reason })}</Notice>
      )}

      {noticeState === 'loading' && !notice && (
        <p className="flex items-center gap-2 text-muted">
          <Spinner /> {t('noticeLoading')}
        </p>
      )}
      {noticeState === 'error' && (
        <div className="space-y-2">
          <Notice tone="bad">{t('noticeFailed')}</Notice>
          <Button small onClick={() => void loadNotice()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {notice && (
        <>
          <Segmented
            label={t('noticeFor')}
            value={side}
            onChange={setSide}
            className="md:hidden"
            items={[
              { id: 'en', label: t('noticeEn') },
              { id: 'hi', label: t('noticeHi') },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className={side === 'hi' ? 'hidden md:block' : ''}>
              <NoticeBox title={t('noticeEn')} text={notice.en} lang="en" />
            </div>
            <div className={side === 'en' ? 'hidden md:block' : ''}>
              <NoticeBox title={t('noticeHi')} text={notice.hi} lang="hi" />
            </div>
          </div>
          {notice.label && <p className="text-xs text-muted">{notice.label}</p>}
        </>
      )}
    </div>
  )
}
