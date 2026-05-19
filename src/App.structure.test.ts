import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('selection screen structure', () => {
  it('renders a mode lobby and opens the peak arena screen from the peak card', () => {
    expect(app).toContain("type GameMode = 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK'")
    expect(app).toContain("type AppScreen = 'LOBBY' | 'CASUAL' | 'PEAK'")
    expect(app).toContain("const [appScreen, setAppScreen] = useState<AppScreen>('LOBBY')")
    expect(app).toContain('function ModeLobby')
    expect(app).toContain('休闲模式')
    expect(app).toContain('天梯模式')
    expect(app).toContain('斗狗模式')
    expect(app).toContain('巅峰模式')
    expect(app).toContain('onEnterPeak={() => setAppScreen(\'PEAK\')}')
    expect(app).toContain('进入巅峰模式')
  })

  it('wires peak arena to apex APIs and keeps the lobby button in the top banner', () => {
    expect(app).toContain('function ApexArena')
    expect(app).toContain("api<ApexOverview>('/apex')")
    expect(app).toContain("api<ApexSubmitResponse>('/apex/submit'")
    expect(app).toContain('leaderboard: result.leaderboard')
    expect(app).toContain('candidates: current?.candidates.filter((run) => run.id !== runId) ?? []')
    expect(app).toContain('title="模式大厅"')
    expect(app).toContain('aria-label="模式大厅"')
    expect(app).toContain('setAppScreen(\'LOBBY\')')
    expect(css).toContain('.apex-screen')
    expect(css).toContain('.apex-layout')
    expect(css).toContain('.apex-rank-row.player-entry')
  })

  it('adds responsive mode lobby styling hooks', () => {
    expect(css).toContain('.mode-lobby-screen')
    expect(css).toContain('.mode-grid')
    expect(css).toContain('.mode-card.locked')
    expect(css).toContain('.lock-chain')
    expect(css).toContain('grid-template-columns: repeat(2, minmax(260px, 1fr))')
    expect(css).toContain('grid-template-columns: 1fr')
  })

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
    expect(app).toContain("EMPEROR: '/assets/dogs/emperor.webp'")
    expect(app).toContain('luckyNumber')
    expect(app).toContain('幸运数字')
    expect(app).toContain("SHIBA: '/assets/dogs/shiba.webp'")
    expect(app).toContain("SAMOYED: '/assets/dogs/samoyed.webp'")
    expect(app).toContain("MUTT: '/assets/dogs/mutt.webp'")
    expect(app).toContain("BULLY: '/assets/dogs/bully.webp'")
  })

  it('keeps shop choices in a seven-slot board and pads missing choices with blanks', () => {
    expect(app).toContain('SHOP_CHOICE_SLOT_COUNT = 7')
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

  it('defers battle result data updates until playback is continued', () => {
    expect(app).toContain("run.phase === 'BATTLE'")
    expect(app).toContain('/battle/finish')
    expect(app).toContain("run.phase === 'BATTLE' && isFinished")
  })

  it('renders battle health bars as a percentage of max health', () => {
    expect(app).toContain('playerMaxHp')
    expect(app).toContain('opponentMaxHp')
    expect(app).toContain('const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0')
  })

  it('shows item effects directly on equipment cards', () => {
    expect(app).toContain('className="item-effect"')
    expect(app).toContain('effectText(item.def, normalizeQuality(item.quality))')
    expect(css).toContain('.item-effect')
  })

  it('renders class reward, relic slots, and rule term tooltip surfaces', () => {
    expect(app).toContain('ClassRewardCeremony')
    expect(app).toContain('ClassRewardSelect')
    expect(app).toContain('RelicChoiceSelect')
    expect(app).toContain('RelicRail')
    expect(app).toContain('RuleText')
    expect(app).toContain('rule-term')
    expect(app).toContain('rule-tip')
  })

  it('places the relic rail to the left of the bag grid', () => {
    const rowStart = app.indexOf('className="bag-relic-row"')
    const rowEnd = app.indexOf('</div>', rowStart)
    const rowMarkup = app.slice(rowStart, rowEnd)

    expect(rowMarkup.indexOf('<RelicRail')).toBeGreaterThan(-1)
    expect(rowMarkup.indexOf('area="BAG"')).toBeGreaterThan(-1)
    expect(rowMarkup.indexOf('<RelicRail')).toBeLessThan(rowMarkup.indexOf('area="BAG"'))
  })

  it('keeps relic rail slots icon-only and moves details into a click tip', () => {
    expect(app).toContain('const [selectedRelicId, setSelectedRelicId] = useState<string | null>(null)')
    expect(app).toContain('className="relic-icon-button"')
    expect(app).toContain('function RelicGlyph')
    expect(app).toContain('<RelicGlyph relic={relic} size={30} />')
    expect(app).toContain('<RelicGlyph relic={relic} size={44} />')
    expect(app).toContain('<RelicFloatingTip')
    expect(app).toContain('className="relic-floating-tip floating-tip"')
    expect(app).toContain('setSelectedRelicId(selectedRelicId === relic.id ? null : relic.id)')

    const relicRailStart = app.indexOf('function RelicRail')
    const relicRailEnd = app.indexOf('function GridPanel', relicRailStart)
    const relicRailMarkup = app.slice(relicRailStart, relicRailEnd)

    expect(relicRailMarkup).not.toContain('<strong>{relic.def.name}</strong>')
    expect(relicRailMarkup).not.toContain('<small><RuleText text={relic.def.description} /></small>')
  })

  it('gates class reward selection behind a dismissible awakening ceremony', () => {
    expect(app).toContain('classRewardCeremonyKey')
    expect(app).toContain('ceremonyDismissedRounds')
    expect(app).toContain('!ceremonyDismissedRounds.has(classRewardCeremonyKey)')
    expect(app).toContain('onDismiss={() => dismissClassRewardCeremony(classRewardCeremonyKey)}')
    expect(app).toContain('run.phase === \'CLASS_REWARD\' && showClassRewardCeremony')
    expect(app).toContain('run.phase === \'CLASS_REWARD\' && !showClassRewardCeremony')
  })

  it('lets players skip the class reward ceremony with click, Enter, or Space', () => {
    expect(app).toContain('function handleCeremonyKeyDown')
    expect(app).toContain("event.key === 'Enter' || event.key === ' '")
    expect(app).toContain('onClick={onDismiss}')
    expect(app).toContain('onKeyDown={handleCeremonyKeyDown}')
    expect(app).toContain('role="button"')
    expect(app).toContain('tabIndex={0}')
  })

  it('keeps rule tooltip buttons out of nested choice buttons', () => {
    expect(app).toContain('function handleChoiceCardKeyDown')
    expect(app).toContain('<div key={choice.defId} role="button"')
    expect(app).toContain('<div key={choice.relicId} role="button"')
    expect(app).not.toContain('<button key={choice.defId} className={`choice reward-choice')
    expect(app).not.toContain('<button key={choice.relicId} className={`choice relic-choice')
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
    expect(app).toContain('function TopBar({ run, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }')
    expect(app).toContain('<Music size={18} />')
    expect(app).toContain('<VolumeX size={18} />')
    expect(css).toContain('.topbar-actions')
  })
})
