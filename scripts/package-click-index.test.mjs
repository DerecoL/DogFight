import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { buildStandaloneIndex } from './package-click-index.mjs'

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
    expect(packageJson.scripts.build).toContain('node scripts/package-click-index.mjs')
  })

  test('default standalone mock uses a build-scoped save key', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'dogfight-standalone-build-'))
    try {
      const distDir = path.join(root, 'dist')
      const assetsDir = path.join(distDir, 'assets')
      await mkdir(assetsDir, { recursive: true })
      await writeFile(
        path.join(distDir, 'index.html'),
        '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
      )
      await writeFile(path.join(assetsDir, 'app.js'), 'console.log("app")')

      const outputFile = path.join(root, 'click-index.html')
      await buildStandaloneIndex({ distDir, outputFile })

      const html = await readFile(outputFile, 'utf8')
      expect(html).toContain('window.__DOGFIGHT_STANDALONE_BUILD_ID__')
      expect(html).toContain("'dogfight:standalone-state:' + buildId")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
