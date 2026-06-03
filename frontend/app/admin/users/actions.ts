'use server'
import { revalidatePath } from 'next/cache'
import { isSuperAdmin, setUserRole, type Role } from '@/lib/auth'

export async function changeRole(userId: string, role: Role) {
  if (!(await isSuperAdmin())) {
    return { ok: false, error: 'Only super admins can change roles.' }
  }
  if (!['super_admin', 'admin', 'individual'].includes(role)) {
    return { ok: false, error: 'Invalid role.' }
  }
  try {
    await setUserRole(userId, role)
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
