import { useEffect, useMemo, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TicketRow = {
  id: number
  ticket_number: string
  title: string
  priority: string
  status: string
  created_at: string
  branch_name: string
  category_name: string
  department_name: string | null
}

type Branch = { id: number; name: string }
type Category = { id: number; name: string }
type Department = { id: number; name: string }

function priVariant(p: string): ComponentProps<typeof Badge>['variant'] {
  if (p === 'urgent' || p === 'high') return 'danger'
  if (p === 'medium') return 'warning'
  return 'secondary'
}

export function TicketsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<TicketRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [ticketNumber, setTicketNumber] = useState('')
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')

  const [branches, setBranches] = useState<Branch[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!isAdmin) return
    let c = true
    ;(async () => {
      try {
        const [b, cat, d] = await Promise.all([
          api<Branch[]>('/branches'),
          api<Category[]>('/categories'),
          api<Department[]>('/departments'),
        ])
        if (c) {
          setBranches(b)
          setCategories(cat)
          setDepartments(d)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = false
    }
  }, [isAdmin])

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (ticketNumber) p.set('ticketNumber', ticketNumber)
    if (branchId) p.set('branchId', branchId)
    if (categoryId) p.set('categoryId', categoryId)
    if (departmentId) p.set('departmentId', departmentId)
    if (status) p.set('status', status)
    if (priority) p.set('priority', priority)
    return p.toString()
  }, [ticketNumber, branchId, categoryId, departmentId, status, priority])

  useEffect(() => {
    let c = true
    setLoading(true)
    ;(async () => {
      try {
        const qs = query ? `?${query}` : ''
        const res = await api<{ tickets: TicketRow[]; total: number }>(`/tickets${qs}`)
        if (c) {
          setRows(res.tickets)
          setTotal(res.total)
          setErr(null)
        }
      } catch (e) {
        if (c) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (c) setLoading(false)
      }
    })()
    return () => {
      c = false
    }
  }, [query])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-bw-navy">Tickets</h1>
          <p className="text-slate-600 mt-1">
            {user?.role === 'branch_user' ? 'Your branch tickets only.' : 'Tickets in your scope.'}{' '}
            <span className="font-semibold text-bw-blue">{total}</span> result(s).
          </p>
        </div>
        {user?.role === 'branch_user' && (
          <Button asChild size="lg">
            <Link to="/submit">New ticket</Link>
          </Button>
        )}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search & filters</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ticket number</Label>
              <Input
                placeholder="BW-0001"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Any status</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Any priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {err && <p className="text-red-600 font-medium">{err}</p>}
      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`}>
              <Card className="hover:border-bw-blue/40 hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-bw-blue">{t.ticket_number}</span>
                      <Badge variant={priVariant(t.priority)} className="capitalize">
                        {t.priority}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {t.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-lg font-medium text-bw-navy mt-1">{t.title}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {t.branch_name} · {t.category_name}
                      {t.department_name ? ` · ${t.department_name}` : ''}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 shrink-0">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!rows.length && <p className="text-slate-600">No tickets found.</p>}
        </div>
      )}
    </div>
  )
}
