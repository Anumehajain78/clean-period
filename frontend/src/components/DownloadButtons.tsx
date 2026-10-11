import { useState } from 'react'
import { useLang } from '../i18n/lang'
import { downloadCsv, printSheets, safeName, type Sheet } from '../lib/download'
import { Button } from './ui'

/** "Download CSV" and "Print / save PDF" for one or more timetables. */
export function DownloadButtons({ fileBase, docTitle, sheets }: { fileBase: string; docTitle: string; sheets: Sheet[] }) {
  const { t, lang } = useLang()
  const [blocked, setBlocked] = useState(false)
  const empty = sheets.every((s) => s.rows.length === 0)
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button small variant="quiet" disabled={empty} onClick={() => downloadCsv(safeName(fileBase), sheets)}>
        ↓ {t('downloadCsv')}
      </Button>
      <Button
        small
        variant="quiet"
        disabled={empty}
        onClick={() => setBlocked(!printSheets(docTitle, sheets, t('printFooter'), lang))}
      >
        {t('printPdf')}
      </Button>
      {blocked && <span className="text-xs text-warn">{t('popupBlocked')}</span>}
    </div>
  )
}
