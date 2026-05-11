import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, uploadsUrl } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Ticket = {
  id: number
  ticket_number: string
  title: string
  description: string
  priority: string
  status: string
  location_room: string | null
  contact_person: string
  contact_number: string
  branch_name: string
  category_name: string
  category_slug: string
  department_name: string | null
  department_id: number | null
  created_at: string
  completed_at: string | null
  created_by: number
  created_by_name: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  satisfaction_rating: number | null
  satisfaction_comment: string | null
}

type Attachment = { id: number; filename: string; url: string }
type Comment = { id: number; body: string; created_at: string; username: string; full_name: string | null }
type AuditRow = { id: number; action: string; details: Record<string, unknown>; created_at: string; username: string | null; full_name: string | null }
type Department = { id: number; name: string }
type UserRow = {
  id: number
  username: string
  full_name: string | null
  role: string
  department_id: number | null
}

export function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [data, setData] = useState<{ ticket: Ticket; attachments: Attachment[]; comments: Comment[] } | null>(
    null
  )
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [staff, setStaff] = useState<UserRow[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [adminDept, setAdminDept] = useState('')
  const [adminAssign, setAdminAssign] = useState('')
  const [adminStatus, setAdminStatus] = useState('')
  const [deptStatus, setDeptStatus] = useState('')
  const [rating, setRating] = useState('5')
  const [ratingNote, setRatingNote] = useState('')

  const load = async () => {
    if (!id) return
    const res = await api<{ ticket: Ticket; attachments: Attachment[]; comments: Comment[] }>(
      `/tickets/${id}`
    )
    setData(res)
    setAdminDept(res.ticket.department_id ? String(res.ticket.department_id) : '')
    setAdminAssign(res.ticket.assigned_to ? String(res.ticket.assigned_to) : '')
    setAdminStatus(res.ticket.status)
    setDeptStatus(res.ticket.status)
    const aud = await api<AuditRow[]>(`/tickets/${id}/audit`)
    setAudit(aud)
  }

  useEffect(() => {
    let c = true
    ;(async () => {
      try {
        await load()
      } catch (e) {
        if (c) setErr(e instanceof Error ? e.message : 'Failed to load ticket')
      }
    })()
    return () => {
      c = false
    }
  }, [id])

  useEffect(() => {
    if (user?.role !== 'admin') return
    let cancelled = false
    ;(async () => {
      try {
        const [d, u] = await Promise.all([
          api<Department[]>('/departments'),
          api<UserRow[]>('/users'),
        ])
        if (!cancelled) {
          setDepartments(d)
          setStaff(u.filter((x) => x.role === 'dept_staff'))
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role])

  const ticket = data?.ticket

  const assignable = staff.filter(
    (s) => !adminDept || String(s.department_id) === String(adminDept)
  )

  async function postComment(e: FormEvent) {
    e.preventDefault()
    if (!id || !comment.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/tickets/${id}/comments`, { method: 'POST', json: { body: comment.trim() } })
      setComment('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post comment')
    } finally {
      setBusy(false)
    }
  }

  async function saveAdmin(e: FormEvent) {
    e.preventDefault()
    if (!id || user?.role !== 'admin') return
    setBusy(true)
    setErr(null)
    try {
      await api(`/tickets/${id}`, {
        method: 'PATCH',
        json: {
          departmentId: adminDept ? Number(adminDept) : null,
          assignedTo: adminAssign ? Number(adminAssign) : null,
          status: adminStatus,
        },
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveDeptStatus(e: FormEvent) {
    e.preventDefault()
    if (!id || user?.role !== 'dept_staff') return
    setBusy(true)
    setErr(null)
    try {
      await api(`/tickets/${id}`, { method: 'PATCH', json: { status: deptStatus } })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveRating(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/tickets/${id}/satisfaction`, {
        method: 'PATCH',
        json: { rating: Number(rating), comment: ratingNote },
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save rating')
    } finally {
      setBusy(false)
    }
  }

  if (err && !ticket) {
    return <p className="text-red-600 font-medium">{err}</p>
  }
  if (!ticket) return <p className="text-slate-600">Loading…</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xl font-bold text-bw-blue">{ticket.ticket_number}</span>
        <Badge className="capitalize">{ticket.priority}</Badge>
        <Badge variant="outline" className="capitalize">
          {ticket.status.replace(/_/g, ' ')}
        </Badge>
      </div>
      <h1 className="text-3xl font-bold text-bw-navy">{ticket.title}</h1>
      {err && <p className="text-red-600 font-medium">{err}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-800">
          <p className="whitespace-pre-wrap">{ticket.description}</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Branch</span>
              <div className="font-medium">{ticket.branch_name}</div>
            </div>
            <div>
              <span className="text-slate-500">Category</span>
              <div className="font-medium">{ticket.category_name}</div>
            </div>
            <div>
              <span className="text-slate-500">Department</span>
              <div className="font-medium">{ticket.department_name || '— (to be assigned)'}</div>
            </div>
            <div>
              <span className="text-slate-500">Location / room</span>
              <div className="font-medium">{ticket.location_room || '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Contact</span>
              <div className="font-medium">
                {ticket.contact_person} · {ticket.contact_number}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Raised by</span>
              <div className="font-medium">{ticket.created_by_name || '—'}</div>
            </div>
            <div>
              <span className="text-slate-500">Assigned to</span>
              <div className="font-medium">{ticket.assigned_to_name || '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!!data?.attachments?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {data.attachments.map((a) => (
              <a key={a.id} href={uploadsUrl(a.url)} target="_blank" rel="noreferrer" className="block">
                <img
                  src={uploadsUrl(a.url)}
                  alt={a.filename}
                  className="h-40 w-auto rounded-lg border border-slate-200 object-cover"
                />
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Admin controls</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid sm:grid-cols-2 gap-4" onSubmit={saveAdmin}>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={adminDept}
                  onChange={(e) => {
                    setAdminDept(e.target.value)
                    setAdminAssign('')
                  }}
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Assign staff</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={adminAssign}
                  onChange={(e) => setAdminAssign(e.target.value)}
                >
                  <option value="">Not assigned</option>
                  {assignable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Status</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base max-w-md"
                  value={adminStatus}
                  onChange={(e) => setAdminStatus(e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <Button type="submit" disabled={busy}>
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {user?.role === 'dept_staff' && (
        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col sm:flex-row gap-3 items-end" onSubmit={saveDeptStatus}>
              <div className="space-y-2 flex-1">
                <Label>Status</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={deptStatus}
                  onChange={(e) => setDeptStatus(e.target.value)}
                >
                  <option value="new">New</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <Button type="submit" disabled={busy}>
                Update
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {data?.comments?.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <div className="text-xs text-slate-500">
                  {c.full_name || c.username} · {new Date(c.created_at).toLocaleString()}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-900">{c.body}</p>
              </div>
            ))}
            {!data?.comments?.length && <p className="text-slate-600">No comments yet.</p>}
          </div>
          <form className="space-y-2" onSubmit={postComment}>
            <Label>Add comment</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            <Button type="submit" disabled={busy}>
              Post comment
            </Button>
          </form>
        </CardContent>
      </Card>

      {user?.role === 'branch_user' &&
        (ticket.status === 'completed' || ticket.status === 'closed') &&
        !ticket.satisfaction_rating && (
          <Card>
            <CardHeader>
              <CardTitle>Satisfaction</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3 max-w-md" onSubmit={saveRating}>
                <div className="space-y-2">
                  <Label>Rating (1–5)</Label>
                  <select
                    className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  >
                    <option value="5">5 — Excellent</option>
                    <option value="4">4 — Good</option>
                    <option value="3">3 — Okay</option>
                    <option value="2">2 — Poor</option>
                    <option value="1">1 — Very poor</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={ratingNote} onChange={(e) => setRatingNote(e.target.value)} rows={2} />
                </div>
                <Button type="submit" disabled={busy}>
                  Submit rating
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

      {ticket.satisfaction_rating != null && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader>
            <CardTitle>Thank you</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-800">
            <p>
              Satisfaction rating: <strong>{ticket.satisfaction_rating}</strong> / 5
            </p>
            {ticket.satisfaction_comment && (
              <p className="mt-2 whitespace-pre-wrap">{ticket.satisfaction_comment}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {audit.map((a) => (
            <div key={a.id} className="border-b border-slate-100 pb-2">
              <div className="text-slate-500">
                {new Date(a.created_at).toLocaleString()} · {a.full_name || a.username || 'System'} ·{' '}
                <span className="font-medium text-bw-navy">{a.action}</span>
              </div>
              {a.details && Object.keys(a.details).length > 0 && (
                <pre className="mt-1 text-xs bg-slate-50 p-2 rounded-lg overflow-x-auto">
                  {JSON.stringify(a.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {!audit.length && <p className="text-slate-600">No audit entries.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
