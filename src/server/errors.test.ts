import { describe, expect, it } from 'vitest'
import { publicErrorMessage } from './errors'

describe('publicErrorMessage', () => {
  it('preserves intentional client-facing errors', () => {
    const error = new Error('Invalid request') as Error & { statusCode: number }
    error.statusCode = 400

    expect(publicErrorMessage(error)).toBe('Invalid request')
  })

  it('hides Prisma internals for database connection failures', () => {
    const error = new Error('Invalid `prisma.user.create()` invocation\nCan\'t reach database server at `localhost:5432`')

    expect(publicErrorMessage(error)).toBe('Database is not ready. Check DATABASE_URL and start PostgreSQL.')
  })
})
