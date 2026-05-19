import { DOGS, itemDef } from './data'
import { triggerOrder } from './grid'
import { normalizeQuality, qualityAmount, QUALITY_LABELS } from './quality'
import { createRng } from './rng'
import type {
  BattleEvent,
  BattleFighterSnapshot,
  BattleResult,
  DogType,
  FighterSnapshot,
  ItemDef,
  ItemQuality,
} from './types'

type Side = 'player' | 'opponent'
const BULLY_LARGE_EFFECT_CHANCE = 0.4
const EMPEROR_LUCKY_EFFECT_CHANCE = 0.5

type ItemTrigger = {
  itemId: string
  defId: string
  quality: ItemQuality
  effectType: ItemDef['effect']['type']
  amount: number
  target: Side
  sourceHp: number
  targetHp: number
  sourceHpDelta: number
  targetHpDelta: number
  text: string
}

function rollDog(dogType: DogType, rng: () => number) {
  let roll = Math.floor(rng() * 6) + 1
  if (dogType === 'SHIBA' && rng() < 0.2) roll = Math.floor(rng() * 3) + 1
  if (dogType === 'SAMOYED' && rng() < 0.2) roll = Math.floor(rng() * 3) + 4
  return roll
}

function opponentOf(actor: Side): Side {
  return actor === 'player' ? 'opponent' : 'player'
}

function toBattleSnapshot(fighter: FighterSnapshot): BattleFighterSnapshot {
  return {
    ...fighter,
    items: fighter.items.map((item) => ({ ...item, quality: normalizeQuality(item.quality), def: itemDef(item.defId) })),
  }
}

function applyItems(
  actorSide: Side,
  actor: FighterSnapshot,
  roll: number,
  targetHp: number,
  selfHp: number,
  rng: () => number,
) {
  const triggers: ItemTrigger[] = []
  for (const item of triggerOrder(actor.items)) {
    const def = itemDef(item.defId)
    if (!def.dice.includes(roll)) continue
    const quality = normalizeQuality(item.quality)
    const bullyDoubled = actor.dogType === 'BULLY' && def.size === 4 && rng() < BULLY_LARGE_EFFECT_CHANCE
    const emperorDoubled = actor.dogType === 'EMPEROR'
      && actor.luckyNumber === roll
      && rng() < EMPEROR_LUCKY_EFFECT_CHANCE
    const doubled = bullyDoubled || emperorDoubled
    const amount = qualityAmount(def.effect.amount, quality) * (doubled ? 2 : 1)
    const itemName = quality === 'BRONZE' ? def.name : `${QUALITY_LABELS[quality]}${def.name}`
    const traitText = bullyDoubled ? '（恶霸翻倍）' : emperorDoubled ? '（狗皇帝幸运翻倍）' : ''

    if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') {
      const before = targetHp
      targetHp = Math.max(0, targetHp - amount)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount,
        target: opponentOf(actorSide),
        sourceHp: selfHp,
        targetHp,
        sourceHpDelta: 0,
        targetHpDelta: targetHp - before,
        text: `${itemName}${traitText} 造成 ${amount} 点伤害`,
      })
    }

    if (def.effect.type === 'HEAL') {
      const before = selfHp
      selfHp = Math.min(100, selfHp + amount)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount,
        target: actorSide,
        sourceHp: selfHp,
        targetHp,
        sourceHpDelta: selfHp - before,
        targetHpDelta: 0,
        text: `${itemName}${traitText} 回复 ${amount} 点生命`,
      })
    }
  }
  return { targetHp, selfHp, triggers }
}

export function simulateBattle(player: FighterSnapshot, opponent: FighterSnapshot, seed: string): BattleResult {
  const rng = createRng(seed)
  let playerHp = 100
  let opponentHp = 100
  const events: BattleEvent[] = []
  const playerSnapshot = toBattleSnapshot(player)
  const opponentSnapshot = toBattleSnapshot(opponent)

  const push = (event: Omit<BattleEvent, 'playerHp' | 'opponentHp'>) => {
    events.push({ ...event, playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp) })
  }

  const resolveActor = (time: number, actorSide: Side, extra = false) => {
    const fighter = actorSide === 'player' ? player : opponent
    const roll = rollDog(fighter.dogType, rng)
    push({
      time,
      actor: actorSide,
      kind: 'ROLL',
      roll,
      effectType: 'ROLL',
      target: 'none',
      text: `${fighter.name}${extra ? ' 额外' : ''}掷出 ${roll} 点（${DOGS[fighter.dogType].name}）`,
    })

    const result = actorSide === 'player'
      ? applyItems('player', player, roll, opponentHp, playerHp, rng)
      : applyItems('opponent', opponent, roll, playerHp, opponentHp, rng)

    for (const trigger of result.triggers) {
      if (actorSide === 'player') {
        opponentHp = trigger.targetHp
        playerHp = trigger.sourceHp
      } else {
        playerHp = trigger.targetHp
        opponentHp = trigger.sourceHp
      }

      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        text: trigger.text,
        itemId: trigger.itemId,
        defId: trigger.defId,
        quality: trigger.quality,
        effectType: trigger.effectType,
        amount: trigger.amount,
        target: trigger.target,
        sourceHpDelta: trigger.sourceHpDelta,
        targetHpDelta: trigger.targetHpDelta,
      })
    }

    if (actorSide === 'player') {
      opponentHp = result.targetHp
      playerHp = result.selfHp
    } else {
      playerHp = result.targetHp
      opponentHp = result.selfHp
    }
  }

  const finish = (time: number, text: string): BattleResult => {
    const winner = playerHp <= 0 && opponentHp <= 0
      ? 'draw'
      : playerHp === opponentHp
        ? 'draw'
        : playerHp > opponentHp
          ? 'player'
          : 'opponent'
    push({ time, actor: 'system', kind: 'END', target: 'none', text })
    return {
      winner,
      duration: time,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      events,
      playerSnapshot,
      opponentSnapshot,
    }
  }

  for (let time = 1; time <= 120; time += 1) {
    for (const actor of ['player', 'opponent'] as const) {
      const fighter = actor === 'player' ? player : opponent
      resolveActor(time, actor)
      if (fighter.dogType === 'MUTT' && rng() < 0.2) resolveActor(time, actor, true)

      if (playerHp <= 0 || opponentHp <= 0) {
        const lead = playerHp > opponentHp ? '玩家胜利' : opponentHp > playerHp ? '对手胜利' : '平局'
        return finish(time, `战斗结束：${lead}`)
      }
    }

    if (time > 60) {
      const poison = time - 60
      const playerBefore = playerHp
      const opponentBefore = opponentHp
      playerHp = Math.max(0, playerHp - poison)
      opponentHp = Math.max(0, opponentHp - poison)
      push({
        time,
        actor: 'system',
        kind: 'POISON',
        effectType: 'POISON',
        amount: poison,
        target: 'both',
        sourceHpDelta: playerHp - playerBefore,
        targetHpDelta: opponentHp - opponentBefore,
        text: `毒伤加深，双方受到 ${poison} 点伤害`,
      })
      if (playerHp <= 0 || opponentHp <= 0) {
        const lead = playerHp > opponentHp ? '玩家胜利' : opponentHp > playerHp ? '对手胜利' : '平局'
        return finish(time, `毒伤结算：${lead}`)
      }
    }
  }

  const lead = playerHp > opponentHp ? '玩家胜利' : opponentHp > playerHp ? '对手胜利' : '平局'
  return finish(120, `120 秒判定：${lead}`)
}
