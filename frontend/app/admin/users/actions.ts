'use server'
import { revalidatePath } from 'next/cache'
import { getCurrentAppUser, isSuperAdmin, setUserRole, type Role } from '@/lib/auth'

export async function changeRole(targetUserId: string, role: Role) {
  // Only super_admin can touch roles
  if (!(await isSuperAdmin())) {
    return { ok: false, error: 'Only super admins can change roles.' }
  }

  // Validate role value
  if (!['super_admin', 'admin', 'individual'].includes(role)) {
    return { ok: false, error: 'Invalid role.' }
  }

  // Prevent self-role changes (protects the only super_admin from locking themselves out)
  const me = await getCurrentAppUser()
  if (me?.id === targetUserId) {
    return { ok: false, error: 'You cannot change your own role.' }
  }

  try {
    await setUserRole(targetUserId, role)
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
