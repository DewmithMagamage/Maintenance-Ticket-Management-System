const FILE_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

/** Base URL for REST calls (`/api/...` on same origin, or `https://api.host/api` when `VITE_API_BASE` is set). */
export const API_ROOT = FILE_BASE ? `${FILE_BASE}/api` : '/api'

function authHeader(): HeadersInit {
  const t = localStorage.getItem('bw_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
    ...((authHeader() as Record<string, string>) || {}),
  }
  let body = init?.body
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${API_ROOT}${path}`, { ...init, headers, body })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type')
  if (ct?.includes('application/json')) return res.json() as Promise<T>
  return undefined as T
}

export function uploadsUrl(path: string) {
  if (!path) return ''
  const name = path.split(/[/\\]/).pop() || path
  return FILE_BASE ? `${FILE_BASE}/uploads/${name}` : `/uploads/${name}`
}

export async function downloadBinary(path: string, filename: string) {
  const t = localStorage.getItem('bw_token')
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
