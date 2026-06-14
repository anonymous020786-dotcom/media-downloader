'use server'
import { revalidatePath } from 'next/cache'
import { getCurrentAppUser, isSuperAdmin, setUserRole, type Role } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function changeRole(targetUserId: string, role: Role) {
  if (!(await isSuperAdmin())) {
    return { ok: false, error: 'Only super admins can change roles.' }
  }

  if (!['admin', 'user'].includes(role)) {
    return { ok: false, error: 'Invalid role. Can only set admin or user.' }
  }

  const me = await getCurrentAppUser()
  if (me?.id === targetUserId) {
    return { ok: false, error: 'You cannot change your own role.' }
  }

  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    await setUserRole(targetUserId, role as 'admin' | 'user', token)
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
