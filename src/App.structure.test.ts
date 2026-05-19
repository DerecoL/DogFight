import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('selection screen structure', () => {
  it('keeps dog selection as an eight-slot gallery with a detail panel', () => {
    expect(app).toContain('DOG_SELECTION_SLOT_COUNT = 8')
    expect(app).toContain('dog-card placeholder')
    expect(app).toContain('dog-detail-panel')
    expect(app).toContain('开始一局')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr) 360px')
    expect(css).toContain('grid-template-columns: repeat(4, minmax(140px, 1fr))')
    expect(css).toContain('.dog-detail-art .dog-avatar.large')
    expect(css).toContain('width: 86%')
  })

  it('offers dog emperor with a lucky-number selector and picture avatars', () => {
    expect(app).toContain("type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR'")
    expect(app).toContain("EMPEROR: '狗皇帝'")
    expect(app).toContain("EMPEROR: '/assets/dogs/emperor.png'")
    expect(app).toContain('luckyNumber')
    expect(app).toContain('幸运数字')
    expect(app).toContain("SHIBA: '/assets/dogs/shiba.png'")
    expect(app).toContain("SAMOYED: '/assets/dogs/samoyed.png'")
    expect(app).toContain("MUTT: '/assets/dogs/mutt.png'")
    expect(app).toContain("BULLY: '/assets/dogs/bully.png'")
  })

  it('keeps shop choices in a six-slot board and pads missing choices with blanks', () => {
    expect(app).toContain('SHOP_CHOICE_SLOT_COUNT = 6')
    expect(app).toContain('choice placeholder')
    expect(app).toContain('ShopChoiceSelect')
    expect(app).toContain("进入 {selectedChoice ? shopNames[selectedChoice] : '商店'}")
    expect(css).toContain('grid-template-columns: repeat(3, minmax(240px, 1fr))')
    expect(css).toContain('.choice.placeholder')
  })

  it('does not render the removed chapter progress or page navigator', () => {
    expect(app).not.toContain('<ChapterProgress')
    expect(app).not.toContain('<PageNav')
    expect(app).not.toContain('function ChapterProgress')
    expect(app).not.toContain('function PageNav')
  })

  it('does not render the player account under the top title', () => {
    expect(app).not.toContain('<p>{user}</p>')
    expect(app).not.toContain('function TopBar({ user')
    expect(app).not.toContain('user: string; run?: Run')
  })

  it('uses the same compact top banner on setup and gameplay screens', () => {
    expect(app).toContain('<main className="app-shell">')
    expect(app).not.toContain('entry-shell')
    expect(app).not.toContain('const shellClass')
    expect(css).not.toContain('.entry-shell')
    expect(css).toContain('height: 58px')
    expect(css).toContain('margin: 12px auto 0')
    expect(css).toContain('align-content: start')
    expect(css).toContain('grid-template-rows: auto auto')
    expect(css).toContain('align-self: start')
    expect(css).toContain('justify-items: center')
    expect(css).toContain('width: 42px')
  })

  it('uses the same compact banner and rectangular action rhythm on gameplay screens', () => {
    expect(app).toContain('<main className="app-shell">')
    expect(app).not.toContain('entry-shell')
    expect(app).toContain('window.scrollTo(0, 0)')
    expect(app).toContain('run?.phase')
    expect(app.indexOf('className="battle-continue-row"')).toBeGreaterThan(-1)
    expect(app.indexOf('className="battle-continue-row"')).toBeLessThan(app.indexOf('<CollapsedBattleLog'))
    expect(css).toContain('height: 58px')
    expect(css).toContain('min-height: 150px')
    expect(css).toContain('width: min(184px, 100%)')
    expect(css).toContain('justify-self: center')
    expect(css).toContain('.battle-continue-row')
  })

  it('shows item effects directly on equipment cards', () => {
    expect(app).toContain('className="item-effect"')
    expect(app).toContain('effectText(item.def, normalizeQuality(item.quality))')
    expect(css).toContain('.item-effect')
  })

  it('anchors dog card tags at the bottom for a consistent gallery rhythm', () => {
    expect(css).toContain('.dog-card .tag-row')
    expect(css).toContain('margin-top: auto')
    expect(css).toContain('align-self: end')
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr) auto')
  })

  it('uses stable rows on shop choice cards to avoid similar floating content', () => {
    expect(css).toContain('grid-template-rows: auto auto minmax(0, 1fr)')
    expect(css).toContain('.choice > span:last-of-type')
    expect(css).toContain('align-self: stretch')
  })

  it('gates newly registered players behind nickname setup', () => {
    expect(app).toContain('needsNickname')
    expect(app).toContain('NicknameSetup')
    expect(app).toContain('/profile/nickname')
  })

  it('wires default-on background music through the logged-in shell', () => {
    expect(app).toContain("backgroundMusicSrc = '/assets/audio/the-final-inventory.mp3'")
    expect(app).toContain("musicPreferenceKey = 'dogfight:background-music'")
    expect(app).toContain("localStorage.getItem(musicPreferenceKey) !== 'off'")
    expect(app).toContain('document.addEventListener(\'visibilitychange\', syncPageAudioFocus)')
    expect(app).toContain("window.addEventListener('focus', syncPageAudioFocus)")
    expect(app).toContain("window.addEventListener('blur', syncPageAudioFocus)")
    expect(app).toContain('const appHasAudioFocus = !document.hidden && document.hasFocus()')
    expect(app).toContain('if (!user || !appHasAudioFocus)')
    expect(app).toContain("window.localStorage.setItem(musicPreferenceKey, nextEnabled ? 'on' : 'off')")
    expect(app).toContain('audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true))')
    expect(app).toContain('musicEnabled={musicEnabled}')
    expect(app).toContain('onToggleMusic={toggleMusic}')
    expect(app).toContain('function TopBar({ run, musicEnabled, musicBlocked, onToggleMusic, onLogout }')
    expect(app).toContain('<Music size={18} />')
    expect(app).toContain('<VolumeX size={18} />')
    expect(css).toContain('.topbar-actions')
  })
})
