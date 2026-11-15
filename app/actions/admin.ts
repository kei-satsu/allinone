'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

type CustomerAccountResult =
  | { success: false; message: string }
  | {
      success: true
      message: string
      customer: {
        id: string
        email: string
        displayName: string
        senders: { id: string; name: string }[]
      }
    }

async function requireAdminAccess() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Cookie writes are unavailable during Server Component rendering.
          }
        },
      },
    },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || user?.app_metadata?.role !== 'admin') {
    throw new Error('Admin access required.')
  }
}

// ၁။ Auth အကောင့်ရော profiles ပါ ပေါင်းစပ်၍ Username အပါအဝင် User List ဆွဲထုတ်ခြင်း
export async function getUsersList() {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
  if (authError) throw new Error(authError.message)

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')

  if (profileError) throw new Error(profileError.message)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const mergedUsers = authData.users.filter(authUser => profileMap.has(authUser.id)).map(authUser => {
    const profile = profileMap.get(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email || '',
      username: profile?.username || authUser.user_metadata?.username || authUser.email?.split('@')[0] || '',
      role: profile?.role || authUser.app_metadata?.role || 'staff',
      branch: profile?.branch || authUser.app_metadata?.branch || authUser.user_metadata?.branch || 'MDY',
      rider_id: profile?.rider_id || null,
      created_at: authUser.created_at,
    }
  })

  return mergedUsers
}

export async function getRidersList() {
  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getCustomerAccounts() {
  await requireAdminAccess()

  const pageSize = 1000
  const relationships: { user_id: string; sender_id: string }[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('user_senders')
      .select('user_id, sender_id')
      .order('user_id', { ascending: true })
      .order('sender_id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(error.message)
    relationships.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }

  const senderIds = [...new Set(relationships.map(row => row.sender_id).filter(Boolean))]
  const senderMap = new Map<string, { id: string; name: string }>()
  for (let offset = 0; offset < senderIds.length; offset += 500) {
    const { data, error } = await supabaseAdmin
      .from('senders')
      .select('id, name')
      .in('id', senderIds.slice(offset, offset + 500))

    if (error) throw new Error(error.message)
    for (const sender of data ?? []) {
      senderMap.set(String(sender.id), { id: String(sender.id), name: sender.name || '' })
    }
  }

  const senderIdsByUser = new Map<string, Set<string>>()
  for (const relationship of relationships) {
    if (!relationship.user_id || !relationship.sender_id) continue
    const userSenderIds = senderIdsByUser.get(relationship.user_id) ?? new Set<string>()
    userSenderIds.add(String(relationship.sender_id))
    senderIdsByUser.set(relationship.user_id, userSenderIds)
  }

  const pendingUserIds = new Set(senderIdsByUser.keys())
  const authUsersById = new Map<string, { email: string; displayName: string }>()
  for (let page = 1; pendingUserIds.size > 0; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: pageSize })
    if (error) throw new Error(error.message)

    for (const user of data.users) {
      if (!pendingUserIds.has(user.id)) continue
      authUsersById.set(user.id, {
        email: user.email || '',
        displayName:
          typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '',
      })
      pendingUserIds.delete(user.id)
    }

    if (data.users.length < pageSize) break
  }

  return [...senderIdsByUser.entries()]
    .flatMap(([userId, userSenderIds]) => {
      const authUser = authUsersById.get(userId)
      if (!authUser) return []
      return [{
        id: userId,
        ...authUser,
        senders: [...userSenderIds].map(
          senderId => senderMap.get(senderId) ?? { id: senderId, name: '' },
        ),
      }]
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function searchSenders(searchTerm: string) {
  await requireAdminAccess()

  const term = typeof searchTerm === 'string' ? searchTerm.trim() : ''
  if (!term) return []

  const { data, error } = await supabaseAdmin
    .from('senders')
    .select('id, name')
    .ilike('name', `%${term}%`)
    .order('name', { ascending: true })
    .limit(25)

  if (error) throw new Error(error.message)
  return (data ?? []).map(sender => ({ id: String(sender.id), name: sender.name || '' }))
}

async function getValidatedSenders(senderIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from('senders')
    .select('id, name')
    .in('id', senderIds)

  if (error) throw new Error(error.message)
  const senders = data ?? []
  const matchedIds = new Set(senders.map(sender => String(sender.id)))
  if (senderIds.some(id => !matchedIds.has(id))) return null
  return senders
}

export async function createCustomerAccount(input: {
  email: string
  displayName: string
  password: string
  senderIds: string[]
}): Promise<CustomerAccountResult> {
  await requireAdminAccess()

  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.email !== 'string' ||
    typeof input.displayName !== 'string' ||
    typeof input.password !== 'string' ||
    !Array.isArray(input.senderIds) ||
    !input.senderIds.every((id): id is string => typeof id === 'string')
  ) {
    return { success: false, message: 'Customer account အချက်အလက်များ မမှန်ကန်ပါ။' }
  }

  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim()
  const password = input.password
  const senderIds = [...new Set(input.senderIds.map(id => id.trim()).filter(Boolean))]

  if (!email || !email.includes('@') || !displayName || password.length < 6) {
    return { success: false, message: 'Email၊ Display Name နှင့် အနည်းဆုံး ၆ လုံးရှိသော Password ဖြည့်ပါ။' }
  }
  if (senderIds.length === 0) {
    return { success: false, message: 'ချိတ်ဆက်မည့် Sender အနည်းဆုံး တစ်ခု ရွေးပါ။' }
  }
  if (senderIds.length > 100) {
    return { success: false, message: 'Sender ၁၀၀ ခုထက် ပိုမရွေးနိုင်ပါ။' }
  }

  const validSenders = await getValidatedSenders(senderIds)
  if (!validSenders) {
    return { success: false, message: 'ရွေးချယ်ထားသော Sender အချို့ကို မတွေ့ပါ။ ပြန်ရွေးချယ်ပါ။' }
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'customer' },
    user_metadata: { display_name: displayName },
  })

  if (authError) return { success: false, message: authError.message }
  if (!authData.user) throw new Error('Customer Auth account was not returned after creation.')

  const { error: linkError } = await supabaseAdmin
    .from('user_senders')
    .insert(validSenders.map(sender => ({ user_id: authData.user.id, sender_id: sender.id })))

  if (linkError) {
    const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    if (cleanupError) {
      throw new Error(
        `Sender ချိတ်ဆက်မှု မအောင်မြင်ပါ (${linkError.message})။ Auth account ကို ဖျက်ရှင်းရာတွင်လည်း မအောင်မြင်ပါ (${cleanupError.message})။`,
      )
    }
    return { success: false, message: `Sender ချိတ်ဆက်မှု မအောင်မြင်ပါ: ${linkError.message}` }
  }

  revalidatePath('/admin/users')
  return {
    success: true,
    message: 'Customer account ကို Sender များနှင့်အတူ အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ။',
    customer: {
      id: authData.user.id,
      email,
      displayName,
      senders: validSenders.map(sender => ({ id: String(sender.id), name: sender.name || '' })),
    },
  }
}

export async function updateCustomerAccount(input: {
  userId: string
  displayName: string
  senderIds: string[]
}): Promise<CustomerAccountResult> {
  await requireAdminAccess()

  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.userId !== 'string' ||
    typeof input.displayName !== 'string' ||
    !Array.isArray(input.senderIds) ||
    !input.senderIds.every((id): id is string => typeof id === 'string')
  ) {
    return { success: false, message: 'Customer account အချက်အလက်များ မမှန်ကန်ပါ။' }
  }

  const userId = input.userId.trim()
  const displayName = input.displayName.trim()
  const senderIds = [...new Set(input.senderIds.map(id => id.trim()).filter(Boolean))]
  if (!userId || !displayName) {
    return { success: false, message: 'Display Name ကို ဖြည့်ပါ။' }
  }
  if (senderIds.length === 0) {
    return { success: false, message: 'Sender အနည်းဆုံး တစ်ခု ချိတ်ဆက်ထားရပါမည်။' }
  }
  if (senderIds.length > 100) {
    return { success: false, message: 'Sender ၁၀၀ ခုထက် ပိုမရွေးနိုင်ပါ။' }
  }

  const { data: authData, error: authLookupError } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (authLookupError) return { success: false, message: authLookupError.message }
  const authUser = authData.user
  if (!authUser) {
    return { success: false, message: 'Customer account ကို မတွေ့ပါ။' }
  }

  const validSenders = await getValidatedSenders(senderIds)
  if (!validSenders) {
    return { success: false, message: 'ရွေးချယ်ထားသော Sender အချို့ကို မတွေ့ပါ။ ပြန်ရွေးချယ်ပါ။' }
  }

  const { data: currentLinks, error: linkLookupError } = await supabaseAdmin
    .from('user_senders')
    .select('sender_id')
    .eq('user_id', userId)

  if (linkLookupError) throw new Error(linkLookupError.message)
  if ((currentLinks ?? []).length === 0) {
    return { success: false, message: 'ဤ Customer အတွက် Sender ချိတ်ဆက်မှု မရှိပါ။' }
  }

  const currentIds = new Set((currentLinks ?? []).map(link => String(link.sender_id)))
  const requestedIds = new Set(senderIds)
  const sendersToAdd = validSenders.filter(sender => !currentIds.has(String(sender.id)))
  const senderIdsToRemove = [...currentIds].filter(id => !requestedIds.has(id))

  if (sendersToAdd.length > 0) {
    const { error: addError } = await supabaseAdmin
      .from('user_senders')
      .insert(sendersToAdd.map(sender => ({ user_id: userId, sender_id: sender.id })))

    if (addError) return { success: false, message: `Sender ချိတ်ဆက်၍ မရပါ: ${addError.message}` }
  }

  const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { ...authUser.user_metadata, display_name: displayName },
  })

  if (updateAuthError) {
    if (sendersToAdd.length > 0) {
      const { error: rollbackError } = await supabaseAdmin
        .from('user_senders')
        .delete()
        .eq('user_id', userId)
        .in('sender_id', sendersToAdd.map(sender => sender.id))

      if (rollbackError) {
        throw new Error(
          `Display Name ပြင်ဆင်၍ မရပါ (${updateAuthError.message})။ Sender row များကို ပြန်ဖျက်ရာတွင်လည်း မအောင်မြင်ပါ (${rollbackError.message})။`,
        )
      }
    }
    return { success: false, message: updateAuthError.message }
  }

  if (senderIdsToRemove.length > 0) {
    const { error: removeError } = await supabaseAdmin
      .from('user_senders')
      .delete()
      .eq('user_id', userId)
      .in('sender_id', senderIdsToRemove)

    if (removeError) {
      const { error: restoreAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: authUser.user_metadata,
      })
      let rollbackLinksError: Error | null = null
      if (sendersToAdd.length > 0) {
        const { error } = await supabaseAdmin
          .from('user_senders')
          .delete()
          .eq('user_id', userId)
          .in('sender_id', sendersToAdd.map(sender => sender.id))
        rollbackLinksError = error
      }

      if (restoreAuthError || rollbackLinksError) {
        throw new Error(
          `Sender ချိတ်ဆက်မှု ဖယ်ရှား၍ မရပါ (${removeError.message})။ ပြန်လည်ပြင်ဆင်ရာတွင် Auth: ${restoreAuthError?.message ?? 'OK'}; Sender rows: ${rollbackLinksError?.message ?? 'OK'}။`,
        )
      }
      return { success: false, message: `Sender ချိတ်ဆက်မှု ဖယ်ရှား၍ မရပါ: ${removeError.message}` }
    }
  }

  revalidatePath('/admin/users')
  return {
    success: true,
    message: 'Customer account ပြင်ဆင်ပြီးပါပြီ။',
    customer: {
      id: userId,
      email: authUser.email || '',
      displayName,
      senders: validSenders.map(sender => ({ id: String(sender.id), name: sender.name || '' })),
    },
  }
}

export async function deleteCustomerAccount(userId: string) {
  await requireAdminAccess()

  if (typeof userId !== 'string' || !userId.trim()) {
    return { success: false, message: 'Customer ID မမှန်ကန်ပါ။' }
  }

  const normalizedUserId = userId.trim()
  const { data: authData, error: authLookupError } =
    await supabaseAdmin.auth.admin.getUserById(normalizedUserId)
  if (authLookupError) return { success: false, message: authLookupError.message }
  if (!authData.user) {
    return { success: false, message: 'Customer account ကို မတွေ့ပါ။' }
  }

  const { data: links, error: linkLookupError } = await supabaseAdmin
    .from('user_senders')
    .select('sender_id')
    .eq('user_id', normalizedUserId)
  if (linkLookupError) throw new Error(linkLookupError.message)
  if ((links ?? []).length === 0) {
    return { success: false, message: 'ဤ Customer အတွက် Sender ချိတ်ဆက်မှု မရှိပါ။' }
  }

  const { error: unlinkError } = await supabaseAdmin
    .from('user_senders')
    .delete()
    .eq('user_id', normalizedUserId)
  if (unlinkError) return { success: false, message: `Sender ချိတ်ဆက်မှုများ ဖျက်၍ မရပါ: ${unlinkError.message}` }

  const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(normalizedUserId)
  if (deleteAuthError) {
    if ((links ?? []).length > 0) {
      const { error: restoreError } = await supabaseAdmin
        .from('user_senders')
        .insert((links ?? []).map(link => ({ user_id: normalizedUserId, sender_id: link.sender_id })))
      if (restoreError) {
        throw new Error(
          `Auth account ဖျက်၍ မရပါ (${deleteAuthError.message})။ Sender ချိတ်ဆက်မှုများ ပြန်ထည့်ရာတွင်လည်း မအောင်မြင်ပါ (${restoreError.message})။`,
        )
      }
    }
    return { success: false, message: deleteAuthError.message }
  }

  revalidatePath('/admin/users')
  return { success: true, message: 'Customer account ကို ဖျက်ပြီးပါပြီ။' }
}

async function validateRiderId(riderId: string | null) {
  if (!riderId) return null

  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('id')
    .eq('id', riderId)
    .maybeSingle()

  if (error) return error.message
  if (!data) return 'ရွေးချယ်ထားသော Rider ကို မတွေ့ပါ။'
  return null
}

// ၂။ User အသစ်ဖွင့်ချိန်တွင် Username, Role, Branch နှင့် Rider ချိတ်ဆက်မှု သတ်မှတ်ခြင်း
export async function createNewUser(formData: {
  email: string
  pass: string
  username: string
  role: string
  branch: string
  rider_id?: string | null
}) {
  const { email, pass, username, role, branch } = formData
  const riderId = formData.rider_id?.trim() || null
  const riderError = await validateRiderId(riderId)
  if (riderError) return { success: false, message: riderError }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    app_metadata: { role, branch },
    user_metadata: { username, branch, rider_id: riderId },
  })

  if (authError) return { success: false, message: authError.message }

  if (authUser.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: authUser.user.id,
          email,
          username: username || email.split('@')[0],
          role,
          branch,
          rider_id: riderId,
        },
        { onConflict: 'id' },
      )

    if (profileError) {
      return { success: false, message: profileError.message }
    }
  }

  revalidatePath('/admin/users')
  return { success: true, message: 'User Account အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ။' }
}

// ၃။ User ရဲ့ Username, Role သို့မဟုတ် Branch ကို ပြောင်းလဲခြင်း
export async function updateUserProfile(
  userId: string,
  newUsername: string,
  newRole: string,
  newBranch: string,
  riderId: string | null,
) {
  const normalizedRiderId = riderId?.trim() || null
  const riderError = await validateRiderId(normalizedRiderId)
  if (riderError) return { success: false, message: riderError }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const userEmail = userData?.user?.email || ''

  const { error: dbError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: userEmail,
        username: newUsername,
        role: newRole,
        branch: newBranch,
        rider_id: normalizedRiderId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (dbError) return { success: false, message: dbError.message }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: newRole, branch: newBranch },
    user_metadata: { username: newUsername, branch: newBranch, rider_id: normalizedRiderId },
  })

  if (authError) return { success: false, message: authError.message }

  revalidatePath('/admin/users')
  return { success: true, message: 'Profile အချက်အလက်များ ပြောင်းလဲပြီးပါပြီ။' }
}

// ၄။ User Account ကို ဖျက်ပစ်ခြင်း
export async function deleteUser(userId: string) {
  const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
  if (profileError) return { success: false, message: profileError.message }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) return { success: false, message: error.message }

  revalidatePath('/admin/users')
  return { success: true, message: 'Account ကို ဖျက်ပြီးပါပြီ။' }
}

// ၅။ Admin ဘက်မှ User ထံသို့ Password Reset Link တိုက်ရိုက် ပို့ပေးခြင်း
export async function sendResetPasswordEmail(email: string) {
  if (!email) return { success: false, message: 'Email အချက်အလက် မရှိပါ။' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectTo = `${siteUrl}/reset-password`

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) return { success: false, message: error.message }

  return {
    success: true,
    message: `${email} ထံသို့ Password ပြောင်းရန် Link ကို အောင်မြင်စွာ ပို့ပေးလိုက်ပါပြီ။`,
  }
}
