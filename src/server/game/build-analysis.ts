import {
  BUILD_ARCHETYPE_IDS,
  BUILD_DOG_MAPPINGS,
  BUILD_TAG_MAPPINGS,
  archetypesForItemDef,
  rolesForComponent,
  type BuildArchetypeId,
  type BuildComponentRole,
  type BuildComponentSource,
} from './build-archetypes'
import type { DogType, ItemDef, RelicDef } from './types'

export type BuildAnalysisEvidence = {
  source: BuildComponentSource
  sourceId: string
  points: number
  role?: BuildComponentRole
  reason: string
}

export type BuildArchetypeScore = {
  archetype: BuildArchetypeId
  score: number
  evidence: BuildAnalysisEvidence[]
}

export type BuildAnalysisInput = {
  dogType?: DogType
  itemDefs?: ItemDef[]
  relicDefs?: RelicDef[]
}

export type BuildAnalysis = {
  scores: BuildArchetypeScore[]
  topArchetypes: BuildArchetypeScore[]
}

function tagArchetypes(tags: string[]) {
  const ids = new Set<BuildArchetypeId>()
  for (const tag of tags) {
    const mapping = BUILD_TAG_MAPPINGS.find((entry) => entry.tag === tag)
    for (const archetype of mapping?.archetypes ?? []) ids.add(archetype)
  }
  return [...ids]
}

function addEvidence(
  byArchetype: Map<BuildArchetypeId, BuildArchetypeScore>,
  archetype: BuildArchetypeId,
  evidence: BuildAnalysisEvidence,
) {
  const entry = byArchetype.get(archetype)
  if (!entry) return
  entry.score += evidence.points
  entry.evidence.push(evidence)
}

export function analyzeBuildArchetypes(input: BuildAnalysisInput): BuildAnalysis {
  const byArchetype = new Map<BuildArchetypeId, BuildArchetypeScore>(
    BUILD_ARCHETYPE_IDS.map((archetype) => [archetype, { archetype, score: 0, evidence: [] }]),
  )

  if (input.dogType) {
    const mapping = BUILD_DOG_MAPPINGS[input.dogType]
    addEvidence(byArchetype, mapping.primary, {
      source: 'DOG',
      sourceId: input.dogType,
      points: 2,
      reason: 'dog-primary',
    })
    for (const archetype of mapping.secondary) {
      addEvidence(byArchetype, archetype, {
        source: 'DOG',
        sourceId: input.dogType,
        points: 1,
        reason: 'dog-secondary',
      })
    }
  }

  for (const def of input.itemDefs ?? []) {
    for (const archetype of archetypesForItemDef(def)) {
      addEvidence(byArchetype, archetype, {
        source: 'ITEM',
        sourceId: def.id,
        points: 1,
        reason: 'item-tag',
      })
    }
    for (const role of rolesForComponent('ITEM', def.id)) {
      addEvidence(byArchetype, role.archetype, {
        source: 'ITEM',
        sourceId: def.id,
        points: 1,
        role: role.role,
        reason: 'item-component',
      })
    }
  }

  for (const def of input.relicDefs ?? []) {
    for (const archetype of tagArchetypes(def.tags)) {
      addEvidence(byArchetype, archetype, {
        source: 'RELIC',
        sourceId: def.id,
        points: 1,
        reason: 'relic-tag',
      })
    }
    for (const role of rolesForComponent('RELIC', def.id)) {
      addEvidence(byArchetype, role.archetype, {
        source: 'RELIC',
        sourceId: def.id,
        points: 1,
        role: role.role,
        reason: 'relic-component',
      })
    }
  }

  const scores = BUILD_ARCHETYPE_IDS.map((archetype) => byArchetype.get(archetype)!)
  const topArchetypes = scores
    .filter((entry) => entry.score > 0)
    .toSorted((left, right) => right.score - left.score)

  return { scores, topArchetypes }
}
