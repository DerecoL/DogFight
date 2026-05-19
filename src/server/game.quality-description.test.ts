import { describe, expect, it } from 'vitest'
import { itemDefForQuality } from './game/data'

function numbers(defId: string, quality: 'GOLD' | 'DIAMOND') {
  return itemDefForQuality(defId, quality).description?.match(/\d+/g) ?? []
}

describe('quality-adjusted item descriptions', () => {
  it('shows upgraded blood mad fang damage in item details', () => {
    expect(numbers('v3-blood-mad-fang', 'GOLD')).toContain('14')
    expect(numbers('v3-blood-mad-fang', 'DIAMOND')).toContain('20')
  })

  it('shows upgraded shield and poison values for advanced equipment', () => {
    expect(numbers('v3-golden-kennel', 'DIAMOND')).toContain('25')
    expect(numbers('v3-golden-kennel', 'DIAMOND')).not.toContain('84')
    expect(numbers('v3-fermented-trash-bin', 'DIAMOND')).toContain('17')
  })

  it('shows upgraded base effects for described equipment and class rewards', () => {
    expect(numbers('v3-large-bone-sword', 'DIAMOND')).toContain('27')
    expect(numbers('samoyed-soft-fur', 'DIAMOND')).toContain('34')
    expect(numbers('shiba-speed-katana', 'DIAMOND')).toContain('20')
    expect(numbers('shiba-great-katana', 'DIAMOND')).toContain('27')
    expect(numbers('shiba-swallow-katana', 'DIAMOND')).toContain('17')
  })
})
