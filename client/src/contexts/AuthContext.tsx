import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/lib/api'

export type Role = 'branch_user' | 'dept_staff' | 'admin'

export type AuthUser = {
  id: number
  username: string
  fullName: string | null
  role: Role
  branchId: number | null
  departmentId: number | null
  branchName?: string | null
  departmentName?: string | null
}

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bw_token'))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const t = localStorage.getItem('bw_token')
    if (!t) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await api<AuthUser>('/auth/me')
      setUser(me)
    } catch {
      localStorage.removeItem('bw_token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api<{ token: string }>('/auth/login', {
      method: 'POST',
      json: { username, password },
    })
    localStorage.setItem('bw_token', res.token)
    setToken(res.token)
    const me = await api<AuthUser>('/auth/me')
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('bw_token')
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refreshMe }),
    [user, token, loading, login, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
