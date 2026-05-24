"use client"
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Rider {
  id: string
  name: string
  phone: string
  branch: string
  created_at?: string
}

export default function RidersManagement() {
  const router = useRouter()
  const [userBranch, setUserBranch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_branch') || ''
    }
    return ''
  })
  const [riders, setRiders] = useState<Rider[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRider, setEditingRider] = useState<Rider | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userBranch) {
      router.push('/login')
    }
  }, [userBranch, router])

  const fetchRiders = useCallback(async () => {
    if (!userBranch) return
    setLoading(true)
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('branch', userBranch)
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      alert(`Failed to load riders: ${error.message}`)
    } else {
      setRiders(data || [])
    }
    setLoading(false)
  }, [userBranch])

  useEffect(() => {
    if (userBranch) {
      fetchRiders()
    }
  }, [userBranch, fetchRiders])

  const openAddModal = () => {
    setEditingRider(null)
    setFormData({ name: '', phone: '' })
    setModalOpen(true)
  }

  const openEditModal = (rider: Rider) => {
    setEditingRider(rider)
    setFormData({ name: rider.name, phone: rider.phone || '' })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert('Rider name is required.')
      return
    }
    setSaving(true)

    if (editingRider) {
      const { error } = await supabase
        .from('riders')
        .update({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
        })
        .eq('id', editingRider.id)
      if (error) alert('Update failed: ' + error.message)
      else {
        await fetchRiders()
        setModalOpen(false)
      }
    } else {
      const { error } = await supabase
        .from('riders')
        .insert([{
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          branch: userBranch,
        }])
      if (error) alert('Add failed: ' + error.message)
      else {
        await fetchRiders()
        setModalOpen(false)
      }
    }
    setSaving(false)
  }

  const handleDelete = async (rider: Rider) => {
    if (!confirm(`Delete rider "${rider.name}"? This action cannot be undone.`)) return
    const { error } = await supabase.from('riders').delete().eq('id', rider.id)
    if (error) alert('Delete failed: ' + error.message)
    else await fetchRiders()
  }

  const winInput = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
  const labelStyle = "block text-gray-600 font-semibold mb-1 uppercase text-[11px] tracking-wide"
  const tableTh = "py-2.5 px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-white sticky top-0 z-10"

  return (
    <div className="min-h-screen bg-[#f3f3f3] font-[system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-sm text-gray-800">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase">
              🏍️ Riders Management
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              {userBranch === 'MDY' ? 'MANDALAY' : 'YANGON'} Branch
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openAddModal} className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-1.5 rounded-md shadow-sm transition-all text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Rider
          </button>
          <button onClick={() => router.push('/')} className="bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-md text-xs shadow-sm transition">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">Rider Directory</h2>
            <span className="text-[10px] bg-white border border-gray-300 text-gray-700 px-2.5 py-0.5 rounded-full font-medium">
              {riders.length} riders
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 text-center text-gray-400 font-medium">Loading riders...</div>
            ) : riders.length === 0 ? (
              <div className="py-16 text-center text-gray-400 font-medium">No riders found. Click "Add Rider" to create one.</div>
            ) : (
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className={tableTh}>Name</th>
                    <th className={tableTh}>Phone</th>
                    <th className={tableTh}>Branch</th>
                    <th className={tableTh}>Created At</th>
                    <th className={`${tableTh} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {riders.map((rider) => (
                    <tr key={rider.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        <Link href={`/riders/${rider.id}`} className="text-gray-800 hover:text-orange-600 transition-colors underline decoration-dotted underline-offset-2">
                          {rider.name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">{rider.phone || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          rider.branch === 'MDY' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {rider.branch}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">
                        {rider.created_at ? new Date(rider.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-3">
                        <button onClick={() => openEditModal(rider)} className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wider transition">Edit</button>
                        <button onClick={() => handleDelete(rider)} className="text-red-500 hover:text-red-700 font-medium text-xs uppercase tracking-wider transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="font-semibold text-gray-900">{editingRider ? 'Edit Rider' : 'Add New Rider'}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{editingRider ? 'Update rider details' : 'Create a new rider for your branch'}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className={labelStyle}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={winInput}
                  placeholder="e.g., Mg Mg"
                  required
                />
              </div>
              <div>
                <label className={labelStyle}>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={winInput}
                  placeholder="09xxxxxxxx"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm font-medium shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRider ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}