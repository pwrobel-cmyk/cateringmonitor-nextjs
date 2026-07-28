import { getAdminUser, getService } from '@/lib/adminAuth'
import { executeCloudRunJob, getExecutionStatus } from '@/lib/gcpAuth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { sourceId, send = false } = body

  if (!sourceId || !UUID_RE.test(sourceId)) {
    return Response.json({ error: 'Invalid sourceId (UUID required)' }, { status: 400 })
  }

  // Verify source exists
  const service = getService()
  const { data: source, error: srcErr } = await service
    .from('social_sources')
    .select('id, brand_id, source_name')
    .eq('id', sourceId)
    .single()

  if (srcErr || !source) {
    return Response.json({ error: 'Source not found' }, { status: 404 })
  }

  try {
    const { executionName } = await executeCloudRunJob({
      env: { SOCIAL_SOURCE_ID: sourceId },
      args: send ? ['--send'] : [],
    })

    return Response.json({
      ok: true,
      executionName,
      sourceId,
      sourceName: source.source_name,
      send,
    })
  } catch (err: any) {
    return Response.json({ error: err.message || 'Failed to execute job' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = await getAdminUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const executionName = searchParams.get('execution')
  if (!executionName) {
    return Response.json({ error: 'Missing execution param' }, { status: 400 })
  }

  if (!/^facebook-social-cloud-test-[a-z0-9]+$/.test(executionName)) {
    return Response.json({ error: 'Invalid execution name' }, { status: 400 })
  }

  try {
    const status = await getExecutionStatus(executionName)
    return Response.json(status)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
