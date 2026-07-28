/**
 * Server-side admin authentication for API routes.
 *
 * Checks user session via Supabase auth, then verifies admin role
 * via user_roles table (service_role, bypasses RLS).
 * Fallback: NEXT_PUBLIC_ADMIN_EMAIL always passes.
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/isAdmin'

export function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Returns the authenticated admin user, or null if not admin.
 * Use in API routes: `const user = await getAdminUser(); if (!user) return 403;`
 */
export async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const service = getService()
  const isAdminUser = await requireAdmin(service, user)

  return isAdminUser ? user : null
}
