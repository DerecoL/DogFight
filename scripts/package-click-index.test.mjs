import vm from 'node:vm'
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { buildStandaloneIndex } from './package-click-index.mjs'

async function createMinimalDist(root) {
  const distDir = path.join(root, 'dist')
  const assetsDir = path.join(distDir, 'assets')
  await mkdir(assetsDir, { recursive: true })
  await writeFile(
    path.join(distDir, 'index.html'),
    '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
  )
  await writeFile(path.join(assetsDir, 'app.js'), 'console.log("app")')
  return distDir
}

function extractMockScript(html) {
  return html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
}

function evaluateMockScript(script) {
  const storage = new Map()
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  }
  const window = {
    fetch: async () => new Response('{}', { status: 404 }),
    location: { href: 'file:///DogFight-standalone-index.html' },
    localStorage,
  }
  const context = {
    window,
    localStorage,
    Response,
    URL,
    console,
    Math,
    Date,
    JSON,
    Number,
    String,
    Array,
    Object,
    Set,
    Map,
  }
  vm.runInNewContext(script, context)
  const storageKey = `dogfight:standalone-state:${window.__DOGFIGHT_STANDALONE_BUILD_ID__}`
  return { window, localStorage, storageKey }
}

async function readJson(response) {
  return JSON.parse(await response.text())
}

describe('buildStandaloneIndex', () => {
  test('inlines Vite assets into a single directly-openable index', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-'))
    try {
      const distDir = path.join(root, 'dist')
      const assetsDir = path.join(distDir, 'assets')
      await mkdir(assetsDir, { recursive: true })
      await writeFile(
        path.join(distDir, 'index.html'),
        [
          '<!doctype html>',
          '<html><head>',
          '<link rel="icon" href="/assets/icon.png">',
          '<script type="module" crossorigin src="/assets/app.js"></script>',
          '<link rel="stylesheet" crossorigin href="/assets/app.css">',
          '</head><body><div id="root"></div></body></html>',
        ].join(''),
      )
      await writeFile(path.join(assetsDir, 'app.js'), 'console.log("/assets/icon.png")')
      await writeFile(path.join(assetsDir, 'app.css'), '.logo{background:url("/assets/icon.png")}')
      await writeFile(path.join(assetsDir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({
        distDir,
        outputFile,
        launcherFile,
        mockApiScript: 'window.__mockApiLoaded = true;',
      })

      const html = await readFile(outputFile, 'utf8')
      const launcher = await readFile(launcherFile, 'utf8')
      expect(html).toContain('<style>')
      expect(html).toContain('console.log("data:image/png;base64')
      expect(html).toContain('window.__mockApiLoaded = true;')
      expect(html).toContain('<script type="module">')
      expect(html).toContain('data:image/png;base64')
      expect(html).not.toContain('src="/assets/')
      expect(html).not.toContain('href="/assets/')
      expect(launcher).toContain('set "DOGFIGHT_OUTPUT=%TEMP%\\DogFight-standalone-index.html"')
      expect(launcher).toContain('$idx=$text.LastIndexOf($marker)')
      expect(launcher).toContain('__DOGFIGHT_HTML_PAYLOAD_BELOW__')
      expect(launcher).toContain('window.__mockApiLoaded = true;')
      expect(launcher).not.toContain('src="/assets/')
      expect(launcher).not.toContain('href="/assets/')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('npm build script regenerates the standalone package', async () => {
    const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'))
    expect(packageJson.scripts.build).toContain('vite build')
    expect(packageJson.scripts.build).toContain('tsx scripts/package-click-index.mjs')
  })

  test('default standalone mock uses a build-scoped save key', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-build-'))
    try {
      const distDir = await createMinimalDist(root)

      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      expect(html).toContain('window.__DOGFIGHT_STANDALONE_BUILD_ID__')
      expect(html).toContain("'dogfight:standalone-state:' + buildId")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('default standalone mock includes current class rewards, relics, and offline ghost builder flow', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-current-data-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      expect(html).toContain('shiba-speed-katana')
      expect(html).toContain('midas-left')
      expect(html).toContain('buildOfflineFighter')

      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'a@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const runId = created.run.id
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.round = 2
      state.run.phase = 'MATCH'
      state.run.matchedGhost = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 2, items: [], relics: [] }
      localStorage.setItem(storageKey, JSON.stringify(state))

      const battled = await readJson(await window.fetch(`/api/runs/${runId}/battle/start`, { method: 'POST', body: '{}' }))
      expect(battled.run).toMatchObject({ round: 3, phase: 'CLASS_REWARD' })
      expect(battled.run.classRewardChoices.map((choice) => choice.defId)).toEqual([
        'shiba-speed-katana',
        'shiba-great-katana',
        'shiba-swallow-katana',
      ])

      const classSelected = await readJson(await window.fetch(`/api/runs/${runId}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId: 'shiba-speed-katana' }) }))
      expect(classSelected.run.phase).toBe('CHOICE')
      expect(classSelected.run.items.find((item) => item.defId === 'shiba-speed-katana')).toMatchObject({
        area: 'BAG',
        quality: 'GOLD',
      })

      const relicState = JSON.parse(localStorage.getItem(storageKey))
      relicState.run.round = 4
      relicState.run.phase = 'CHOICE'
      relicState.run.choices = ['RELIC']
      localStorage.setItem(storageKey, JSON.stringify(relicState))
      const relicChoice = await readJson(await window.fetch(`/api/runs/${runId}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType: 'RELIC' }) }))
      expect(relicChoice.run).toMatchObject({ phase: 'RELIC_CHOICE', shopType: 'RELIC' })
      expect(relicChoice.run.relicChoices).toHaveLength(3)

      const firstRelic = relicChoice.run.relicChoices[0].relicId
      const relicSelected = await readJson(await window.fetch(`/api/runs/${runId}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId: firstRelic }) }))
      expect(relicSelected.run.phase).toBe('PREP')
      expect(relicSelected.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: 'SILVER' }))

      const ghostState = JSON.parse(localStorage.getItem(storageKey))
      ghostState.run.round = 6
      ghostState.run.phase = 'MATCH'
      ghostState.run.wins = 5
      ghostState.run.losses = 1
      ghostState.run.matchedGhost = null
      localStorage.setItem(storageKey, JSON.stringify(ghostState))
      const matched = await readJson(await window.fetch(`/api/runs/${runId}/battle/match`, { method: 'POST', body: '{}' }))
      expect(matched.run.matchedGhost.items.some((item) => item.defId.startsWith('mutt-'))).toBe(true)
      expect(matched.run.matchedGhost.relics.length).toBeGreaterThan(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
