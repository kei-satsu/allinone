"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// 🌟 ၁။ Main Page က လှမ်းပေးလိုက်တဲ့ Props အားလုံးကို လက်ခံနိုင်အောင် Interface ကို အဆင့်မြှင့်တင်လိုက်ပါတယ်
interface SenderModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (data: any) => void
  mode: 'add' | 'edit'          // 👈 mode လက်ခံရန်
  editData: any                 // 👈 ပြင်မယ့် ဒေတာဟောင်း လက်ခံရန်
  activeBranch: string          // 👈 လက်ရှိ ရွေးထားတဲ့ Branch လက်ခံရန်
}

export default function SenderModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  mode, 
  editData, 
  activeBranch 
}: SenderModalProps) {
  
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loc, setLoc] = useState('MDY')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 🌟 ၂။ Modal ပွင့်လာတဲ့အခါမှာ Add လား Edit လားအပေါ် မူတည်ပြီး Input Fields တွေကို ဒေတာ ဖြည့်ပေးခြင်း
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && editData) {
        // Edit Mode ဆိုလျှင် ဒေတာဟောင်းများကို ထည့်ပေးမည်
        setName(editData.name || '')
        setPhone(editData.phone || '')
        setLoc(editData.LOC || activeBranch || 'MDY')
      } else {
        // Add Mode ဆိုလျှင် ကွက်လပ်များကို ရှင်းလင်းပြီး လက်ရှိ Branch အလိုက် Default မြို့ သတ်မှတ်မည်
        setName('')
        setPhone('')
        setLoc(activeBranch === 'YGN' ? 'YGN' : 'MDY')
      }
      setError('')
    }
  }, [isOpen, mode, editData, activeBranch])

  const resetFields = () => {
    setName('')
    setPhone('')
    setLoc('MDY')
    setError('')
  }

  // 🌟 ၃။ Save သို့မဟုတ် Update လုပ်မည့် နေရာ
  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      setError('Sender name and phone are required.')
      return
    }

    setSaving(true)
    setError('')

    let resultData = null
    let resultError = null

    if (mode === 'add') {
      // 🟢 A. Add Mode အတွက် database ထဲသို့ Insert လုပ်ခြင်း
      const { data, error } = await supabase
        .from('senders')
        .insert({ name: name.trim(), phone: phone.trim(), LOC: loc })
        .select()
        .single()
      
      resultData = data
      resultError = error
    } else {
      // 🟠 B. Edit Mode အတွက် database ရှိ သက်ဆိုင်ရာ ID ကို Update လုပ်ခြင်း
      const { data, error } = await supabase
        .from('senders')
        .update({ name: name.trim(), phone: phone.trim(), LOC: loc })
        .eq('id', editData.id) // 💡 ID ကို တိုက်စစ်ပြီး ပြင်ခြင်း
        .select()
        .single()

      resultData = data
      resultError = error
    }

    setSaving(false)

    if (resultError || !resultData) {
      setError(resultError?.message ?? 'Unable to save sender.')
      return
    }

    // အောင်မြင်သွားပါက Main Page သို့ ဒေတာလှမ်းပေးပြီး ပိတ်မည်
    onSuccess(resultData)
    resetFields()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
        
        {/* Modal Header (Dynamic Title) */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'edit' ? '✏️ Edit Sender Info' : '➕ Add New Sender'}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === 'edit' ? 'ပို့ဆောင်သူ၏ အချက်အလက်များကို ပြင်ဆင်ပါ။' : 'ပို့ဆောင်သူအသစ် စာရင်းသွင်းပြီး စနစ်ထဲတွင် ချက်ချင်း အသုံးပြုပါ။'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-gray-100 p-2 text-gray-600 transition hover:bg-gray-200">
            <span className="sr-only">Close modal</span>
            ✕
          </button>
        </div>

        {/* Input Form Fields */}
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

        {/* Action Buttons */}
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
            {saving ? 'Saving...' : mode === 'edit' ? 'Update Sender' : 'Save Sender'}
          </button>
        </div>
      </div>
    </div>
  )
}