// app/admin/users/page.tsx
import { getUsersList } from '@/app/actions/admin'
import UserTableClient from './UserTableClient' // အောက်တွင် ပြထားသော Client Component

export const revalidate = 0 // Data အမြဲ လတ်ဆတ်နေစေရန်

export default async function AdminUsersPage() {
  // Step 4 မှ ရေးခဲ့သော getUsersList Action အား လှမ်းခေါ်ခြင်း
  const users = await getUsersList()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-400">User အကောင့်များနှင့် Role များကို စီမံခန့်ခွဲရန်</p>
        </div>
      </div>

      {/* User Table နှင့် Create User Form ပါဝင်သော Client Component */}
      <UserTableClient initialUsers={users || []} />
    </div>
  )
}