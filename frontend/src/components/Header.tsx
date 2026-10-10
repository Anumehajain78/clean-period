import { useLang } from '../i18n/lang'
import { Segmented, Tabs } from './ui'

export type View = 'plan' | 'evidence' | 'method'

export function Header({ view, onView }: { view: View; onView: (v: View) => void }) {
  const { lang, setLang, t } = useLang()
  const items = [
    { id: 'plan' as const, label: t('tabPlan') },
    { id: 'evidence' as const, label: t('tabEvidence') },
    { id: 'method' as const, label: t('tabMethod') },
  ]
  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-baseline gap-2 py-2.5">
            <span className="text-[17px] font-semibold tracking-tight text-ink">{t('appName')}</span>
            <span className="hidden text-sm text-muted md:inline">{t('tagline')}</span>
          </div>
          <Tabs
            label="Sections"
            items={items}
            value={view}
            onChange={onView}
            className="hidden sm:flex"
          />
        </div>
        <Segmented
          label={t('language')}
          value={lang}
          onChange={setLang}
          items={[
            { id: 'en', label: 'EN' },
            { id: 'hi', label: 'हिंदी' },
          ]}
        />
      </div>
      <Tabs
        label="Sections"
        items={items}
        value={view}
        onChange={onView}
        className="border-t border-line px-2 sm:hidden [&>button]:flex-1"
      />
    </header>
  )
}
