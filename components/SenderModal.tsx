"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SenderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newSender: any) => void
}

export default function SenderModal({ isOpen, onClose, onSuccess }: SenderModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loc, setLoc] = useState('MDY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetFields = () => {
    setName('')
    setPhone('')
    setLoc('MDY')
    setError('')
  }

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Sender name and phone are required.')
      return
    }

    setSaving(true)
    setError('')

    const { data, error } = await supabase
      .from('senders')
      .insert({ name: name.trim(), phone: phone.trim(), LOC: loc })
      .select()
      .single()

    setSaving(false)

    if (error || !data) {
      setError(error?.message ?? 'Unable to save sender.')
      return
    }

    onSuccess(data)
    resetFields()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add New Sender</h2>
            <p className="text-sm text-gray-500">Create a sender record and use it immediately in the entry form.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200">
            <span className="sr-only">Close modal</span>
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Sender Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="Sender name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="09-xxx-xxx-xxx"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Office Location</label>
            <select
              value={loc}
              onChange={e => setLoc(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="MDY">MANDALAY</option>
              <option value="YGN">YANGON</option>
            </select>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-100">{error}</div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {saving ? 'Saving...' : 'Save Sender'}
          </button>
        </div>
      </div>
    </div>
  )
}
