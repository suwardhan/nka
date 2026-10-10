import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface Env {
  SNAPSHOTS: KVNamespace
  SHEETS_PROXY_URL: string
  PROXY_KEY: string
  CF_ACCESS_TEAM_DOMAIN: string
  CF_ACCESS_AUD: string
  INGEST_SECRET: string
  /** Set to "1" only for local wrangler dev. */
  ALLOW_DEV_BYPASS?: string
}

type JsonRecord = Record<string, unknown>

function corsHeadersFor(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || ''
  const allowed =
    origin === 'https://narendravaluers.in' ||
    (env.ALLOW_DEV_BYPASS === '1' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      ? origin
      : 'https://narendravaluers.in'

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

function json(
  request: Request,
  env: Env,
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeadersFor(request, env),
    },
  })
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/'
  if (trimmed.startsWith('/admin-api')) {
    return trimmed.slice('/admin-api'.length) || '/'
  }
  return trimmed
}

function snapshotKey(year: string): string {
  return `snapshot:${year}`
}

function casesKey(year: string): string {
  return `cases:${year}`
}

function parseYear(
  request: Request,
  env: Env,
  url: URL,
): string | Response {
  const year = String(url.searchParams.get('year') || '').trim()
  if (!/^\d{4}$/.test(year)) {
    return json(request, env, { error: 'Missing or invalid year' }, 400)
  }
  return year
}

function extractCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) {
    return null
  }
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) {
      return rest.join('=') || null
    }
  }
  return null
}

async function verifyAccessJwt(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (env.ALLOW_DEV_BYPASS === '1') {
    return null
  }

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    extractCookie(request, 'CF_Authorization')

  if (!token) {
    return json(request, env, { error: 'Unauthorized' }, 401)
  }

  const team = env.CF_ACCESS_TEAM_DOMAIN?.replace(/^https?:\/\//, '').replace(
    /\/$/,
    '',
  )
  const aud = env.CF_ACCESS_AUD
  if (!team || !aud) {
    return json(
      request,
      env,
      { error: 'Access verification is not configured' },
      500,
    )
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`https://${team}/cdn-cgi/access/certs`),
    )
    await jwtVerify(token, JWKS, {
      issuer: `https://${team}`,
      audience: aud,
    })
    return null
  } catch {
    return json(request, env, { error: 'Unauthorized' }, 401)
  }
}

function verifyIngestSecret(request: Request, env: Env): Response | null {
  const expected = env.INGEST_SECRET
  if (!expected) {
    return json(request, env, { error: 'Ingest is not configured' }, 500)
  }
  const auth = request.headers.get('Authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const headerSecret = request.headers.get('X-Ingest-Secret') || ''
  if (bearer !== expected && headerSecret !== expected) {
    return json(request, env, { error: 'Unauthorized' }, 401)
  }
  return null
}

async function callAppsScript(
  env: Env,
  action: string,
  year: string,
): Promise<JsonRecord> {
  if (!env.SHEETS_PROXY_URL || !env.PROXY_KEY) {
    throw new Error('SHEETS_PROXY_URL / PROXY_KEY are not configured')
  }

  const url = new URL(env.SHEETS_PROXY_URL)
  url.searchParams.set('key', env.PROXY_KEY)
  url.searchParams.set('action', action)
  url.searchParams.set('year', year)

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  })

  const text = await response.text()
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      `Apps Script returned non-JSON (${response.status}). Check SHEETS_PROXY_URL deployment.`,
    )
  }

  let parsed: JsonRecord
  try {
    parsed = JSON.parse(trimmed) as JsonRecord
  } catch {
    throw new Error('Apps Script returned invalid JSON')
  }

  if (parsed.error) {
    throw new Error(String(parsed.error))
  }

  return parsed
}

function splitSnapshot(payload: JsonRecord): {
  dashboard: JsonRecord
  cases: JsonRecord | null
} {
  const cases = Array.isArray(payload.cases) ? payload.cases : null
  const dashboard: JsonRecord = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'cases') {
      continue
    }
    dashboard[key] = value
  }

  if (!cases) {
    return { dashboard, cases: null }
  }

  return {
    dashboard,
    cases: {
      year: payload.year,
      updatedAt: payload.updatedAt,
      timezone: payload.timezone || 'Asia/Kolkata',
      cases,
      github: payload.casesGithub,
    },
  }
}

async function writeCache(
  env: Env,
  year: string,
  dashboard: JsonRecord,
  casesPayload: JsonRecord | null,
): Promise<void> {
  await env.SNAPSHOTS.put(snapshotKey(year), JSON.stringify(dashboard))
  if (casesPayload) {
    await env.SNAPSHOTS.put(casesKey(year), JSON.stringify(casesPayload))
  }
}

async function handleSnapshot(
  request: Request,
  env: Env,
  year: string,
): Promise<Response> {
  const cached = await env.SNAPSHOTS.get(snapshotKey(year), 'json')
  if (cached && typeof cached === 'object') {
    return json(request, env, cached)
  }

  const live = await callAppsScript(env, 'aggregate', year)
  const { dashboard, cases } = splitSnapshot(live)
  await writeCache(env, year, dashboard, cases)
  return json(request, env, dashboard)
}

async function handleCases(
  request: Request,
  env: Env,
  year: string,
): Promise<Response> {
  const cached = await env.SNAPSHOTS.get(casesKey(year), 'json')
  if (cached && typeof cached === 'object') {
    return json(request, env, cached)
  }

  const live = await callAppsScript(env, 'cases', year)
  await env.SNAPSHOTS.put(casesKey(year), JSON.stringify(live))
  return json(request, env, live)
}

async function handleRefresh(
  request: Request,
  env: Env,
  year: string,
): Promise<Response> {
  const live = await callAppsScript(env, 'refresh', year)
  const { dashboard, cases } = splitSnapshot(live)
  await writeCache(env, year, dashboard, cases)

  const responseBody: JsonRecord = { ...dashboard }
  if (cases && Array.isArray(cases.cases)) {
    responseBody.cases = cases.cases
    if (cases.github) {
      responseBody.casesGithub = cases.github
    }
  }
  responseBody.cache = { ok: true }
  return json(request, env, responseBody)
}

async function handleIngest(request: Request, env: Env): Promise<Response> {
  const unauthorized = verifyIngestSecret(request, env)
  if (unauthorized) {
    return unauthorized
  }

  let body: JsonRecord
  try {
    body = (await request.json()) as JsonRecord
  } catch {
    return json(request, env, { error: 'Invalid JSON body' }, 400)
  }

  const year = String(body.year || '').trim()
  if (!/^\d{4}$/.test(year)) {
    return json(request, env, { error: 'Missing or invalid year' }, 400)
  }

  const dashboard =
    body.dashboard && typeof body.dashboard === 'object'
      ? (body.dashboard as JsonRecord)
      : null
  const casesPayload =
    body.cases && typeof body.cases === 'object'
      ? (body.cases as JsonRecord)
      : null

  if (!dashboard && !casesPayload) {
    return json(request, env, { error: 'Provide dashboard and/or cases' }, 400)
  }

  if (dashboard) {
    await env.SNAPSHOTS.put(snapshotKey(year), JSON.stringify(dashboard))
  }
  if (casesPayload) {
    await env.SNAPSHOTS.put(casesKey(year), JSON.stringify(casesPayload))
  }

  return json(request, env, { ok: true, year })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeadersFor(request, env),
      })
    }

    const url = new URL(request.url)
    const path = normalizePath(url.pathname)

    try {
      if (path === '/internal/ingest' && request.method === 'POST') {
        return await handleIngest(request, env)
      }

      const denied = await verifyAccessJwt(request, env)
      if (denied) {
        return denied
      }

      if (path === '/snapshot' && request.method === 'GET') {
        const yearOrError = parseYear(request, env, url)
        if (yearOrError instanceof Response) {
          return yearOrError
        }
        return await handleSnapshot(request, env, yearOrError)
      }

      if (path === '/cases' && request.method === 'GET') {
        const yearOrError = parseYear(request, env, url)
        if (yearOrError instanceof Response) {
          return yearOrError
        }
        return await handleCases(request, env, yearOrError)
      }

      if (path === '/refresh' && request.method === 'POST') {
        const yearOrError = parseYear(request, env, url)
        if (yearOrError instanceof Response) {
          return yearOrError
        }
        return await handleRefresh(request, env, yearOrError)
      }

      return json(request, env, { error: 'Not found' }, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return json(request, env, { error: message }, 500)
    }
  },
}
