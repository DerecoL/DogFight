import { describe, expect, it, vi } from 'vitest'
import { exchangeTapTapCode, type TapTapAuthConfig } from './taptap-auth'

const cnConfig: TapTapAuthConfig = {
  appId: 'cn-app',
  secret: 'cn-secret',
  region: 'cn',
}

describe('TapTap auth client', () => {
  it('exchanges a code against the domestic TapTap endpoint', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      openid: 'openid-1',
      unionid: 'union-1',
      session_key: 'session-1',
    }), { status: 200 }))

    const result = await exchangeTapTapCode(cnConfig, 'login-code', fetchFn)

    expect(result).toEqual({
      openid: 'openid-1',
      unionid: 'union-1',
      sessionKey: 'session-1',
    })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchFn.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.origin + url.pathname).toBe('https://cloud-miniapp.tapapis.cn/auth/v1/jscode2session')
    expect(url.searchParams.get('appid')).toBe('cn-app')
    expect(url.searchParams.get('secret')).toBe('cn-secret')
    expect(url.searchParams.get('js_code')).toBe('login-code')
    expect(url.searchParams.get('grant_type')).toBe('authorization_code')
  })

  it('uses the international TapTap endpoint for io region', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      openid: 'openid-io',
      session_key: 'session-io',
    }), { status: 200 }))

    await exchangeTapTapCode({ ...cnConfig, region: 'io' }, 'login-code', fetchFn)

    const [requestUrl] = fetchFn.mock.calls[0]
    const url = new URL(String(requestUrl))
    expect(url.origin + url.pathname).toBe('https://cloud-miniapp.tapapis.com/auth/v1/jscode2session')
  })

  it('rejects TapTap error responses without leaking secrets', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      errcode: 1040029,
      errmsg: 'invalid code',
    }), { status: 200 }))

    await expect(exchangeTapTapCode(cnConfig, 'bad-code', fetchFn)).rejects.toThrow('TapTap login failed: invalid code')
  })
})
