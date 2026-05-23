import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TERM_DEFS } from './shared/rule-terms'

const sourceFiles = [
  'src/App.tsx',
  'src/server/game/data.ts',
  'src/server/game/battle.ts',
]

const ruleFacingLinePatterns = [
  /trait:/,
  /description:/,
  /return [`'"]/,
  /text:/,
]

const allowedUnbracketedLines = [
  /term:/,
  /ruleTerms/,
  /statusTipDetails/,
  /label: '/,
  /aria-label/,
  /title=/,
  /function effectText/,
  /function effectToneText/,
  /def\.advancedEffect ===/,
  /def\.tags\.includes/,
  /return '.*'/,
]

function readRepoFile(path: string) {
  return readFileSync(new URL(`./../${path}`, import.meta.url), 'utf8')
}

function termNames() {
  return TERM_DEFS.map((term) => term.term)
}

function bracketedTermsIn(text: string) {
  return [...text.matchAll(/【([^】]+)】/g)]
    .map((match) => match[1])
    .filter((term) => !term.includes('$') && !term.includes('{') && !term.includes('^') && term !== '(.+)')
}

describe('rule term definitions', () => {
  it('keeps every rule term unique and fully described', () => {
    const names = termNames()
    expect(new Set(names).size).toBe(names.length)
    for (const term of TERM_DEFS) {
      expect(term.term.trim()).toBe(term.term)
      expect(term.term.length).toBeGreaterThan(0)
      expect(term.description.trim().length).toBeGreaterThan(0)
      expect(term.note.trim().length).toBeGreaterThan(0)
    }
  })

  it('registers every bracketed rule term used in game text', () => {
    const names = new Set(termNames())
    const unknown = sourceFiles.flatMap((path) =>
      bracketedTermsIn(readRepoFile(path))
        .filter((term) => !names.has(term))
        .map((term) => `${path}: ${term}`),
    )

    expect(unknown).toEqual([])
  })

  it('wraps registered rule terms with brackets in rule-facing text', () => {
    const terms = termNames().sort((left, right) => right.length - left.length)
    const nakedUses: string[] = []

    for (const path of sourceFiles) {
      const lines = readRepoFile(path).split(/\r?\n/)
      lines.forEach((line, index) => {
        if (!ruleFacingLinePatterns.some((pattern) => pattern.test(line))) return
        if (allowedUnbracketedLines.some((pattern) => pattern.test(line))) return
        for (const term of terms) {
          const nakedTerm = new RegExp(`(?<!【)${term}(?!】)`)
          if (nakedTerm.test(line)) nakedUses.push(`${path}:${index + 1}: ${term}`)
        }
      })
    }

    expect(nakedUses).toEqual([])
  })

  it('describes key rule terms according to battle implementation', () => {
    const byName = new Map(TERM_DEFS.map((term) => [term.term, term.description]))
    expect(byName.get('护盾')).toContain('优先吸收')
    expect(byName.get('护盾')).toContain('不会被偷取')
    expect(byName.get('护盾')).toContain('每 8 点折算')
    expect(byName.get('吸血')).toContain('实际造成的生命伤害')
    expect(byName.get('吸血')).toContain('治疗自己')
    expect(byName.get('爆鸣计数')).toContain('30')
    expect(byName.get('爆鸣计数')).toContain('清零')
    expect(byName.get('爆鸣计数')).toContain('直接伤害')
    expect(byName.get('雪崩')).toContain('5 层')
    expect(byName.get('雪崩')).toContain('伤害翻倍')
    expect(byName.get('冻结')).toContain('跳过投掷')
    expect(byName.get('虚弱')).toContain('下次攻击')
    expect(byName.get('中毒')).toContain('每秒')
    expect(byName.get('失效')).toContain('抵消')
  })
})
