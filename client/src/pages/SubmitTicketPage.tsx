import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_ROOT, api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Category = { id: number; name: string; slug: string }

export function SubmitTicketPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [locationRoom, setLocationRoom] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let c = true
    ;(async () => {
      try {
        const rows = await api<Category[]>('/categories')
        if (c) setCategories(rows)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      c = false
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('description', description.trim())
      fd.append('categoryId', String(categoryId))
      fd.append('priority', priority)
      if (locationRoom) fd.append('locationRoom', locationRoom.trim())
      fd.append('contactPerson', contactPerson.trim())
      fd.append('contactNumber', contactNumber.trim())
      if (files) {
        for (let i = 0; i < files.length; i++) {
          fd.append('photos', files[i])
        }
      }
      const t = localStorage.getItem('bw_token')
      const res = await fetch(`${API_ROOT}/tickets`, {
        method: 'POST',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || res.statusText)
      }
      const data = (await res.json()) as { id: number; ticketNumber: string }
      navigate(`/tickets/${data.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-bw-navy">New maintenance ticket</h1>
        <p className="text-slate-600 mt-1">
          Your branch <strong>{user?.branchName}</strong> is recorded automatically.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ticket details</CardTitle>
          <CardDescription>Fields marked with * are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="title">Ticket title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Input id="branch" value={user?.branchName || ''} readOnly className="bg-slate-100" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <select
                  id="category"
                  required
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <select
                  id="priority"
                  className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location / room</Label>
              <Input
                id="location"
                value={locationRoom}
                onChange={(e) => setLocationRoom(e.target.value)}
                placeholder="e.g. Reception, Classroom 2"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact person *</Label>
                <Input
                  id="contact"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Contact number *</Label>
                <Input
                  id="phone"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="photos">Upload photos</Label>
              <Input
                id="photos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(e.target.files)}
              />
              <p className="text-xs text-slate-500">Up to 5 images, 8 MB each.</p>
            </div>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" size="lg" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit ticket'}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
