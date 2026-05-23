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

  test('standalone mock buys a matching shop item as an immediate upgrade when the bag is full', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-buy-upgrade-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'a@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const offer = { offerId: 'upgrade-small-bite', defId: 'small-bite', price: 3, discount: 1, quality: 'BRONZE' }
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.gold = 10
      state.run.shopItems = [offer]
      state.run.items = [
        ...state.run.items,
        { id: 'owned-small-bite', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
        ...Array.from({ length: 12 }, (_, x) => ({ id: `bag-${x}`, defId: 'starter-1', quality: 'BRONZE', area: 'BAG', x, y: 0 })),
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const boughtResponse = await window.fetch(`/api/runs/${created.run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: offer.offerId, area: 'BAG' }) })
      const bought = await readJson(boughtResponse)

      expect(boughtResponse.status).toBe(200)
      expect(bought.run.gold).toBe(7)
      expect(bought.run.shopItems).toEqual([])
      expect(bought.run.items.find((item) => item.id === 'owned-small-bite')).toMatchObject({ quality: 'SILVER' })
      expect(bought.run.items.filter((item) => item.defId === 'small-bite')).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock buys a matching shop item into the bag when the bag has room', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-buy-copy-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'copy@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const offer = { offerId: 'buy-small-bite-copy', defId: 'small-bite', price: 3, discount: 1, quality: 'BRONZE' }
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.gold = 10
      state.run.shopItems = [offer]
      state.run.items = [
        ...state.run.items,
        { id: 'owned-small-bite', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const boughtResponse = await window.fetch(`/api/runs/${created.run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: offer.offerId, area: 'BAG' }) })
      const bought = await readJson(boughtResponse)

      expect(boughtResponse.status).toBe(200)
      expect(bought.run.gold).toBe(7)
      expect(bought.run.shopItems).toEqual([])
      expect(bought.run.items.find((item) => item.id === 'owned-small-bite')).toMatchObject({ quality: 'BRONZE' })
      expect(bought.run.items).toContainEqual(expect.objectContaining({ defId: 'small-bite', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 }))
      expect(bought.run.items.filter((item) => item.defId === 'small-bite')).toHaveLength(2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock lets fourth-dimensional kennel place an item in the thirteenth equipment slot', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-space-relic-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'space@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.items = [
        ...Array.from({ length: 12 }, (_, x) => ({ id: `equip-${x}`, defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x, y: 0 })),
        { id: 'extra', defId: 'starter-1', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const blocked = await window.fetch(`/api/runs/${created.run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId: 'extra', area: 'EQUIPMENT', x: 12, y: 0 }) })
      expect(blocked.status).toBe(400)

      const relicState = JSON.parse(localStorage.getItem(storageKey))
      relicState.run.relics = [{ id: 'space-relic', relicId: 'v3-fourth-dimensional-kennel', quality: 'DIAMOND', slot: 0 }]
      localStorage.setItem(storageKey, JSON.stringify(relicState))

      const me = await readJson(await window.fetch('/api/me'))
      const kennelDescription = me.activeRun.relics.find((relic) => relic.relicId === 'v3-fourth-dimensional-kennel')?.def.description
      expect(kennelDescription).not.toContain('降低')
      expect(kennelDescription).not.toContain('15%')

      const movedResponse = await window.fetch(`/api/runs/${created.run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId: 'extra', area: 'EQUIPMENT', x: 12, y: 0 }) })
      const moved = await readJson(movedResponse)

      expect(movedResponse.status).toBe(200)
      expect(moved.run.items.find((item) => item.id === 'extra')).toMatchObject({ area: 'EQUIPMENT', x: 12, y: 0 })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock replaces covered equipment into the bag', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-replace-equipment-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'replace@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.items = [
        { id: 'left', defId: 'starter-1', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
        { id: 'right', defId: 'starter-2', quality: 'BRONZE', area: 'EQUIPMENT', x: 1, y: 0 },
        { id: 'wide', defId: 'spiked-collar', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const movedResponse = await window.fetch(`/api/runs/${created.run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId: 'wide', area: 'EQUIPMENT', x: 0, y: 0 }) })
      const moved = await readJson(movedResponse)

      expect(movedResponse.status).toBe(200)
      expect(moved.run.items.find((item) => item.id === 'wide')).toMatchObject({ area: 'EQUIPMENT', x: 0, y: 0 })
      expect(moved.run.items.find((item) => item.id === 'left')).toMatchObject({ area: 'BAG', x: 0, y: 0 })
      expect(moved.run.items.find((item) => item.id === 'right')).toMatchObject({ area: 'BAG', x: 1, y: 0 })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock upgrades matching items when a move lands on an identical item', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-move-upgrade-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'move-upgrade@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.items = [
        ...state.run.items,
        { id: 'target-small-bite', defId: 'small-bite', quality: 'BRONZE', area: 'EQUIPMENT', x: 6, y: 0 },
        { id: 'moving-small-bite', defId: 'small-bite', quality: 'BRONZE', area: 'BAG', x: 0, y: 0 },
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const movedResponse = await window.fetch(`/api/runs/${created.run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId: 'moving-small-bite', area: 'EQUIPMENT', x: 6, y: 0 }) })
      const moved = await readJson(movedResponse)

      expect(movedResponse.status).toBe(200)
      expect(moved.run.items.find((item) => item.id === 'target-small-bite')).toMatchObject({ quality: 'SILVER', area: 'EQUIPMENT', x: 6, y: 0 })
      expect(moved.run.items.some((item) => item.id === 'moving-small-bite')).toBe(false)
      expect(moved.run.items.filter((item) => item.defId === 'small-bite')).toHaveLength(1)
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
      expect(html).toContain('v4-blood-contract-fang')
      expect(html).toContain('v4-boom-counter')
      expect(html).toContain('v4-growing-chew-sword')
      expect(html).toContain('v4-reverse-fur-comb')
      expect(html).toContain('GRANT_LIFESTEAL_ADJACENT')
      expect(html).toContain('BOOM_COUNTER')
      expect(html).toContain('GROWTH_DAMAGE')
      expect(html).toContain('PURGE_ENEMY_BUFFS')

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
      expect(battled.run).toMatchObject({ round: 2, phase: 'BATTLE', wins: 0, losses: 0 })

      const finished = await readJson(await window.fetch(`/api/runs/${runId}/battle/finish`, { method: 'POST', body: '{}' }))
      expect(finished.run).toMatchObject({ round: 3, phase: 'CLASS_REWARD' })
      expect(finished.run.classRewardChoices.map((choice) => choice.defId)).toEqual([
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

      const firstRelicChoice = relicChoice.run.relicChoices[0]
      const firstRelic = firstRelicChoice.relicId
      const relicSelected = await readJson(await window.fetch(`/api/runs/${runId}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId: firstRelic }) }))
      expect(relicSelected.run.phase).toBe('PREP')
      expect(relicSelected.run.relics).toContainEqual(expect.objectContaining({ relicId: firstRelic, quality: firstRelicChoice.quality }))

      const ghostState = JSON.parse(localStorage.getItem(storageKey))
      ghostState.run.round = 6
      ghostState.run.phase = 'MATCH'
      ghostState.run.wins = 5
      ghostState.run.losses = 1
      ghostState.run.matchedGhost = null
      localStorage.setItem(storageKey, JSON.stringify(ghostState))
      const matched = await readJson(await window.fetch(`/api/runs/${runId}/battle/match`, { method: 'POST', body: '{}' }))
      expect(matched.run.matchedGhost.wins).toBe(4)
      expect(matched.run.matchedGhost.items.some((item) =>
        ['shiba-', 'samoyed-', 'mutt-', 'bully-', 'emperor-'].some((prefix) => item.defId.startsWith(prefix)),
      )).toBe(true)
      expect(matched.run.matchedGhost.relics.length).toBeGreaterThan(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock returns quality-adjusted item descriptions for every public item surface', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-item-descriptions-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'descriptions@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.items = [
        { id: 'sword', defId: 'v3-large-bone-sword', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ]
      state.run.shopItems = [
        { offerId: 'sword-offer', defId: 'v3-large-bone-sword', price: 6, discount: 1, quality: 'DIAMOND' },
      ]
      localStorage.setItem(storageKey, JSON.stringify(state))

      const me = await readJson(await window.fetch('/api/me'))
      const item = me.activeRun.items.find((entry) => entry.id === 'sword')
      const offer = me.activeRun.shopItems.find((entry) => entry.offerId === 'sword-offer')

      expect(item.def.description).toContain('27')
      expect(item.def.description).not.toContain('8')
      expect(offer.def.description).toContain('27')
      expect(offer.def.description).not.toContain('8')
      expect(created.run.items[0].def.description).toContain('5')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock prices direct diamond shop offers at exact quality value without purchase markup', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-diamond-price-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'diamond-price@dog.test', password: 'dogdice' }) })
      await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      let goldenKennelOffer = null

      for (let index = 0; index < 80 && !goldenKennelOffer; index += 1) {
        const state = JSON.parse(localStorage.getItem(storageKey))
        state.run.id = `diamond-price-seed-${index}`
        state.run.round = 6
        state.run.phase = 'CHOICE'
        state.run.choices = ['LARGE']
        localStorage.setItem(storageKey, JSON.stringify(state))

        const selected = await readJson(await window.fetch(`/api/runs/${state.run.id}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType: 'LARGE' }) }))
        goldenKennelOffer = selected.run.shopItems.find((offer) => offer.defId === 'v3-golden-kennel') ?? null
      }

      expect(goldenKennelOffer).toMatchObject({ quality: 'DIAMOND' })
      expect(goldenKennelOffer.price).toBe(Math.max(1, Math.floor(144 * goldenKennelOffer.discount)))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock applies shiba poison class reward during battle', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-poison-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'poison@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const runId = created.run.id
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.round = 6
      state.run.phase = 'MATCH'
      state.run.items = [
        { id: 'poison-class-reward', defId: 'shiba-poison', quality: 'DIAMOND', area: 'EQUIPMENT', x: 0, y: 0 },
      ]
      state.run.matchedGhost = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 6, items: [], relics: [] }
      localStorage.setItem(storageKey, JSON.stringify(state))

      const battled = await readJson(await window.fetch(`/api/runs/${runId}/battle/start`, { method: 'POST', body: '{}' }))
      const poisonApply = battled.battle.events.find((event) => event.kind === 'ITEM' && event.defId === 'shiba-poison' && event.effectType === 'POISON')
      const poisonTick = battled.battle.events.find((event) => event.kind === 'POISON' && event.target === 'opponent')

      expect(poisonApply).toMatchObject({ amount: 6, target: 'opponent' })
      expect(poisonApply.opponentStatuses.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 6, tickDamage: 6 }))
      expect(poisonTick).toMatchObject({ amount: 6, target: 'opponent' })
      expect(poisonTick.opponentStatuses.negative).toContainEqual(expect.objectContaining({ type: 'poison', stacks: 6, tickDamage: 6 }))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock reflects two damage per thorn stack during battle', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-thorns-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'thorns@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'MUTT' }) }))
      const runId = created.run.id
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.round = 3
      state.run.phase = 'MATCH'
      state.run.items = [
        { id: 'hit', defId: 'starter-6', quality: 'BRONZE', area: 'EQUIPMENT', x: 0, y: 0 },
      ]
      state.run.matchedGhost = {
        name: 'O',
        dogType: 'MUTT',
        wins: 0,
        losses: 0,
        round: 3,
        items: [],
        relics: [{ id: 'opening-thorns', relicId: 'v3-fluffed-spike-collar', quality: 'GOLD', slot: 0 }],
      }
      localStorage.setItem(storageKey, JSON.stringify(state))

      const battled = await readJson(await window.fetch(`/api/runs/${runId}/battle/start`, { method: 'POST', body: '{}' }))
      const thorn = battled.battle.events.find((event) => event.text.includes('【荆棘】反弹'))

      expect(thorn).toMatchObject({ effectType: 'DAMAGE', amount: 10, target: 'player' })
      expect(thorn.text).toContain('反弹 10 点伤害')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('standalone mock applies new common archetype growth damage during battle', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-growth-damage-'))
    try {
      const distDir = await createMinimalDist(root)
      const outputFile = path.join(root, 'click-index.html')
      const launcherFile = path.join(root, 'DogFight-standalone.cmd')
      await buildStandaloneIndex({ distDir, outputFile, launcherFile })

      const html = await readFile(outputFile, 'utf8')
      const { window, localStorage, storageKey } = evaluateMockScript(extractMockScript(html))
      await window.fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'growth@dog.test', password: 'dogdice' }) })
      const created = await readJson(await window.fetch('/api/runs', { method: 'POST', body: JSON.stringify({ dogType: 'SHIBA' }) }))
      const runId = created.run.id
      const state = JSON.parse(localStorage.getItem(storageKey))
      state.run.round = 6
      state.run.phase = 'MATCH'
      state.run.items = [
        { id: 'growth-sword', defId: 'v4-growing-chew-sword', quality: 'SILVER', area: 'EQUIPMENT', x: 0, y: 0 },
      ]
      state.run.matchedGhost = { name: 'O', dogType: 'MUTT', wins: 0, losses: 0, round: 6, items: [], relics: [] }
      localStorage.setItem(storageKey, JSON.stringify(state))

      const battled = await readJson(await window.fetch(`/api/runs/${runId}/battle/start`, { method: 'POST', body: '{}' }))
      const growthEvents = battled.battle.events.filter((event) =>
        event.kind === 'ITEM' && event.defId === 'v4-growing-chew-sword' && event.effectType === 'DAMAGE'
      )

      expect(growthEvents.map((event) => event.amount).slice(0, 3)).toEqual([1, 4, 7])
      expect(growthEvents[0].text).toContain('后续伤害')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
