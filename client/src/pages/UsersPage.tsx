import { useEffect, useState, type FormEvent } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Branch = { id: number; name: string }
type Department = { id: number; name: string }
type UserRow = {
  id: number
  username: string
  full_name: string | null
  role: string
  is_active: boolean
  branch_id: number | null
  department_id: number | null
  branch_name: string | null
  department_name: string | null
}

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [err, setErr] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'branch_user' | 'dept_staff' | 'admin'>('branch_user')
  const [branchId, setBranchId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  async function refresh() {
    const [u, b, d] = await Promise.all([
      api<UserRow[]>('/users'),
      api<Branch[]>('/branches'),
      api<Department[]>('/departments'),
    ])
    setUsers(u)
    setBranches(b)
    setDepartments(d)
  }

  useEffect(() => {
    void refresh().catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  async function createUser(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      await api('/users', {
        method: 'POST',
        json: {
          username: username.trim(),
          password,
          fullName: fullName.trim() || undefined,
          role,
          branchId: role === 'branch_user' ? Number(branchId) : undefined,
          departmentId: role === 'dept_staff' ? Number(departmentId) : undefined,
        },
      })
      setUsername('')
      setPassword('')
      setFullName('')
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create user')
    }
  }

  async function toggleActive(u: UserRow) {
    setErr(null)
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', json: { isActive: !u.is_active } })
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-bw-navy">User management</h1>
        <p className="text-slate-600 mt-1">Create branch logins or department staff accounts.</p>
      </div>
      {err && <p className="text-red-600 font-medium">{err}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add user</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid sm:grid-cols-2 gap-4" onSubmit={createUser}>
            <div className="space-y-2 sm:col-span-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                <option value="branch_user">Branch user</option>
                <option value="dept_staff">Department staff</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            {role === 'branch_user' && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                >
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {role === 'dept_staff' && (
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Button type="submit">Create user</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-slate-200 rounded-xl p-4"
            >
              <div>
                <div className="font-semibold text-bw-navy">{u.username}</div>
                <div className="text-sm text-slate-600">
                  {u.full_name || '—'} · {u.branch_name || u.department_name || 'Head office'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{u.role.replace('_', ' ')}</Badge>
                  {!u.is_active && <Badge variant="danger">Inactive</Badge>}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void toggleActive(u)}>
                {u.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
