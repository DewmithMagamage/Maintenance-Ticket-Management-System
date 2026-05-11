import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ClipboardList, FileBarChart, Home, LogOut, PlusCircle, Ticket, Users, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-colors',
    isActive ? 'bg-bw-blue text-white shadow' : 'text-slate-700 hover:bg-bw-sky'
  )

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-white p-4 flex flex-col gap-6 shrink-0">
        <div className="px-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-bw-blue">British Way</div>
          <div className="text-lg font-bold text-bw-navy leading-tight">Maintenance Tickets</div>
          <p className="mt-2 text-sm text-slate-600">
            {user.fullName || user.username}
            <span className="block text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</span>
          </p>
        </div>
        <nav className="flex flex-row md:flex-col flex-wrap gap-2">
          <NavLink to="/dashboard" className={navClass}>
            <Home className="h-5 w-5 shrink-0" />
            Dashboard
          </NavLink>
          <NavLink to="/notifications" className={navClass}>
            <Bell className="h-5 w-5 shrink-0" />
            Notifications
          </NavLink>
          {user.role === 'branch_user' && (
            <>
              <NavLink to="/submit" className={navClass}>
                <PlusCircle className="h-5 w-5 shrink-0" />
                New Ticket
              </NavLink>
              <NavLink to="/tickets" className={navClass}>
                <Ticket className="h-5 w-5 shrink-0" />
                My Tickets
              </NavLink>
            </>
          )}
          {(user.role === 'dept_staff' || user.role === 'admin') && (
            <NavLink to="/tickets" className={navClass}>
              <ClipboardList className="h-5 w-5 shrink-0" />
              Tickets
            </NavLink>
          )}
          {user.role === 'admin' && (
            <>
              <NavLink to="/reports" className={navClass}>
                <FileBarChart className="h-5 w-5 shrink-0" />
                Reports
              </NavLink>
              <NavLink to="/users" className={navClass}>
                <Users className="h-5 w-5 shrink-0" />
                Users
              </NavLink>
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </Button>
          <Link to="/dashboard" className="text-center text-xs text-slate-400 hover:text-bw-blue">
            Help: call Head Office IT
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
