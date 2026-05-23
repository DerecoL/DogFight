import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

const { queryRawMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
}))

vi.mock('./db', () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

const { buildApp } = await import('./app')

afterEach(() => {
  queryRawMock.mockReset()
})

describe('health API', () => {
  it('checks PostgreSQL before reporting healthy', async () => {
    queryRawMock.mockResolvedValue([{ ok: 1 }])
    const app = buildApp()

    try {
      await app.ready()
      const response = await request(app.server).get('/api/health').expect(200)

      expect(queryRawMock).toHaveBeenCalledOnce()
      expect(response.body).toMatchObject({ ok: true, database: 'ok' })
      expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('returns unavailable when PostgreSQL cannot be reached', async () => {
    queryRawMock.mockRejectedValue(new Error('database down'))
    const app = buildApp()

    try {
      await app.ready()
      const response = await request(app.server).get('/api/health').expect(503)

      expect(queryRawMock).toHaveBeenCalledOnce()
      expect(response.body).toMatchObject({ ok: false, database: 'unavailable' })
      expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false)
    } finally {
      await app.close()
    }
  })
})
