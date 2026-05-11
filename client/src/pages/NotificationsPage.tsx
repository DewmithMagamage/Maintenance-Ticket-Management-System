import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type N = { id: number; message: string; ticket_id: number | null; read_at: string | null; created_at: string }

export function NotificationsPage() {
  const [rows, setRows] = useState<N[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const list = await api<N[]>('/notifications')
    setRows(list)
  }

  useEffect(() => {
    let c = true
    ;(async () => {
      try {
        await refresh()
      } finally {
        if (c) setLoading(false)
      }
    })()
    return () => {
      c = false
    }
  }, [])

  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' })
    await refresh()
  }

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST' })
    await refresh()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-bw-navy">Notifications</h1>
        <Button variant="outline" onClick={() => void markAll()}>
          Mark all read
        </Button>
      </div>
      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((n) => (
            <Card key={n.id} className={n.read_at ? 'opacity-70' : 'border-bw-blue/30'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-slate-900">{n.message}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>{new Date(n.created_at).toLocaleString()}</span>
                {!n.read_at && (
                  <Button size="sm" variant="secondary" onClick={() => void markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {!rows.length && <p className="text-slate-600">You have no notifications.</p>}
        </div>
      )}
    </div>
  )
}
