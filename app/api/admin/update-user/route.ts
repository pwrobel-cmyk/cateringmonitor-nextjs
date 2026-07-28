import { getAdminUser, getService } from '@/lib/adminAuth'

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) { return Response.json({ error: 'Unauthorized' }, { status: 403 }) }

  const { userId, brandId, role, password } = await request.json()

  if (!userId) {
    return Response.json({ error: 'Missing userId' }, { status: 400 })
  }

  const service = getService()

  const errors: string[] = []

  // Brand assignment
  if (brandId !== undefined) {
    await service.from('user_brand_assignments').delete().eq('user_id', userId)
    if (brandId) {
      const { error } = await service.from('user_brand_assignments').insert({ user_id: userId, brand_id: brandId })
      if (error) errors.push(`brand: ${error.message}`)
    }
  }

  // Role — stored in user_roles table (delete + insert)
  if (role !== undefined) {
    await service.from('user_roles').delete().eq('user_id', userId)
    const { error } = await service.from('user_roles').insert({ user_id: userId, role })
    if (error) errors.push(`role: ${error.message}`)
  }

  // Password
  if (password) {
    const { error } = await service.auth.admin.updateUserById(userId, { password })
    if (error) errors.push(`password: ${error.message}`)
  }

  if (errors.length > 0) {
    return Response.json({ error: errors.join('; ') }, { status: 500 })
  }

  return Response.json({ ok: true })
}
