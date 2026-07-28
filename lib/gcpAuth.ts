/**
 * Client for the Cloud Run proxy that executes Facebook social collector jobs.
 *
 * The proxy runs as a Cloud Run service with its own SA identity,
 * authenticates requests via x-import-token (same DISCOUNT_IMPORT_TOKEN).
 *
 * No GCP SDK or SA keys needed in Vercel — just HTTP calls.
 *
 * Env:
 *   SOCIAL_PROXY_URL — URL of the Cloud Run proxy service
 *   DISCOUNT_IMPORT_TOKEN — shared auth token
 */

const PROXY_URL = process.env.SOCIAL_PROXY_URL || ''
const TOKEN = process.env.DISCOUNT_IMPORT_TOKEN || ''

function getHeaders() {
  if (!PROXY_URL) throw new Error('SOCIAL_PROXY_URL env var not set')
  if (!TOKEN) throw new Error('DISCOUNT_IMPORT_TOKEN env var not set')
  return {
    'Content-Type': 'application/json',
    'x-import-token': TOKEN,
  }
}

export async function executeCloudRunJob(overrides?: {
  env?: Record<string, string>
  args?: string[]
}): Promise<{ executionName: string }> {
  const resp = await fetch(`${PROXY_URL}/run`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      sourceId: overrides?.env?.SOCIAL_SOURCE_ID || '',
      send: overrides?.args?.includes('--send') || false,
    }),
  })

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }))
    throw new Error(data.error || `Proxy error: ${resp.status}`)
  }

  const data = await resp.json()
  return { executionName: data.executionName }
}

export async function getExecutionStatus(executionName: string): Promise<{
  status: 'running' | 'success' | 'failed' | 'unknown'
  message: string
  startTime?: string
  completionTime?: string
  result?: any
}> {
  const resp = await fetch(
    `${PROXY_URL}/status?execution=${encodeURIComponent(executionName)}`,
    { headers: getHeaders() },
  )

  if (!resp.ok) {
    return { status: 'unknown', message: `Proxy error: ${resp.status}` }
  }

  return resp.json()
}

// Re-export for backward compat — logs are now fetched by the proxy
export async function getExecutionLogs(executionName: string): Promise<string | null> {
  const status = await getExecutionStatus(executionName)
  return status.result ? JSON.stringify(status.result) : null
}
