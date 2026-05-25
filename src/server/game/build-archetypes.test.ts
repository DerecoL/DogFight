import { describe, expect, it } from 'vitest'
import {
  BUILD_ARCHETYPES,
  BUILD_ARCHETYPE_IDS,
  BUILD_COMPONENT_ROLES,
  BUILD_COMPONENTS,
  BUILD_COUNTER_RELATIONS,
  BUILD_DOG_MAPPINGS,
  BUILD_GAP_TYPES,
  BUILD_STATUSES,
  BUILD_TAG_MAPPINGS,
  archetypesForItemDef,
  componentsForArchetype,
  countersForArchetype,
  getBuildArchetype,
  rolesForComponent,
} from './build-archetypes'
import { ALL_ITEM_DEFS, DOGS, RELIC_DEFS, itemDef } from './data'
import type { DogType } from './types'

const DOG_TYPES: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG']
const itemIds = new Set(ALL_ITEM_DEFS.map((def) => def.id))
const relicIds = new Set(RELIC_DEFS.map((def) => def.id))
const dogIds = new Set(Object.keys(DOGS))

describe('BD core archetype metadata', () => {
  it('defines the exact first-stage BD route set', () => {
    expect(BUILD_ARCHETYPE_IDS).toEqual([
      'SMALL_DICE',
      'BIG_DICE',
      'MULTI',
      'RESERVOIR',
      'POISON',
      'SHIELD_THORNS',
      'LIFESTEAL_GROWTH',
      'BOOM_FREQUENCY',
      'LUCKY',
      'LARGE_ITEM',
      'ECONOMY',
    ])
    expect(BUILD_ARCHETYPES).toHaveLength(11)
  })

  it('keeps every BD route reviewable and actionable', () => {
    for (const archetype of BUILD_ARCHETYPES) {
      expect(BUILD_STATUSES).toContain(archetype.status)
      expect(archetype.name).toBeTruthy()
      expect(archetype.goal).toBeTruthy()
      expect(archetype.primaryDogs.length + archetype.secondaryDogs.length).toBeGreaterThan(0)
      expect(archetype.gaps.length).toBeGreaterThan(0)
      expect(archetype.gaps.every((gap) => BUILD_GAP_TYPES.includes(gap))).toBe(true)
      expect(archetype.recommendation).toBeTruthy()
    }
  })

  it('maps every dog to one primary BD and at least one secondary BD', () => {
    expect(Object.keys(BUILD_DOG_MAPPINGS).sort()).toEqual([...DOG_TYPES].sort())
    for (const dogType of DOG_TYPES) {
      const mapping = BUILD_DOG_MAPPINGS[dogType]
      expect(getBuildArchetype(mapping.primary).id).toBe(mapping.primary)
      expect(mapping.secondary.length).toBeGreaterThan(0)
      for (const archetypeId of mapping.secondary) {
        expect(getBuildArchetype(archetypeId).id).toBe(archetypeId)
      }
    }
  })
})

describe('BD component catalog', () => {
  it('uses the exact first-stage component role set', () => {
    expect(BUILD_COMPONENT_ROLES).toEqual(['CORE', 'ENGINE', 'PAYOFF', 'DEFENSE', 'COUNTER', 'BRIDGE'])
  })

  it('gives every BD route all six component roles', () => {
    for (const archetypeId of BUILD_ARCHETYPE_IDS) {
      const roles = new Set(componentsForArchetype(archetypeId).map((component) => component.role))
      expect([...roles].sort()).toEqual([...BUILD_COMPONENT_ROLES].sort())
    }
  })

  it('references only existing dog, item, relic, or system component ids', () => {
    for (const component of BUILD_COMPONENTS) {
      if (component.source === 'DOG') expect(dogIds.has(component.sourceId)).toBe(true)
      if (component.source === 'ITEM') expect(itemIds.has(component.sourceId)).toBe(true)
      if (component.source === 'RELIC') expect(relicIds.has(component.sourceId)).toBe(true)
      if (component.source === 'SYSTEM') expect(component.sourceId).toMatch(/^system:/)
    }
  })
})

describe('BD tag and counter helpers', () => {
  it('maps existing tags to expected BD routes', () => {
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'small')?.archetypes).toContain('SMALL_DICE')
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'multi')?.archetypes).toEqual(
      expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']),
    )
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'reservoir')?.archetypes).toContain('RESERVOIR')
    expect(BUILD_TAG_MAPPINGS.find((mapping) => mapping.tag === 'economy')?.archetypes).toContain('ECONOMY')
  })

  it('infers BD routes from current item definitions without changing item data', () => {
    expect(archetypesForItemDef(itemDef('training-disc'))).toEqual(
      expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']),
    )
    expect(archetypesForItemDef(itemDef('v4-blood-contract-fang'))).toContain('LIFESTEAL_GROWTH')
    expect(archetypesForItemDef(itemDef('v4-boom-counter'))).toContain('BOOM_FREQUENCY')
    expect(archetypesForItemDef(itemDef('dog-gold-ingot'))).toContain('ECONOMY')
  })

  it('returns roles for known component ids', () => {
    expect(rolesForComponent('ITEM', 'v4-boom-counter')).toEqual(
      expect.arrayContaining([
        { archetype: 'BOOM_FREQUENCY', role: 'CORE' },
        { archetype: 'BOOM_FREQUENCY', role: 'PAYOFF' },
      ]),
    )
    expect(rolesForComponent('DOG', 'FROG')).toEqual([{ archetype: 'RESERVOIR', role: 'CORE' }])
  })

  it('describes first-stage counter directions', () => {
    expect(BUILD_COUNTER_RELATIONS.length).toBeGreaterThanOrEqual(7)
    expect(countersForArchetype('BOOM_FREQUENCY').map((relation) => relation.method).join(' ')).toContain('反高频')
    expect(countersForArchetype('LIFESTEAL_GROWTH').map((relation) => relation.method).join(' ')).toContain('反治疗')
  })
})

describe('BD tags stay non-restrictive', () => {
  it('allows one item to map to multiple BD routes', () => {
    expect(archetypesForItemDef(itemDef('training-disc'))).toEqual(
      expect.arrayContaining(['MULTI', 'BOOM_FREQUENCY']),
    )
    expect(archetypesForItemDef(itemDef('training-disc')).length).toBeGreaterThan(1)
  })

  it('treats dog primary and secondary BD routes as descriptive metadata', () => {
    for (const dogType of DOG_TYPES) {
      const mapping = BUILD_DOG_MAPPINGS[dogType] as Record<string, unknown>
      expect(mapping.locked).toBeUndefined()
      expect(mapping.allowedOnly).toBeUndefined()
      expect((mapping.secondary as unknown[]).length).toBeGreaterThan(0)
    }
  })

  it('does not export helpers that validate or reject a player build', async () => {
    const module = await import('./build-archetypes')
    expect('validateBuildArchetype' in module).toBe(false)
    expect('isBuildAllowed' in module).toBe(false)
    expect('filterItemsForBuild' in module).toBe(false)
  })
})
