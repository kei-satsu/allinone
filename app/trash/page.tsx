"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function TrashList() {
  const router = useRouter()
  const [deletedOrders, setDeletedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userBranch, setUserBranch] = useState<string>('')

  // အမှိုက်ပုံးထဲက ဒေတာတွေပဲ ဆွဲထုတ်မည့် Function (is_deleted = true)
  const fetchData = async (branchCode?: string) => {
    const activeBranch = branchCode || userBranch
    if (!activeBranch) return

    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('branch', activeBranch)
      .eq('is_deleted', true) // 🗑️ ဖျက်ထားတဲ့ မှတ်တမ်းတွေပဲ ပြမယ်
      .order('deleted_at', { ascending: false }) // လတ်တလောဖျက်ထားတာ အပေါ်ဆုံးပြမယ်

    if (error) console.error(error)
    else setDeletedOrders(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const storedBranch = localStorage.getItem('user_branch')
    if (!storedBranch) {
      router.push('/login')
    } else {
      setUserBranch(storedBranch)
      fetchData(storedBranch)
    }
  }, [router])

  // 🔄 မှတ်တမ်းကို မူလစာရင်းထဲ ပြန်ဆယ်မည့် Function (Restore)
  const handleRestore = async (orderId: string) => {
    if (confirm("ဒီမှတ်တမ်းကို မူလစာရင်းထဲသို့ ပြန်ထည့်ရန် သေချာပါသလား?")) {
      const { error } = await supabase
        .from('orders')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', orderId)

      if (error) {
        alert(error.message)
      } else {
        alert("မှတ်တမ်းကို အောင်မြင်စွာ ပြန်ဆယ်ပြီးပါပြီ။")
        fetchData()
      }
    }
  }

const handlePermanentDelete = async (order: any) => {
  if (confirm("⚠️ သတိပြုရန်!\nဒီမှတ်တမ်းကို အပြီးတိုင်ဖျက်ပါက ဘယ်လိုမှ ပြန်ယူ၍ ရတော့မည်မဟုတ်ပါ။ ဖြတ်ရန် သေချာပါသလား?")) {
    setLoading(true)
    try {
      // ၁။ Image URL ပေါ်မူတည်၍ Cloudinary သို့မဟုတ် R2 ထဲမှ ပုံကို ဖျက်မည်
      if (order.image_url) {
        const isR2Url = order.image_url.includes('r2.dev');
        const deleteEndpoint = isR2Url ? '/api/r2/delete' : '/api/cloudinary/delete';

        await fetch(deleteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: order.image_url })
        });
      }

      // ၂။ Supabase Database ထဲက Record ကို ဖျက်မည်
      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;

      alert("မှတ်တမ်းနှင့် ပုံကို အပြီးတိုင် ဖျက်ဆီးလိုက်ပါပြီ။");
      fetchData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }
}

  return (
    <div className="w-full h-full flex flex-col bg-[#f3f3f3] overflow-hidden select-none">
      {/* Title Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex justify-between items-center flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <div>
            <h1 className="text-base font-semibold text-gray-900 tracking-wide uppercase">Recently Deleted (အမှိုက်ပုံး)</h1>
            <p className="text-[11px] text-gray-500 font-medium">မှားဖျက်မိသော ပါဆယ်များကို ဤနေရာတွင် ပြန်ဆယ်နိုင်သည်</p>
          </div>
        </div>
        <Link href="/" className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-1.5 rounded-md text-xs transition-all flex items-center gap-1 border border-gray-300">
          ◀ Back to Orders
        </Link>
      </div>

      {/* Trash Table */}
      <div className="flex-1 overflow-auto bg-white mx-5 my-3 rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-left whitespace-nowrap text-[12px]">
          <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Item ID</th>
              <th className="py-2.5 px-3">Sender</th>
              <th className="py-2.5 px-3">Receiver</th>
              <th className="py-2.5 px-3">Deleted At</th>
              <th className="py-2.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-20 text-center text-gray-400">Loading Trash Records...</td>
              </tr>
            ) : deletedOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-16 text-center text-gray-400 font-medium">အမှိုက်ပုံးထဲတွင် မည်သည့်မှတ်တမ်းမှ မရှိပါ။</td>
              </tr>
            ) : deletedOrders.map((o) => (
              <tr key={o.id} className="hover:bg-red-50/30 transition-colors">
                <td className="py-2.5 px-4 font-mono font-medium text-gray-900">{o.item_id}</td>
                <td className="py-2.5 px-3 text-gray-700">{o.sender_name} ({o.sender_loc})</td>
                <td className="py-2.5 px-3 text-gray-700">{o.receiver_name} ({o.receiver_loc})</td>
                <td className="py-2.5 px-3 text-red-500 font-medium">
                  {o.deleted_at ? new Date(o.deleted_at).toLocaleString() : '-'}
                </td>
                <td className="py-2.5 px-4 text-center flex items-center justify-center gap-2">
                  {/* ပြန်ဆယ်ရန် Button */}
                  <button 
                    onClick={() => handleRestore(o.id)}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-all"
                  >
                    🔄 Restore
                  </button>
                  {/* အပြီးဖျက်ရန် Button */}
                  <button 
                    onClick={() => handlePermanentDelete(o)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1 rounded text-[11px] font-semibold transition-all"
                  >
                    🗑️ Delete Permanent
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}