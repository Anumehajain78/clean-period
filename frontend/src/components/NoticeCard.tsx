import { useState } from 'react'
import { t, type Lang, type StringKey } from '../i18n/strings'
import type { NoticeResponse } from '../types'

function NoticeText({ lang, title, text, textLang }: { lang: Lang; title: StringKey; text: string; textLang: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(lang, title)}</h3>
        <button type="button" onClick={copy}
          className="rounded-full border border-emerald-700 px-3 py-0.5 text-xs font-medium text-emerald-800">
          {copied ? t(lang, 'copied') : t(lang, 'copy')}
        </button>
      </div>
      <p lang={textLang} className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
    </div>
  )
}

export function NoticeCard({ notice, lang }: { notice: NoticeResponse; lang: Lang }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">{t(lang, 'noticeTitle')}</h2>
      <p className="mb-3 text-xs text-stone-500">
        {notice.source === 'ai' ? t(lang, 'noticeByAi') : t(lang, 'noticeByTemplate')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <NoticeText lang={lang} title="hindi" text={notice.hi} textLang="hi" />
        <NoticeText lang={lang} title="english" text={notice.en} textLang="en" />
      </div>
    </section>
  )
}
