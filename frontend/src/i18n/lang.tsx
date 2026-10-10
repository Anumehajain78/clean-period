import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, hi, type Key } from './strings'

export type Lang = 'en' | 'hi'
type Vars = Record<string, string | number>

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: Key, vars?: Vars) => string
}

const Ctx = createContext<LangCtx | null>(null)

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('cp.lang')
    if (saved === 'en' || saved === 'hi') return saved
  } catch {
    /* storage unavailable */
  }
  return 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('cp.lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const t = useCallback(
    (key: Key, vars?: Vars) => {
      let s: string = (lang === 'hi' ? hi : en)[key]
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
      return s
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang: setLangState, t }), [lang, t])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang(): LangCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLang outside LangProvider')
  return c
}
