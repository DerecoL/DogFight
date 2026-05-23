import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('casual tutorial guide', () => {
  it('defines the casual tutorial state model and local storage key', () => {
    expect(app).toContain("type CasualTutorialStepId = 'LOBBY' | 'DOG_SELECT' | 'SHOP_INSPECT' | 'SHOP_BUY' | 'PLACE_ITEM' | 'MATCH' | 'BATTLE_WATCH' | 'CONTINUE'")
    expect(app).toContain("type CasualTutorialStatus = 'idle' | 'active' | 'completed' | 'skipped' | 'replaying'")
    expect(app).toContain('type CasualTutorialState = { status: CasualTutorialStatus; stepId: CasualTutorialStepId }')
    expect(app).toContain("const casualTutorialStoragePrefix = 'dogfight:tutorial:casual-core:'")
    expect(app).toContain('casualTutorialStorageKey(user.id)')
    expect(app).toContain('saveCasualTutorialState(user.id, nextState)')
  })

  it('wires first-run launch, skip, completion, and replay entry points', () => {
    expect(app).toContain('function startCasualTutorial')
    expect(app).toContain('function skipCasualTutorial')
    expect(app).toContain('function completeCasualTutorial')
    expect(app).toContain('function handleEnterCasual')
    expect(app).toContain('shouldAutoStartCasualTutorial(user.id)')
    expect(app).toContain('<ModeLobby')
    expect(app).toContain('onReplayTutorial={startCasualTutorial}')
    expect(app).toContain('新手引导')
    expect(app).toContain('<CasualTutorialGuide')
    expect(app).toContain('onSkip={skipCasualTutorial}')
  })

  it('exposes stable tutorial anchors on the real casual flow surfaces', () => {
    for (const anchor of [
      'mode-casual',
      'dog-select',
      'shop-offers',
      'shop-buy',
      'equipment-board',
      'bag-board',
      'match-button',
      'battle-start',
      'battle-stage',
      'battle-continue',
    ]) {
      expect(app).toContain(`data-tutorial-anchor="${anchor}"`)
    }
  })

  it('advances the tutorial from real gameplay state instead of hard locking controls', () => {
    expect(app).toContain('resolveCasualTutorialStep')
    expect(app).toContain("return 'SHOP_BUY'")
    expect(app).toContain("return 'PLACE_ITEM'")
    expect(app).toContain("return 'BATTLE_WATCH'")
    expect(app).toContain("return 'CONTINUE'")
    expect(app).toContain('markOfferInspectedForTutorial')
    expect(app).toContain('markBoughtForTutorial')
    expect(app).toContain('markPlacedForTutorial')
    expect(app).toContain('completeCasualTutorial()')
  })

  it('styles the guide as a non-blocking coach overlay with highlighted anchors', () => {
    expect(css).toContain('.casual-tutorial-guide')
    expect(css).toContain('.tutorial-coach-card')
    expect(css).toContain('.tutorial-highlight')
    expect(css).toContain('[data-tutorial-anchor]')
    expect(css).toContain('pointer-events: none')
    expect(css).toContain('z-index: 30')
  })
})
