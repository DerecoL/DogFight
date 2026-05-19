import { DOGS, itemDef, relicDef } from './data'
import { triggerOrder } from './grid'
import { normalizeQuality, qualityAmount, QUALITY_LABELS } from './quality'
import { createRng } from './rng'
import type {
  BattleEvent,
  BattleFighterSnapshot,
  BattleResult,
  DogType,
  FighterSnapshot,
  GameItem,
  ItemDef,
  ItemQuality,
} from './types'

type Side = 'player' | 'opponent'
const BULLY_LARGE_EFFECT_CHANCE = 0.4
const EMPEROR_LUCKY_EFFECT_CHANCE = 0.5
const TRIGGER_QUEUE_CAP = 40
const BASE_MAX_HP = 100
const EARLY_ROUND_HP_GROWTH = 20
const LATE_ROUND_HP_GROWTH = 50
const EARLY_HP_GROWTH_ROUNDS = 6

type HealthForDecision = {
  hp: number
  maxHp: number
}

type ItemTrigger = {
  itemId: string
  defId: string
  quality: ItemQuality
  effectType: ItemDef['effect']['type'] | 'POISON' | 'ROLL'
  amount: number
  target: Side | 'none'
  sourceHp: number
  targetHp: number
  sourceHpDelta: number
  targetHpDelta: number
  text: string
  roll?: number
}

type BattleSideState = {
  shield: number
  thorns: number
  weak: number
  poison: number
  maxHp: number
  rollCount: number
  missedLucky: number
  avalanche: number
  avalancheDamage: number
  freeze: number
  disabledLarge: number
}

function maxHealthForRound(round: number) {
  const completedRounds = Math.max(0, Math.floor(round))
  const earlyRounds = Math.min(completedRounds, EARLY_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function createSideState(maxHp: number): BattleSideState {
  return {
    shield: 0,
    thorns: 0,
    weak: 0,
    poison: 0,
    maxHp,
    rollCount: 0,
    missedLucky: 0,
    avalanche: 0,
    avalancheDamage: 50,
    freeze: 0,
    disabledLarge: 0,
  }
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

export function resolveWinnerByHealthPercent(player: HealthForDecision, opponent: HealthForDecision): Side {
  const playerPercent = player.maxHp > 0 ? player.hp / player.maxHp : 0
  const opponentPercent = opponent.maxHp > 0 ? opponent.hp / opponent.maxHp : 0
  if (playerPercent !== opponentPercent) return playerPercent > opponentPercent ? 'player' : 'opponent'
  if (player.hp !== opponent.hp) return player.hp > opponent.hp ? 'player' : 'opponent'
  return 'player'
}

function relicsOf(fighter: FighterSnapshot) {
  return fighter.relics ?? []
}

function hasRelic(fighter: FighterSnapshot, effect: string) {
  return relicsOf(fighter).some((relic) => relicDef(relic.relicId).effect === effect)
}

function toBattleSnapshot(fighter: FighterSnapshot): BattleFighterSnapshot {
  return {
    ...fighter,
    items: fighter.items.map((item) => ({ ...item, quality: normalizeQuality(item.quality), def: itemDef(item.defId) })),
    relics: relicsOf(fighter).map((relic) => ({ ...relic, quality: normalizeQuality(relic.quality), def: relicDef(relic.relicId) })),
  }
}

function isLarge(def: ItemDef, actor: FighterSnapshot) {
  const sizeThreeIsLarge = triggerOrder(actor.items).some((item) => itemDef(item.defId).advancedEffect === 'SIZE_THREE_IS_LARGE')
  return def.size === 4 || (sizeThreeIsLarge && def.size === 3)
}

function matchingContext(actor: FighterSnapshot, def: ItemDef, roll: number) {
  if (def.dice.includes(roll)) return { matches: true, scale: 1, note: '' }

  if (hasRelic(actor, 'MIRROR_BIG_TO_SMALL') && roll <= 3 && def.dice.includes(roll + 3)) {
    return { matches: true, scale: 0.5, note: '（点金手·左映射）' }
  }
  if (hasRelic(actor, 'MIRROR_SMALL_TO_BIG') && roll >= 4 && def.dice.includes(roll - 3)) {
    return { matches: true, scale: 0.5, note: '（点金手·右映射）' }
  }
  if (triggerOrder(actor.items).some((item) => itemDef(item.defId).advancedEffect === 'TRIGGER_BY_SIZE') && def.size === roll) {
    return { matches: true, scale: 1, note: '（按容量触发）' }
  }
  return { matches: false, scale: 1, note: '' }
}

function restrictRollByRelic(fighter: FighterSnapshot, roll: number) {
  if (hasRelic(fighter, 'ONLY_BIG_HALF_EFFECT') && roll <= 3) return roll + 3
  if (hasRelic(fighter, 'ONLY_SMALL_HALF_EFFECT') && roll >= 4) return roll - 3
  return roll
}

function globalEffectScale(actor: FighterSnapshot) {
  return hasRelic(actor, 'ONLY_BIG_HALF_EFFECT') || hasRelic(actor, 'ONLY_SMALL_HALF_EFFECT') ? 0.5 : 1
}

function adjacentItems(actor: FighterSnapshot, item: GameItem) {
  const ordered = triggerOrder(actor.items)
  return ordered.filter((candidate) => candidate.id !== item.id && Math.abs(candidate.x - item.x) <= itemDef(item.defId).width)
}

function itemName(def: ItemDef, quality: ItemQuality) {
  return quality === 'BRONZE' ? def.name : `${QUALITY_LABELS[quality]}${def.name}`
}

function roundScaled(amount: number, scale: number) {
  return Math.max(0, Math.round(amount * scale))
}

export function simulateBattle(player: FighterSnapshot, opponent: FighterSnapshot, seed: string): BattleResult {
  const rng = createRng(seed)
  const playerMaxHp = maxHealthForRound(player.round)
  const opponentMaxHp = maxHealthForRound(opponent.round)
  const state: Record<Side, BattleSideState> = { player: createSideState(playerMaxHp), opponent: createSideState(opponentMaxHp) }
  let playerHp = playerMaxHp
  let opponentHp = opponentMaxHp
  const events: BattleEvent[] = []
  const playerSnapshot = toBattleSnapshot(player)
  const opponentSnapshot = toBattleSnapshot(opponent)

  const push = (event: Omit<BattleEvent, 'playerHp' | 'opponentHp' | 'playerMaxHp' | 'opponentMaxHp'>) => {
    events.push({
      ...event,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      playerMaxHp: state.player.maxHp,
      opponentMaxHp: state.opponent.maxHp,
    })
  }

  const getHp = (side: Side) => side === 'player' ? playerHp : opponentHp
  const setHp = (side: Side, hp: number) => {
    if (side === 'player') playerHp = hp
    else opponentHp = hp
  }

  const applyDamage = (target: Side, amount: number) => {
    const before = getHp(target)
    const shieldUsed = Math.min(state[target].shield, amount)
    state[target].shield -= shieldUsed
    const after = Math.max(0, before - (amount - shieldUsed))
    setHp(target, after)
    return { before, after, delta: after - before }
  }

  const applyHeal = (side: Side, amount: number) => {
    const before = getHp(side)
    const after = Math.min(state[side].maxHp, before + amount)
    setHp(side, after)
    return { before, after, delta: after - before }
  }

  const executeItem = (
    actorSide: Side,
    actor: FighterSnapshot,
    item: GameItem,
    roll: number,
    scale: number,
    note: string,
    queue: GameItem[],
    processed: { count: number; capped: boolean },
    extra: boolean,
  ): ItemTrigger[] => {
    const targetSide = opponentOf(actorSide)
    const def = itemDef(item.defId)
    const quality = normalizeQuality(item.quality)
    const triggers: ItemTrigger[] = []
    const actorState = state[actorSide]
    const targetState = state[targetSide]
    const advanced = def.advancedEffect ?? 'NONE'

    if (targetState.disabledLarge > 0 && isLarge(def, actor)) {
      targetState.disabledLarge -= 1
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)} 被【失效】抵消`,
      })
      return triggers
    }

    const bullyDoubled = actor.dogType === 'BULLY' && isLarge(def, actor) && rng() < BULLY_LARGE_EFFECT_CHANCE
    const bullyQuad = bullyDoubled && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'BULLY_QUADRUPLE_CHANCE') && rng() < 0.2
    const emperorDoubled = actor.dogType === 'EMPEROR'
      && actor.luckyNumber === roll
      && rng() < EMPEROR_LUCKY_EFFECT_CHANCE
    const doubled = bullyDoubled || emperorDoubled
    const multiplier = bullyQuad ? 4 : doubled ? 2 : 1
    const traitText = bullyQuad ? '（恶霸4倍翻倍）' : bullyDoubled ? '（恶霸翻倍）' : emperorDoubled ? '（狗皇帝幸运翻倍）' : ''
    const amount = roundScaled(qualityAmount(def.effect.amount, quality) * multiplier, scale * globalEffectScale(actor))

    if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') {
      const before = getHp(targetSide)
      const result = applyDamage(targetSide, amount)
      const weakScale = actorState.weak > 0 ? 0.5 : 1
      if (actorState.weak > 0) actorState.weak -= 1
      if (weakScale < 1 && result.delta < 0) {
        const refunded = Math.round(Math.abs(result.delta) * 0.5)
        setHp(targetSide, Math.min(targetState.maxHp, getHp(targetSide) + refunded))
      }
      const after = getHp(targetSide)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount: Math.abs(after - before),
        target: targetSide,
        sourceHp: getHp(actorSide),
        targetHp: after,
        sourceHpDelta: 0,
        targetHpDelta: after - before,
        roll,
        text: `${itemName(def, quality)}${traitText}${note} 造成 ${Math.abs(after - before)} 点伤害`,
      })
      if (targetState.thorns > 0) {
        const thorn = targetState.thorns * 3
        const thornResult = applyDamage(actorSide, thorn)
        triggers.push({
          itemId: item.id,
          defId: item.defId,
          quality,
          effectType: 'DAMAGE',
          amount: thorn,
          target: actorSide,
          sourceHp: thornResult.after,
          targetHp: getHp(targetSide),
          sourceHpDelta: thornResult.delta,
          targetHpDelta: 0,
          roll,
          text: `【荆棘】反弹 ${thorn} 点伤害`,
        })
      }
      if (actor.dogType === 'BULLY' && isLarge(def, actor) && triggerOrder(actor.items).some((entry) => itemDef(entry.defId).advancedEffect === 'DISABLE_ENEMY_LARGE')) {
        targetState.disabledLarge += 1
      }
    }

    if (def.effect.type === 'HEAL') {
      const result = applyHeal(actorSide, amount)
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: def.effect.type,
        amount,
        target: actorSide,
        sourceHp: result.after,
        targetHp: getHp(targetSide),
        sourceHpDelta: result.delta,
        targetHpDelta: 0,
        roll,
        text: `${itemName(def, quality)}${traitText}${note} 回复 ${amount} 点生命`,
      })
    }

    if (advanced === 'POISON_ON_ROLL') {
      targetState.poison += qualityAmount(3, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'POISON', amount: targetState.poison, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 叠加 ${qualityAmount(3, quality)} 层【中毒】` })
    }
    if (advanced === 'GAIN_THORNS' && rng() < 0.5) {
      actorState.thorns += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: actorState.thorns, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(1, quality)} 层【荆棘】` })
    }
    if (advanced === 'APPLY_WEAK' && rng() < 0.5) {
      targetState.weak += qualityAmount(1, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: targetState.weak, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 施加 ${qualityAmount(1, quality)} 层【虚弱】` })
    }
    if (advanced === 'AVALANCHE' && roll <= 3) {
      actorState.avalanche += 1
      if (actorState.avalanche >= 5) {
        actorState.avalanche = 0
        const damage = qualityAmount(actorState.avalancheDamage, quality)
        actorState.avalancheDamage *= 2
        const result = applyDamage(targetSide, damage)
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'DAMAGE', amount: damage, target: targetSide, sourceHp: getHp(actorSide), targetHp: result.after, sourceHpDelta: 0, targetHpDelta: result.delta, roll, text: `${itemName(def, quality)} 引发雪崩，造成 ${damage} 点伤害` })
      }
    }
    if (advanced === 'FREEZE_STACK' && roll >= 4) {
      actorState.freeze += 1
      if (actorState.freeze >= 10) {
        actorState.freeze = 0
        targetState.weak += 2
        triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 2, target: targetSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 冻结敌人 2 秒` })
      }
    }
    if (advanced === 'SHIELD_ON_NON_LUCKY' && actor.luckyNumber !== roll) {
      actorState.shield += qualityAmount(5, quality)
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: qualityAmount(5, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 获得 ${qualityAmount(5, quality)} 点护盾` })
    }
    if (advanced === 'CLEANSE_ON_LUCKY' && actor.luckyNumber === roll) {
      actorState.poison = 0
      actorState.weak = 0
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'UTILITY', amount: 0, target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: 0, targetHpDelta: 0, roll, text: `${itemName(def, quality)} 驱散所有负面状态` })
    }

    if (advanced === 'TRIGGER_ADJACENT' || (advanced === 'ADJACENT_ON_EXTRA_ROLL' && extra)) {
      queue.push(...adjacentItems(actor, item))
    }
    if (advanced === 'TRIGGER_MINUS_THREE' && roll >= 4) {
      queue.push(...triggerOrder(actor.items).filter((entry) => itemDef(entry.defId).dice.includes(roll - 3)))
    }
    if (advanced === 'LARGE_TRIGGERS_NON_LARGE' && isLarge(def, actor)) {
      const candidates = triggerOrder(actor.items).filter((entry) => !isLarge(itemDef(entry.defId), actor))
      if (candidates.length > 0) queue.push(candidates[Math.floor(rng() * candidates.length)])
    }
    if (advanced === 'SMALL_TRIGGERS_LARGE' && def.size === 1) {
      queue.push(...triggerOrder(actor.items).filter((entry) => isLarge(itemDef(entry.defId), actor)))
    }
    if (advanced === 'EXTRA_ROLL_TRIGGERS_ALL' || (advanced === 'ROLL_COUNTER_EXTRA' && actorState.rollCount % 4 === 0)) {
      queue.push(...triggerOrder(actor.items))
    }
    if ((advanced === 'EXTRA_ROLL_CHANCE' && rng() < 0.2) || (advanced === 'EXTRA_ROLL_RECURSE' && extra && rng() < 0.2)) {
      queue.push(...triggerOrder(actor.items))
    }
    if (advanced === 'MAX_HP_ON_EXTRA_ROLL' && extra) {
      actorState.maxHp += qualityAmount(1, quality)
      setHp(actorSide, getHp(actorSide) + qualityAmount(1, quality))
      triggers.push({ itemId: item.id, defId: item.defId, quality, effectType: 'HEAL', amount: qualityAmount(1, quality), target: actorSide, sourceHp: getHp(actorSide), targetHp: getHp(targetSide), sourceHpDelta: qualityAmount(1, quality), targetHpDelta: 0, roll, text: `${itemName(def, quality)} 使最大生命值 +${qualityAmount(1, quality)}` })
    }

    if (processed.count >= TRIGGER_QUEUE_CAP && !processed.capped) {
      processed.capped = true
      triggers.push({
        itemId: item.id,
        defId: item.defId,
        quality,
        effectType: 'UTILITY',
        amount: 0,
        target: 'none',
        sourceHp: getHp(actorSide),
        targetHp: getHp(targetSide),
        sourceHpDelta: 0,
        targetHpDelta: 0,
        roll,
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
      })
    }

    return triggers
  }

  const resolveActor = (time: number, actorSide: Side, extra = false) => {
    const fighter = actorSide === 'player' ? player : opponent
    const fighterState = state[actorSide]
    let roll = rollDog(fighter.dogType, rng)
    if (triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'ROLL_TWO_PICK_SMALL')) {
      const second = rollDog(fighter.dogType, rng)
      roll = Math.min(roll, second)
    }
    if (fighter.dogType === 'EMPEROR' && fighter.luckyNumber && triggerOrder(fighter.items).some((item) => itemDef(item.defId).advancedEffect === 'LUCKY_NUMBER_PITY')) {
      if (fighterState.missedLucky >= 2) roll = fighter.luckyNumber
    }
    roll = restrictRollByRelic(fighter, roll)
    fighterState.rollCount += 1
    if (fighter.dogType === 'EMPEROR' && fighter.luckyNumber) fighterState.missedLucky = roll === fighter.luckyNumber ? 0 : fighterState.missedLucky + 1
    push({
      time,
      actor: actorSide,
      kind: 'ROLL',
      roll,
      effectType: 'ROLL',
      target: 'none',
      text: `${fighter.name}${extra ? ' 额外' : ''}掷出 ${roll} 点（${DOGS[fighter.dogType].name}）`,
    })

    const queue = triggerOrder(fighter.items).filter((item) => matchingContext(fighter, itemDef(item.defId), roll).matches)
    const processed = { count: 0, capped: false }
    while (queue.length > 0 && processed.count < TRIGGER_QUEUE_CAP) {
      const item = queue.shift()
      if (!item) continue
      const def = itemDef(item.defId)
      const context = matchingContext(fighter, def, roll)
      processed.count += 1
      for (const trigger of executeItem(actorSide, fighter, item, roll, context.scale, context.note, queue, processed, extra)) {
        push({
          time,
          actor: actorSide,
          kind: 'ITEM',
          text: trigger.text,
          roll: trigger.roll,
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
    }
    if (queue.length > 0 && !processed.capped) {
      push({
        time,
        actor: actorSide,
        kind: 'ITEM',
        text: `触发队列达到上限 ${TRIGGER_QUEUE_CAP}，后续联动已截断`,
        effectType: 'UTILITY',
        target: 'none',
      })
    }
  }

  const currentWinner = () => resolveWinnerByHealthPercent(
    { hp: playerHp, maxHp: state.player.maxHp },
    { hp: opponentHp, maxHp: state.opponent.maxHp },
  )

  const currentLeadText = () => currentWinner() === 'player' ? '玩家胜利' : '对手胜利'

  const finish = (time: number, text: string): BattleResult => {
    const winner = currentWinner()
    push({ time, actor: 'system', kind: 'END', target: 'none', text })
    return {
      winner,
      duration: time,
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      playerMaxHp: state.player.maxHp,
      opponentMaxHp: state.opponent.maxHp,
      events,
      playerSnapshot,
      opponentSnapshot,
    }
  }

  for (let time = 1; time <= 120; time += 1) {
    for (const actor of ['player', 'opponent'] as const) {
      resolveActor(time, actor)
      const fighter = actor === 'player' ? player : opponent
      if (fighter.dogType === 'MUTT' && rng() < 0.2) resolveActor(time, actor, true)

      if (playerHp <= 0 || opponentHp <= 0) {
        return finish(time, `战斗结束：${currentLeadText()}`)
      }
    }

    for (const side of ['player', 'opponent'] as const) {
      if (state[side].poison > 0) {
        const before = getHp(side)
        const damage = state[side].poison
        const result = applyDamage(side, damage)
        push({
          time,
          actor: 'system',
          kind: 'POISON',
          effectType: 'POISON',
          amount: damage,
          target: side,
          sourceHpDelta: side === 'player' ? result.delta : 0,
          targetHpDelta: side === 'opponent' ? result.delta : 0,
          text: `【中毒】结算，${side === 'player' ? '玩家' : '对手'}受到 ${before - result.after} 点伤害`,
        })
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
        return finish(time, `毒伤结算：${currentLeadText()}`)
      }
    }
  }

  return finish(120, `120 秒判定：${currentLeadText()}`)
}
