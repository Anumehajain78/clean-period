// Download a timetable as CSV (opens in Excel / Google Sheets) or as a printable
// page the browser can save as PDF. No libraries.

export interface Sheet {
  title: string // e.g. class name
  subtitle?: string // e.g. date, school
  head: string[]
  rows: string[][]
  outdoor?: boolean[] // per row: shaded as an outdoor period when printed
  movedCol?: number // index of a column whose non-empty cells mark a moved row
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function safeName(s: string): string {
  return (s.trim() || 'timetable').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** One CSV for one or more sheets. The leading BOM makes Excel read Hindi correctly. */
export function downloadCsv(fileName: string, sheets: Sheet[]) {
  const lines: string[] = []
  sheets.forEach((s, i) => {
    if (i > 0) lines.push('')
    if (sheets.length > 1) lines.push(csvCell(s.title))
    lines.push(s.head.map(csvCell).join(','))
    for (const r of s.rows) lines.push(r.map(csvCell).join(','))
  })
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.csv') ? fileName : fileName + '.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Open a clean printable timetable; the browser's print dialog can save it as PDF. */
export function printSheets(docTitle: string, sheets: Sheet[], footer: string, lang: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  const body = sheets
    .map(
      (s) => `<section>
  <h2>${esc(s.title)}</h2>${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ''}
  <table><thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
  ${s.rows
    .map((r, i) => {
      const cls = [s.outdoor?.[i] ? 'out' : '', s.movedCol != null && r[s.movedCol] ? 'moved' : '']
        .filter(Boolean)
        .join(' ')
      return `<tr class="${cls}">${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`
    })
    .join('\n')}
  </tbody></table></section>`,
    )
    .join('\n')
  w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(docTitle)}</title>
<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{font-family:Mukta,system-ui,sans-serif;color:#16201c;margin:32px;font-size:14px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:17px;margin:24px 0 2px} .sub{color:#5a6661;margin:0 0 8px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #d6ddd9;padding:6px 8px;text-align:left}
  th{background:#e9eeeb;font-weight:600} tr.out td{background:#f6e7d6} tr.moved td:first-child{border-left:4px solid #1f4d3f}
  section{break-inside:avoid} footer{margin-top:24px;color:#5a6661;font-size:12px}
  @media print{body{margin:12mm}}
</style></head><body><h1>${esc(docTitle)}</h1>${body}<footer>${esc(footer)}</footer>
<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`)
  w.document.close()
  return true
}
