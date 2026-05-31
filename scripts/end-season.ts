import { prisma } from '../src/server/db'
import { endActiveSeason } from '../src/server/seasons'

const forceAbandonActiveLadder = process.argv.includes('--force-abandon-active-ladder')

async function main() {
  const result = await endActiveSeason({ forceAbandonActiveLadder })
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
