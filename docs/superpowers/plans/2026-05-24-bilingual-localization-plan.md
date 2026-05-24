# Bilingual Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Chinese/English language selection with English coverage for core UI, game data, common battle text, feedback, and server error display.

**Architecture:** Add a small in-repo i18n layer instead of a third-party framework. Keep existing Chinese source data as the canonical data contract, and localize at the display boundary using stable IDs, enum keys, and known-message mappings.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, existing Fastify game data modules.

---

### Task 1: Core i18n Types And Persistence

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/language.ts`
- Create: `src/i18n/language.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { isLanguage, normalizeLanguage, readStoredLanguage, writeStoredLanguage, LANGUAGE_STORAGE_KEY } from './language'

describe('language utilities', () => {
  it('accepts only supported languages', () => {
    expect(isLanguage('zh-CN')).toBe(true)
    expect(isLanguage('en-US')).toBe(true)
    expect(isLanguage('fr-FR')).toBe(false)
  })

  it('falls back to Chinese for invalid values', () => {
    expect(normalizeLanguage('en-US')).toBe('en-US')
    expect(normalizeLanguage('bad-value')).toBe('zh-CN')
    expect(normalizeLanguage(null)).toBe('zh-CN')
  })

  it('reads and writes language selection from localStorage', () => {
    localStorage.clear()
    expect(LANGUAGE_STORAGE_KEY).toBe('dogfight-language')
    expect(readStoredLanguage()).toBe('zh-CN')
    writeStoredLanguage('en-US')
    expect(localStorage.getItem('dogfight-language')).toBe('en-US')
    expect(readStoredLanguage()).toBe('en-US')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/language.test.ts`
Expected: FAIL because `src/i18n/language.ts` does not exist.

- [ ] **Step 3: Implement minimal language utilities**

```ts
export type Language = 'zh-CN' | 'en-US'
export const SUPPORTED_LANGUAGES: Language[] = ['zh-CN', 'en-US']
export const DEFAULT_LANGUAGE: Language = 'zh-CN'
export const LANGUAGE_STORAGE_KEY = 'dogfight-language'

export function isLanguage(value: unknown): value is Language {
  return value === 'zh-CN' || value === 'en-US'
}

export function normalizeLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

export function readStoredLanguage(): Language {
  if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE
  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
}

export function writeStoredLanguage(language: Language) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/i18n/language.test.ts`
Expected: PASS.

### Task 2: Translation Dictionaries And Coverage Tests

**Files:**
- Create: `src/i18n/dictionary.ts`
- Create: `src/i18n/game-text.ts`
- Create: `src/i18n/game-text.test.ts`
- Modify: `src/i18n/language.test.ts`

- [ ] **Step 1: Write failing dictionary coverage tests**

```ts
import { describe, expect, it } from 'vitest'
import { DOGS, ITEM_DEFS, RELIC_DEFS } from '../server/game/data'
import { TERM_DEFS } from '../shared/rule-terms'
import { gameText, localizeDog, localizeItemDef, localizeRelicDef, localizeRuleTerm } from './game-text'

describe('game text localization', () => {
  it('has English text for every item definition', () => {
    for (const def of ITEM_DEFS) {
      const text = localizeItemDef(def, 'en-US')
      expect(text.name, def.id).toBeTruthy()
      expect(text.description, def.id).toBeTruthy()
      expect(text.name).not.toBe(def.name)
    }
  })

  it('has English text for every relic definition', () => {
    for (const def of RELIC_DEFS) {
      const text = localizeRelicDef(def, 'en-US')
      expect(text.name, def.id).toBeTruthy()
      expect(text.description, def.id).toBeTruthy()
      expect(text.name).not.toBe(def.name)
    }
  })

  it('has English text for every dog and rule term', () => {
    for (const dogType of Object.keys(DOGS) as Array<keyof typeof DOGS>) {
      expect(localizeDog(dogType, 'en-US').name).toBeTruthy()
      expect(localizeDog(dogType, 'en-US').trait).toBeTruthy()
    }

    for (const term of TERM_DEFS) {
      expect(localizeRuleTerm(term.term, 'en-US').term).toBeTruthy()
      expect(localizeRuleTerm(term.term, 'en-US').description).toBeTruthy()
    }
  })

  it('keeps Chinese text as the default canonical display', () => {
    const firstItem = ITEM_DEFS[0]
    expect(localizeItemDef(firstItem, 'zh-CN').name).toBe(firstItem.name)
    expect(gameText.quality.en.US).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/game-text.test.ts`
Expected: FAIL because localization files do not exist.

- [ ] **Step 3: Implement dictionaries and localizers**

Implement focused dictionaries:

```ts
export const uiText = {
  appTitle: { 'zh-CN': '狗骰对战', 'en-US': 'Dog Dice Duel' },
  language: { 'zh-CN': '语言', 'en-US': 'Language' },
  chinese: { 'zh-CN': '中文', 'en-US': '中文' },
  english: { 'zh-CN': 'English', 'en-US': 'English' },
}
```

For `game-text.ts`, create `itemTextById`, `relicTextById`, `dogTextByType`, `ruleTermTextByTerm`, quality labels, shop labels, mode labels, server error mapping, feedback mapping, and helper functions:

```ts
export function localizeItemDef(def: ItemDef, language: Language) {
  if (language === 'zh-CN') return { name: def.name, description: def.description ?? '' }
  return itemTextById[def.id] ?? { name: def.name, description: def.description ?? '' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/i18n/game-text.test.ts`
Expected: PASS.

### Task 3: React Language Provider And Selector

**Files:**
- Create: `src/i18n/LanguageProvider.tsx`
- Create: `src/i18n/index.ts`
- Create: `src/i18n/LanguageProvider.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write failing structure tests**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

describe('language provider wiring', () => {
  it('wraps the app in LanguageProvider', () => {
    expect(main).toContain('LanguageProvider')
    expect(main).toContain('<LanguageProvider>')
  })

  it('renders a language selector using the persisted language key', () => {
    expect(app).toContain('LanguageSelector')
    expect(app).toContain('dogfight-language')
    expect(app).toContain('setLanguage')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/LanguageProvider.test.tsx`
Expected: FAIL because provider and selector are not wired.

- [ ] **Step 3: Implement provider and selector**

Add context with `language`, `setLanguage`, `t`, and `text` helpers. Wrap `App` in `main.tsx`. Add `LanguageSelector` near the top app chrome using existing button/control styling, with stable `aria-label`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/i18n/LanguageProvider.test.tsx`
Expected: PASS.

### Task 4: Localize Game Data At Display Boundaries

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.effect-text.test.ts`
- Modify: `src/App.tooltip.test.ts`
- Modify: `src/rule-terms.test.ts`

- [ ] **Step 1: Write failing tests for localized display helpers**

Add tests that confirm source references exist:

```ts
expect(app).toContain('localizeItemDef(')
expect(app).toContain('localizeRelicDef(')
expect(app).toContain('localizeDog(')
expect(app).toContain('localizeRuleTerm(')
expect(app).toContain('localizedEffectText(')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/App.effect-text.test.ts src/App.tooltip.test.ts src/rule-terms.test.ts`
Expected: FAIL on missing localizer calls.

- [ ] **Step 3: Replace direct display text**

Use localizers for:

- item cards
- shop cards
- relic panels
- dog selection cards
- rule term panels
- status tip copy
- quality labels
- shop/mode labels

Keep payloads and IDs unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/App.effect-text.test.ts src/App.tooltip.test.ts src/rule-terms.test.ts`
Expected: PASS.

### Task 5: Localize Feedback, Errors, And Common Battle Text

**Files:**
- Create: `src/i18n/battle-text.ts`
- Create: `src/i18n/battle-text.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/feedback.ts`
- Modify: `src/feedback.test.ts`

- [ ] **Step 1: Write failing text tests**

```ts
import { describe, expect, it } from 'vitest'
import { localizeBattleEventText, localizeFeedbackText, localizeServerError } from './battle-text'

describe('battle and error localization', () => {
  it('localizes known battle event text', () => {
    expect(localizeBattleEventText('毒爪 使敌方最右侧装备【失效】一次', 'en-US')).toContain('rightmost enemy item')
  })

  it('localizes feedback and server errors', () => {
    expect(localizeFeedbackText('战斗开始', 'en-US')).toBe('Battle starts')
    expect(localizeServerError('职业装备不可使用药水', 'en-US')).toBe('Class equipment cannot use potions')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/i18n/battle-text.test.ts`
Expected: FAIL because `battle-text.ts` does not exist.

- [ ] **Step 3: Implement known-message localization**

Implement maps plus a small regex layer for dynamic cases:

```ts
export function localizeBattleEventText(text: string, language: Language) {
  if (language === 'zh-CN') return text
  return knownBattleText[text] ?? translateKnownBattlePattern(text) ?? text
}
```

Call these helpers before showing errors, feedback events, and battle log text in `App.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/i18n/battle-text.test.ts src/feedback.test.ts`
Expected: PASS.

### Task 6: Verification, Build, And Layout Check

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS and package script regenerates `E:\AI-GPT\DogFight\dist-click\DogFight-standalone.cmd`.

- [ ] **Step 3: Run app and inspect English UI**

Run the existing dev or preview server, open the app in the browser, switch to English, and verify:

- language selector is visible
- hero/title/mode buttons change language
- item/relic/dog names show English
- English button text does not overflow obvious containers

- [ ] **Step 4: Final status**

Report tests, build result, standalone path, and Excel non-update reason.
