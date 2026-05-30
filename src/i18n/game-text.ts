import type { DogType, ItemQuality, ShopType } from '../server/game/types'
import type { Language } from './types'

type DefText = { name: string; description: string }
type RuleTermText = { term: string; description: string; note?: string }
type LocalizableItemDef = {
  id: string
  name: string
  description?: string
  effect: { type: string; amount: number }
}
type LocalizableRelicDef = {
  id: string
  name: string
  description: string
}

export const qualityText: Record<ItemQuality, Record<Language, string>> = {
  BRONZE: { 'zh-CN': '青铜', 'en-US': 'Bronze' },
  SILVER: { 'zh-CN': '白银', 'en-US': 'Silver' },
  GOLD: { 'zh-CN': '黄金', 'en-US': 'Gold' },
  DIAMOND: { 'zh-CN': '钻石', 'en-US': 'Diamond' },
}

export const shopTypeText: Record<ShopType, Record<Language, string>> = {
  GENERAL: { 'zh-CN': '通用商店', 'en-US': 'General Shop' },
  LARGE: { 'zh-CN': '大型商店', 'en-US': 'Large Gear Shop' },
  MEDIUM: { 'zh-CN': '中型商店', 'en-US': 'Medium Gear Shop' },
  SMALL: { 'zh-CN': '小型商店', 'en-US': 'Small Gear Shop' },
  SMALL_DICE: { 'zh-CN': '小点商店', 'en-US': 'Low Roll Shop' },
  BIG_DICE: { 'zh-CN': '大点商店', 'en-US': 'High Roll Shop' },
  RELIC: { 'zh-CN': '遗物商店', 'en-US': 'Relic Shop' },
  UPGRADE: { 'zh-CN': '升级商店', 'en-US': 'Upgrade Shop' },
  POTION: { 'zh-CN': '药水商店', 'en-US': 'Potion Shop' },
}

export const dogTextByType: Record<DogType, DefText> = {
  SHIBA: { name: 'Shiba', description: '20% chance to reroll into a low roll: 1, 2, or 3.' },
  SAMOYED: { name: 'Samoyed', description: '20% chance to reroll into a high roll: 4, 5, or 6.' },
  MUTT: { name: 'Mutt', description: '20% chance to gain one extra roll.' },
  BULLY: { name: 'Bully', description: '40% chance to double the effect of the triggered large item.' },
  EMPEROR: { name: 'Dog Emperor', description: 'Choose a destiny number. When it hits, there is a 50% chance to double triggered effects.' },
  FROG: { name: 'Zuling', description: 'Explicit-dice gear fills a reservoir instead of using base rolls, starts battle at 50% reservoir progress, and triggers every 6 divided by explicit dice count before class speed bonuses.' },
}

export const itemTextById: Record<string, DefText> = {
  'starter-1': { name: '1-Pip Fang Bite', description: 'Deals 5 damage when a 1 is rolled.' },
  'starter-2': { name: '2-Pip Fang Bite', description: 'Deals 5 damage when a 2 is rolled.' },
  'starter-3': { name: '3-Pip Fang Bite', description: 'Deals 5 damage when a 3 is rolled.' },
  'starter-4': { name: '4-Pip Fang Bite', description: 'Deals 5 damage when a 4 is rolled.' },
  'starter-5': { name: '5-Pip Fang Bite', description: 'Deals 5 damage when a 5 is rolled.' },
  'starter-6': { name: '6-Pip Fang Bite', description: 'Deals 5 damage when a 6 is rolled.' },
  'small-bite': { name: 'Small Bite', description: 'Deals 4 damage. On hit, has a 20% chance to apply 1 Weak stack.' },
  'lucky-paw': { name: 'Lucky Paw Pad', description: 'Multi 2. Deals 5 damage twice when triggered.' },
  'milk-bone': { name: 'Milk Bone', description: 'Multi 2. Restores 3 health twice when triggered.' },
  'rubber-ball': { name: 'Rubber Ball', description: 'Multi 2. Deals 4 damage twice on reliable mid rolls.' },
  'spiked-collar': { name: 'Spiked Collar', description: 'A medium attack item that favors high rolls.' },
  'training-disc': { name: 'Training Disc', description: 'Multi 3. Deals 3 damage three times on edge rolls: 1 and 6.' },
  'guard-vest': { name: 'Guard Vest', description: 'Restores health across alternating trigger rolls.' },
  'giant-bone': { name: 'Giant Bone Club', description: 'Deals 16 damage. Attacks have a 50% chance to gain Fury.' },
  'dog-house': { name: 'Puppy Kennel', description: 'Restores 12 health and steals 1 enemy buff, prioritizing Thorns then Haste. Shield cannot be stolen.' },
  'dog-gold-ingot': { name: 'Dog Gold Ingot', description: 'No trigger required. If equipped, post-battle sell price increases by 3.' },
  'dog-silver-ingot': { name: 'Dog Silver Ingot', description: 'No trigger required. If equipped or carried, post-battle sell price increases by 1.' },
  'v3-broken-canine': { name: 'Broken Canine', description: 'Deals 3 damage. If the target is Weak, deals 4 extra true damage.' },
  'v3-chew-scratch-post': { name: 'Chew-Proof Scratching Post', description: 'Increases the next trigger damage of adjacent gear by 4.' },
  'v3-cone-collar': { name: 'Cone Collar', description: 'Gain 3 Shield.' },
  'v3-dog-catnip': { name: 'Dog Catnip Extract', description: 'Restores 4 health and cleanses 1 Poison or Weak stack from yourself.' },
  'v3-flea-disc': { name: 'Flea Disc', description: 'Applies 2 Poison stacks to the enemy.' },
  'v3-large-bone-sword': { name: 'Large Chew-Bone Sword', description: 'Deals 8 damage.' },
  'v3-wooden-shield': { name: 'Kennel Plank Shield', description: 'Gain 8 Shield.' },
  'v3-spiked-vest': { name: 'Spiked Riot Harness', description: 'Gain 1 Shield and 1 Thorns stack.' },
  'v3-hydrant-axe': { name: 'Hydrant Battle Axe', description: 'Deals 15 damage and applies 1 Weak stack to the enemy.' },
  'v3-dinosaur-leg-bone': { name: 'Dinosaur Femur Club', description: 'Deals 18 damage. If the enemy has Shield, this hit deals double damage to Shield.' },
  'v3-auto-waterer': { name: 'Automatic Waterer', description: 'Restores 8 health. If you are already at full health, permanently gain 1 max health.' },
  'v3-night-patrol-light': { name: 'Night Patrol Light', description: 'Temporarily improves adjacent gear trigger odds for 2 seconds by doubling base weight.' },
  'v3-blood-mad-fang': { name: 'Blood-Mad Fang', description: 'Deals 6 damage and triggers Lifesteal.' },
  'v3-fermented-trash-bin': { name: 'Fermented Trash Bin', description: 'Applies 5 Poison stacks and disables the enemy rightmost item once.' },
  'v3-golden-kennel': { name: 'Untouchable Golden Kennel', description: 'Gain 14 Shield. While shielded, incoming Poison and Weak stacks are halved, rounded up.' },
  'v4-blood-contract-fang': { name: 'Blood Pact Fang', description: 'Aura: grants Lifesteal to the left adjacent item for the battle. Diamond affects both adjacent items.' },
  'v4-boom-counter': { name: 'Boom Counter', description: 'Triggers only by counting. Each allied item trigger adds 1 count. At 50, resets and deals direct damage.' },
  'v4-growing-chew-sword': { name: 'Growing Chew Sword', description: 'Starts at 1 damage. Each successful trigger increases later damage this battle by 3 without a cap.' },
  'v4-reverse-fur-comb': { name: 'Reverse-Fur Purifying Comb', description: 'Purges up to 3 enemy buffs. Heal 5 for each removed stack, prioritizing Thorns, Haste, then Shield chunks.' },
  'patting-bear': { name: 'Patting Bear', description: 'Each trigger applies 1 Wound.' },
  'poisoned-dog-fang': { name: 'Poisoned Dog Fang', description: 'No trigger required. Each attack hit applies 1 Poison stack.' },
  'lotus-sea': { name: 'Lotus Sea', description: 'Aura: the left adjacent Multi item gains +1 Multi. Diamond affects both adjacent Multi items.' },
  'kyushu-bracer': { name: 'Kyushu Bracer', description: 'Aura: allied Multi attack items gain bonus damage on their 2nd and later trigger, and grant Shield.' },
  'shiba-speed-katana': { name: 'Swift Katana', description: 'Each trigger grants 1 Haste stack, up to 5 stacks, resetting after battle.' },
  'shiba-great-katana': { name: 'Great Katana', description: 'Also triggers one adjacent item once.' },
  'shiba-swallow-katana': { name: 'Swallow Katana', description: 'Has a 20% chance to grant an extra roll. Stacks up to 3 extra rolls.' },
  'shiba-shadow-clone': { name: 'Shadow Clone Jutsu', description: 'Each roll rolls twice and keeps the result closer to 1, 2, or 3.' },
  'shiba-break': { name: 'Jutsu: Break', description: 'Gear triggers by size instead of dice. Size triggers have a 50% chance to trigger one extra time.' },
  'shiba-poison': { name: 'Jutsu: Venom', description: 'Each roll applies 6 Poison stacks to the enemy. This does not scale with quality.' },
  'samoyed-soft-fur': { name: 'Soft Fur', description: 'Each trigger restores 8 health.' },
  'samoyed-thorn-fur': { name: 'Thorn Fur', description: 'Each trigger has a 50% chance to gain 1 Thorns stack.' },
  'samoyed-frost-fur': { name: 'Frost Fur', description: 'Each trigger has a 50% chance to apply 1 Weak stack.' },
  'samoyed-avalanche-core': { name: 'Avalanche Core', description: 'Low rolls add Avalanche. At 5 stacks, clear them and deal damage; each Avalanche doubles the next one.' },
  'samoyed-absolute-zero': { name: 'Absolute Zero', description: 'High rolls add Freeze count. At 10 counts, clear them and freeze the enemy for 2 seconds.' },
  'samoyed-cold-proof': { name: 'Coldproof', description: 'When you roll a high number, also triggers gear bound to that number minus 3.' },
  'mutt-old-collar': { name: 'Old Collar', description: 'Whenever your class trait grants an extra roll, permanently gain 1 max health.' },
  'mutt-counting-collar': { name: 'Counting Collar', description: 'Every 4 rolls during battle immediately grants one extra roll.' },
  'mutt-charged-collar': { name: 'Charged Collar', description: 'When an extra roll occurs, triggers this item adjacent gear once.' },
  'mutt-chase-tail': { name: 'Tail Chaser', description: 'Extra rolls have a 20% chance to create another extra roll. Each chain roll temporarily increases all damage by 10%.' },
  'mutt-chase-car': { name: 'Car Chaser', description: 'Extra rolls also trigger another item twice.' },
  'mutt-eat-air': { name: 'Air Eater', description: 'For the first 10 seconds, base roll speed is doubled, but you cannot gain healing or Shield.' },
  'bully-vault': { name: 'Bully Vault', description: 'After each battle round, gain one large item.' },
  'bully-gym': { name: 'Bully Gym', description: 'When a large item triggers, it also triggers a random non-large item.' },
  'bully-armband': { name: 'Bully Armband', description: 'Size-3 items also count as large items.' },
  'bully-sacrifice': { name: 'Ruthless Sacrifice', description: 'Your small items lose their base effects. Each small item trigger triggers your large items instead.' },
  'bully-colossus': { name: 'Colossus Pressure', description: 'When a large item successfully doubles, it has a 20% chance to quadruple instead.' },
  'bully-demolish': { name: 'Unreasonable Demolition', description: 'Large item hits disable all enemy large items once. Stacks are cumulative.' },
  'emperor-dice-cup': { name: 'Imperial Dice Cup', description: 'If you miss your destiny number twice in a row, the next system roll is forced to your destiny number.' },
  'emperor-minister': { name: 'Usurping Minister', description: 'When the roll is not your destiny number, gain 5 Shield.' },
  'emperor-robe': { name: 'Golden Dragon Robe', description: 'Whenever you roll your destiny number, immediately cleanse all negative statuses from yourself.' },
  'emperor-curtain': { name: 'Rule Behind the Curtain', description: 'Your original destiny number becomes inactive. Adjacent gear uses the destiny number as its trigger number.' },
  'emperor-edict': { name: 'Tyrannical Edict', description: 'At battle start, forcibly changes the trigger dice of the two leftmost items on both sides to your destiny number.' },
  'emperor-fallen': { name: 'Fallen Monarch', description: 'Only destiny-number gear can take effect, including no-trigger gear, but destiny-number gear triggers twice.' },
  'frog-lily-pump': { name: 'Lily Pad Pump', description: 'Passive: all reservoir gear fills 15% faster.' },
  'frog-croak-drum': { name: 'Croak Drum', description: 'After this item triggers from a full reservoir, perform one ordinary roll. That roll cannot request another Croak Drum roll.' },
  'frog-raindrop-funnel': { name: 'Raindrop Funnel', description: 'After this item triggers from a full reservoir, adjacent reservoir gear gains 50% reservoir progress.' },
  'frog-lotus-echo': { name: 'Lotus Pond Echo', description: 'The first non-class item hit by an ordinary roll created by class gear triggers one extra time.' },
  'frog-rainy-season': { name: 'Rainy Season', description: 'After this item triggers from a full reservoir, all reservoir gear fills 50% faster for 4 seconds.' },
  'frog-full-pond-gate': { name: 'Full Pond Gate', description: 'After this item triggers from a full reservoir, immediately triggers the non-class item with the highest current reservoir progress.' },
}

export const relicTextById: Record<string, DefText> = {
  'midas-left': { name: 'Midas Hand: Left', description: 'Items bound to 4, 5, or 6 also trigger on the matching low roll minus 3, with effects reduced by 50%.' },
  'midas-right': { name: 'Midas Hand: Right', description: 'Items bound to 1, 2, or 3 also trigger on the matching high roll plus 3, with effects reduced by 50%.' },
  'half-die-left': { name: 'Half Die: Left', description: 'You can only roll high numbers, but all gear effects are reduced by 50%.' },
  'half-die-right': { name: 'Half Die: Right', description: 'You can only roll low numbers, but all gear effects are reduced by 50%.' },
  carrot: { name: 'Carrot', description: 'All equipped trigger dice shift up by 1. Six wraps around to 1.' },
  tissue: { name: 'Tissue', description: 'All equipped trigger dice shift down by 1. One wraps around to 6.' },
  'v3-two-sided-gold-tag': { name: 'Two-Sided Gold Dog Tag', description: 'The absolute chance of rolling an extreme value, 1 or 6, increases by 30%.' },
  'v3-balanced-food-bowl': { name: 'Balanced Food Bowl', description: 'The absolute chance of rolling 3 or 4 increases by 30%.' },
  'v3-lucky-foxtail': { name: 'Lucky Foxtail', description: 'After 2 empty rolls in a row, the 3rd roll must trigger a random large item, or a medium item if none exist.' },
  'v3-bad-dog-manual': { name: 'Bad Dog Manual', description: 'Enemy Poison deals 2 extra damage each time it ticks.' },
  'v3-fluffed-spike-collar': { name: 'Fluffed Spike Collar', description: 'At battle start, immediately gain 5 Thorns stacks.' },
  'v3-husky-engine': { name: 'Husky Engine', description: 'Your base roll interval is shortened from 1 second to 0.85 seconds.' },
  'v3-fourth-dimensional-kennel': { name: 'Fourth-Dimensional Kennel', description: 'Break the normal bag limit and place a 13th item into the battle area.' },
}

export const ruleTermTextByTerm: Record<string, RuleTermText> = {
  '相邻': { term: 'Adjacent', description: 'The first item directly to the left or right of this item. Some effects only use the left adjacent item; Diamond quality or specific effects may use both sides.', note: 'Determined only by equipment row position, not the bag.' },
  '小点': { term: 'Low Roll', description: 'A roll result of 1, 2, or 3.', note: 'Some relics and class effects bias, restrict, or map low rolls.' },
  '大点': { term: 'High Roll', description: 'A roll result of 4, 5, or 6.', note: 'Some relics and class effects bias, restrict, or map high rolls.' },
  '极值': { term: 'Extreme', description: 'A roll result of 1 or 6.', note: 'Two-Sided Gold Dog Tag increases extreme roll chance.' },
  '护盾': { term: 'Shield', description: 'Temporary protection that absorbs normal damage first. It cannot be stolen, but some buff-purge effects remove it in chunks of 8 Shield per stack.', note: 'While Shield exists, some gear halves incoming Poison and Weak stacks.' },
  '荆棘': { term: 'Thorns', description: 'Positive buff. Each stack reflects 2 damage when attacked.', note: 'Reflected damage resolves after receiving an attack.' },
  '加速': { term: 'Haste', description: 'Positive buff. Each stack reduces base roll interval by 0.1 seconds, up to 5 stacks, with a 0.5 second minimum interval.', note: 'Can be stolen or purged.' },
  '激昂': { term: 'Fury', description: 'Positive buff. Each stack adds 1 to all attack damage.', note: 'Applied by Giant Bone Club, enchantments, and similar effects.' },
  '中毒': { term: 'Poison', description: 'Negative effect. Each stack deals 1 direct health damage per second. Relics can increase tick damage.', note: 'Poison bypasses Shield.' },
  '虚弱': { term: 'Weak', description: 'Negative effect. The target next attack deals 50% less damage, then consumes 1 stack.', note: 'Some shield-immunity gear halves incoming Weak stacks.' },
  '伤口': { term: 'Wound', description: 'Negative effect. Each stack increases direct attack damage taken by 1. It does not affect Poison, Thorns, or other non-direct damage.', note: 'Patting Bear applies Wound.' },
  '冻结': { term: 'Freeze', description: 'Negative effect. While frozen, rolls and item triggers are skipped until the remaining time reaches zero.', note: 'Absolute Zero freezes the enemy after 10 Freeze counts.' },
  '大型物品': { term: 'Large Item', description: 'An item with size 4. With Bully Armband, size-3 items also count as large.', note: 'Bully class and some shops or relics care about large items.' },
  '中型物品': { term: 'Medium Item', description: 'An item with size 2 or 3.', note: 'Medium shops favor these items.' },
  '小型物品': { term: 'Small Item', description: 'An item with size 1.', note: 'Small shops favor these items.' },
  '失效': { term: 'Disabled', description: 'Negative effect. Each stack cancels one item trigger, either for a specified item or a large item, then is consumed.', note: 'Checked before the item effect resolves.' },
  '天命数字': { term: 'Destiny Number', description: 'The Dog Emperor lucky number chosen at the start. Hits can trigger Dog Emperor class traits or class gear.', note: 'Some class gear rewrites, forces, or limits destiny-number triggers.' },
  '吸血': { term: 'Lifesteal', description: 'After an attack deals health damage, heal yourself for 100% of the health damage dealt. Shield absorption does not become healing.', note: 'Blood Pact Fang can grant Lifesteal to adjacent gear.' },
  '额外投掷': { term: 'Extra Roll', description: 'An additional roll beyond the base roll. It can trigger gear and related class effects, with chain protection.', note: 'Mutt and several class items are built around extra rolls.' },
  '净化': { term: 'Cleanse', description: 'Removes negative statuses. Normal cleanse prioritizes Poison, then Weak. Some effects remove all negative statuses.', note: 'Cleanse is not the same as purging enemy positive buffs.' },
  '真实伤害': { term: 'True Damage', description: 'Damage that directly reduces health and does not get absorbed by Shield first.', note: 'Broken Canine can deal true damage.' },
  '雪崩': { term: 'Avalanche', description: 'Samoyed class count. Low rolls add stacks. At 5 stacks, they clear and deal damage; each Avalanche doubles the next one.', note: 'Avalanche base damage scales with quality.' },
  '爆鸣计数': { term: 'Boom Count', description: 'Boom Counter can only trigger by counting. Each allied item trigger adds 1 count. At 50, it clears and deals direct damage.', note: 'Upgrading Boom Counter only increases the damage dealt at 50.' },
  '蓄水': { term: 'Reservoir', description: 'Zuling class timing mechanic. Explicit-dice gear starts battle at 50% reservoir progress, fills over time based on its explicit dice count, then triggers at full and keeps any overflow progress above 100%.', note: 'The base interval is max(0.5, 6 divided by explicit dice count divided by speed multiplier). Linked triggers do not clear the target reservoir, and overflow is capped below full after the trigger.' },
  '暴雨季': { term: 'Rainy Season', description: 'A temporary Zuling class speed window. When triggered, all reservoir gear fills 50% faster for 4 seconds.', note: 'Multiplies with Lily Pad Pump and does not change explicit dice count.' },
  '多重': { term: 'Multi', description: 'When this item hits, it fully triggers the listed number of times. Multi 2 means two complete trigger resolutions from the same hit.', note: 'Each segment counts as a successful trigger. Each Disabled stack cancels only one segment. Multi caps at 5.' },
}

export function localizeItemDef(def: LocalizableItemDef, language: Language): DefText {
  if (language === 'zh-CN') return { name: def.name, description: def.description ?? baseEffectDescription(def) }
  return itemTextById[def.id] ?? { name: def.name, description: def.description ?? baseEffectDescription(def) }
}

export function localizeRelicDef(def: LocalizableRelicDef, language: Language): DefText {
  if (language === 'zh-CN') return { name: def.name, description: def.description }
  return relicTextById[def.id] ?? { name: def.name, description: def.description }
}

export function localizeDog(dogType: DogType, language: Language): { name: string; trait: string } {
  if (language === 'zh-CN') {
    const zhDogText: Record<DogType, { name: string; trait: string }> = {
      SHIBA: { name: '柴犬', trait: '20% 概率改掷为【小点】 1/2/3' },
      SAMOYED: { name: '萨摩耶', trait: '20% 概率改掷为【大点】 4/5/6' },
      MUTT: { name: '土狗', trait: '20% 概率【额外投掷】一次' },
      BULLY: { name: '恶霸', trait: '40% 概率使本次触发的【大型物品】效果翻倍' },
      EMPEROR: { name: '狗皇帝', trait: '指定【天命数字】，命中时 50% 概率使触发效果翻倍' },
      FROG: { name: '祖灵', trait: '显式点数装备改为【蓄水】触发，可被职业装备提速' },
    }
    return zhDogText[dogType]
  }
  return { name: dogTextByType[dogType].name, trait: dogTextByType[dogType].description }
}

export function localizeRuleTerm(term: string, language: Language): RuleTermText {
  if (language === 'zh-CN') return { term, description: '', note: '' }
  return ruleTermTextByTerm[term] ?? { term, description: '' }
}

export function localizeQuality(quality: ItemQuality, language: Language) {
  return qualityText[quality][language]
}

export function localizeShopType(shopType: ShopType, language: Language) {
  return shopTypeText[shopType][language]
}

function baseEffectDescription(def: LocalizableItemDef) {
  if (def.effect.type === 'DAMAGE') return `造成 ${def.effect.amount} 点伤害。`
  if (def.effect.type === 'HEAL') return `恢复 ${def.effect.amount} 点生命值。`
  if (def.effect.type === 'DAMAGE_SELF_SHIELD') return `造成 ${def.effect.amount} 点伤害。`
  return '效果见装备规则。'
}
