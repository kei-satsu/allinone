"use client"

import { useState } from "react"
import { createNewUser, updateUserProfile, deleteUser, sendResetPasswordEmail, getRiderById } from "@/app/actions/admin"

export interface UserProfile {
  id: string
  email?: string
  username?: string
  role?: string
  branch?: string
  rider_id?: string // 👈 rider_id ထည့်သွင်းထားသည်
  created_at?: string
}

export default function UserTableClient({ initialUsers }: { initialUsers: UserProfile[] }) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [loading, setLoading] = useState(false)
  const [resettingEmail, setResettingEmail] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Create Form State
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [username, setUsername] = useState("")
  const [role, setRole] = useState("staff")
  const [branch, setBranch] = useState("MDY")
  const [riderId, setRiderId] = useState("")
  const [riderLookupLoading, setRiderLookupLoading] = useState(false)

  // Edit Form State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editRole, setEditRole] = useState("staff")
  const [editBranch, setEditBranch] = useState("MDY")

  const handleRiderIdLookup = async (value: string) => {
    const normalizedId = value.trim()
    setRiderId(value)

    if (role !== "rider" || !normalizedId) {
      if (!normalizedId) setUsername("")
      return
    }

    setRiderLookupLoading(true)
    setMessage(null)
    try {
      const res = await getRiderById(normalizedId)
      if (res.success && res.rider?.name) {
        setUsername(res.rider.name)
      } else {
        setUsername("")
        setMessage({ type: "error", text: res.message || "ဤ Rider ID မတွေ့ပါ။" })
      }
    } catch (err: any) {
      setUsername("")
      setMessage({ type: "error", text: err.message || "Rider ID ရှာဖွေရာတွင် အမှားအယွင်းရှိပါသည်။" })
    } finally {
      setRiderLookupLoading(false)
    }
  }

  // 🟢 1. User အကောင့်သစ် ဆောက်ခြင်း
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pass) {
      setMessage({ type: "error", text: "Email နှင့် Password ဖြည့်စွက်ပေးပါ။" })
      return
    }
    if (role === "rider" && !riderId.trim()) {
      setMessage({ type: "error", text: "Rider ID ဖြည့်စွက်ပေးပါ။" })
      return
    }
    if (role === "rider" && !username.trim()) {
      setMessage({ type: "error", text: "မှန်ကန်သော Rider ID ဖြည့်ပြီး Rider အမည်ကို ရယူပေးပါ။" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // 👇 ဒီနေရာတွင် rider_id ကို createNewUser ထံ ထည့်သွင်းပေးလိုက်ပါသည်
      const res = await createNewUser({
        email,
        pass,
        username,
        role,
        branch,
        rider_id: role === "rider" ? riderId.trim() : undefined
      })

      if (res.success) {
        setMessage({ type: "success", text: res.message })
        setEmail("")
        setPass("")
        setUsername("")
        setRole("staff")
        setBranch("MDY")
        setRiderId("")
        setShowModal(false)
        window.location.reload()
      } else {
        setMessage({ type: "error", text: res.message || "User ဖန်တီးရာတွင် အမှားအယွင်းရှိနေပါသည်။" })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An unexpected error occurred." })
    } finally {
      setLoading(false)
    }
  }

  // 🟢 2. User Profile ပြောင်းလဲခြင်း
  const handleUpdateProfile = async () => {
    if (!editingUser) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await updateUserProfile(editingUser.id, editUsername, editRole, editBranch)

      if (res.success) {
        setMessage({ type: "success", text: res.message })
        setUsers(prev =>
          prev.map(u =>
            u.id === editingUser.id
              ? { ...u, username: editUsername, role: editRole, branch: editBranch }
              : u
          )
        )
        setEditingUser(null)
      } else {
        setMessage({ type: "error", text: res.message || "ပြင်ဆင်၍ မရပါ" })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  // 🟢 3. User ထံသို့ Password Reset Link ပို့ပေးခြင်း (NEW)
  const handleSendResetLink = async (userEmail?: string) => {
    if (!userEmail) {
      setMessage({ type: "error", text: "ဤ User တွင် အီးမေးလ် မရှိပါ" })
      return
    }

    if (!confirm(`${userEmail} ထံသို့ Password Reset Link ပို့ပေးရန် သေချာပါသလား?`)) return

    setResettingEmail(userEmail)
    setMessage(null)

    try {
      const res = await sendResetPasswordEmail(userEmail)
      if (res.success) {
        setMessage({ type: "success", text: res.message })
      } else {
        setMessage({ type: "error", text: res.message })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setResettingEmail(null)
    }
  }

  // 🟢 4. User ဖျက်ပစ်ခြင်း
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("ဤ User Account ကို ဖျက်ပစ်ရန် သေချာပါသလား?")) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await deleteUser(userId)
      if (res.success) {
        setMessage({ type: "success", text: res.message })
        setUsers(prev => prev.filter(u => u.id !== userId))
      } else {
        setMessage({ type: "error", text: res.message || "ဖျက်၍ မရပါ" })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl text-sm font-medium transition-all ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
              : "bg-rose-50 text-rose-800 border border-rose-200/60"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
        <span className="text-sm font-bold text-slate-700">
          စုစုပေါင်း User ({users.length}) ဦး
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          User အသစ်ထည့်မည်
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Username / Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Branch</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    User စာရင်း မရှိသေးပါ။
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">
                        @{u.username || "no_username"}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{u.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                          u.role === "admin"
                            ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role || "staff"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${
                          u.branch === "MDY"
                            ? "bg-orange-50 text-orange-700 border border-orange-200/60"
                            : u.branch === "YGN"
                            ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        }`}
                      >
                        {u.branch || "MDY"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* 🔑 Password Reset Link ပို့ပေးမည့် Button */}
                        <button
                          onClick={() => handleSendResetLink(u.email)}
                          disabled={resettingEmail === u.email}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-xs transition-colors disabled:opacity-50"
                          title="Send Password Reset Email"
                        >
                          {resettingEmail === u.email ? "Sending..." : "Reset Pass"}
                        </button>

                        <button
                          onClick={() => {
                            setEditingUser(u)
                            setEditUsername(u.username || "")
                            setEditRole(u.role || "staff")
                            setEditBranch(u.branch || "MDY")
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={loading}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🟢 MODAL 1: User အသစ်ဆောက်ရန် */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">User Account အသစ်ဖွင့်ရန်</h3>

            <form onSubmit={handleCreateUser} className="space-y-4">

              {role === "rider" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Rider ID</label>
                  <input
                    type="text"
                    required
                    value={riderId}
                    onChange={e => setRiderId(e.target.value)}
                    onBlur={e => handleRiderIdLookup(e.target.value)}
                    placeholder="riders table ထဲရှိ ID ထည့်ပါ"
                    className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    {riderLookupLoading
                      ? "Rider အမည်ရှာဖွေနေသည်..."
                      : "ID ဖြည့်ပြီး အပြင်ဘက်ကိုနှိပ်ပါ။ Username တွင် Rider အမည် အလိုအလျောက်ဖြည့်ပါမည်။"}
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. mgmg_mdy"
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={e => {
                      const nextRole = e.target.value
                      setRole(nextRole)
                      if (nextRole !== "rider") {
                        setRiderId("")
                      } else {
                        setUsername("")
                      }
                    }}
                    className="w-full px-3 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="customer_service">Customer Service</option>
                    <option value="rider">Rider</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Branch</label>
                  <select
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  >
                    <option value="MDY">MDY</option>
                    <option value="YGN">YGN</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? "ဖန်တီးနေသည်..." : "အကောင့်ဖွင့်မည်"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL 2: User Profile ပြောင်းလဲရန် */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">User Profile ပြောင်းလဲရန်</h3>
            <p className="text-xs text-slate-500 truncate">{editingUser.email}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="customer_service">Customer Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Branch</label>
                <select
                  value={editBranch}
                  onChange={e => setEditBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="MDY">MDY</option>
                  <option value="YGN">YGN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex-1 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
              >
                {loading ? "သိမ်းဆည်းနေသည်..." : "အတည်ပြုမည်"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}