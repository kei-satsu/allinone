'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ၁။ Auth အကောင့်ရော profiles ပါ ပေါင်းစပ်၍ Username အပါအဝင် User List ဆွဲထုတ်ခြင်း
export async function getUsersList() {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
  if (authError) throw new Error(authError.message)

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')

  if (profileError) throw new Error(profileError.message)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  const mergedUsers = authData.users.map(authUser => {
    const profile = profileMap.get(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email || '',
      username: profile?.username || authUser.user_metadata?.username || authUser.email?.split('@')[0] || '',
      role: profile?.role || authUser.app_metadata?.role || 'staff',
      branch: profile?.branch || authUser.app_metadata?.branch || authUser.user_metadata?.branch || 'MDY',
      rider_id: profile?.rider_id || authUser.user_metadata?.rider_id || null, // 👈 rider_id ကို ပါးပေးလိုက်သည်
      created_at: authUser.created_at,
    }
  })

  return mergedUsers
}

// ၂။ User အသစ်ဖွင့်ချိန်တွင် Username, Role, Branch, Rider ID အတူတကွ သတ်မှတ်ခြင်း
export async function createNewUser(formData: {
  email: string
  pass: string
  username: string
  role: string
  branch: string
  rider_id?: string
}) {
  // 👈 1. rider_id ကိုပါ formData ကနေ ဆွဲထုတ်လိုက်သည်
  const { email, pass, username, role, branch, rider_id } = formData

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    app_metadata: { role, branch },
    user_metadata: { username, branch, rider_id: role === 'rider' ? rider_id : null },
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
          rider_id: role === 'rider' ? (rider_id || null) : null, // 👈 2. profiles table ထဲသို့ rider_id ထည့်ပေးလိုက်သည်
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
) {
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (dbError) return { success: false, message: dbError.message }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: newRole, branch: newBranch },
    user_metadata: { username: newUsername, branch: newBranch },
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

// ၆။ riders table ထဲမှ ID ဖြင့် Rider အမည်ရှာခြင်း
export async function getRiderById(id: string) {
  const riderId = id.trim()

  if (!riderId) {
    return {
      success: false,
      rider: null,
      message: 'Rider ID ဖြည့်စွက်ပေးပါ။',
    }
  }

  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('id, name')
    .eq('id', riderId)
    .maybeSingle()

  if (error) {
    console.error('getRiderById error:', error)
    return {
      success: false,
      rider: null,
      message: 'Rider အချက်အလက် ရှာဖွေရာတွင် အမှားရှိပါသည်။',
    }
  }

  if (!data) {
    return {
      success: false,
      rider: null,
      message: 'ဤ Rider ID မတွေ့ပါ။',
    }
  }

  return {
    success: true,
    rider: {
      id: data.id,
      name: data.name,
    },
    message: 'Rider အမည် ရရှိပါပြီ။',
  }
}