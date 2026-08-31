import { spawn } from 'node:child_process'
import process from 'node:process'

const port = 18787
const child = spawn(process.execPath, ['server/index.mjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    SESSION_SECRET: 'hw-landing-ci-smoke-secret-do-not-use-in-production',
    DISCORD_CLIENT_ID: '',
    DISCORD_CLIENT_SECRET: '',
    DISCORD_REDIRECT_URI: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stderr = ''
child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited early with code ${child.exitCode}. ${stderr}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.ok) {
        const body = await response.json()
        if (body.ok === true && body.authReady === false) return
      }
    } catch {
      // Server may still be starting.
    }
    await sleep(100)
  }
  throw new Error(`Health endpoint did not become ready. ${stderr}`)
}

try {
  await waitForHealth()
  console.log('HW Landing server smoke test passed.')
} finally {
  child.kill('SIGTERM')
}
