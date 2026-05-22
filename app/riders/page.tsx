"use client"
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Rider {
  id: string
  name: string
  phone: string
  branch: string
  created_at?: string
}

export default function RidersManagement() {
  const router = useRouter()
  // Read branch from localStorage once, synchronously (client only)
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

  // Auth check – if no branch, redirect to login
  useEffect(() => {
    if (!userBranch) {
      router.push('/login')
    }
  }, [userBranch, router])

  // Fetch riders for the current branch – wrapped in useCallback
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

  // The rest of your component stays the same (openAddModal, openEditModal, handleSubmit, handleDelete, UI)
  // ... (copy the same functions and JSX from the previous working version)

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

  // UI Helpers (unchanged)
  const cardStyle = "bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"
  const tableTh = "p-3 text-slate-500 uppercase text-xs font-bold tracking-wider border-b border-slate-200"

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-7 text-sm text-slate-700 antialiased">
      <div className="w-full max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
          <div className="flex items-center gap-3.5">
            <span className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-black tracking-widest">
              {userBranch === 'MDY' ? 'MANDALAY' : 'YANGON'}
            </span>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-wider uppercase">🏍️ Riders Management</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Manage delivery riders for your branch</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm flex items-center gap-1">
              + Add Rider
            </button>
            <button onClick={() => router.push('/')} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm">
              ← Back to Report
            </button>
          </div>
        </div>

        {/* Riders Table */}
        <div className={cardStyle}>
          <div className="flex justify-between items-center mb-4 px-1">
            <h2 className="font-black text-slate-800 uppercase tracking-wider text-xs">Rider Directory</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-mono font-bold">{riders.length} riders</span>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-slate-400 font-bold italic">Loading riders...</div>
            ) : riders.length === 0 ? (
              <div className="py-12 text-center text-amber-600 font-bold italic">No riders found. Click "Add Rider" to create one.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={tableTh}>Name</th>
                    <th className={tableTh}>Phone</th>
                    <th className={tableTh}>Branch</th>
                    <th className={tableTh}>Created At</th>
                    <th className={`${tableTh} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riders.map((rider) => (
                    <tr key={rider.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-800">{rider.name}</td>
                      <td className="py-3 font-mono text-slate-600">{rider.phone || '—'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${rider.branch === 'MDY' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {rider.branch}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-slate-400 font-mono">
                        {rider.created_at ? new Date(rider.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-right space-x-3">
                        <button onClick={() => openEditModal(rider)} className="text-blue-600 hover:text-blue-800 font-bold text-xs uppercase tracking-wider transition">Edit</button>
                        <button onClick={() => handleDelete(rider)} className="text-rose-500 hover:text-rose-700 font-bold text-xs uppercase tracking-wider transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal (same as before) */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-slate-800 uppercase tracking-wider">{editingRider ? 'Edit Rider' : 'Add New Rider'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="e.g., Mg Mg" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="09xxxxxxxx" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50">{saving ? 'Saving...' : editingRider ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}