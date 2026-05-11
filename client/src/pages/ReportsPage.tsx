import { useState } from 'react'
import { downloadBinary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const types = [
  { value: 'open', label: 'Open tickets' },
  { value: 'completed', label: 'Completed tickets' },
  { value: 'branch', label: 'Branch-wise (admin)' },
  { value: 'department', label: 'Department-wise (admin)' },
  { value: 'priority', label: 'Priority-wise' },
  { value: 'monthly', label: 'This month (admin)' },
]

export function ReportsPage() {
  const [type, setType] = useState('open')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function download(format: 'pdf' | 'xlsx') {
    setErr(null)
    setBusy(format)
    try {
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      await downloadBinary(`/reports?type=${encodeURIComponent(type)}&format=${format}`, `bw-${type}.${ext}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-bw-navy">Reports</h1>
        <p className="text-slate-600 mt-1">Generate summaries for Head Office reviews.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Report type</Label>
            <select
              className="flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" disabled={!!busy} onClick={() => void download('pdf')}>
              {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
            </Button>
            <Button size="lg" variant="outline" disabled={!!busy} onClick={() => void download('xlsx')}>
              {busy === 'xlsx' ? 'Preparing…' : 'Download Excel'}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            JSON data is available from the API for integrations:{' '}
            <code className="bg-slate-100 px-1 rounded">/api/reports?type=…&format=json</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
