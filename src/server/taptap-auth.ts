export type TapTapAuthConfig = {
  appId: string
  secret: string
  region: 'cn' | 'io'
}

export type TapTapSession = {
  openid: string
  unionid?: string
  sessionKey: string
}

type TapTapCode2SessionResponse = {
  openid?: string
  unionid?: string
  session_key?: string
  errcode?: number
  errmsg?: string
}

const CODE2SESSION_ENDPOINTS: Record<TapTapAuthConfig['region'], string> = {
  cn: 'https://cloud-miniapp.tapapis.cn/auth/v1/jscode2session',
  io: 'https://cloud-miniapp.tapapis.com/auth/v1/jscode2session',
}

export async function exchangeTapTapCode(
  config: TapTapAuthConfig,
  code: string,
  fetchFn: typeof fetch = fetch,
): Promise<TapTapSession> {
  const url = new URL(CODE2SESSION_ENDPOINTS[config.region])
  url.searchParams.set('appid', config.appId)
  url.searchParams.set('secret', config.secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const response = await fetchFn(url.toString())
  const body = await response.json() as TapTapCode2SessionResponse

  if (!response.ok || body.errcode || !body.openid || !body.session_key) {
    const message = body.errmsg || response.statusText || 'code exchange failed'
    throw new Error(`TapTap login failed: ${message}`)
  }

  return {
    openid: body.openid,
    unionid: body.unionid,
    sessionKey: body.session_key,
  }
}
