import { useEffect, useState, type ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Ticket } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type DashboardStats = {
  byStatus: Record<string, number>
  openTickets: number
  completedTickets: number
  thisMonthNew?: number
}

function statusVariant(s: string): ComponentProps<typeof Badge>['variant'] {
  if (s === 'completed' || s === 'closed') return 'success'
  if (s === 'urgent' || s === 'high') return 'danger'
  if (s === 'in_progress') return 'warning'
  return 'default'
}

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await api<DashboardStats>('/stats/dashboard')
        if (!cancelled) setStats(s)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load dashboard')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-bw-navy">Welcome back</h1>
        <p className="text-slate-600 mt-1 max-w-2xl">
          Report issues in a few clicks and track them until they are completed. Use large buttons below
          for the most common actions.
        </p>
      </div>

      {err && <p className="text-red-600 font-medium">{err}</p>}

      {user?.role === 'branch_user' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="text-lg min-h-14">
            <Link to="/submit">
              <PlusCircle className="h-6 w-6" />
              Submit New Ticket
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg min-h-14">
            <Link to="/tickets">
              <Ticket className="h-6 w-6" />
              View My Tickets
            </Link>
          </Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-600">Open tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-bw-blue">{stats?.openTickets ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-700">{stats?.completedTickets ?? '—'}</div>
          </CardContent>
        </Card>
        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-slate-600">New this month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-bw-navy">{stats?.thisMonthNew ?? '—'}</div>
            </CardContent>
          </Card>
        )}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base text-slate-600">Status summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats &&
              Object.entries(stats.byStatus).map(([k, v]) => (
                <Badge key={k} variant={statusVariant(k)} className="capitalize">
                  {k.replace(/_/g, ' ')}: {v}
                </Badge>
              ))}
            {!stats && <span className="text-slate-500">Loading…</span>}
          </CardContent>
        </Card>
      </div>

      {user?.branchName && (
        <Card className="bg-bw-sky/60 border-bw-blue/20">
          <CardHeader>
            <CardTitle className="text-lg">Your branch</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-800 text-lg font-medium">{user.branchName}</CardContent>
        </Card>
      )}
      {user?.role === 'dept_staff' && user.departmentName && (
        <Card className="bg-bw-sky/60 border-bw-blue/20">
          <CardHeader>
            <CardTitle className="text-lg">Your department</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-800 text-lg font-medium">{user.departmentName}</CardContent>
        </Card>
      )}
    </div>
  )
}
