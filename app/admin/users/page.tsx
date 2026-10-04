// app/admin/users/page.tsx
import { getRidersList, getUsersList } from '@/app/actions/admin'
import UserTableClient from './UserTableClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const [users, riders] = await Promise.all([getUsersList(), getRidersList()])

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

      <UserTableClient initialUsers={users ?? []} initialRiders={riders} />
    </div>
  )
}
