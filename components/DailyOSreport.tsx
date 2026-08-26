"use client"
import { useState, useEffect, useCallback } from 'react'
import { getSenderSummary } from '@/lib/databaseApi'

interface SenderWaySummary {
  sender_id: string | null
  sender_name: string
  way_count: number
}

interface SenderWaySummaryModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SenderWaySummaryModal({ isOpen, onClose }: SenderWaySummaryModalProps) {
  const today = new Date().toISOString().split('T')[0]
  
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [userBranch, setUserBranch] = useState<string>('')
  const [summaryList, setSummaryList] = useState<SenderWaySummary[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    if (!isOpen) return
    const branch = localStorage.getItem('user_branch') || 'MDY'
    setUserBranch(branch)
  }, [isOpen])

  // Database ဘက်တွင် ရေတွက်ပြီးသား RPC Function ကို ခေါ်ယူခြင်း
  const fetchSenderSummary = useCallback(async () => {
    if (!userBranch || !selectedDate || !isOpen) return
    setLoading(true)

    try {
      const { data } = await getSenderSummary(userBranch, selectedDate)
      setSummaryList(data || [])
    } catch (error) {
      console.error('Error fetching sender way summary:', error)
      setSummaryList([])
    }

    setLoading(false)
  }, [userBranch, selectedDate, isOpen])

  useEffect(() => {
    fetchSenderSummary()
  }, [fetchSenderSummary])

  if (!isOpen) return null

  const filteredList = summaryList.filter(item =>
    item.sender_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalWays = summaryList.reduce((sum, item) => sum + Number(item.way_count), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl bg-white border border-gray-200 rounded-2xl shadow-2xl p-6 text-gray-800 max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              Sender Daily Way Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Branch: <span className="font-bold text-orange-600 font-mono">{userBranch || 'N/A'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-mono font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
            
            <button
              onClick={fetchSenderSummary}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 border border-gray-200 rounded-lg transition active:scale-95 disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition active:scale-95 ml-1"
              title="Close Modal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-orange-50/60 border border-orange-100 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-900 uppercase">Total Senders</span>
            <span className="text-lg font-bold font-mono text-orange-600">{summaryList.length}</span>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900 uppercase">Total Ways</span>
            <span className="text-lg font-bold font-mono text-emerald-600">{totalWays}</span>
          </div>
        </div>

        {/* Filter Input */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Sender အမည်ဖြင့် ရှာရန်..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 placeholder-gray-400"
          />
        </div>

        {/* Summary Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden overflow-y-auto max-h-72 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              စာရင်းဆွဲထုတ်နေပါသည်...
            </div>
          ) : filteredList.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-gray-100/80 sticky top-0 border-b border-gray-200 text-gray-600 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">No.</th>
                  <th className="py-2.5 px-4">Sender Name</th>
                  <th className="py-2.5 px-4 text-right">Way Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredList.map((item, index) => (
                  <tr key={item.sender_id || index} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2.5 px-4 text-center font-mono text-gray-400">{index + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{item.sender_name}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-orange-100 text-orange-800">
                        {item.way_count} Ways
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-10 text-center text-xs text-gray-400">
              {selectedDate} နေ့စွဲအတွက် Data မရှိပါ။
            </div>
          )}
        </div>
      </div>
    </div>
  )
}