"use client"

import { useEffect, useState } from "react"
import {
  createCustomerAccount,
  createNewUser,
  deleteCustomerAccount,
  deleteUser,
  searchSenders,
  sendResetPasswordEmail,
  updateCustomerAccount,
  updateUserProfile,
} from "@/app/actions/admin"

interface RiderOption {
  id: string
  name: string
}

interface SenderOption {
  id: string
  name: string
}

interface CustomerAccount {
  id: string
  email: string
  displayName: string
  senders: SenderOption[]
}

export interface UserProfile {
  id: string
  email?: string
  username?: string
  role?: string
  branch?: string
  rider_id?: string
  created_at?: string
}

export default function UserTableClient({
  initialUsers,
  initialRiders,
  initialCustomers,
}: {
  initialUsers: UserProfile[]
  initialRiders: RiderOption[]
  initialCustomers: CustomerAccount[]
}) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [customers, setCustomers] = useState<CustomerAccount[]>(initialCustomers)
  const [activeTab, setActiveTab] = useState<"employees" | "customers">("employees")
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
  const [isRider, setIsRider] = useState(false)
  const [riderId, setRiderId] = useState("")

  // Customer account form state
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerAccount | null>(null)
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerDisplayName, setCustomerDisplayName] = useState("")
  const [customerPassword, setCustomerPassword] = useState("")
  const [editCustomerDisplayName, setEditCustomerDisplayName] = useState("")
  const [senderSearchTerm, setSenderSearchTerm] = useState("")
  const [senderSearchResults, setSenderSearchResults] = useState<SenderOption[]>([])
  const [selectedSenders, setSelectedSenders] = useState<SenderOption[]>([])
  const [searchingSenders, setSearchingSenders] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [updatingCustomer, setUpdatingCustomer] = useState(false)
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null)

  // Edit Form State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editUsername, setEditUsername] = useState("")
  const [editRole, setEditRole] = useState("staff")
  const [editBranch, setEditBranch] = useState("MDY")
  const [editIsRider, setEditIsRider] = useState(false)
  const [editRiderId, setEditRiderId] = useState("")

  useEffect(() => {
    const term = senderSearchTerm.trim()
    if (!term) return

    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const results = await searchSenders(term)
        if (!cancelled) setSenderSearchResults(results)
      } catch (err: unknown) {
        if (!cancelled) {
          setSenderSearchResults([])
          setMessage({
            type: "error",
            text: err instanceof Error ? err.message : "Sender ရှာဖွေရာတွင် အမှားအယွင်းရှိပါသည်။",
          })
        }
      } finally {
        if (!cancelled) setSearchingSenders(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [senderSearchTerm])

  // 🟢 1. User အကောင့်သစ် ဆောက်ခြင်း
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pass) {
      setMessage({ type: "error", text: "Email နှင့် Password ဖြည့်စွက်ပေးပါ။" })
      return
    }
    if (isRider && !riderId) {
      setMessage({ type: "error", text: "Rider ကို ရွေးချယ်ပေးပါ။" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await createNewUser({
        email,
        pass,
        username,
        role,
        branch,
        rider_id: isRider ? riderId : null,
      })

      if (res.success) {
        setMessage({ type: "success", text: res.message })
        setEmail("")
        setPass("")
        setUsername("")
        setRole("staff")
        setBranch("MDY")
        setIsRider(false)
        setRiderId("")
        setShowModal(false)
        window.location.reload()
      } else {
        setMessage({ type: "error", text: res.message || "User ဖန်တီးရာတွင် အမှားအယွင်းရှိနေပါသည်။" })
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "An unexpected error occurred.",
      })
    } finally {
      setLoading(false)
    }
  }

  // 🟢 2. User Profile ပြောင်းလဲခြင်း
  const handleUpdateProfile = async () => {
    if (!editingUser) return
    if (editIsRider && !editRiderId) {
      setMessage({ type: "error", text: "Rider ကို ရွေးချယ်ပေးပါ။" })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const riderId = editIsRider ? editRiderId : null
      const res = await updateUserProfile(editingUser.id, editUsername, editRole, editBranch, riderId)

      if (res.success) {
        setMessage({ type: "success", text: res.message })
        setUsers(prev =>
          prev.map(u =>
            u.id === editingUser.id
              ? { ...u, username: editUsername, role: editRole, branch: editBranch, rider_id: riderId || undefined }
              : u
          )
        )
        setEditingUser(null)
      } else {
        setMessage({ type: "error", text: res.message || "ပြင်ဆင်၍ မရပါ" })
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "ပြင်ဆင်၍ မရပါ" })
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
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Password Reset Link ပို့ရာတွင် အမှားအယွင်းရှိပါသည်။",
      })
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
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "ဖျက်၍ မရပါ" })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedSenders.length === 0) {
      setMessage({ type: "error", text: "ချိတ်ဆက်မည့် Sender အနည်းဆုံး တစ်ခု ရွေးပါ။" })
      return
    }

    setCreatingCustomer(true)
    setMessage(null)

    try {
      const result = await createCustomerAccount({
        email: customerEmail,
        displayName: customerDisplayName,
        password: customerPassword,
        senderIds: selectedSenders.map(sender => sender.id),
      })

      if (result.success) {
        setCustomers(current => [
          result.customer,
          ...current.filter(customer => customer.id !== result.customer.id),
        ])
        setMessage({ type: "success", text: result.message })
        setCustomerEmail("")
        setCustomerDisplayName("")
        setCustomerPassword("")
        setSenderSearchTerm("")
        setSenderSearchResults([])
        setSelectedSenders([])
        setSearchingSenders(false)
        setShowCustomerModal(false)
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Customer account ဖန်တီးရာတွင် အမှားအယွင်းရှိပါသည်။",
      })
    } finally {
      setCreatingCustomer(false)
    }
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCustomer) return
    if (selectedSenders.length === 0) {
      setMessage({ type: "error", text: "Sender အနည်းဆုံး တစ်ခု ချိတ်ဆက်ထားရပါမည်။" })
      return
    }

    setUpdatingCustomer(true)
    setMessage(null)

    try {
      const result = await updateCustomerAccount({
        userId: editingCustomer.id,
        displayName: editCustomerDisplayName,
        senderIds: selectedSenders.map(sender => sender.id),
      })

      if (result.success) {
        setCustomers(current =>
          current
            .map(customer => customer.id === result.customer.id ? result.customer : customer)
            .sort((a, b) => a.displayName.localeCompare(b.displayName)),
        )
        setMessage({ type: "success", text: result.message })
        setEditingCustomer(null)
        setEditCustomerDisplayName("")
        setSelectedSenders([])
        setSenderSearchTerm("")
        setSenderSearchResults([])
        setSearchingSenders(false)
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Customer account ပြင်ဆင်ရာတွင် အမှားအယွင်းရှိပါသည်။",
      })
    } finally {
      setUpdatingCustomer(false)
    }
  }

  const handleDeleteCustomer = async (customer: CustomerAccount) => {
    if (!confirm(`${customer.displayName || customer.email} Customer account ကို ဖျက်ရန် သေချာပါသလား?`)) {
      return
    }

    setDeletingCustomerId(customer.id)
    setMessage(null)

    try {
      const result = await deleteCustomerAccount(customer.id)
      if (result.success) {
        setCustomers(current => current.filter(item => item.id !== customer.id))
        setMessage({ type: "success", text: result.message })
      } else {
        setMessage({ type: "error", text: result.message })
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Customer account ဖျက်ရာတွင် အမှားအယွင်းရှိပါသည်။",
      })
    } finally {
      setDeletingCustomerId(null)
    }
  }

  const toggleSelectedSender = (sender: SenderOption) => {
    const isSelected = selectedSenders.some(selected => selected.id === sender.id)
    if (isSelected && selectedSenders.length === 1) {
      setMessage({ type: "error", text: "Sender အနည်းဆုံး တစ်ခု ချိတ်ဆက်ထားရပါမည်။" })
      return
    }

    setMessage(null)
    setSelectedSenders(current =>
      isSelected
        ? current.filter(selected => selected.id !== sender.id)
        : [...current, sender],
    )
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

      <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="User categories">
        <button
          id="employees-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "employees"}
          aria-controls="employees-panel"
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "employees"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          ဝန်ထမ်းများ ({users.length})
        </button>
        <button
          id="customers-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "customers"}
          aria-controls="customers-panel"
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "customers"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Customers
        </button>
      </div>

      <div
        role="tabpanel"
        id="employees-panel"
        aria-labelledby="employees-tab"
        hidden={activeTab !== "employees"}
        className="space-y-6"
      >
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
        <span className="text-sm font-bold text-slate-700">
          စုစုပေါင်း ဝန်ထမ်း ({users.length}) ဦး
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
                            setEditIsRider(Boolean(u.rider_id))
                            setEditRiderId(u.rider_id || "")
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
      </div>

      <div
        role="tabpanel"
        id="customers-panel"
        aria-labelledby="customers-tab"
        hidden={activeTab !== "customers"}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Customer အကောင့်များ ({customers.length})</h2>
            <p className="mt-1 text-sm text-slate-500">
              Customer account ဖွင့်ပြီး Sender တစ်ခုထက်ပို၍ ချိတ်ဆက်နိုင်ပါသည်။
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessage(null)
              setShowCustomerModal(true)
            }}
            className="shrink-0 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:from-orange-600 hover:to-amber-600"
          >
            Customer Account ဖွင့်မည်
          </button>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4">Display Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">ချိတ်ဆက်ထားသော Senders</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Customer အကောင့် မရှိသေးပါ။
                    </td>
                  </tr>
                ) : (
                  customers.map(customer => (
                    <tr key={customer.id} className="align-top transition-colors hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">
                          {customer.displayName || "အမည်မရှိပါ"}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-slate-400">{customer.id}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{customer.email || "-"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {customer.senders.map(sender => (
                            <span
                              key={sender.id}
                              className="rounded-xl border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs text-orange-800"
                              title={sender.id}
                            >
                              {sender.name || `Sender ${sender.id}`}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMessage(null)
                              setEditingCustomer(customer)
                              setEditCustomerDisplayName(customer.displayName)
                              setSelectedSenders(customer.senders)
                              setSenderSearchTerm("")
                              setSenderSearchResults([])
                              setSearchingSenders(false)
                            }}
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                          >
                            ပြင်ဆင်
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={deletingCustomerId !== null}
                            className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
                          >
                            {deletingCustomerId === customer.id ? "ဖျက်နေသည်..." : "ဖျက်"}
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
      </div>

      {activeTab === "customers" && showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Customer Account ဖွင့်ရန်</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Email၊ Display Name၊ Password နှင့် ချိတ်ဆက်မည့် Sender များကို ဖြည့်ပါ။
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                disabled={creatingCustomer}
                aria-label="ပိတ်ရန်"
                className="rounded-xl px-3 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {message && (
              <div
                className={`rounded-2xl border p-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
                role="status"
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="customer-email" className="mb-1 block text-xs font-bold text-slate-600">
                    Email
                  </label>
                  <input
                    id="customer-email"
                    type="email"
                    required
                    disabled={creatingCustomer}
                    autoComplete="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="customer-display-name" className="mb-1 block text-xs font-bold text-slate-600">
                    Display Name
                  </label>
                  <input
                    id="customer-display-name"
                    type="text"
                    required
                    disabled={creatingCustomer}
                    autoComplete="name"
                    value={customerDisplayName}
                    onChange={e => setCustomerDisplayName(e.target.value)}
                    placeholder="Customer အမည်"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="customer-password" className="mb-1 block text-xs font-bold text-slate-600">
                  Password
                </label>
                <input
                  id="customer-password"
                  type="password"
                  required
                  minLength={6}
                  disabled={creatingCustomer}
                  autoComplete="new-password"
                  value={customerPassword}
                  onChange={e => setCustomerPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <p className="mt-1 text-xs text-slate-400">အနည်းဆုံး ၆ လုံး ထည့်ပါ။</p>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="sender-search" className="text-xs font-bold text-slate-600">
                    Sender များ ရှာဖွေရွေးချယ်ရန်
                  </label>
                  <span className="text-xs text-slate-500">
                    ရွေးထားသည် ({selectedSenders.length}/100)
                  </span>
                </div>
                <input
                  id="sender-search"
                  type="search"
                  disabled={creatingCustomer}
                  value={senderSearchTerm}
                  onChange={e => {
                    setSenderSearchTerm(e.target.value)
                    setSenderSearchResults([])
                    setSearchingSenders(Boolean(e.target.value.trim()))
                  }}
                  placeholder="Sender name ဖြင့် ရှာပါ"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />

                {selectedSenders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSenders.map(sender => (
                      <button
                        key={sender.id}
                        type="button"
                        disabled={creatingCustomer}
                        onClick={() => toggleSelectedSender(sender)}
                        className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                        aria-label={`${sender.name} ကို ရွေးချယ်မှုမှ ဖယ်ရန်`}
                      >
                        {sender.name} ×
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200" aria-live="polite">
                  {searchingSenders ? (
                    <p className="p-4 text-center text-sm text-slate-400">ရှာဖွေနေသည်...</p>
                  ) : senderSearchTerm.trim() === "" ? (
                    <p className="p-4 text-center text-sm text-slate-400">
                      Sender အမည် ရိုက်ထည့်ပြီး ရှာဖွေပါ။
                    </p>
                  ) : senderSearchResults.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-400">ကိုက်ညီသော Sender မတွေ့ပါ။</p>
                  ) : (
                    senderSearchResults.map(sender => {
                      const checked = selectedSenders.some(selected => selected.id === sender.id)
                      const selectionLimitReached = selectedSenders.length >= 100 && !checked
                      return (
                        <label
                          key={sender.id}
                          className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 last:border-b-0 hover:bg-slate-50 ${
                            selectionLimitReached ? "cursor-not-allowed opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={creatingCustomer || selectionLimitReached}
                            onChange={() => toggleSelectedSender(sender)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-700">
                              {sender.name}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-slate-400">
                              {sender.id}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </section>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  disabled={creatingCustomer}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={creatingCustomer || selectedSenders.length === 0}
                  className="flex-1 rounded-2xl bg-orange-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingCustomer ? "ဖန်တီးနေသည်..." : "အကောင့်ဖွင့်မည်"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "customers" && editingCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="edit-customer-title" className="text-lg font-bold text-slate-800">
                  Customer Account ပြင်ဆင်ရန်
                </h3>
                <p className="mt-1 text-sm text-slate-500">{editingCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCustomer(null)
                  setEditCustomerDisplayName("")
                  setSelectedSenders([])
                  setSenderSearchTerm("")
                  setSenderSearchResults([])
                  setSearchingSenders(false)
                  setMessage(null)
                }}
                disabled={updatingCustomer}
                aria-label="ပိတ်ရန်"
                className="rounded-xl px-3 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {message && (
              <div
                className={`rounded-2xl border p-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
                role="status"
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleUpdateCustomer} className="space-y-5">
              <div>
                <label htmlFor="edit-customer-display-name" className="mb-1 block text-xs font-bold text-slate-600">
                  Display Name
                </label>
                <input
                  id="edit-customer-display-name"
                  type="text"
                  required
                  disabled={updatingCustomer}
                  autoComplete="name"
                  value={editCustomerDisplayName}
                  onChange={e => setEditCustomerDisplayName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="edit-sender-search" className="text-xs font-bold text-slate-600">
                    ချိတ်ဆက်ထားသော Sender များ
                  </label>
                  <span className="text-xs text-slate-500">
                    ရွေးထားသည် ({selectedSenders.length}/100)
                  </span>
                </div>
                <input
                  id="edit-sender-search"
                  type="search"
                  disabled={updatingCustomer}
                  value={senderSearchTerm}
                  onChange={e => {
                    setSenderSearchTerm(e.target.value)
                    setSenderSearchResults([])
                    setSearchingSenders(Boolean(e.target.value.trim()))
                    setMessage(null)
                  }}
                  placeholder="Sender name ဖြင့် ရှာပါ"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />

                {selectedSenders.length === 0 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">
                    အနည်းဆုံး Sender တစ်ခု ချိတ်ဆက်ထားရပါမည်။
                  </p>
                )}

                {selectedSenders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSenders.map(sender => (
                      <button
                        key={sender.id}
                        type="button"
                        disabled={updatingCustomer}
                        onClick={() => toggleSelectedSender(sender)}
                        className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                        aria-label={`${sender.name || sender.id} ကို ရွေးချယ်မှုမှ ဖယ်ရန်`}
                      >
                        {sender.name || `Sender ${sender.id}`} ×
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200" aria-live="polite">
                  {searchingSenders ? (
                    <p className="p-4 text-center text-sm text-slate-400">ရှာဖွေနေသည်...</p>
                  ) : senderSearchTerm.trim() === "" ? (
                    <p className="p-4 text-center text-sm text-slate-400">
                      Sender အမည် ရိုက်ထည့်ပြီး ရှာဖွေပါ။
                    </p>
                  ) : senderSearchResults.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-400">ကိုက်ညီသော Sender မတွေ့ပါ။</p>
                  ) : (
                    senderSearchResults.map(sender => {
                      const checked = selectedSenders.some(selected => selected.id === sender.id)
                      const selectionLimitReached = selectedSenders.length >= 100 && !checked
                      return (
                        <label
                          key={sender.id}
                          className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 p-3 last:border-b-0 hover:bg-slate-50 ${
                            selectionLimitReached ? "cursor-not-allowed opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={updatingCustomer || selectionLimitReached}
                            onChange={() => toggleSelectedSender(sender)}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-700">
                              {sender.name}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-slate-400">
                              {sender.id}
                            </span>
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </section>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomer(null)
                    setEditCustomerDisplayName("")
                    setSelectedSenders([])
                    setSenderSearchTerm("")
                    setSenderSearchResults([])
                    setSearchingSenders(false)
                    setMessage(null)
                  }}
                  disabled={updatingCustomer}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  disabled={updatingCustomer || selectedSenders.length === 0}
                  className="flex-1 rounded-2xl bg-orange-500 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updatingCustomer ? "သိမ်းဆည်းနေသည်..." : "သိမ်းဆည်းမည်"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 MODAL 1: User အသစ်ဆောက်ရန် */}
      {activeTab === "employees" && showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-800">User Account အသစ်ဖွင့်ရန်</h3>

            <form onSubmit={handleCreateUser} className="space-y-4">

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

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isRider}
                    onChange={e => {
                      setIsRider(e.target.checked)
                      if (!e.target.checked) setRiderId("")
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  Rider နှင့် ချိတ်ဆက်မည်
                </label>
                {isRider && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Rider အမည်</label>
                    <select
                      required
                      value={riderId}
                      onChange={e => setRiderId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                    >
                      <option value="">Rider ကို ရွေးချယ်ပါ</option>
                      {initialRiders.map(rider => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
      {activeTab === "employees" && editingUser && (
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

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editIsRider}
                    onChange={e => {
                      setEditIsRider(e.target.checked)
                      if (!e.target.checked) setEditRiderId("")
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  Rider နှင့် ချိတ်ဆက်မည်
                </label>
                {editIsRider && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Rider အမည်</label>
                    <select
                      required
                      value={editRiderId}
                      onChange={e => setEditRiderId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                    >
                      <option value="">Rider ကို ရွေးချယ်ပါ</option>
                      {initialRiders.map(rider => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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