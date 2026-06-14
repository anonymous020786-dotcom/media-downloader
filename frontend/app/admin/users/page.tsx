import { redirect } from 'next/navigation'
import { isSuperAdmin, listUsers } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import UserTable from './UserTable'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  if (!(await isSuperAdmin())) redirect('/admin')

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const users = await listUsers(token)

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[var(--text)]">User Management</h1>
        <p className="text-sm text-[var(--text-3)]">{users.length} registered users · Manage roles & access</p>
      </div>
      <UserTable users={users} />
    </div>
  )
}
