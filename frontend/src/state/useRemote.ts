import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'

export type Remote<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; data: T }
  | { state: 'error'; detail?: string; network?: boolean }

/** Run `load` whenever `key` changes (and is not null). Keeps the last result for the same key. */
export function useRemote<T>(key: string | null, load: () => Promise<T>): [Remote<T>, () => void] {
  const [res, setRes] = useState<{ key: string | null; value: Remote<T> }>({ key: null, value: { state: 'idle' } })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (key === null) return
    let live = true
    setRes({ key, value: { state: 'loading' } })
    load().then(
      (data) => live && setRes({ key, value: { state: 'ok', data } }),
      (e) =>
        live &&
        setRes({
          key,
          value: { state: 'error', detail: e instanceof ApiError ? e.detail : undefined, network: e instanceof ApiError && e.kind === 'network' },
        }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  return [res.key === key ? res.value : { state: 'idle' }, () => setNonce((n) => n + 1)]
}
