import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
