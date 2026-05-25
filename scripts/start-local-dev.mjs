import { spawn } from 'node:child_process'

const npmCommand = 'npm'

function ensureSslDisabled(databaseUrl) {
  if (!databaseUrl || databaseUrl.includes('sslmode=')) return databaseUrl
  return `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=disable`
}

function runNpmScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['run', script], {
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    const stop = (signal) => {
      if (!child.killed) child.kill(signal)
    }

    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${script} exited with ${signal ?? code}`))
    })
  })
}

process.env.DATABASE_URL = ensureSslDisabled(process.env.DATABASE_URL)

await runNpmScript('db:push')
await runNpmScript('dev:app')
