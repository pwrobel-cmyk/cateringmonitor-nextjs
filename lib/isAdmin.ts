/**
 * Admin role checking — client and server variants.
 *
 * Source of truth: user_roles table (role = 'admin' | 'super_admin').
 * Fallback: NEXT_PUBLIC_ADMIN_EMAIL (owner account always works).
 */

// ─── Client-side (for Header, admin pages) ──────────────────────────────────

export type AppRole = 'super_admin' | 'admin' | 'moderator' | 'user'

const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin']

export function isAdmin(
  email: string | null | undefined,
  role: AppRole | null | undefined,
): boolean {
  // Fallback: owner email always works
  if (email && email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) return true
  // Role from user_roles table
  if (role && ADMIN_ROLES.includes(role)) return true
  return false
}

// ─── Server-side (for API routes) ───────────────────────────────────────────

/**
 * Check if user is admin using service_role client (bypasses RLS).
 * Use in API routes after getting user from auth session.
 */
export async function requireAdmin(
  serviceClient: { from: (table: string) => any },
  user: { id: string; email?: string },
): Promise<boolean> {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (user.email && user.email === adminEmail) return true

  try {
    const { data } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const role = data?.role as AppRole | undefined
    return !!role && ADMIN_ROLES.includes(role)
  } catch {
    return false
  }
}
