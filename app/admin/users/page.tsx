// app/admin/users/page.tsx
import { getUsersList } from '@/app/actions/admin'
import UserTableClient from './UserTableClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const users = await getUsersList()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-400">
            User အကောင့်များနှင့် Role များကို စီမံခန့်ခွဲရန်
          </p>
        </div>
      </div>

      <UserTableClient initialUsers={users ?? []} />
    </div>
  )
}

// မှတ်ချက်။ Rider lookup အတွက် page.tsx ကို getRiderById မခေါ်ပါ။
// Client Component က server action ဖြစ်သော getRiderById ကို တိုက်ရိုက်ခေါ်ပါမည်။
// ထို့ကြောင့် အောက်ပါ admin.ts ထဲတွင် getRiderById ကို export လုပ်ထားရန်လိုပါသည်။
