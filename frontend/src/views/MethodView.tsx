import type { ReactNode } from 'react'
import { useLang } from '../i18n/lang'
import type { Key } from '../i18n/strings'
import { BANDS } from '../lib/aqi'

// Published values, shown for reading only. The calculation uses backend/config/dose_config.json.
const RATES: { key: Key; v: string }[] = [
  { key: 'rateSedentary', v: '0.0048' },
  { key: 'rateLight', v: '0.011' },
  { key: 'rateModerate', v: '0.022' },
  { key: 'rateHigh', v: '0.042' },
]

const BAND_LABEL: Record<(typeof BANDS)[number]['key'], Key> = {
  good: 'bandGood',
  satisfactory: 'bandSatisfactory',
  moderate: 'bandModerate',
  poor: 'bandPoor',
  verypoor: 'bandVerypoor',
  severe: 'bandSevere',
}
const BAND_RANGE = ['0–30', '31–60', '61–90', '91–120', '121–250', '> 250']

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-3">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function MethodView() {
  const { t } = useLang()
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-4 py-5 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('methodTitle')}</h1>

        <div className="mt-4 grid gap-x-10 gap-y-5 lg:grid-cols-2">
          <div className="space-y-5">
            <Block title={t('formulaTitle')}>
              <p className="rounded-[4px] bg-wash px-3 py-2 font-mono text-[13px]">{t('formula')}</p>
              <p className="mt-2 text-[15px] text-muted">{t('formulaBody')}</p>
            </Block>

            <Block title={t('ratesTitle')}>
              <table className="w-full text-sm">
                <tbody>
                  {RATES.map((r) => (
                    <tr key={r.key} className="border-b border-line last:border-b-0">
                      <td className="py-1.5">{t(r.key)}</td>
                      <td className="num py-1.5 text-right font-medium">{r.v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted">
                {t('rateUnit')}. {t('ratesSource')}
              </p>
            </Block>

            <Block title={t('rulesTitle')}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>{t('rule1')}</li>
                <li>{t('rule2')}</li>
                <li>{t('rule3')}</li>
                <li>{t('rule4')}</li>
                <li>{t('rule5')}</li>
              </ul>
            </Block>
          </div>

          <div className="space-y-5">
            <Block title={t('bandsTitle')}>
              <table className="w-full text-sm">
                <tbody>
                  {BANDS.map((b, i) => (
                    <tr key={b.key} className="border-b border-line last:border-b-0">
                      <td className="w-6 py-1.5">
                        <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: b.color }} />
                      </td>
                      <td className="py-1.5">{t(BAND_LABEL[b.key])}</td>
                      <td className="num py-1.5 text-right">{BAND_RANGE[i]} µg/m³</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted">{t('bandsSource')}</p>
              <p className="mt-1 text-xs font-medium text-warn">{t('bandsApprox')}</p>
              <p className="mt-3 text-sm">
                <span className="font-medium">{t('badDayTitle')}. </span>
                <span className="text-muted">{t('badDayBody')}</span>
              </p>
            </Block>

            <Block title={t('limitsTitle')}>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>{t('limit1')}</li>
                <li>{t('limit2')}</li>
                <li>{t('limit3')}</li>
                <li>{t('limit4')}</li>
                <li>{t('limit5')}</li>
              </ul>
            </Block>

            <Block title={t('creditsTitle')}>
              <p className="text-sm text-muted">{t('credits')}</p>
            </Block>
          </div>
        </div>
      </div>
    </div>
  )
}
