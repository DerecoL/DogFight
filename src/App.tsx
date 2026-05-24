import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  ArrowRight,
  Backpack,
  BadgeDollarSign,
  Coins,
  Crown,
  Dice5,
  Flag,
  Gamepad2,
  Grid3X3,
  HeartPulse,
  House,
  Lock,
  LogOut,
  Medal,
  Music,
  PackagePlus,
  PawPrint,
  RadioTower,
  RefreshCcw,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
  VolumeX,
} from 'lucide-react'
import {
  buildFxTimeline,
  battlePresentationTargetSide,
  createBattlePresentation,
  createUiFeedbackEvent,
  type FeedbackAnchor,
  type PresentationEvent,
  type PresentationKind,
  type UiFeedbackEvent,
  type UiFeedbackKind,
} from './feedback'
import {
  playFeedbackSound,
  soundCueForBattlePresentation,
  soundCueForUiFeedback,
} from './sound-feedback'
import { resolveSlotPlacement } from './placement'
import { itemTriggerCountLabel } from './item-trigger-display'
import { triggerDiceLabel } from './item-trigger-display'
import { queryBattleFxAnchor, resolveBattleFxPoints } from './battle-vfx-coordinates'
import { TERM_DEFS } from './shared/rule-terms'
import './App.css'

type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR'
type Phase = 'SHOP' | 'CHOICE' | 'CLASS_REWARD' | 'ENCHANT_CHOICE' | 'RELIC_CHOICE' | 'UPGRADE_CHOICE' | 'POTION_CHOICE' | 'PREP' | 'MATCH' | 'BATTLE' | 'COMPLETE'
type Area = 'EQUIPMENT' | 'BAG'
type ShopType = 'GENERAL' | 'LARGE' | 'MEDIUM' | 'SMALL' | 'SMALL_DICE' | 'BIG_DICE' | 'RELIC' | 'UPGRADE' | 'POTION'
type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
type GameMode = 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK'
type AppScreen = 'LOBBY' | 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK'
type HistoryModeTab = 'ALL' | 'CASUAL' | 'DOGFIGHT' | 'PEAK' | 'LADDER'
type HistoryRunMode = Exclude<HistoryModeTab, 'ALL'>
type RunMode = 'CASUAL' | 'LADDER'
type LadderTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MASTER' | 'DOG_KING'
type VisualThemeId = 'dogPark' | 'backAlley' | 'royalKennel'
type SurpriseBackgroundId = 'classReward' | 'enchant' | 'settlement'

const BOOM_COUNTER_TRIGGER_THRESHOLD = 50
const HANDDRAWN_FONT_STACK = '"Comic Sans MS", "Microsoft YaHei", "KaiTi", "Kaiti SC", "DFKai-SB", cursive, sans-serif'

type ItemDef = {
  id: string
  name: string
  kind?: string
  size: 1 | 2 | 3 | 4
  width: number
  height: number
  price: number
  dice: number[]
  tags: string[]
  description?: string
  defaultQuality?: ItemQuality
  advancedEffect?: string
  effect: { type: string; amount: number; qualityBase?: ItemQuality }
}
type ShopOffer = { offerId: string; defId: string; price: number; discount: number; quality?: ItemQuality; def?: ItemDef }
type ClassRewardChoice = { defId: string; quality: ItemQuality; def: ItemDef }
type RelicDef = { id: string; name: string; defaultQuality: ItemQuality; tags: string[]; description: string; effect: string }
type Relic = { id: string; relicId: string; quality: ItemQuality; slot: number; def: RelicDef }
type RelicChoice = { relicId: string; quality: ItemQuality; def: RelicDef }
type EnchantmentTarget = 'LEFT' | 'RIGHT' | 'ADJACENT'
type EnchantmentBaseEffect = 'DAMAGE' | 'HEAL' | 'SHIELD'
type EnchantmentSpecialEffect = 'THORNS' | 'FURY' | 'POISON' | 'WEAK'
type EnchantmentGrantEffect = 'LIFESTEAL' | 'THORNS' | 'CLEANSE'
type Enchantment =
  | { kind: 'EXTRA_DICE'; dice: number[]; label: string }
  | { kind: 'BASE_EFFECT'; effect: EnchantmentBaseEffect; amount: number; label: string }
  | { kind: 'SPECIAL'; effect: EnchantmentSpecialEffect; amount: number; label: string }
  | { kind: 'TRIGGER_NEIGHBOR'; target: EnchantmentTarget; label: string }
  | { kind: 'BUFF_NEIGHBOR_EFFECT'; target: EnchantmentTarget; effect: EnchantmentBaseEffect; amount: number; label: string }
  | { kind: 'GRANT_NEIGHBOR_EFFECT'; target: EnchantmentTarget; effect: EnchantmentGrantEffect; amount: number; label: string }
type EnchantmentChoice = { id: string; description: string; enchant: Enchantment }
type PotionCategory = 'ADD_ONE' | 'ADD_TWO' | 'EXTRA_ONE' | 'REPLACE_RANGE' | 'REPLACE_ALL'
type PotionChoice = { id: string; category: PotionCategory; dice: number[]; description: string }
type Item = { id: string; defId: string; quality: ItemQuality; area: Area; x: number; y: number; def: ItemDef; enchant?: Enchantment | null; triggerDiceOverride?: number[] | null; sellBonus?: number }
type BattleActor = 'player' | 'opponent' | 'system'
type BattleTarget = 'player' | 'opponent' | 'both' | 'none'
type BattleSnapshot = { name: string; dogType: DogType; luckyNumber?: number | null; wins: number; losses: number; round: number; items: Item[]; relics?: Relic[] }
type BattleStatusEntry = {
  type: 'shield' | 'thorns' | 'extraRoll' | 'fury' | 'poison' | 'weak' | 'wound' | 'freeze' | 'disabled' | string
  label: string
  tone: 'positive' | 'negative'
  amount?: number
  stacks?: number
  remaining?: number
  nextTickIn?: number
  tickDamage?: number
}
type BattleStatusRows = { positive: BattleStatusEntry[]; negative: BattleStatusEntry[] }
type BattleEvent = {
  time: number
  actor: BattleActor
  kind: 'ROLL' | 'ITEM' | 'POISON' | 'END' | string
  text: string
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  playerShield?: number
  opponentShield?: number
  playerStatuses?: BattleStatusRows
  opponentStatuses?: BattleStatusRows
  statusChanged?: string[]
  roll?: number
  itemId?: string
  targetItemId?: string
  defId?: string
  itemTriggerCount?: number
  boomCounterItemId?: string
  boomCounterValue?: number
  boomCounterMax?: number
  boomCounterChanged?: boolean
  effectType?: string
  amount?: number
  target?: BattleTarget
  sourceHpDelta?: number
  targetHpDelta?: number
}
type BattleVfxKind = PresentationKind
type BattleVfxStyle = { kind: BattleVfxKind; color: string; accent: string; prefix: string; particleCount: number }
type MeteorCue = { delay: number; duration: number; lane: number; lift: number; size: number; alpha: number }
type BattleVfxAnchorAttrs = {
  'data-vfx-anchor': FeedbackAnchor
  'data-vfx-side': 'player' | 'opponent' | 'system'
  'data-vfx-item-id'?: string
}
type Battle = {
  winner: string
  duration: number
  playerHp: number
  opponentHp: number
  playerMaxHp: number
  opponentMaxHp: number
  events: BattleEvent[]
  playerSnapshot?: BattleSnapshot
  opponentSnapshot?: BattleSnapshot
}
type Run = {
  id: string
  mode: RunMode
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  gold: number
  phase: Phase
  status: string
  shopType: ShopType
  shopItems: ShopOffer[]
  choices: ShopType[]
  classRewardChoices: ClassRewardChoice[]
  enchantChoices: EnchantmentChoice[]
  potionChoices: PotionChoice[]
  relicChoices: RelicChoice[]
  relics: Relic[]
  refreshCost: number
  matchedGhost: null | { name: string; dogType: DogType; luckyNumber?: number | null; wins: number; losses: number; round: number }
  lastBattle: Battle | null
  ladderSettlement: LadderSettlement | null
  items: Item[]
}
type LadderSettlement = {
  id: string
  beforeTier: LadderTier
  beforeScore: number
  afterTier: LadderTier
  afterScore: number
  delta: number
  rawDelta: number
  baseScore: number
  tierTax: number
  lossPenalty: number
  perfectBonus: number
  newbieProtection: number
  wins: number
  losses: number
  createdAt: string
}
type LadderProfile = {
  seasonId: string
  tier: LadderTier
  tierLabel: string
  score: number
  highestTier: LadderTier
  highestTierLabel: string
  gamesPlayed: number
  totalWins: number
  totalLosses: number
  updatedAt: string
}
type LadderMeResponse = { profile: LadderProfile; recentSettlements: LadderSettlement[] }
type LadderLeaderboardEntry = { rank: number; title: string; name: string; profile: LadderProfile }
type LadderLeaderboardResponse = { leaderboard: LadderLeaderboardEntry[]; playerRank: number | null; playerProfile: LadderProfile }
type PlayerRunHistoryEntry = Pick<Run, 'id' | 'dogType' | 'luckyNumber' | 'wins' | 'losses' | 'round' | 'status' | 'phase'> & {
  mode: HistoryRunMode
  items: Item[]
  relics: Relic[]
  createdAt: string
  updatedAt: string
}
type PlayerRunHistory = {
  totalRuns: number
  activeRuns: number
  completedRuns: number
  abandonedRuns: number
  totalWins: number
  totalLosses: number
  bestRun: PlayerRunHistoryEntry | null
  recentRuns: PlayerRunHistoryEntry[]
}
type AuthUser = { id: string; account: string; nickname: string | null }
type CasualTutorialStepId = 'LOBBY' | 'DOG_SELECT' | 'SHOP_INSPECT' | 'SHOP_BUY' | 'PLACE_ITEM' | 'MATCH' | 'BATTLE_WATCH' | 'CONTINUE'
type CasualTutorialStatus = 'idle' | 'active' | 'completed' | 'skipped' | 'replaying'
type CasualTutorialState = { status: CasualTutorialStatus; stepId: CasualTutorialStepId }
type TipAnchor = { x: number; y: number }
type RuleTermTipState = {
  term: string
  description: string
  note: string
  anchor: TipAnchor
  placement: 'above' | 'below'
}
type StatusTipState = {
  status: BattleStatusEntry
  side: 'player' | 'opponent'
  polarity: 'positive' | 'negative'
  anchor: TipAnchor
}
type ApexEntry = {
  id: string
  sourceRunId: string | null
  boardType: 'OVERALL' | 'DAILY'
  boardKey: string
  name: string
  dogType: DogType
  luckyNumber?: number | null
  wins: number
  losses: number
  round: number
  rank: number
  challengeWins: number
  isSeed: boolean
  isMine: boolean
  createdAt: string
  items: Item[]
  relics: Relic[]
}
type ApexBattleSummary = {
  opponentId: string
  opponentRank: number
  opponentName: string
  winner: 'player' | 'opponent'
  duration: number
  playerHp: number
  opponentHp: number
}
type ApexChallengeReport = {
  placementRank: number
  battles: ApexBattleSummary[]
}
type ApexBoardId = 'overall' | 'daily'
type ApexLeaderboards = Record<ApexBoardId, ApexEntry[]>
type ApexReports = Record<ApexBoardId, ApexChallengeReport>
type ApexEntries = Record<ApexBoardId, ApexEntry>
type ApexOverview = { leaderboards: ApexLeaderboards; candidates: Run[]; dailyBoardKey: string; dailyResetHour: number }
type ApexSubmitResponse = { entries: ApexEntries; reports: ApexReports; leaderboards: ApexLeaderboards; dailyBoardKey: string; dailyResetHour: number }
type DogfightRoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETE'
type DogfightRoomPhase = 'LOBBY' | 'DOG_SELECT' | 'SHOP' | 'BATTLE' | 'COMPLETE'
type DogfightMember = {
  id: string
  userId: string | null
  runId: string | null
  kind: 'PLAYER' | 'BOT'
  nickname: string
  isHost: boolean
  ready: boolean
  eliminated: boolean
  eliminatedRound?: number | null
  placement?: number | null
  currentBattleId?: string | null
  dogType: DogType | null
  wins: number
  losses: number
  round: number
  gold: number
  phase: Phase
  status: string
}
type DogfightBattleSummary = {
  id: string
  round: number
  participantAId: string
  participantBId?: string | null
  opponentKind: 'PLAYER' | 'OFFLINE'
  winnerSide: string
  winnerParticipantId?: string | null
  createdAt: string
}
type DogfightRoom = {
  id: string
  hostUserId: string
  status: DogfightRoomStatus
  phase: DogfightRoomPhase
  currentRound: number
  maxPlayers: number
  targetPlayerCount: number
  readyDeadline: string | null
  phaseDeadline: string | null
  winnerParticipantId?: string | null
  isHost: boolean
  spectator: boolean
  members: DogfightMember[]
  currentRunMember: DogfightMember | null
  currentRun: Run | null
  battles: DogfightBattleSummary[]
}
type DogfightRoomSummary = {
  id: string
  status: DogfightRoomStatus
  phase: DogfightRoomPhase
  currentRound: number
  maxPlayers: number
  targetPlayerCount: number
  memberCount: number
  aliveCount: number
  readyDeadline: string | null
  phaseDeadline: string | null
  winnerParticipantId?: string | null
  isMember: boolean
  isHost: boolean
  spectator: boolean
  hostName: string
}
type DogfightRoomsResponse = { rooms: DogfightRoomSummary[] }
type DogfightRoomResponse = { room: DogfightRoom }
type DogfightLeaveResponse = { room: DogfightRoom | null }
type DogfightBattleResponse = { battle: { id: string; roomId: string; round: number; opponentKind: string; result: Battle } }

const dogNames: Record<DogType, string> = { SHIBA: '柴犬', SAMOYED: '萨摩耶', MUTT: '土狗', BULLY: '恶霸', EMPEROR: '狗皇帝' }
const dogTraits: Record<DogType, string> = {
  SHIBA: '20% 概率改掷为【小点】 1/2/3',
  SAMOYED: '20% 概率改掷为【大点】 4/5/6',
  MUTT: '20% 概率【额外投掷】一次',
  BULLY: '40% 概率使本次触发的【大型物品】效果翻倍',
  EMPEROR: '指定【天命数字】，命中时 50% 概率使触发效果翻倍',
}
const dogAssets: Record<DogType, string> = {
  SHIBA: '/assets/dogs/shiba.webp',
  SAMOYED: '/assets/dogs/samoyed.webp',
  MUTT: '/assets/dogs/mutt.webp',
  BULLY: '/assets/dogs/bully.webp',
  EMPEROR: '/assets/dogs/emperor.webp',
}
const dogBrawlTownBackground = '/assets/backgrounds/dog-brawl-town.jpg'
const visualThemeAssets: Record<VisualThemeId, string> = {
  dogPark: dogBrawlTownBackground,
  backAlley: dogBrawlTownBackground,
  royalKennel: dogBrawlTownBackground,
}
const surpriseBackgrounds: Record<SurpriseBackgroundId, string> = {
  classReward: '/assets/backgrounds/canine-fighting-study.png',
  settlement: '/assets/backgrounds/canine-anatomy-run.png',
  enchant: '/assets/backgrounds/canine-comparative-anatomy.png',
}
const visualThemeOrder: VisualThemeId[] = ['dogPark', 'backAlley', 'royalKennel']
const gameIcon = '/assets/game-icon.png'
const backgroundMusicSrc = '/assets/audio/the-final-inventory.mp3'
const musicPreferenceKey = 'dogfight:background-music'
const casualTutorialStoragePrefix = 'dogfight:tutorial:casual-core:'
const defaultCasualTutorialState: CasualTutorialState = { status: 'idle', stepId: 'LOBBY' }
const casualTutorialSteps: Record<CasualTutorialStepId, { title: string; body: string; task: string; anchor: string }> = {
  LOBBY: {
    title: '新手引导',
    body: '先从休闲模式熟悉一局，不影响天梯。',
    task: '点击开始休闲模式。',
    anchor: 'mode-casual',
  },
  DOG_SELECT: {
    title: '选择狗狗',
    body: '每只狗都有被动。第一次可以直接用默认柴犬开始。',
    task: '选择一只狗，然后开始一局。',
    anchor: 'dog-select',
  },
  SHOP_INSPECT: {
    title: '查看商品',
    body: '点商品看触发点数、占格和效果，再决定买不买。',
    task: '点击任意商品卡。',
    anchor: 'shop-offers',
  },
  SHOP_BUY: {
    title: '购买装备',
    body: '买来的装备会先进入背包。',
    task: '点击购买到背包。',
    anchor: 'shop-buy',
  },
  PLACE_ITEM: {
    title: '摆到装备栏',
    body: '装备放进装备栏才会在战斗中生效；从左到右展示。',
    task: '把新买的装备拖到装备栏，或者直接匹配继续。',
    anchor: 'equipment-board',
  },
  MATCH: {
    title: '匹配对手',
    body: '准备好后找一个接近强度的对手。',
    task: '点击匹配。',
    anchor: 'match-button',
  },
  BATTLE_WATCH: {
    title: '观看自动战斗',
    body: '战斗自动播放，骰子点数会触发对应装备。',
    task: '点击开始战斗，然后观察骰子和装备高亮。',
    anchor: 'battle-start',
  },
  CONTINUE: {
    title: '进入下一回合',
    body: '战斗后会获得金币并进入下一回合，重复购买、摆放、匹配。',
    task: '点击继续。',
    anchor: 'battle-continue',
  },
}

function createDefaultAccount() {
  return `player-${Math.floor(100000 + Math.random() * 900000)}`
}

function casualTutorialStorageKey(userId: string) {
  return `${casualTutorialStoragePrefix}${userId}`
}

function readCasualTutorialState(userId: string): CasualTutorialState {
  try {
    const raw = window.localStorage.getItem(casualTutorialStorageKey(userId))
    if (!raw) return defaultCasualTutorialState
    const parsed = JSON.parse(raw) as Partial<CasualTutorialState>
    if (!parsed.status || !parsed.stepId) return defaultCasualTutorialState
    if (!Object.keys(casualTutorialSteps).includes(parsed.stepId)) return defaultCasualTutorialState
    if (!['idle', 'active', 'completed', 'skipped', 'replaying'].includes(parsed.status)) return defaultCasualTutorialState
    return { status: parsed.status, stepId: parsed.stepId }
  } catch {
    return defaultCasualTutorialState
  }
}

function saveCasualTutorialState(userId: string, nextState: CasualTutorialState) {
  window.localStorage.setItem(casualTutorialStorageKey(userId), JSON.stringify(nextState))
}

function shouldAutoStartCasualTutorial(userId: string) {
  const state = readCasualTutorialState(userId)
  return state.status !== 'completed' && state.status !== 'skipped'
}

function isCasualTutorialRunning(state: CasualTutorialState) {
  return state.status === 'active' || state.status === 'replaying'
}

function isStarterItem(item: Item) {
  return item.defId.startsWith('starter-')
}

function visualThemeForRound(round: number): VisualThemeId {
  const normalizedRound = Math.max(1, Math.floor(Number.isFinite(round) ? round : 1))
  return visualThemeOrder[(normalizedRound - 1) % visualThemeOrder.length]
}

function visualThemeStyle(visualTheme: VisualThemeId) {
  return { '--theme-bg': `url("${visualThemeAssets[visualTheme]}")` } as React.CSSProperties
}

function surpriseBackgroundStyle(background: SurpriseBackgroundId) {
  return { '--surprise-bg': `url("${surpriseBackgrounds[background]}")` } as React.CSSProperties
}

function hasBoughtTutorialItem(run: Run | null) {
  return Boolean(run?.items.some((item) => !isStarterItem(item)))
}

function hasPlacedTutorialItem(run: Run | null) {
  return Boolean(run?.items.some((item) => !isStarterItem(item) && item.area === 'EQUIPMENT'))
}

function battlePlaybackFinished(battle: Battle | null, eventIndex: number) {
  return Boolean(battle && eventIndex >= battle.events.length - 1)
}

function resolveCasualTutorialStep(input: {
  appScreen: AppScreen
  run: Run | null
  battle: Battle | null
  eventIndex: number
  offerInspected: boolean
  bought: boolean
  placed: boolean
}): CasualTutorialStepId {
  if (input.appScreen === 'LOBBY') return 'LOBBY'
  if (!input.run) return 'DOG_SELECT'
  if (input.battle && battlePlaybackFinished(input.battle, input.eventIndex)) return 'CONTINUE'
  if (input.battle || input.run.phase === 'MATCH' || input.run.phase === 'BATTLE') return 'BATTLE_WATCH'
  if (input.run.phase === 'PREP') return 'MATCH'
  if (input.run.phase === 'SHOP') {
    if (!input.offerInspected) return 'SHOP_INSPECT'
    if (!input.bought && !hasBoughtTutorialItem(input.run)) return 'SHOP_BUY'
    if (!input.placed && !hasPlacedTutorialItem(input.run)) return 'PLACE_ITEM'
    return 'MATCH'
  }
  if (input.run.phase === 'CLASS_REWARD' || input.run.phase === 'RELIC_CHOICE' || input.run.phase === 'UPGRADE_CHOICE' || input.run.phase === 'POTION_CHOICE' || input.run.phase === 'ENCHANT_CHOICE' || input.run.phase === 'CHOICE') return 'MATCH'
  return 'MATCH'
}
const shopNames: Record<ShopType, string> = {
  GENERAL: '通用商店',
  LARGE: '大物品商店',
  MEDIUM: '中物品商店',
  SMALL: '小物品商店',
  SMALL_DICE: '小点商店',
  BIG_DICE: '大点商店',
  RELIC: '遗物商店',
  UPGRADE: '升级商店',
  POTION: '药水商店',
}
const itemIcons: Record<string, string> = {
  'starter-1': '/assets/items/bite.svg',
  'starter-2': '/assets/items/bite.svg',
  'starter-3': '/assets/items/bite.svg',
  'starter-4': '/assets/items/bite.svg',
  'starter-5': '/assets/items/bite.svg',
  'starter-6': '/assets/items/bite.svg',
  'small-bite': '/assets/items/small-bite.svg',
  'lucky-paw': '/assets/items/lucky-paw.svg',
  'milk-bone': '/assets/items/milk-bone.svg',
  'rubber-ball': '/assets/items/rubber-ball.svg',
  'spiked-collar': '/assets/items/spiked-collar.svg',
  'training-disc': '/assets/items/training-disc.svg',
  'guard-vest': '/assets/items/guard-vest.svg',
  'giant-bone': '/assets/items/giant-bone.svg',
  'dog-house': '/assets/items/dog-house.svg',
  'dog-gold-ingot': '/assets/items/dog-gold-ingot.svg',
  'dog-silver-ingot': '/assets/items/dog-silver-ingot.svg',
  'patting-bear': '/assets/items/patting-bear.svg',
  'poisoned-dog-fang': '/assets/items/poisoned-dog-fang.svg',
  'v3-broken-canine': '/assets/items/v3-broken-canine.svg',
  'v3-chew-scratch-post': '/assets/items/v3-chew-scratch-post.svg',
  'v3-cone-collar': '/assets/items/v3-cone-collar.svg',
  'v3-dog-catnip': '/assets/items/v3-dog-catnip.svg',
  'v3-flea-disc': '/assets/items/v3-flea-disc.svg',
  'v3-large-bone-sword': '/assets/items/v3-large-bone-sword.svg',
  'v3-wooden-shield': '/assets/items/v3-wooden-shield.svg',
  'v3-spiked-vest': '/assets/items/v3-spiked-vest.svg',
  'v3-hydrant-axe': '/assets/items/v3-hydrant-axe.svg',
  'v3-dinosaur-leg-bone': '/assets/items/v3-dinosaur-leg-bone.svg',
  'v3-auto-waterer': '/assets/items/v3-auto-waterer.svg',
  'v3-night-patrol-light': '/assets/items/v3-night-patrol-light.svg',
  'v3-blood-mad-fang': '/assets/items/v3-blood-mad-fang.svg',
  'v3-fermented-trash-bin': '/assets/items/v3-fermented-trash-bin.svg',
  'v3-golden-kennel': '/assets/items/v3-golden-kennel.svg',
  'v4-blood-contract-fang': '/assets/items/v4-blood-contract-fang.svg',
  'v4-boom-counter': '/assets/items/v4-boom-counter.svg',
  'v4-growing-chew-sword': '/assets/items/v4-growing-chew-sword.svg',
  'v4-reverse-fur-comb': '/assets/items/v4-reverse-fur-comb.svg',
  'shiba-speed-katana': '/assets/items/shiba-speed-katana.svg',
  'shiba-great-katana': '/assets/items/shiba-great-katana.svg',
  'shiba-swallow-katana': '/assets/items/shiba-swallow-katana.svg',
  'shiba-shadow-clone': '/assets/items/shiba-shadow-clone.svg',
  'shiba-break': '/assets/items/shiba-break.svg',
  'shiba-poison': '/assets/items/shiba-poison.svg',
  'samoyed-soft-fur': '/assets/items/samoyed-soft-fur.svg',
  'samoyed-thorn-fur': '/assets/items/samoyed-thorn-fur.svg',
  'samoyed-frost-fur': '/assets/items/samoyed-frost-fur.svg',
  'samoyed-avalanche-core': '/assets/items/samoyed-avalanche-core.svg',
  'samoyed-absolute-zero': '/assets/items/samoyed-absolute-zero.svg',
  'samoyed-cold-proof': '/assets/items/samoyed-cold-proof.svg',
  'mutt-old-collar': '/assets/items/mutt-old-collar.svg',
  'mutt-counting-collar': '/assets/items/mutt-counting-collar.svg',
  'mutt-charged-collar': '/assets/items/mutt-charged-collar.svg',
  'mutt-chase-tail': '/assets/items/mutt-chase-tail.svg',
  'mutt-chase-car': '/assets/items/mutt-chase-car.svg',
  'mutt-eat-air': '/assets/items/mutt-eat-air.svg',
  'bully-vault': '/assets/items/bully-vault.svg',
  'bully-gym': '/assets/items/bully-gym.svg',
  'bully-armband': '/assets/items/bully-armband.svg',
  'bully-sacrifice': '/assets/items/bully-sacrifice.svg',
  'bully-colossus': '/assets/items/bully-colossus.svg',
  'bully-demolish': '/assets/items/bully-demolish.svg',
  'emperor-dice-cup': '/assets/items/emperor-dice-cup.svg',
  'emperor-minister': '/assets/items/emperor-minister.svg',
  'emperor-robe': '/assets/items/emperor-robe.svg',
  'emperor-curtain': '/assets/items/emperor-curtain.svg',
  'emperor-edict': '/assets/items/emperor-edict.svg',
  'emperor-fallen': '/assets/items/emperor-fallen.svg',
}
const relicIcons: Record<string, string> = {
  'midas-left': '/assets/relics/midas-left.svg',
  'midas-right': '/assets/relics/midas-right.svg',
  'half-die-left': '/assets/relics/half-die-left.svg',
  'half-die-right': '/assets/relics/half-die-right.svg',
  'carrot': '/assets/relics/carrot.svg',
  'tissue': '/assets/relics/tissue.svg',
  'v3-two-sided-gold-tag': '/assets/relics/v3-two-sided-gold-tag.svg',
  'v3-balanced-food-bowl': '/assets/relics/v3-balanced-food-bowl.svg',
  'v3-lucky-foxtail': '/assets/relics/v3-lucky-foxtail.svg',
  'v3-bad-dog-manual': '/assets/relics/v3-bad-dog-manual.svg',
  'v3-fluffed-spike-collar': '/assets/relics/v3-fluffed-spike-collar.svg',
  'v3-husky-engine': '/assets/relics/v3-husky-engine.svg',
  'v3-fourth-dimensional-kennel': '/assets/relics/v3-fourth-dimensional-kennel.svg',
}
const qualityOrder: ItemQuality[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']
const qualityLabel: Record<ItemQuality, string> = {
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  DIAMOND: '钻石',
}
const qualityPriceMultiplier: Record<ItemQuality, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 4,
  DIAMOND: 8,
}
const DOG_SELECTION_SLOT_COUNT = 8
const BASE_EQUIPMENT_SLOT_COUNT = 12
const EXTRA_EQUIPMENT_SLOT_COUNT = 13
const BASE_MAX_HP = 100
const EARLY_ROUND_HP_GROWTH = 20
const LATE_ROUND_HP_GROWTH = 50
const EARLY_HP_GROWTH_ROUNDS = 6
const emptyRunHistory: PlayerRunHistory = {
  totalRuns: 0,
  activeRuns: 0,
  completedRuns: 0,
  abandonedRuns: 0,
  totalWins: 0,
  totalLosses: 0,
  bestRun: null,
  recentRuns: [],
}
const historyModeTabs: Array<{ id: HistoryModeTab; label: string }> = [
  { id: 'ALL', label: '全部' },
  { id: 'CASUAL', label: '休闲模式' },
  { id: 'DOGFIGHT', label: '斗狗模式' },
  { id: 'PEAK', label: '巅峰模式' },
  { id: 'LADDER', label: '天梯模式' },
]
const ladderTierLabel: Record<LadderTier, string> = {
  BRONZE: '青铜',
  SILVER: '白银',
  GOLD: '黄金',
  PLATINUM: '白金',
  DIAMOND: '钻石',
  MASTER: '大师',
  DOG_KING: '犬王',
}
const dogOptions: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR']
const shopChoiceOrder: ShopType[] = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE', 'RELIC', 'UPGRADE', 'POTION']
const SHOP_CHOICE_SLOT_COUNT = shopChoiceOrder.length
const dogStrategies: Record<DogType, string> = {
  SHIBA: '适合新手，专注于持续输出伤害',
  SAMOYED: '适合押【大点】构筑，爆发窗口更集中',
  MUTT: '适合随机和连击构筑，上限更高但波动更大',
  BULLY: '适合【大型物品】构筑，围绕 4 格道具打爆发',
  EMPEROR: '适合围绕一个核心点数堆叠道具，命中【天命数字】时有爆发上限',
}
const dogTags: Record<DogType, string[]> = {
  SHIBA: ['进攻', '简单'],
  SAMOYED: ['爆发', '中等'],
  MUTT: ['随机', '困难'],
  BULLY: ['大型', '爆发'],
  EMPEROR: ['幸运', '爆发'],
}
const shopDescriptions: Record<ShopType, string> = {
  GENERAL: '提供各类基础道具，适合补齐构筑短板',
  LARGE: '提供高占格高收益道具，适合大件路线',
  MEDIUM: '提供稳定中型道具，适合均衡过渡',
  SMALL: '提供低占格道具，适合填补装备缝隙',
  SMALL_DICE: '偏向【小点】触发道具，适合【小点】战术',
  BIG_DICE: '偏向【大点】触发道具，适合高点爆发',
  RELIC: '免费选择一个遗物，强化骰子倾向和触发频率',
  UPGRADE: '免费选择一件未达到钻石的装备，直接提升 1 个品质',
  POTION: '三选一药水，修改一件非职业装备的基础触发点数',
}
const ruleTerms = Object.fromEntries(TERM_DEFS.map((term) => [term.term, term]))
const statusTipId = 'battle-status-tip'
const STATUS_THORNS_DAMAGE_PER_STACK = 2
const STATUS_FURY_DAMAGE_PER_STACK = 1
const STATUS_SPEED_REDUCTION_PER_STACK = 0.1
const statusTipDetails: Record<string, { polarity: '正面效果' | '负面效果'; timing: string; description: string; source: string }> = {
  shield: {
    polarity: '正面效果',
    timing: '受到伤害时优先结算',
    description: '【护盾】会先吸收即将受到的普通伤害；不会被小狗窝偷取，但可被部分【净化】效果按每 8 点折算清除。',
    source: '常见来源：【护盾】类装备、职业道具和遗物。',
  },
  thorns: {
    polarity: '正面效果',
    timing: '受到直接伤害后触发',
    description: '【荆棘】会在被直接攻击后对攻击方造成反伤。层数越高，反伤能力越强。',
    source: '常见来源：【荆棘】、反伤和防御类装备。',
  },
  extraRoll: {
    polarity: '正面效果',
    timing: '后续投骰或触发时消耗',
    description: '【加速】会缩短后续基础投掷间隔。显示的层数代表当前投掷频率提升强度。',
    source: '常见来源：【加速】、连击和额外触发类效果。',
  },
  fury: {
    polarity: '正面效果',
    timing: '后续攻击或造成伤害时生效',
    description: '【激昂】会强化后续攻击伤害。显示的层数代表当前增幅强度。',
    source: '常见来源：【激昂】、狂怒和进攻类装备。',
  },
  poison: {
    polarity: '负面效果',
    timing: '持续结算时造成伤害',
    description: '【中毒】每秒结算 1 次，芯片上的层数表示毒性强度，倒计时提示下一次毒伤时机。',
    source: '常见来源：毒刃、毒牙和持续伤害类装备。',
  },
  weak: {
    polarity: '负面效果',
    timing: '造成伤害时生效',
    description: '【虚弱】会让下次攻击伤害降低，层数表示还可消耗多少次。',
    source: '常见来源：削弱、压制和控制类效果。',
  },
  wound: {
    polarity: '负面效果',
    timing: '受到直接攻击时生效',
    description: '【伤口】会让受到的直接攻击伤害提高，层数越高，被攻击时额外受到的伤害越高。',
    source: '常见来源：拍拍熊。',
  },
  freeze: {
    polarity: '负面效果',
    timing: '行动或触发前检查',
    description: '【冻结】期间会跳过投掷和装备触发。显示的剩余时间代表控制还会持续多久。',
    source: '常见来源：冰冻、寒冷和控制类装备。',
  },
  disabled: {
    polarity: '负面效果',
    timing: '装备或效果触发前检查',
    description: '【失效】会让指定装备或大型装备的触发被抵消。显示的次数代表还会抵消多少次触发。',
    source: '常见来源：缴械、破坏和反制类效果。',
  },
}

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  const res = await fetch(`/api${url}`, { credentials: 'include', headers, ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || '请求失败')
  return data
}

function itemTone(def: ItemDef) {
  if (def.tags.includes('starter')) return 'starter'
  if (def.tags.includes('heal')) return 'heal'
  if (def.tags.includes('large')) return 'large'
  if (def.tags.includes('big')) return 'big'
  return 'utility'
}

function itemIcon(def: ItemDef) {
  return itemIcons[def.id] ?? '/assets/items/bite.svg'
}

function relicIcon(def: RelicDef) {
  return relicIcons[def.id] ?? '/assets/relics/v3-two-sided-gold-tag.svg'
}

function normalizeQuality(quality?: string): ItemQuality {
  return qualityOrder.includes(quality as ItemQuality) ? quality as ItemQuality : 'BRONZE'
}

function qualityClass(quality?: string) {
  return `quality-${normalizeQuality(quality).toLowerCase()}`
}

function qualityAmountFrom(amount: number, quality?: string, baseQuality?: string) {
  return Math.round(amount * (1.5 ** qualityOrder.indexOf(normalizeQuality(quality))) / (1.5 ** qualityOrder.indexOf(normalizeQuality(baseQuality))))
}

function equipmentSlotCount(relics?: Relic[]) {
  return relics?.some((relic) => relic.def.effect === 'EXTRA_EQUIPMENT_REDUCED_EFFECT') ? EXTRA_EQUIPMENT_SLOT_COUNT : BASE_EQUIPMENT_SLOT_COUNT
}

function itemTriggerDisplay(item: Item) {
  return { ...item.def, triggerDiceOverride: item.triggerDiceOverride }
}

function battleEquipmentItems(snapshot: BattleSnapshot) {
  return snapshot.items.filter((item) => item.area === 'EQUIPMENT').sort((left, right) => left.x - right.x || left.y - right.y)
}

function adjacentBattleItems(snapshot: BattleSnapshot, source: Item) {
  return battleEquipmentItems(snapshot).filter((item) => item.id !== source.id && Math.abs(item.x - source.x) <= source.def.width)
}

function touchingAdjacentBattleItems(snapshot: BattleSnapshot, source: Item) {
  const sourceLeft = source.x
  const sourceRight = source.x + source.def.width
  return battleEquipmentItems(snapshot).filter((item) => {
    if (item.id === source.id) return false
    const itemLeft = item.x
    const itemRight = item.x + item.def.width
    return itemRight === sourceLeft || itemLeft === sourceRight
  })
}

function leftAdjacentBattleItems(snapshot: BattleSnapshot, source: Item) {
  const sourceLeft = source.x
  return battleEquipmentItems(snapshot).filter((item) => item.id !== source.id && item.x + item.def.width === sourceLeft)
}

function rightmostBattleItem(snapshot: BattleSnapshot) {
  return battleEquipmentItems(snapshot).at(-1) ?? null
}

function targetEquipmentItemsForBattleEvent(event: BattleEvent, player: BattleSnapshot, opponent: BattleSnapshot): { owner: 'player' | 'opponent' | null; itemIds: string[] } {
  if (event.kind !== 'ITEM' || !event.itemId) return { owner: null, itemIds: [] }
  const actorSnapshot = event.actor === 'player' ? player : event.actor === 'opponent' ? opponent : null
  const targetOwner = event.target === 'player' || event.target === 'opponent'
    ? event.target
    : event.actor === 'player'
      ? 'opponent'
      : event.actor === 'opponent'
        ? 'player'
        : null
  const targetSnapshot = targetOwner === 'player' ? player : targetOwner === 'opponent' ? opponent : null
  const sourceItem = actorSnapshot?.items.find((item) => item.id === event.itemId) ?? null
  const advancedEffect = sourceItem?.def.advancedEffect

  if (event.targetItemId && targetOwner) return { owner: targetOwner, itemIds: [event.targetItemId] }

  if (targetSnapshot && event.text.includes('最右侧装备')) {
    const rightmost = rightmostBattleItem(targetSnapshot)
    return rightmost ? { owner: targetOwner, itemIds: [rightmost.id] } : { owner: null, itemIds: [] }
  }

  if (actorSnapshot && sourceItem && advancedEffect === 'GRANT_LIFESTEAL_ADJACENT') {
    const owner = event.actor === 'player' || event.actor === 'opponent' ? event.actor : null
    const targets = normalizeQuality(sourceItem.quality) === 'DIAMOND' ? touchingAdjacentBattleItems(actorSnapshot, sourceItem) : leftAdjacentBattleItems(actorSnapshot, sourceItem)
    return { owner, itemIds: targets.map((item) => item.id) }
  }

  if (actorSnapshot && sourceItem && (advancedEffect === 'TRIGGER_ADJACENT' || event.text.includes('相邻'))) {
    const owner = event.actor === 'player' || event.actor === 'opponent' ? event.actor : null
    return { owner, itemIds: adjacentBattleItems(actorSnapshot, sourceItem).map((item) => item.id) }
  }

  return { owner: null, itemIds: [] }
}

function battlePresentationWithEquipmentTarget(presentation: PresentationEvent | null, targetEquipment: { owner: 'player' | 'opponent' | null; itemIds: string[] }): PresentationEvent | null {
  const targetItemId = targetEquipment.itemIds[0]
  if (!presentation || !targetEquipment.owner || !targetItemId) return presentation
  return {
    ...presentation,
    target: { anchor: 'equipment-row', side: targetEquipment.owner, id: targetItemId },
  }
}

function battleVfxKind(event?: BattleEvent): BattleVfxKind {
  return createBattlePresentation(event).kind
}

function battleVfxTargetSide(event?: BattleEvent): 'player' | 'opponent' | null {
  return battlePresentationTargetSide(event, battleVfxKind(event))
}

function battleVfxAnchorAttrs(anchor: FeedbackAnchor, side: 'player' | 'opponent' | 'system', itemId?: string): BattleVfxAnchorAttrs {
  return {
    'data-vfx-anchor': anchor,
    'data-vfx-side': side,
    ...(itemId ? { 'data-vfx-item-id': itemId } : {}),
  }
}

const battleVfxStyles: Record<BattleVfxKind, BattleVfxStyle> = {
  none: { kind: 'none', color: '#8b735d', accent: '#fff4e4', prefix: '', particleCount: 0 },
  roll: { kind: 'roll', color: '#5a84f6', accent: '#ffe08a', prefix: '', particleCount: 18 },
  damage: { kind: 'damage', color: '#ef4444', accent: '#fbbf24', prefix: '-', particleCount: 40 },
  heal: { kind: 'heal', color: '#16a34a', accent: '#86efac', prefix: '+', particleCount: 34 },
  shield: { kind: 'shield', color: '#2563eb', accent: '#93c5fd', prefix: '+', particleCount: 32 },
  poison: { kind: 'poison', color: '#22c55e', accent: '#a7f3d0', prefix: '+', particleCount: 46 },
  weak: { kind: 'weak', color: '#7c3aed', accent: '#ddd6fe', prefix: '', particleCount: 30 },
  freeze: { kind: 'freeze', color: '#38bdf8', accent: '#dbeafe', prefix: '', particleCount: 32 },
  thorns: { kind: 'thorns', color: '#b7791f', accent: '#fde68a', prefix: '+', particleCount: 34 },
  miss: { kind: 'miss', color: '#8b735d', accent: '#e7d7c4', prefix: '', particleCount: 18 },
  utility: { kind: 'utility', color: '#5a84f6', accent: '#bfdbfe', prefix: '', particleCount: 28 },
}

function createBattleFxStyle(event: BattleEvent) {
  return battleVfxStyles[battleVfxKind(event)]
}

function effectText(def: ItemDef, quality: ItemQuality = 'BRONZE') {
  const amount = qualityAmountFrom(def.effect.amount, quality, def.effect.qualityBase)
  if (def.advancedEffect === 'GRANT_LIFESTEAL_ADJACENT') return quality === 'DIAMOND' ? '左右【相邻】装备获得【吸血】' : '左侧【相邻】装备获得【吸血】'
  if (def.advancedEffect === 'BOOM_COUNTER') return `只能通过计数触发，达到 ${BOOM_COUNTER_TRIGGER_THRESHOLD} 后造成 ${amount} 伤害`
  if (def.advancedEffect === 'GROWTH_DAMAGE') return `造成 ${amount} 伤害，后续伤害提升`
  if (def.advancedEffect === 'PURGE_ENEMY_BUFFS') return '清除敌方增益并恢复生命'
  if (def.advancedEffect === 'APPLY_WOUND') return `叠加 ${amount} 层【伤口】`
  if (def.effect.type === 'HEAL') return `回复 ${amount} 生命`
  if (def.effect.type === 'DAMAGE' || def.effect.type === 'DAMAGE_SELF_SHIELD') return `造成 ${amount} 伤害`
  if (def.effect.type === 'UTILITY') {
    if (def.tags.includes('shield')) return `获得 ${amount} 点【护盾】`
    if (def.tags.includes('poison')) return `施加 ${amount} 层【中毒】`
    if (def.tags.includes('weak')) return `施加 ${amount} 层【虚弱】`
    if (def.tags.includes('cleanse')) return `回复 ${amount} 生命`
    if (amount > 0) return `效果 ${amount}`
  }
  return '特殊效果'
}

function growthDamageTextForBattleItem(item: Item, owner: 'player' | 'opponent', events: BattleEvent[], displayIndex: number) {
  if (item.def.advancedEffect !== 'GROWTH_DAMAGE') return null
  const baseDamage = qualityAmountFrom(item.def.effect.amount, item.quality, item.def.effect.qualityBase)
  const growth = events.slice(0, displayIndex + 1).reduce((total, event) => {
    if (
      event.actor === owner
      && event.kind === 'ITEM'
      && event.itemId === item.id
      && event.defId === item.defId
      && event.effectType === 'UTILITY'
    ) {
      return total + (event.amount ?? 0)
    }
    return total
  }, 0)
  return `当前伤害 ${baseDamage + growth}；每次成功触发后，本局内后续伤害继续提升。`
}

function boomCounterStateForBattleItem(item: Item, owner: 'player' | 'opponent', events: BattleEvent[], displayIndex: number, activeEvent?: BattleEvent) {
  if (item.def.advancedEffect !== 'BOOM_COUNTER') return null
  const latest = events.slice(0, displayIndex + 1).reverse().find((event) => event.actor === owner && event.boomCounterItemId === item.id)
  const max = latest?.boomCounterMax ?? BOOM_COUNTER_TRIGGER_THRESHOLD
  const count = Math.max(0, Math.min(max, latest?.boomCounterValue ?? 0))
  const progress = max > 0 ? Math.round((count / max) * 100) : 0
  const popping = activeEvent?.actor === owner && activeEvent.boomCounterItemId === item.id && activeEvent.boomCounterChanged === true
  return { count, max, progress, popping }
}

function enchantmentText(enchant?: Enchantment | null) {
  if (!enchant) return ''
  if (enchant.kind === 'EXTRA_DICE') return `附魔：额外在 ${enchant.dice.join('/')} 点触发`
  if (enchant.kind === 'BASE_EFFECT') {
    const effect = enchant.effect === 'DAMAGE' ? '造成伤害' : enchant.effect === 'HEAL' ? '回复生命' : '获得护盾'
    return `附魔：触发时额外${effect} ${enchant.amount}`
  }
  if (enchant.kind === 'SPECIAL') {
    const effect = enchant.effect === 'THORNS' ? '荆棘' : enchant.effect === 'FURY' ? '激昂' : enchant.effect === 'POISON' ? '中毒' : '虚弱'
    return `附魔：触发时额外触发 ${enchant.amount} 层${effect}`
  }
  const target = enchant.target === 'LEFT' ? '左侧' : enchant.target === 'RIGHT' ? '右侧' : '相邻'
  if (enchant.kind === 'TRIGGER_NEIGHBOR') return `附魔：触发时额外触发${target}装备`
  if (enchant.kind === 'BUFF_NEIGHBOR_EFFECT') {
    const effect = enchant.effect === 'DAMAGE' ? '攻击' : enchant.effect === 'HEAL' ? '回复生命' : '增加护盾'
    return `附魔：触发时使${target}装备下次${effect} +${enchant.amount}`
  }
  const effect = enchant.effect === 'LIFESTEAL' ? '吸血' : enchant.effect === 'THORNS' ? '荆棘' : '净化'
  return `附魔：触发时使${target}装备获得${effect} ${enchant.amount}`
}

function purchaseValueForItem(def: ItemDef, quality: ItemQuality = normalizeQuality(def.defaultQuality)) {
  const currentQuality = normalizeQuality(quality)
  return Math.floor(def.price * qualityPriceMultiplier[currentQuality])
}

function sellValueForItem(item: Item) {
  return Math.floor(purchaseValueForItem(item.def, item.quality) / 2) + (item.sellBonus ?? 0)
}

function maxHealthForRound(round: number) {
  const completedRounds = Math.max(0, Math.floor(round))
  const earlyRounds = Math.min(completedRounds, EARLY_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function dogfightPhaseLabel(phase: DogfightRoomPhase) {
  if (phase === 'LOBBY') return '等待开局'
  if (phase === 'DOG_SELECT') return '选狗阶段'
  if (phase === 'SHOP') return '商店阶段'
  if (phase === 'BATTLE') return '战斗阶段'
  return '房间结束'
}

function dogfightLives(member: DogfightMember) {
  return member.eliminated ? 0 : Math.max(0, 5 - member.losses)
}

function sortedDogfightMembers(members: DogfightMember[]) {
  return members.slice().sort((left, right) => {
    const leftLives = dogfightLives(left)
    const rightLives = dogfightLives(right)
    return rightLives - leftLives
      || right.wins - left.wins
      || (left.kind === right.kind ? 0 : left.kind === 'PLAYER' ? -1 : 1)
      || left.nickname.localeCompare(right.nickname)
  })
}

function diceToneText(def: ItemDef) {
  const min = Math.min(...def.dice)
  const max = Math.max(...def.dice)
  if (max <= 3) return '小点'
  if (min >= 4) return '大点'
  return '混合'
}

function effectToneText(def: ItemDef) {
  if (def.advancedEffect === 'GRANT_LIFESTEAL_ADJACENT') return '吸血'
  if (def.advancedEffect === 'BOOM_COUNTER') return '爆鸣计数'
  if (def.advancedEffect === 'GROWTH_DAMAGE') return '后续伤害'
  if (def.advancedEffect === 'PURGE_ENEMY_BUFFS') return '清除'
  if (def.advancedEffect === 'APPLY_WOUND') return '伤口'
  if (def.effect.type === 'HEAL') return '回复'
  if (def.effect.type === 'UTILITY') {
    if (def.tags.includes('shield')) return '护盾'
    if (def.tags.includes('poison')) return '中毒'
    if (def.tags.includes('weak')) return '虚弱'
    if (def.tags.includes('cleanse')) return '净化'
    return '特殊'
  }
  return '攻击'
}

function canUpgradeItem(item: Item, items: Item[]) {
  const quality = normalizeQuality(item.quality)
  return quality !== 'DIAMOND' && items.some((entry) => entry.id !== item.id && entry.defId === item.defId && normalizeQuality(entry.quality) === quality)
}

function canFreeUpgradeItem(item: Item) {
  return normalizeQuality(item.quality) !== 'DIAMOND'
}

function canUpgradeDrop(source: Item | undefined, target: Item | undefined) {
  if (!source || !target || source.id === target.id) return false
  const quality = normalizeQuality(source.quality)
  return quality !== 'DIAMOND' && source.defId === target.defId && normalizeQuality(target.quality) === quality
}

function shopOfferOwnedCount(run: Run, offer: ShopOffer) {
  return run.items.filter((item) => item.defId === offer.defId).length
}

function parseSlotId(id: string) {
  const [area, x, y] = id.split(':')
  if ((area !== 'EQUIPMENT' && area !== 'BAG') || x == null || y == null) return null
  return { area: area as Area, x: Number(x), y: Number(y) }
}

function gridWidthForArea(run: Run, area: Area) {
  return area === 'EQUIPMENT' ? equipmentSlotCount(run.relics) : BASE_EQUIPMENT_SLOT_COUNT
}

function resolveRunSlotPlacement(run: Run, itemId: string, area: Area, x: number, y: number) {
  return resolveSlotPlacement(run.items, itemId, area, x, y, gridWidthForArea(run, area))
}

function getFloatingTipPosition(element: HTMLElement): TipAnchor {
  const rect = element.getBoundingClientRect()
  const gap = 12
  const edge = 14
  const tipWidth = Math.min(380, window.innerWidth - edge * 2)
  const tipHeight = Math.min(440, window.innerHeight - edge * 2)
  const rightX = rect.right + gap
  const leftX = rect.left - tipWidth - gap
  const x = rightX + tipWidth <= window.innerWidth - edge ? rightX : Math.max(edge, leftX)
  const centeredY = rect.top + rect.height / 2 - tipHeight / 2
  const y = Math.min(Math.max(edge, centeredY), Math.max(edge, window.innerHeight - tipHeight - edge))
  return { x, y }
}

function getRuleTermTipPosition(element: HTMLElement): Pick<RuleTermTipState, 'anchor' | 'placement'> {
  const rect = element.getBoundingClientRect()
  const edge = 16
  const gap = 8
  const tipWidth = Math.min(260, window.innerWidth - edge * 2)
  const estimatedTipHeight = 136
  const x = Math.min(Math.max(edge, rect.left), Math.max(edge, window.innerWidth - tipWidth - edge))
  const placement = rect.top - estimatedTipHeight - gap >= edge ? 'above' : 'below'
  const y = placement === 'above' ? Math.max(edge, rect.top - gap) : Math.min(window.innerHeight - edge, rect.bottom + gap)
  return { anchor: { x, y }, placement }
}

function useOutsideTipDismiss(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.floating-tip, .rule-tip')) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [active, onClose])
}

function RuleText({ text }: { text: string }) {
  const [openTerm, setOpenTerm] = useState<RuleTermTipState | null>(null)
  const ruleTermStart = String.fromCharCode(0x3010)
  const ruleTermEnd = String.fromCharCode(0x3011)
  const parts = text.split(/(【[^】]+】)/g).filter(Boolean)
  return (
    <>
      {parts.map((part, index) => {
        if (!part.startsWith(ruleTermStart) || !part.endsWith(ruleTermEnd)) return <span key={`${part}-${index}`}>{part}</span>
        const term = part.slice(1, -1)
        const entry = ruleTerms[term]
        if (!entry) return <strong key={`${term}-${index}`}>【{term}】</strong>
        return (
          <span className="rule-term-wrap" key={`${term}-${index}`} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rule-term"
              onClick={(event) => {
                event.stopPropagation()
                const position = getRuleTermTipPosition(event.currentTarget)
                setOpenTerm((current) => {
                  if (current?.term === term) return null
                  return { term, description: entry.description, note: entry.note, ...position }
                })
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              【{term}】
            </button>
          </span>
        )
      })}
      <RuleTermFloatingTip tip={openTerm} />
    </>
  )
}

function RuleTermFloatingTip({ tip }: { tip: RuleTermTipState | null }) {
  if (!tip || typeof document === 'undefined') return null
  const style = {
    '--rule-tip-x': `${tip.anchor.x}px`,
    '--rule-tip-y': `${tip.anchor.y}px`,
  } as React.CSSProperties
  return createPortal(
    <span className={`rule-tip paper-card rule-tip-floating ${tip.placement}`} style={style} role="tooltip" onPointerDown={(event) => event.stopPropagation()}>
      <b>{tip.term}</b>
      <span>{tip.description}</span>
      {tip.note !== '无' && <small>{tip.note}</small>}
    </span>,
    document.body,
  )
}

export default function App() {
  const [account, setAccount] = useState(createDefaultAccount)
  const [password, setPassword] = useState('dogdice')
  const [appScreen, setAppScreen] = useState<AppScreen>('LOBBY')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [needsNicknameSetup, setNeedsNicknameSetup] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedEnchantId, setSelectedEnchantId] = useState<string | null>(null)
  const [selectedPotionId, setSelectedPotionId] = useState<string | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [ceremonyDismissedRounds, setCeremonyDismissedRounds] = useState(() => new Set<string>())
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem(musicPreferenceKey) !== 'off')
  const [musicBlocked, setMusicBlocked] = useState(false)
  const [appHasAudioFocus, setAppHasAudioFocus] = useState(() => !document.hidden && document.hasFocus())
  const [runHistory, setRunHistory] = useState<PlayerRunHistory>(emptyRunHistory)
  const [ladderProfile, setLadderProfile] = useState<LadderProfile | null>(null)
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false)
  const [casualTutorialState, setCasualTutorialState] = useState<CasualTutorialState>(defaultCasualTutorialState)
  const [tutorialOfferInspected, setTutorialOfferInspected] = useState(false)
  const [tutorialBought, setTutorialBought] = useState(false)
  const [tutorialPlaced, setTutorialPlaced] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const hasBattle = Boolean(battle)

  const loadRunHistory = useCallback(async () => {
    const data = await api<{ history: PlayerRunHistory }>('/runs/history')
    setRunHistory(data.history)
  }, [])

  const loadLadderProfile = useCallback(async () => {
    const data = await api<LadderMeResponse>('/ladder/me')
    setLadderProfile(data.profile)
  }, [])

  useEffect(() => {
    api<{ user: AuthUser; activeRun: Run | null }>('/me')
      .then((data) => {
        setUser(data.user)
        setCasualTutorialState(data.user ? readCasualTutorialState(data.user.id) : defaultCasualTutorialState)
        setRun(data.activeRun)
        void loadRunHistory().catch(() => undefined)
        void loadLadderProfile().catch(() => undefined)
      })
      .catch(() => undefined)
  }, [loadLadderProfile, loadRunHistory])

  useEffect(() => {
    if (!run) {
      setTutorialOfferInspected(false)
      setTutorialBought(false)
      setTutorialPlaced(false)
      return
    }
    setTutorialBought(hasBoughtTutorialItem(run))
    setTutorialPlaced(hasPlacedTutorialItem(run))
  }, [run])

  useEffect(() => {
    if (!user || !isCasualTutorialRunning(casualTutorialState)) return
    const stepId = resolveCasualTutorialStep({
      appScreen,
      run: run?.mode === 'CASUAL' ? run : null,
      battle,
      eventIndex,
      offerInspected: tutorialOfferInspected,
      bought: tutorialBought,
      placed: tutorialPlaced,
    })
    if (stepId === casualTutorialState.stepId) return
    const nextState = { ...casualTutorialState, stepId }
    setCasualTutorialState(nextState)
    saveCasualTutorialState(user.id, nextState)
  }, [appScreen, battle, casualTutorialState, eventIndex, run, tutorialBought, tutorialOfferInspected, tutorialPlaced, user])

  useEffect(() => {
    if (!battle) return
    const timer = window.setInterval(() => {
      setEventIndex((value) => Math.min(value + 1, battle.events.length - 1))
    }, 420 / speed)
    return () => window.clearInterval(timer)
  }, [battle, speed])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [run?.id, run?.phase, hasBattle, needsNicknameSetup])

  useEffect(() => {
    const syncPageAudioFocus = () => {
      const appHasAudioFocus = !document.hidden && document.hasFocus()
      setAppHasAudioFocus(appHasAudioFocus)
    }
    document.addEventListener('visibilitychange', syncPageAudioFocus)
    window.addEventListener('focus', syncPageAudioFocus)
    window.addEventListener('blur', syncPageAudioFocus)
    return () => {
      document.removeEventListener('visibilitychange', syncPageAudioFocus)
      window.removeEventListener('focus', syncPageAudioFocus)
      window.removeEventListener('blur', syncPageAudioFocus)
    }
  }, [])

  useEffect(() => {
    if (!user || !appHasAudioFocus) {
      audioRef.current?.pause()
      return
    }

    let audio = audioRef.current
    if (!audio) {
      audio = new Audio(backgroundMusicSrc)
      audio.loop = true
      audio.volume = 0.55
      audioRef.current = audio
    }

    if (!musicEnabled) {
      audio.pause()
      return
    }

    void audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true))
  }, [appHasAudioFocus, musicEnabled, user])

  const selectedItem = run?.items.find((item) => item.id === selectedItemId) || null
  const selectedOffer = run?.shopItems.find((offer) => offer.offerId === selectedOfferId) || null
  const selectedEnchant = run?.phase === 'ENCHANT_CHOICE'
    ? run.enchantChoices.find((choice) => choice.id === selectedEnchantId) ?? run.enchantChoices[0] ?? null
    : null
  const selectedPotion = run?.phase === 'POTION_CHOICE'
    ? run.potionChoices.find((choice) => choice.id === selectedPotionId) ?? run.potionChoices[0] ?? null
    : null
  const draggingItem = run?.items.find((item) => item.id === draggingItemId) || null
  const currentEvent = battle?.events[eventIndex]
  const score = run ? run.wins * 100 + Math.max(0, 12 - run.losses * 2) * 5 : 0
  const classRewardCeremonyKey = run?.phase === 'CLASS_REWARD' ? `${run.id}:${run.round}` : ''
  const showClassRewardCeremony = Boolean(run?.phase === 'CLASS_REWARD' && classRewardCeremonyKey && !ceremonyDismissedRounds.has(classRewardCeremonyKey))
  const enchantCeremonyKey = run?.phase === 'ENCHANT_CHOICE' ? `${run.id}:enchant:${run.round}` : ''
  const showEnchantCeremony = Boolean(run?.phase === 'ENCHANT_CHOICE' && enchantCeremonyKey && !ceremonyDismissedRounds.has(enchantCeremonyKey))
  const [uiFeedbacks, setUiFeedbacks] = useState<UiFeedbackEvent[]>([])

  const pushUiFeedback = useCallback((kind: UiFeedbackKind, label?: string) => {
    const feedback = createUiFeedbackEvent(kind, label)
    playFeedbackSound(soundCueForUiFeedback(kind), { enabled: musicEnabled })
    setUiFeedbacks((current) => [...current.slice(-3), feedback])
    window.setTimeout(() => {
      setUiFeedbacks((current) => current.filter((entry) => entry.id !== feedback.id))
    }, feedback.durationMs)
  }, [musicEnabled])

  function setSavedCasualTutorialState(nextState: CasualTutorialState) {
    setCasualTutorialState(nextState)
    if (user) saveCasualTutorialState(user.id, nextState)
  }

  function startCasualTutorial() {
    if (!user) return
    const status: CasualTutorialStatus = shouldAutoStartCasualTutorial(user.id) ? 'active' : 'replaying'
    const nextState: CasualTutorialState = {
      status,
      stepId: resolveCasualTutorialStep({
        appScreen,
        run: run?.mode === 'CASUAL' ? run : null,
        battle,
        eventIndex,
        offerInspected: tutorialOfferInspected,
        bought: tutorialBought,
        placed: tutorialPlaced,
      }),
    }
    setSavedCasualTutorialState(nextState)
  }

  function skipCasualTutorial() {
    setSavedCasualTutorialState({ status: 'skipped', stepId: casualTutorialState.stepId })
  }

  function completeCasualTutorial() {
    if (!isCasualTutorialRunning(casualTutorialState)) return
    setSavedCasualTutorialState({ status: 'completed', stepId: 'CONTINUE' })
  }

  function handleEnterCasual() {
    if (user && shouldAutoStartCasualTutorial(user.id)) {
      const nextState: CasualTutorialState = { status: 'active', stepId: 'DOG_SELECT' }
      setSavedCasualTutorialState(nextState)
    }
    setAppScreen('CASUAL')
  }

  function markOfferInspectedForTutorial() {
    if (isCasualTutorialRunning(casualTutorialState)) setTutorialOfferInspected(true)
  }

  function markBoughtForTutorial() {
    if (isCasualTutorialRunning(casualTutorialState)) setTutorialBought(true)
  }

  function markPlacedForTutorial() {
    if (isCasualTutorialRunning(casualTutorialState)) setTutorialPlaced(true)
  }

  const action = async (
    fn: () => Promise<{ run: Run; battle?: Battle } | { user: AuthUser | null; activeRun?: Run | null; needsNickname?: boolean }>,
    feedback?: { success?: UiFeedbackKind; failure?: UiFeedbackKind; successLabel?: string; failureLabel?: string },
  ) => {
    setError('')
    try {
      const data = await fn()
      if ('user' in data) {
        setUser(data.user)
        setAppScreen('LOBBY')
        if (!data.user) {
          setRun(null)
          setCasualTutorialState(defaultCasualTutorialState)
          setRunHistory(emptyRunHistory)
          setLadderProfile(null)
        } else if ('activeRun' in data) {
          setRun(data.activeRun ?? null)
          setCasualTutorialState(readCasualTutorialState(data.user.id))
        }
        setNeedsNicknameSetup(Boolean(data.user && data.needsNickname))
        if (data.user) {
          void loadRunHistory().catch(() => undefined)
          void loadLadderProfile().catch(() => undefined)
        }
      } else {
        setRun(data.run)
        if (data.battle) {
          setEventIndex(0)
          setBattle(data.battle)
        }
        void loadRunHistory().catch(() => undefined)
        void loadLadderProfile().catch(() => undefined)
      }
      if (feedback?.success) pushUiFeedback(feedback.success, feedback.successLabel)
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败'
      setError(message)
      pushUiFeedback(feedback?.failure ?? (message.includes('金币') ? 'gold-shortage' : 'action-failed'), feedback?.failureLabel ?? message)
    }
  }

  const moveItem = (itemId: string, area: Area, x: number, y: number) => {
    if (!run) return
    const placement = resolveRunSlotPlacement(run, itemId, area, x, y)
    if (!placement) {
      pushUiFeedback('place-failed')
      return
    }
    const movingItem = run.items.find((item) => item.id === itemId)
    if (placement.area === 'EQUIPMENT' && movingItem && !isStarterItem(movingItem)) markPlacedForTutorial()
    void action(
      () => api(`/runs/${run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId, area: placement.area, x: placement.x, y: placement.y }) }),
      { success: 'place-success', failure: 'place-failed' },
    )
  }

  const upgradeItem = (itemId: string, targetItemId?: string) => {
    if (!run) return
    setTipAnchor(null)
    void action(
      () => api(`/runs/${run.id}/items/upgrade`, { method: 'POST', body: JSON.stringify({ itemId, targetItemId }) }),
      { success: 'upgrade-success', failure: 'upgrade-failed' },
    )
  }

  const selectUpgradeChoice = (itemId: string) => {
    if (!run) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void action(
      () => api(`/runs/${run.id}/upgrade/select`, { method: 'POST', body: JSON.stringify({ itemId }) }),
      { success: 'upgrade-success', failure: 'upgrade-failed' },
    )
  }

  const applyPotionChoice = (itemId: string) => {
    if (!run || !selectedPotion) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void action(
      () => api(`/runs/${run.id}/potion/select`, { method: 'POST', body: JSON.stringify({ potionId: selectedPotion.id, itemId }) }),
      { success: 'upgrade-success', failure: 'upgrade-failed' },
    )
  }

  const sellRelic = (relicId: string) => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/relic/sell`, { method: 'POST', body: JSON.stringify({ relicId }) }),
      { success: 'relic-sold' },
    )
  }

  const applyEnchant = (itemId: string) => {
    if (!run || !selectedEnchant) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void action(
      () => api(`/runs/${run.id}/enchant/select`, { method: 'POST', body: JSON.stringify({ enchantId: selectedEnchant.id, itemId }) }),
      { success: 'enchant-applied' },
    )
  }

  const finishBattle = async () => {
    if (!run) return
    setError('')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/battle/finish`, { method: 'POST' })
      setRun(data.run)
      setBattle(null)
      setEventIndex(0)
      completeCasualTutorial()
      void loadRunHistory().catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const settleRun = async () => {
    if (!run) return
    const confirmed = window.confirm('将按当前胜负结算，不会额外增加失败。确定放弃本局吗？')
    if (!confirmed) return
    setError('')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/settle`, { method: 'POST' })
      setRun(data.run)
      setBattle(null)
      setEventIndex(0)
      void loadRunHistory().catch(() => undefined)
      void loadLadderProfile().catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const onInspectOffer = (offerId: string, element: HTMLElement) => {
    markOfferInspectedForTutorial()
    setSelectedOfferId(offerId)
    setSelectedItemId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    if (run?.phase === 'ENCHANT_CHOICE' && selectedEnchant) {
      applyEnchant(itemId)
      return
    }
    if (run?.phase === 'UPGRADE_CHOICE') {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item && canFreeUpgradeItem(item)) {
        selectUpgradeChoice(itemId)
        return
      }
    }
    if (run?.phase === 'POTION_CHOICE' && selectedPotion) {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item?.def.kind === 'CLASS_EQUIPMENT') {
        setError('职业装备不可使用药水')
        return
      }
      if (item?.def.advancedEffect === 'BOOM_COUNTER') {
        setError('爆鸣计数器只能通过计数触发')
        return
      }
      if (item) {
        applyPotionChoice(itemId)
        return
      }
    }
    setSelectedItemId(itemId)
    setSelectedOfferId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const closeShopTip = () => {
    setSelectedItemId(null)
    setSelectedOfferId(null)
    setTipAnchor(null)
  }

  const dismissClassRewardCeremony = (key: string) => {
    if (!key) return
    setCeremonyDismissedRounds((current) => new Set(current).add(key))
  }

  const toggleMusic = () => {
    const nextEnabled = !musicEnabled
    window.localStorage.setItem(musicPreferenceKey, nextEnabled ? 'on' : 'off')
    setMusicEnabled(nextEnabled)
    if (nextEnabled && appHasAudioFocus) {
      setMusicBlocked(false)
      void audioRef.current?.play().catch(() => setMusicBlocked(true))
    } else {
      audioRef.current?.pause()
      setMusicBlocked(false)
    }
  }

  const onDragStart = (event: DragStartEvent) => {
    setDraggingItemId(String(event.active.id))
    setTipAnchor(null)
  }
  const onDragEnd = (event: DragEndEvent) => {
    setDraggingItemId(null)
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      const sourceItem = run?.items.find((item) => item.id === itemId)
      const targetItem = run?.items.find((item) => item.id === targetItemId)
      if (canUpgradeDrop(sourceItem, targetItem)) {
        upgradeItem(itemId, targetItemId)
      } else if (targetItem && targetItem.id !== itemId) {
        moveItem(itemId, targetItem.area, targetItem.x, targetItem.y)
      } else {
        pushUiFeedback('upgrade-failed')
      }
      return
    }
    if (String(event.over?.id) === 'SELL_ZONE' && run?.phase === 'SHOP') {
      setSelectedItemId(null)
      setTipAnchor(null)
      void action(
        () => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }),
        { success: 'sell-success' },
      )
      return
    }
    const slot = event.over ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
    else pushUiFeedback('place-failed')
  }

  const tutorialGuide = user && isCasualTutorialRunning(casualTutorialState) ? (
    <CasualTutorialGuide
      state={casualTutorialState}
      run={run}
      battle={battle}
      eventIndex={eventIndex}
      onSkip={skipCasualTutorial}
    />
  ) : null

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel paper-card sticker-card">
          <div className="brand-block">
            <img className="game-logo" src={gameIcon} alt="" />
            <div>
              <h1>狗骰对战</h1>
              <p>摆好装备，掷骰触发，挑战异步狗狗对手。</p>
            </div>
          </div>
          <label>账号<input value={account} autoCapitalize="none" onChange={(e) => setAccount(e.target.value)} /></label>
          <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <div className="row">
            <button className="action-button" onClick={() => action(() => api('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) }))}>登录</button>
            <button className="secondary action-button" onClick={() => action(() => api('/auth/register', { method: 'POST', body: JSON.stringify({ account, password }) }))}>注册</button>
          </div>
        </section>
        <FeedbackLayer feedbacks={uiFeedbacks} />
      </main>
    )
  }

  if (needsNicknameSetup) {
    return (
      <Shell feedbacks={uiFeedbacks} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <NicknameSetup onSubmit={(nickname) => action(() => api('/profile/nickname', { method: 'POST', body: JSON.stringify({ nickname }) }))} />
      </Shell>
    )
  }

  if (appScreen === 'LOBBY') {
    return (
      <Shell feedbacks={uiFeedbacks} run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <PlayerRunHistoryPanel history={runHistory} ladderProfile={ladderProfile} onOpen={() => setHistoryOverlayOpen(true)} />
        <ModeLobby run={run} runHistory={runHistory} onOpen={() => setHistoryOverlayOpen(true)} onEnterCasual={handleEnterCasual} onReplayTutorial={startCasualTutorial} onEnterLadder={() => setAppScreen('LADDER')} onEnterDogfight={() => setAppScreen('DOGFIGHT')} onEnterPeak={() => setAppScreen('PEAK')} />
        {historyOverlayOpen && <PlayerHistoryOverlay history={runHistory} onClose={() => setHistoryOverlayOpen(false)} />}
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'LADDER' && run?.mode !== 'LADDER') {
    return (
      <Shell feedbacks={uiFeedbacks} run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <LadderHome onStart={(choice) => action(() => api('/runs', { method: 'POST', body: JSON.stringify({ ...choice, mode: 'LADDER' }) }))} />
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'DOGFIGHT') {
    return (
      <Shell feedbacks={uiFeedbacks} run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogfightLobby soundEnabled={musicEnabled} />
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'PEAK') {
    return (
      <Shell feedbacks={uiFeedbacks} run={run ?? undefined} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <ApexArena />
        {tutorialGuide}
      </Shell>
    )
  }

  if (!run) {
    return (
      <Shell feedbacks={uiFeedbacks} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogSelect onPick={(choice) => action(() => api('/runs', { method: 'POST', body: JSON.stringify(choice) }))} />
        {tutorialGuide}
      </Shell>
    )
  }
  return (
    <Shell feedbacks={uiFeedbacks} run={run} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
      {!battle && run.phase === 'CHOICE' && (
        <ShopChoiceSelect choices={run.choices} onPick={(shopType) => action(() => api(`/runs/${run.id}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType }) }))} />
      )}

      {!battle && run.phase === 'CLASS_REWARD' && showClassRewardCeremony && (
        <ClassRewardCeremony
          run={run}
          choices={run.classRewardChoices}
          onDismiss={() => dismissClassRewardCeremony(classRewardCeremonyKey)}
        />
      )}

      {!battle && run.phase === 'CLASS_REWARD' && !showClassRewardCeremony && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="reward-workbench">
            <ClassRewardSelect
              choices={run.classRewardChoices}
              visualTheme={visualThemeForRound(run.round)}
              onPick={(defId) => action(() => api(`/runs/${run.id}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId }) }), { success: 'reward-picked' })}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              draggingItemId={draggingItemId}
              onSellRelic={sellRelic}
              onSelectItem={onInspectItem}
              onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            />
            <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null} />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} relics={run.relics} />
          </DragOverlay>
        </DndContext>
      )}

      {!battle && run.phase === 'ENCHANT_CHOICE' && showEnchantCeremony && (
        <EnchantCeremony run={run} choices={run.enchantChoices} onDismiss={() => dismissClassRewardCeremony(enchantCeremonyKey)} />
      )}

      {!battle && run.phase === 'ENCHANT_CHOICE' && !showEnchantCeremony && (
        <section className="reward-workbench enchant-workbench">
          <EnchantChoiceSelect choices={run.enchantChoices} selectedId={selectedEnchant?.id ?? ''} visualTheme={visualThemeForRound(run.round)} onSelect={setSelectedEnchantId} />
          <InventoryBoard
            run={run}
            selectedItemId={selectedItemId}
            draggingItemId={draggingItemId}
            onSellRelic={sellRelic}
            onSelectItem={onInspectItem}
            onSlotClick={() => undefined}
          />
          <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={null} />
        </section>
      )}

      {!battle && run.phase === 'RELIC_CHOICE' && (
        <RelicChoiceSelect choices={run.relicChoices} visualTheme={visualThemeForRound(run.round)} onPick={(relicId) => action(() => api(`/runs/${run.id}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId }) }), { success: 'relic-picked' })} />
      )}

      {!battle && run.phase === 'UPGRADE_CHOICE' && (
        <section className="reward-workbench upgrade-workbench">
          <UpgradeChoiceSelect run={run} visualTheme={visualThemeForRound(run.round)} />
          <InventoryBoard
            run={run}
            selectedItemId={selectedItemId}
            draggingItemId={draggingItemId}
            onSellRelic={sellRelic}
            onSelectItem={onInspectItem}
            onSlotClick={() => undefined}
          />
          <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canFreeUpgradeItem(selectedItem) ? () => selectUpgradeChoice(selectedItem.id) : null} />
        </section>
      )}

      {!battle && run.phase === 'POTION_CHOICE' && (
        <section className="reward-workbench potion-workbench">
          <PotionChoiceSelect choices={run.potionChoices} selectedId={selectedPotion?.id ?? ''} visualTheme={visualThemeForRound(run.round)} onSelect={setSelectedPotionId} />
          <InventoryBoard
            run={run}
            selectedItemId={selectedItemId}
            draggingItemId={draggingItemId}
            onSellRelic={sellRelic}
            onSelectItem={onInspectItem}
            onSlotClick={() => undefined}
          />
          <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={null} />
        </section>
      )}

      {!battle && run.phase === 'SHOP' && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="shop-workbench">
            <ShopShelf
              run={run}
              selectedOfferId={selectedOfferId}
              draggingItemId={draggingItemId}
              onInspectOffer={onInspectOffer}
              onReroll={() => action(() => api(`/runs/${run.id}/shop/reroll`, { method: 'POST' }), { success: 'reroll-success' })}
              onMatch={() => action(() => api(`/runs/${run.id}/battle/match`, { method: 'POST' }), { success: 'battle-start' })}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              draggingItemId={draggingItemId}
              onSellRelic={sellRelic}
              onSelectItem={onInspectItem}
              onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            />
            <FloatingTip
              run={run}
              item={selectedItem}
              offer={selectedOffer}
              anchor={tipAnchor}
              onClose={closeShopTip}
              onBuy={() => {
                if (!selectedOffer) return
                markBoughtForTutorial()
                void action(() => api(`/runs/${run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: selectedOffer.offerId, area: 'BAG' }) }), { success: 'buy-success', failure: 'gold-shortage' })
              }}
              onSell={() => selectedItem && action(() => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId: selectedItem.id }) }), { success: 'sell-success' })}
              onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
            />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} relics={run.relics} />
          </DragOverlay>
        </DndContext>
      )}

      {!battle && (run.phase === 'MATCH' || run.phase === 'PREP') && (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <section className="match-panel" data-tutorial-anchor="battle-start">
            {run.phase === 'MATCH' ? (
              <>
                <img className="dog-avatar large" src={dogAssets[run.matchedGhost?.dogType ?? 'SHIBA']} alt="" />
                <h2>匹配到 {run.matchedGhost?.name}</h2>
                <p>{dogNames[run.matchedGhost?.dogType ?? 'SHIBA']} · {run.matchedGhost?.wins}胜 {run.matchedGhost?.losses}败 · 第 {run.matchedGhost?.round} 回合</p>
              </>
            ) : (
              <>
                <h2>整备阶段</h2>
                <p>整理装备与遗物后再匹配对手。</p>
              </>
            )}
            <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={sellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)} />
            <FloatingTip
              run={run}
              item={selectedItem}
              offer={null}
              anchor={tipAnchor}
              onClose={closeShopTip}
              onBuy={null}
              onSell={null}
              onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
            />
            <button className="primary action-button" data-tutorial-anchor={run.phase === 'MATCH' ? 'battle-start' : 'match-button'} onClick={() => action(() => api(run.phase === 'PREP' ? `/runs/${run.id}/battle/match` : `/runs/${run.id}/battle/start`, { method: 'POST' }), { success: 'battle-start' })}>
              <Dice5 size={18} /> {run.phase === 'PREP' ? '匹配对手' : '开始战斗'}
            </button>
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay item={draggingItem} relics={run.relics} />
          </DragOverlay>
        </DndContext>
      )}

      {(run.phase === 'BATTLE' || run.phase === 'COMPLETE' || battle) && (
        <BattleView
          run={run}
          battle={battle}
          currentEvent={currentEvent}
          eventIndex={eventIndex}
          speed={speed}
          score={score}
          soundEnabled={musicEnabled}
          onSpeed={setSpeed}
          onContinue={() => void finishBattle()}
          onRestart={() => setRun(null)}
        />
      )}
      {!battle && !showClassRewardCeremony && run.status === 'ACTIVE' && run.phase !== 'BATTLE' && (
        <ForfeitRunAction run={run} onForfeit={() => void settleRun()} />
      )}
      {tutorialGuide}
    </Shell>
  )
}

const modeCards: Array<{
  id: GameMode
  title: string
  description: string
  icon: React.ReactNode
  locked: boolean
}> = [
  {
    id: 'CASUAL',
    title: '休闲模式',
    description: '当前经典构筑、商店、匹配和自动战斗流程',
    icon: <Gamepad2 size={38} />,
    locked: false,
  },
  {
    id: 'LADDER',
    title: '天梯模式',
    description: '按整局表现结算积分，冲击大师与犬王排行榜',
    icon: <Medal size={38} />,
    locked: false,
  },
  {
    id: 'DOGFIGHT',
    title: '斗狗模式',
    description: '实时房间，8 狗同场淘汰',
    icon: <RadioTower size={38} />,
    locked: false,
  },
  {
    id: 'PEAK',
    title: '巅峰模式',
    description: '战斗结束后的狗进入巅峰竞技场，自动挑战榜单冲击排名',
    icon: <Crown size={38} />,
    locked: false,
  },
]

function CasualTutorialGuide({ state, run, battle, eventIndex, onSkip }: { state: CasualTutorialState; run: Run | null; battle: Battle | null; eventIndex: number; onSkip: () => void }) {
  const step = casualTutorialSteps[state.stepId]
  const battleFinished = battlePlaybackFinished(battle, eventIndex)
  const advancedPhase = run?.phase === 'CLASS_REWARD' || run?.phase === 'RELIC_CHOICE' || run?.phase === 'UPGRADE_CHOICE' || run?.phase === 'POTION_CHOICE' || run?.phase === 'ENCHANT_CHOICE'
  const body = advancedPhase
    ? '这是进阶奖励，选择一个适合当前装备的即可。'
    : state.stepId === 'BATTLE_WATCH' && battle && !battle.events.slice(0, eventIndex + 1).some((event) => event.kind === 'ITEM')
      ? '如果这次掷骰没有触发装备，就是一次空过；继续看下一次骰子。'
      : step.body
  const anchor = state.stepId === 'BATTLE_WATCH' && battle ? 'battle-stage' : step.anchor

  useEffect(() => {
    const highlighted = [...document.querySelectorAll('.tutorial-highlight')]
    highlighted.forEach((element) => element.classList.remove('tutorial-highlight'))
    const target = document.querySelector(`[data-tutorial-anchor="${anchor}"]`)
    target?.classList.add('tutorial-highlight')
    target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    return () => target?.classList.remove('tutorial-highlight')
  }, [anchor])

  return (
    <aside className="casual-tutorial-guide" aria-live="polite">
      <div className="tutorial-coach-card paper-card">
        <span className="tip-tag">{state.status === 'replaying' ? '重看引导' : '新手引导'}</span>
        <h2>{step.title}</h2>
        <p>{body}</p>
        <strong>{battleFinished ? casualTutorialSteps.CONTINUE.task : step.task}</strong>
        <button className="secondary action-button" type="button" onClick={onSkip}>跳过引导</button>
      </div>
    </aside>
  )
}

function ModeLobby({ run, runHistory, onOpen, onEnterCasual, onReplayTutorial, onEnterLadder, onEnterDogfight, onEnterPeak }: { run: Run | null; runHistory: PlayerRunHistory; onOpen: () => void; onEnterCasual: () => void; onReplayTutorial: () => void; onEnterLadder: () => void; onEnterDogfight: () => void; onEnterPeak: () => void }) {
  const casualAction = run?.mode === 'CASUAL' ? '继续休闲模式' : '开始休闲模式'
  const ladderAction = run?.mode === 'LADDER' ? '继续天梯模式' : '进入天梯模式'
  return (
    <section className="mode-lobby-screen" data-history-count={runHistory.totalRuns} data-history-action={onOpen.name}>
      <div className="screen-heading centered">
        <h2>模式大厅</h2>
        <p>选择本次要进入的竞技方式。休闲或天梯完成后的狗可以送入巅峰竞技场。</p>
      </div>
        <button className="secondary action-button tutorial-replay-button" type="button" onClick={onReplayTutorial}>新手引导</button>
      <div className="mode-grid">
        {modeCards.map((mode) => (
          <article key={mode.id} className={`mode-card paper-card sticker-card ${mode.locked ? 'locked' : 'available'}`}>
            <span className="mode-icon">{mode.icon}</span>
            {mode.locked && (
              <span className="lock-chain" aria-label={`${mode.title}未解锁`}>
                <Lock size={18} />
                未解锁
              </span>
            )}
            <div className="mode-copy">
              <strong>{mode.title}</strong>
              <p>{mode.description}</p>
            </div>
            {mode.id === 'CASUAL' ? (
              <button className="primary action-button mode-action" data-tutorial-anchor="mode-casual" onClick={onEnterCasual}>{casualAction}</button>
            ) : mode.id === 'LADDER' ? (
              <button className="primary action-button mode-action" onClick={onEnterLadder}>{ladderAction}</button>
            ) : mode.id === 'DOGFIGHT' ? (
              <button className="primary action-button mode-action" onClick={onEnterDogfight}>进入斗狗模式</button>
            ) : mode.id === 'PEAK' ? (
              <button className="primary action-button mode-action" onClick={onEnterPeak}>进入巅峰模式</button>
            ) : (
              <button className="secondary action-button mode-action" disabled>
                <Lock size={18} /> 未解锁
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function PlayerRunHistoryPanel({ history, ladderProfile, onOpen }: { history: PlayerRunHistory; ladderProfile: LadderProfile | null; onOpen: () => void }) {
  const bestRun = history.bestRun
  const winRate = history.totalWins + history.totalLosses > 0
    ? Math.round((history.totalWins / (history.totalWins + history.totalLosses)) * 100)
    : 0
  const rankLabel = ladderProfile?.tierLabel ?? '青铜'
  const rankScore = ladderProfile?.score ?? 0
  const lobbyRecentRuns = history.recentRuns.slice(0, 5)

  return (
    <section className="player-history-panel" aria-label="个人战绩">
      <div className="history-summary">
        <div>
          <span>个人战绩</span>
          <h2>{history.totalWins}胜 {history.totalLosses}败</h2>
          <p>共 {history.totalRuns} 局 · 胜率 {winRate}% · 完成 {history.completedRuns} 局</p>
        </div>
        <div className="history-ladder-slot" aria-label="天梯段位">
          <span className="dog-rank-trophy" title="犬爪奖杯">
            <Trophy size={34} />
            <PawPrint size={15} />
          </span>
          <div>
            <small>天梯段位</small>
            <strong>{rankLabel}</strong>
            <p>{rankScore} 分</p>
          </div>
        </div>
        <div className="history-best">
          <small>最佳成绩</small>
          {bestRun ? (
            <strong>{dogNames[bestRun.dogType]} · {bestRun.wins}胜 {bestRun.losses}败 · 第 {bestRun.round} 回合</strong>
          ) : (
            <strong>暂无对局</strong>
          )}
        </div>
        <button className="history-open-action" type="button" onClick={onOpen}>查看详情和装备</button>
      </div>
      <div className="history-run-list" aria-label="最近对局">
        {lobbyRecentRuns.length > 0 ? lobbyRecentRuns.map((entry) => (
          <div className="history-run-row" key={entry.id}>
            <span>{dogNames[entry.dogType]}</span>
            <strong>{entry.wins}胜 {entry.losses}败</strong>
            <small>{runStatusText(entry.status)} · 第 {entry.round} 回合</small>
          </div>
        )) : (
          <div className="history-run-row empty">
            <span>最近对局</span>
            <strong>还没有记录</strong>
            <small>开始一局后会自动统计</small>
          </div>
        )}
      </div>
    </section>
  )
}

function runStatusText(status: string) {
  if (status === 'ACTIVE') return '进行中'
  if (status === 'COMPLETE') return '已完成'
  if (status === 'ABANDONED') return '已换狗'
  return '已记录'
}

function PlayerHistoryOverlay({ history, onClose }: { history: PlayerRunHistory; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<HistoryModeTab>('ALL')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [inspectedItem, setInspectedItem] = useState<Item | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const runs = activeTab === 'ALL' ? history.recentRuns : history.recentRuns.filter((entry) => entry.mode === activeTab)
  const selectedRun = runs.find((entry) => entry.id === selectedRunId) ?? runs[0] ?? null
  const bestRun = history.bestRun

  const closeTip = () => {
    setInspectedItem(null)
    setTipAnchor(null)
  }
  const inspectItem = (item: Item, element: HTMLElement) => {
    setInspectedItem(item)
    setTipAnchor(getFloatingTipPosition(element))
  }

  return (
    <div className="player-history-overlay" role="dialog" aria-modal="true" aria-label="个人战绩详情">
      <section className="player-history-page">
        <header className="history-page-header">
          <div>
            <span>个人战绩</span>
            <h2>{history.totalWins}胜 {history.totalLosses}败</h2>
            <p>共 {history.totalRuns} 局 · 进行中 {history.activeRuns} 局 · 已完成 {history.completedRuns} 局</p>
          </div>
          <div className="history-page-best">
            <small>最佳成绩</small>
            <strong>{bestRun ? `${dogNames[bestRun.dogType]} · ${bestRun.wins}胜 ${bestRun.losses}败` : '暂无对局'}</strong>
          </div>
          <button className="icon-button" title="关闭个人战绩" aria-label="关闭个人战绩" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="history-mode-tabs" role="tablist" aria-label="战绩模式">
          {historyModeTabs.map((tab) => {
            const count = tab.id === 'ALL' ? history.recentRuns.length : history.recentRuns.filter((entry) => entry.mode === tab.id).length
            return (
              <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => { setActiveTab(tab.id); setSelectedRunId(null); closeTip() }}>
                {tab.label}<small>{count}</small>
              </button>
            )
          })}
        </div>

        <div className="history-detail-layout">
          <section className="history-run-browser" aria-label="历史对局列表">
            {runs.length > 0 ? runs.map((entry) => (
              <button key={entry.id} type="button" className={`history-detail-row ${selectedRun?.id === entry.id ? 'selected' : ''}`} onClick={() => { setSelectedRunId(entry.id); closeTip() }}>
                <img className="dog-avatar small" src={dogAssets[entry.dogType]} alt="" />
                <span>{dogNames[entry.dogType]}</span>
                <strong>{entry.wins}胜 {entry.losses}败</strong>
                <small>{runStatusText(entry.status)} · 第 {entry.round} 回合 · 装备 {entry.items.length}</small>
              </button>
            )) : (
              <div className="history-empty-state">
                <strong>{historyModeTabs.find((tab) => tab.id === activeTab)?.label}暂无记录</strong>
                <p>这个页签已经预留，后续模式接入历史数据后会显示详情。</p>
              </div>
            )}
          </section>

          <section className="history-selected-run" aria-label="对局详情">
            {selectedRun ? (
              <HistoryRunDetails entry={selectedRun} inspectedItem={inspectedItem} tipAnchor={tipAnchor} onInspectItem={inspectItem} onCloseTip={closeTip} />
            ) : (
              <div className="history-empty-state">
                <strong>没有可查看的对局</strong>
                <p>开始或完成一局后，会在这里显示装备和遗物详情。</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}

function HistoryRunDetails({ entry, inspectedItem, tipAnchor, onInspectItem, onCloseTip }: { entry: PlayerRunHistoryEntry; inspectedItem: Item | null; tipAnchor: TipAnchor | null; onInspectItem: (item: Item, element: HTMLElement) => void; onCloseTip: () => void }) {
  const equipment = entry.items.filter((item) => item.area === 'EQUIPMENT')
  const bag = entry.items.filter((item) => item.area === 'BAG')
  const tipRun: Run = {
    id: entry.id,
    mode: entry.mode === 'LADDER' ? 'LADDER' : 'CASUAL',
    dogType: entry.dogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    gold: 0,
    phase: entry.phase,
    status: entry.status,
    shopType: 'GENERAL',
    shopItems: [],
    choices: [],
    classRewardChoices: [],
    enchantChoices: [],
    potionChoices: [],
    relicChoices: [],
    relics: entry.relics,
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    ladderSettlement: null,
    items: entry.items,
  }

  return (
    <div className="history-run-details">
      <div className="history-run-title">
        <div>
          <span>{historyModeTabs.find((tab) => tab.id === entry.mode)?.label}</span>
          <h3>{dogNames[entry.dogType]} · {entry.wins}胜 {entry.losses}败</h3>
          <p>{runStatusText(entry.status)} · 第 {entry.round} 回合 · {new Date(entry.updatedAt).toLocaleString()}</p>
        </div>
      </div>
      <div className="battle-equipment-row player history-equipment-preview">
        <div className="battle-row-title">
          <span>历史装备栏</span>
          <small>点击查看装备</small>
        </div>
        <div className="battle-slot-grid" style={{ gridTemplateColumns: `repeat(${equipmentSlotCount(entry.relics)}, minmax(0, 1fr))` }}>
          {Array.from({ length: equipmentSlotCount(entry.relics) }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
          {equipment.map((item) => {
            const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), entry.relics)
            return (
            <button
              type="button"
              key={item.id}
              className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
              style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
              title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
              onClick={(event) => onInspectItem(item, event.currentTarget)}
            >
              <img className="item-icon" src={itemIcon(item.def)} alt="" />
              <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
              <span>{item.def.name}</span>
              {triggerDice && <small><Dice5 size={12} /> {triggerDice}</small>}
            </button>
            )
          })}
        </div>
      </div>
      <div className="history-inventory-summary">
        <RelicRail relics={entry.relics} />
        <p>遗物 {entry.relics.length} 个 · 背包物品 {bag.length} 个</p>
      </div>
      <FloatingTip run={tipRun} item={inspectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={null} />
    </div>
  )
}

function DogfightLobby({ soundEnabled }: { soundEnabled: boolean }) {
  const [rooms, setRooms] = useState<DogfightRoomSummary[]>([])
  const [room, setRoom] = useState<DogfightRoom | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const roomId = room?.id ?? null

  const loadRooms = async () => {
    setError('')
    try {
      const data = await api<DogfightRoomsResponse>('/dogfight/rooms')
      setRooms(data.rooms)
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间加载失败')
    } finally {
      setLoading(false)
    }
  }

  const loadRoom = async (roomId: string) => {
    setError('')
    try {
      const data = await api<DogfightRoomResponse>('/dogfight/rooms/' + roomId)
      setRoom(data.room)
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间进入失败')
    }
  }

  useEffect(() => {
    let active = true
    api<DogfightRoomsResponse>('/dogfight/rooms')
      .then((data) => {
        if (active) setRooms(data.rooms)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '斗狗房间加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (roomId) {
        void loadRoom(roomId)
      } else {
        void loadRooms()
      }
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [roomId])

  const enterRoom = async (actionType: 'CREATE' | 'JOIN' | 'MATCH', joinRoomId = selectedRoomId) => {
    setError('')
    try {
      let data: DogfightRoomResponse
      if (actionType === 'CREATE') {
        data = await api<DogfightRoomResponse>('/dogfight/rooms', { method: 'POST' })
      } else if (actionType === 'MATCH') {
        data = await api<DogfightRoomResponse>('/dogfight/match', { method: 'POST' })
      } else {
        const roomId = joinRoomId
        if (!roomId) throw new Error('请先选择一个未开始的房间')
        data = await api<DogfightRoomResponse>(`/dogfight/rooms/${roomId}/join`, { method: 'POST' })
      }
      setRoom(data.room)
      void loadRooms()
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗房间操作失败')
    }
  }

  const leaveRoom = async () => {
    if (room) {
      try {
        await api<DogfightLeaveResponse>(`/dogfight/rooms/${room.id}/leave`, { method: 'POST' })
      } catch {
        // The room may already have been removed by another client; still return locally.
      }
    }
    setRoom(null)
    void loadRooms()
  }

  if (room) {
    return <DogfightRoomView room={room} onRoomChange={setRoom} onLeave={() => void leaveRoom()} soundEnabled={soundEnabled} />
  }

  return (
    <section className="dogfight-screen">
      <div className="screen-heading centered">
        <h2>斗狗模式</h2>
        <p>房间内同步推进回合，前三回合发育，之后玩家两两对战。</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dogfight-layout">
        <aside className="dogfight-actions">
          <button className="primary action-button" onClick={() => void enterRoom('CREATE')}><House size={18} /> 创建房间</button>
          <button className="secondary action-button" disabled={!selectedRoomId} onClick={() => void enterRoom('JOIN')}><Swords size={18} /> 加入房间</button>
          <button className="primary action-button" onClick={() => void enterRoom('MATCH')}><RadioTower size={18} /> 随机匹配</button>
          <p className="muted-note">玩家席位先进入房间，开局后统一 15 秒选择斗狗；不足 8 人由机器人补齐。</p>
        </aside>
        <section className="dogfight-room-list">
          <div className="panel-heading">
            <h3>房间列表</h3>
            <button className="secondary action-button" onClick={() => void loadRooms()} disabled={loading}><RefreshCcw size={18} /> 刷新</button>
          </div>
          {rooms.length === 0 ? (
            <p className="apex-empty">暂无房间，创建一个斗狗房间开始。</p>
          ) : rooms.map((room) => (
            <article key={room.id} className={`dogfight-room-card ${selectedRoomId === room.id ? 'selected' : ''}`}>
              <div>
                <strong>{room.hostName} 的房间</strong>
                <p>{room.status === 'WAITING' ? '等待中' : room.status === 'ACTIVE' ? `${dogfightPhaseLabel(room.phase)} · 第 ${room.currentRound} 回合` : '已结束'} · 真人 {room.memberCount}/{room.maxPlayers} · 存活 {room.aliveCount}/{room.targetPlayerCount}</p>
              </div>
              <button
                className="primary action-button"
                onClick={() => {
                  if (room.status === 'WAITING') {
                    setSelectedRoomId(room.id)
                    void enterRoom('JOIN', room.id)
                  } else {
                    void loadRoom(room.id)
                  }
                }}
              >
                {room.status === 'WAITING' ? '加入房间' : '观战'}
              </button>
            </article>
          ))}
        </section>
      </div>
    </section>
  )
}

function DogfightRoomView({ room, onRoomChange, onLeave, soundEnabled }: { room: DogfightRoom; onRoomChange: (room: DogfightRoom) => void; onLeave: () => void; soundEnabled: boolean }) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedEnchantId, setSelectedEnchantId] = useState<string | null>(null)
  const [selectedPotionId, setSelectedPotionId] = useState<string | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [battleId, setBattleId] = useState<string | null>(null)
  const [dismissedAutoBattleId, setDismissedAutoBattleId] = useState<string | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const run = room.currentRun
  const currentMember = room.currentRunMember ?? (run ? room.members.find((member) => member.runId === run.id) ?? null : null)
  const selectedItem = run?.items.find((item) => item.id === selectedItemId) || null
  const selectedOffer = run?.shopItems.find((offer) => offer.offerId === selectedOfferId) || null
  const selectedEnchant = run?.enchantChoices.find((choice) => choice.id === selectedEnchantId) ?? run?.enchantChoices[0] ?? null
  const selectedPotion = run?.potionChoices.find((choice) => choice.id === selectedPotionId) ?? run?.potionChoices[0] ?? null
  const draggingItem = run?.items.find((item) => item.id === draggingItemId) || null
  const deadline = room.phaseDeadline ? Math.max(0, Math.ceil((new Date(room.phaseDeadline).getTime() - now) / 1000)) : 0
  const selectedBattleMemberId = selectedMemberId ?? currentMember?.id ?? sortedDogfightMembers(room.members)[0]?.id ?? null

  useEffect(() => {
    if (!battle) return
    const timer = window.setInterval(() => {
      setEventIndex((value) => Math.min(value + 1, battle.events.length - 1))
    }, 420 / speed)
    return () => window.clearInterval(timer)
  }, [battle, speed])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const refreshRoom = async () => {
    const data = await api<DogfightRoomResponse>('/dogfight/rooms/' + room.id)
    onRoomChange(data.room)
  }

  const runAction = async (fn: () => Promise<{ run?: Run } | DogfightRoomResponse>) => {
    setError('')
    try {
      const data = await fn()
      if ('room' in data) {
        onRoomChange(data.room)
      } else {
        await refreshRoom()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '斗狗操作失败')
    }
  }

  const startRoom = () => runAction(() => api<DogfightRoomResponse>(`/dogfight/rooms/${room.id}/start`, { method: 'POST' }))
  const readyRoom = () => runAction(() => api<DogfightRoomResponse>(`/dogfight/rooms/${room.id}/ready`, { method: 'POST' }))
  const chooseDog = (choice: { dogType: DogType; luckyNumber?: number }) => runAction(() => api<DogfightRoomResponse>(`/dogfight/rooms/${room.id}/dog-choice`, { method: 'POST', body: JSON.stringify(choice) }))

  const loadBattle = async (battleId: string, options: { auto?: boolean } = {}) => {
    setError('')
    if (!options.auto) setDismissedAutoBattleId(null)
    try {
      const data = await api<DogfightBattleResponse>(`/dogfight/battles/${battleId}`)
      setBattle(data.battle.result)
      setBattleId(data.battle.id)
      setEventIndex(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '战报读取失败')
    }
  }

  const dismissDogfightBattleReplay = () => {
    if (battleId) setDismissedAutoBattleId(battleId)
    setBattle(null)
    setBattleId(null)
  }

  const finishDogfightBattleReplay = () => {
    const shouldMarkFinished = room.phase === 'BATTLE'
      && Boolean(run)
      && Boolean(currentMember)
      && !currentMember?.ready
      && !currentMember?.eliminated
      && battleId === currentMember?.currentBattleId
    dismissDogfightBattleReplay()
    if (shouldMarkFinished) void readyRoom()
  }

  useEffect(() => {
    if (battle || room.phase !== 'BATTLE') return
    const battleId = currentMember?.currentBattleId ?? sortedDogfightMembers(room.members).find((member) => member.currentBattleId)?.currentBattleId
    if (!battleId) return
    if (dismissedAutoBattleId === battleId) return
    const timer = window.setTimeout(() => {
      void loadBattle(battleId, { auto: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [battle, currentMember?.currentBattleId, dismissedAutoBattleId, room.phase, room.members])

  useEffect(() => {
    if (room.phase !== 'BATTLE') setDismissedAutoBattleId(null)
  }, [room.phase])

  const moveItem = (itemId: string, area: Area, x: number, y: number) => {
    if (!run || currentMember?.ready) return
    const placement = resolveRunSlotPlacement(run, itemId, area, x, y)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/items/move`, { method: 'POST', body: JSON.stringify({ itemId, area: placement?.area ?? area, x: placement?.x ?? x, y: placement?.y ?? y }) }))
  }

  const upgradeItem = (itemId: string, targetItemId?: string) => {
    if (!run || currentMember?.ready) return
    setTipAnchor(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/items/upgrade`, { method: 'POST', body: JSON.stringify({ itemId, targetItemId }) }))
  }

  const selectUpgradeChoice = (itemId: string) => {
    if (!run || currentMember?.ready) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/upgrade/select`, { method: 'POST', body: JSON.stringify({ itemId }) }))
  }

  const applyPotionChoice = (itemId: string) => {
    if (!run || !selectedPotion || currentMember?.ready) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/potion/select`, { method: 'POST', body: JSON.stringify({ potionId: selectedPotion.id, itemId }) }))
  }

  const sellRelic = (relicId: string) => {
    if (!run || currentMember?.ready) return
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/relic/sell`, { method: 'POST', body: JSON.stringify({ relicId }) }))
  }

  const applyEnchant = (itemId: string) => {
    if (!run || !selectedEnchant || currentMember?.ready) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/enchant/select`, { method: 'POST', body: JSON.stringify({ enchantId: selectedEnchant.id, itemId }) }))
  }

  const onInspectOffer = (offerId: string, element: HTMLElement) => {
    setSelectedOfferId(offerId)
    setSelectedItemId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    if (run?.phase === 'ENCHANT_CHOICE' && selectedEnchant) {
      applyEnchant(itemId)
      return
    }
    if (run?.phase === 'UPGRADE_CHOICE') {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item && canFreeUpgradeItem(item)) {
        selectUpgradeChoice(itemId)
        return
      }
    }
    if (run?.phase === 'POTION_CHOICE' && selectedPotion) {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item?.def.kind === 'CLASS_EQUIPMENT') {
        setError('职业装备不可使用药水')
        return
      }
      if (item) {
        applyPotionChoice(itemId)
        return
      }
    }
    setSelectedItemId(itemId)
    setSelectedOfferId(null)
    setTipAnchor(getFloatingTipPosition(element))
  }

  const closeTip = () => {
    setSelectedItemId(null)
    setSelectedOfferId(null)
    setTipAnchor(null)
  }

  const onDragStart = (event: DragStartEvent) => {
    setDraggingItemId(String(event.active.id))
    setTipAnchor(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingItemId(null)
    if (!run || currentMember?.ready) return
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      const sourceItem = run.items.find((item) => item.id === itemId)
      const targetItem = run.items.find((item) => item.id === targetItemId)
      if (canUpgradeDrop(sourceItem, targetItem)) {
        upgradeItem(itemId, targetItemId)
      } else if (targetItem && targetItem.id !== itemId) {
        moveItem(itemId, targetItem.area, targetItem.x, targetItem.y)
      }
      return
    }
    if (String(event.over?.id) === 'SELL_ZONE' && run.phase === 'SHOP') {
      setSelectedItemId(null)
      setTipAnchor(null)
      void runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }))
      return
    }
    const slot = event.over ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
  }

  const battleRun = battleToRun(battle) ?? run

  return (
    <section className="dogfight-room-view">
      <div className="dogfight-room-toolbar">
        <button className="secondary action-button" onClick={onLeave}><House size={18} /> 返回房间列表</button>
        <button className="secondary action-button" onClick={() => void refreshRoom()}><RefreshCcw size={18} /> 刷新房间</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="dogfight-room-status">
        <div>
          <h2>{dogfightPhaseLabel(room.phase)} · 第 {room.currentRound} 回合</h2>
          <p>{room.phase === 'LOBBY' ? `玩家席位 ${room.members.filter((member) => member.kind === 'PLAYER').length}/${room.maxPlayers}` : `阶段倒计时 ${deadline}s`}</p>
        </div>
        <div className="dogfight-phase-track">
          {(['DOG_SELECT', 'SHOP', 'BATTLE'] as DogfightRoomPhase[]).map((phase) => <span key={phase} className={room.phase === phase ? 'active' : ''}>{dogfightPhaseLabel(phase)}</span>)}
        </div>
        {run && (
          <div className="dogfight-run-stats" aria-label="斗狗当前属性">
            <span className="resource-pill gold"><Coins size={16} /> 金币 {run.gold}</span>
            <span className="resource-pill win"><Trophy size={16} /> {run.wins}胜 {run.losses}败</span>
            <span className="resource-pill round"><RefreshCcw size={16} /> 第 {run.round} 回合</span>
            {currentMember && <span className={`resource-pill ${currentMember.ready ? 'safe' : 'round'}`}>{currentMember.ready ? (room.phase === 'BATTLE' ? '已完成' : '已准备') : (room.phase === 'BATTLE' ? '回放中' : '调整中')}</span>}
          </div>
        )}
        {currentMember && <span className="resource-pill safe"><Shield size={16} /> 剩余存活 {dogfightLives(currentMember)}</span>}
        {room.isHost && room.status === 'WAITING' && <button className="primary action-button" onClick={startRoom}>开始房间</button>}
        {run && room.phase === 'SHOP' && !currentMember?.ready && !currentMember?.eliminated && <button className="primary action-button" onClick={readyRoom}>完成本回合</button>}
        {run && room.phase === 'BATTLE' && !currentMember?.ready && !currentMember?.eliminated && <button className="primary action-button" onClick={readyRoom}>完成本回合</button>}
      </div>

      <div className="dogfight-room-columns">
        <aside className="dogfight-survivor-board">
          <h3>房间玩家</h3>
          {sortedDogfightMembers(room.members).map((member) => (
            <button
              key={member.id}
              className={`dogfight-player-frame ${member.kind.toLowerCase()} ${member.eliminated ? 'eliminated' : ''} ${selectedBattleMemberId === member.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedMemberId(member.id)
                if (member.currentBattleId) void loadBattle(member.currentBattleId)
              }}
            >
              {member.dogType ? <img className="dog-avatar small" src={dogAssets[member.dogType]} alt="" /> : <PawPrint size={28} />}
              <div>
                <strong>{member.nickname}{member.isHost ? ' · 房主' : ''}</strong>
                <p>{member.dogType ? dogNames[member.dogType] : '等待选狗'} · {member.kind === 'BOT' ? '参赛者' : '玩家'} · {member.wins}胜 {member.losses}败</p>
              </div>
              <b>{dogfightLives(member)}</b>
            </button>
          ))}
        </aside>

        <main className="dogfight-play-area">
          {battle && battleRun ? (
            <BattleView run={battleRun} battle={battle} currentEvent={battle.events[eventIndex]} eventIndex={eventIndex} speed={speed} score={0} soundEnabled={soundEnabled} onSpeed={setSpeed} onContinue={() => finishDogfightBattleReplay()} onRestart={() => dismissDogfightBattleReplay()} />
          ) : room.phase === 'DOG_SELECT' && !run ? (
            <section className="dogfight-dog-select sketch-panel">
              <div className="section-title">
                <PawPrint size={22} />
                <div>
                  <h2>选择斗狗</h2>
                  <p>15 秒内锁定狗狗；超时会自动随机。</p>
                </div>
              </div>
              <DogSelect onPick={chooseDog} />
            </section>
          ) : run && room.phase === 'SHOP' ? (
            <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <DogfightRunWorkbench
                run={run}
                selectedItemId={selectedItemId}
                selectedOfferId={selectedOfferId}
                draggingItemId={draggingItemId}
                onInspectOffer={onInspectOffer}
                onInspectItem={onInspectItem}
                onMoveItem={moveItem}
                onReroll={() => !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/reroll`, { method: 'POST' }))}
                onBuy={() => selectedOffer && !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: selectedOffer.offerId, area: 'BAG' }) }))}
                onSell={() => selectedItem && !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId: selectedItem.id }) }))}
                onSellRelic={sellRelic}
                onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) && !currentMember?.ready ? () => upgradeItem(selectedItem.id) : null}
                onChoice={(shopType) => !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/choice/select`, { method: 'POST', body: JSON.stringify({ shopType }) }))}
                onClassReward={(defId) => !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId }) }))}
                onRelic={(relicId) => !currentMember?.ready && runAction(() => api<{ run: Run }>(`/runs/${run.id}/relic/select`, { method: 'POST', body: JSON.stringify({ relicId }) }))}
                onUpgradeChoice={selectUpgradeChoice}
                selectedEnchantId={selectedEnchant?.id ?? ''}
                onEnchantChoice={setSelectedEnchantId}
                selectedPotionId={selectedPotion?.id ?? ''}
                onPotionChoice={setSelectedPotionId}
                selectedItem={selectedItem}
                selectedOffer={selectedOffer}
                tipAnchor={tipAnchor}
                onCloseTip={closeTip}
              />
              <DragOverlay dropAnimation={null} zIndex={1000}>
                <DraggingItemOverlay item={draggingItem} relics={run.relics} />
              </DragOverlay>
            </DndContext>
          ) : (
            <p className="apex-empty">{room.phase === 'BATTLE' ? '战斗生成中，可以点击左侧玩家框或右侧场次切换观战。' : '你正在观战这个房间。可以查看房间战况和历史战报。'}</p>
          )}
        </main>

        <section className="dogfight-battle-dock">
          <h3>本轮场次</h3>
          {room.battles.length === 0 ? <p className="apex-empty">暂无战报</p> : room.battles.slice().reverse().map((entry) => (
            <button key={entry.id} className="dogfight-battle-row" onClick={() => void loadBattle(entry.id)}>
              第 {entry.round} 回合 · {entry.opponentKind === 'PLAYER' ? '玩家对战' : '离线训练'} · 回放
            </button>
          ))}
        </section>
      </div>
    </section>
  )
}

function DogfightRunWorkbench({ run, selectedItemId, selectedOfferId, draggingItemId, selectedItem, selectedOffer, tipAnchor, onInspectOffer, onInspectItem, onMoveItem, onReroll, onBuy, onSell, onSellRelic, onUpgrade, onChoice, onClassReward, onRelic, onUpgradeChoice, selectedEnchantId, onEnchantChoice, selectedPotionId, onPotionChoice, onCloseTip }: {
  run: Run
  selectedItemId: string | null
  selectedOfferId: string | null
  draggingItemId: string | null
  selectedItem: Item | null
  selectedOffer: ShopOffer | null
  tipAnchor: TipAnchor | null
  onInspectOffer: (offerId: string, element: HTMLElement) => void
  onInspectItem: (itemId: string, element: HTMLElement) => void
  onMoveItem: (itemId: string, area: Area, x: number, y: number) => void
  onReroll: () => void
  onBuy: () => void
  onSell: () => void
  onSellRelic: (relicId: string) => void
  onUpgrade: (() => void) | null
  onChoice: (shopType: ShopType) => void
  onClassReward: (defId: string) => void
  onRelic: (relicId: string) => void
  onUpgradeChoice: (itemId: string) => void
  selectedEnchantId: string
  onEnchantChoice: (id: string) => void
  selectedPotionId: string
  onPotionChoice: (id: string) => void
  onCloseTip: () => void
}) {
  if (run.phase === 'CHOICE') return <ShopChoiceSelect choices={run.choices} onPick={onChoice} />
  if (run.phase === 'CLASS_REWARD') {
    return (
      <section className="reward-workbench">
        <ClassRewardSelect choices={run.classRewardChoices} visualTheme={visualThemeForRound(run.round)} onPick={onClassReward} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={onUpgrade} />
      </section>
    )
  }
  if (run.phase === 'ENCHANT_CHOICE') {
    return (
      <section className="reward-workbench enchant-workbench">
        <EnchantChoiceSelect choices={run.enchantChoices} selectedId={selectedEnchantId} visualTheme={visualThemeForRound(run.round)} onSelect={onEnchantChoice} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={null} />
      </section>
    )
  }
  if (run.phase === 'RELIC_CHOICE') return <RelicChoiceSelect choices={run.relicChoices} visualTheme={visualThemeForRound(run.round)} onPick={onRelic} />
  if (run.phase === 'UPGRADE_CHOICE') {
    return (
      <section className="reward-workbench upgrade-workbench">
        <UpgradeChoiceSelect run={run} visualTheme={visualThemeForRound(run.round)} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canFreeUpgradeItem(selectedItem) ? () => onUpgradeChoice(selectedItem.id) : null} />
      </section>
    )
  }
  if (run.phase === 'POTION_CHOICE') {
    return (
      <section className="reward-workbench potion-workbench">
        <PotionChoiceSelect choices={run.potionChoices} selectedId={selectedPotionId} visualTheme={visualThemeForRound(run.round)} onSelect={onPotionChoice} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={null} />
      </section>
    )
  }
  return (
    <section className="shop-workbench dogfight-workbench">
      {run.phase === 'SHOP' && <ShopShelf run={run} selectedOfferId={selectedOfferId} draggingItemId={draggingItemId} onInspectOffer={onInspectOffer} onReroll={onReroll} onMatch={() => undefined} />}
      <InventoryBoard run={run} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
      <FloatingTip run={run} item={selectedItem} offer={selectedOffer} anchor={tipAnchor} onClose={onCloseTip} onBuy={selectedOffer ? onBuy : null} onSell={selectedItem ? onSell : null} onUpgrade={onUpgrade} />
    </section>
  )
}

function battleToRun(battle: Battle | null): Run | null {
  const snapshot = battle?.playerSnapshot
  if (!snapshot) return null
  return {
    id: 'dogfight-spectator-battle',
    mode: 'CASUAL',
    dogType: snapshot.dogType,
    luckyNumber: snapshot.luckyNumber,
    wins: snapshot.wins,
    losses: snapshot.losses,
    round: snapshot.round,
    gold: 0,
    phase: 'BATTLE',
    status: 'DOGFIGHT_SPECTATING',
    shopType: 'GENERAL',
    shopItems: [],
    choices: [],
    classRewardChoices: [],
    enchantChoices: [],
    potionChoices: [],
    relicChoices: [],
    relics: snapshot.relics ?? [],
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    ladderSettlement: null,
    items: snapshot.items,
  }
}

function ApexArena() {
  const [overview, setOverview] = useState<ApexOverview | null>(null)
  const [reports, setReports] = useState<ApexReports | null>(null)
  const [submittedEntries, setSubmittedEntries] = useState<ApexEntries | null>(null)
  const [activeApexBoard, setActiveApexBoard] = useState<ApexBoardId>('overall')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingRunId, setSubmittingRunId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadApex = async () => {
    setError('')
    setLoading(true)
    try {
      setOverview(await api<ApexOverview>('/apex'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '巅峰竞技场加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api<ApexOverview>('/apex')
      .then((data) => {
        if (active) setOverview(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '巅峰竞技场加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const submitRun = async (runId: string) => {
    setError('')
    setSubmittingRunId(runId)
    try {
      const result = await api<ApexSubmitResponse>('/apex/submit', { method: 'POST', body: JSON.stringify({ runId }) })
      setReports(result.reports)
      setSubmittedEntries(result.entries)
      setOverview((current) => ({
        leaderboards: result.leaderboards,
        dailyBoardKey: result.dailyBoardKey,
        dailyResetHour: result.dailyResetHour,
        candidates: current?.candidates.filter((run) => run.id !== runId) ?? [],
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交巅峰竞技场失败')
    } finally {
      setSubmittingRunId(null)
    }
  }

  const leaderboards = overview?.leaderboards ?? { overall: [], daily: [] }
  const leaderboard = leaderboards[activeApexBoard]
  const candidates = overview?.candidates ?? []
  const activeBoardLabel = activeApexBoard === 'overall' ? '总榜' : '当日榜'

  return (
    <section className="apex-screen">
      <div className="screen-heading centered">
        <h2>巅峰竞技场</h2>
        <p>保存战斗结束后的死数据，自动从榜尾向上挑战，失败后固定在当前名次。</p>
      </div>
      <div className="apex-toolbar">
        <button className="secondary action-button" onClick={() => void loadApex()} disabled={loading}>
          <RefreshCcw size={18} /> 刷新
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {reports && submittedEntries && (
        <div className="apex-report">
          <Trophy size={30} />
          <div>
            <h3>{submittedEntries.overall.name} 已投入巅峰榜</h3>
            <p>总榜第 {reports.overall.placementRank} 名，当日榜第 {reports.daily.placementRank} 名。新记录防守连胜从 {submittedEntries.overall.challengeWins} 开始。</p>
          </div>
        </div>
      )}
      <div className="apex-layout">
        <section className="apex-candidates">
          <div className="panel-heading">
            <h3>可投入的完成狗</h3>
            <p>{candidates.length > 0 ? '选择一只狗进入巅峰竞技场。每只完成局只能提交一次。' : '暂无可提交的完成局。'}</p>
          </div>
          <div className="apex-candidate-list">
            {loading ? (
              <p className="apex-empty">正在读取巅峰数据...</p>
            ) : candidates.length === 0 ? (
              <p className="apex-empty">先在休闲模式完成一局，再回来冲榜。</p>
            ) : candidates.map((candidate) => (
              <article className="apex-candidate-card" key={candidate.id}>
                <img className="dog-avatar small" src={dogAssets[candidate.dogType]} alt="" />
                <div>
                  <strong>{dogNames[candidate.dogType]} · {candidate.wins}胜{candidate.losses}败</strong>
                  <p>第 {candidate.round} 回合 · 遗物 {candidate.relics.length} · 装备 {candidate.items.length}</p>
                </div>
                <button className="primary action-button" disabled={Boolean(submittingRunId)} onClick={() => void submitRun(candidate.id)}>
                  <Crown size={18} /> {submittingRunId === candidate.id ? '挑战中' : '投入巅峰'}
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="apex-leaderboard">
          <div className="panel-heading">
            <h3>{activeBoardLabel}</h3>
            <p>{activeApexBoard === 'daily' ? `每日 05:00 更新 · ${overview?.dailyBoardKey ?? ''}` : '初始50个种子数据会随着玩家提交逐步被挤下去。'}</p>
            <div className="apex-tabs" role="tablist" aria-label="巅峰榜切换">
              <button type="button" role="tab" aria-selected={activeApexBoard === 'overall'} className={activeApexBoard === 'overall' ? 'active' : ''} onClick={() => setActiveApexBoard('overall')}>总榜</button>
              <button type="button" role="tab" aria-selected={activeApexBoard === 'daily'} className={activeApexBoard === 'daily' ? 'active' : ''} onClick={() => setActiveApexBoard('daily')}>当日榜</button>
            </div>
          </div>
          <div className="apex-rank-list">
            {leaderboard.map((entry) => (
              <div className="apex-rank-entry" key={entry.id}>
                <article className={`apex-rank-row ${entry.isSeed ? 'seed' : ''} ${entry.isMine ? 'player-entry' : ''}`}>
                  <b>#{entry.rank}</b>
                  <img className="dog-avatar small" src={dogAssets[entry.dogType]} alt="" />
                  <div>
                    <strong>{entry.name}</strong>
                    <p>{dogNames[entry.dogType]} · {entry.wins}胜{entry.losses}败 · 第 {entry.round} 回合</p>
                  </div>
                  {entry.isMine && <span className="apex-self-marker">我的记录</span>}
                  <span>{entry.isSeed ? '种子' : `防守连胜 ${entry.challengeWins}`}</span>
                  <button className="secondary action-button apex-config-toggle" onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}>
                    {expandedEntryId === entry.id ? '收起配置' : '查看配置'}
                  </button>
                </article>
                {expandedEntryId === entry.id && <ApexSnapshotDetails entry={entry} />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function ApexSnapshotDetails({ entry }: { entry: ApexEntry }) {
  const [inspectedItem, setInspectedItem] = useState<Item | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const equipment = entry.items.filter((item) => item.area === 'EQUIPMENT')
  const bag = entry.items.filter((item) => item.area === 'BAG')
  const apexTipRun: Run = {
    id: entry.id,
    mode: 'CASUAL',
    dogType: entry.dogType,
    luckyNumber: entry.luckyNumber,
    wins: entry.wins,
    losses: entry.losses,
    round: entry.round,
    gold: 0,
    phase: 'COMPLETE',
    status: 'COMPLETE',
    shopType: 'GENERAL',
    shopItems: [],
    choices: [],
    classRewardChoices: [],
    enchantChoices: [],
    potionChoices: [],
    relicChoices: [],
    relics: entry.relics,
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    ladderSettlement: null,
    items: entry.items,
  }
  const setInspectedItemWithAnchor = (item: Item, element: HTMLElement) => {
    setInspectedItem(item)
    setTipAnchor(getFloatingTipPosition(element))
  }
  const closeTip = () => {
    setInspectedItem(null)
    setTipAnchor(null)
  }

  return (
    <div className="apex-snapshot-details">
      <div className="battle-equipment-row player apex-equipment-preview">
        <div className="battle-row-title">
          <span>巅峰装备栏</span>
          <small>{entry.name} · {dogNames[entry.dogType]}</small>
        </div>
        <div className="battle-slot-grid" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
          {Array.from({ length: 12 }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
          {equipment.map((item) => {
            const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), entry.relics)
            return (
            <button
              type="button"
              key={item.id}
              className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
              style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
              title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
              onClick={(event) => setInspectedItemWithAnchor(item, event.currentTarget)}
            >
              <img className="item-icon" src={itemIcon(item.def)} alt="" />
              <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
              <span>{item.def.name}</span>
              {triggerDice && <small><Dice5 size={12} /> {triggerDice}</small>}
            </button>
            )
          })}
        </div>
      </div>
      <div className="apex-relic-preview">
        <RelicRail relics={entry.relics} />
        <p>{entry.relics.length > 0 ? `遗物 ${entry.relics.length} 个` : '没有遗物'} · 背包物品 {bag.length} 个</p>
      </div>
      <FloatingTip run={apexTipRun} item={inspectedItem} offer={null} anchor={tipAnchor} onClose={closeTip} onBuy={null} onSell={null} onUpgrade={null} />
    </div>
  )
}

function LadderHome({ onStart }: { onStart: (choice: { dogType: DogType; luckyNumber?: number }) => void | Promise<void> }) {
  const [overview, setOverview] = useState<LadderMeResponse | null>(null)
  const [leaderboard, setLeaderboard] = useState<LadderLeaderboardResponse | null>(null)
  const [selectedDog, setSelectedDog] = useState<DogType>('SHIBA')
  const [luckyNumber, setLuckyNumber] = useState(1)
  const slots = Array.from({ length: DOG_SELECTION_SLOT_COUNT }, (_, index) => dogOptions[index] ?? null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<LadderMeResponse>('/ladder/me'),
      api<LadderLeaderboardResponse>('/ladder/leaderboard'),
    ]).then(([me, board]) => {
      if (cancelled) return
      setOverview(me)
      setLeaderboard(board)
    }).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const profile = overview?.profile
  const progress = profile
    ? profile.tier === 'MASTER' || profile.tier === 'DOG_KING'
      ? Math.min(100, Math.round((profile.score / 500) * 100))
      : Math.min(100, profile.score)
    : 0
  const startRun = () => {
    onStart(selectedDog === 'EMPEROR' ? { dogType: selectedDog, luckyNumber } : { dogType: selectedDog })
  }

  return (
    <section className="ladder-screen">
      <div className="screen-heading centered">
        <h2>天梯模式</h2>
        <p>12 胜或 5 败结算积分，低段位更宽松，高段位按犬王积分榜竞争。</p>
      </div>
      <div className="ladder-layout">
        <section className="ladder-panel paper-card">
          <div className="section-title">
            <div>
              <h3>当前段位</h3>
              <p>{profile ? `${profile.gamesPlayed} 局 · ${profile.totalWins}胜 ${profile.totalLosses}败` : '读取天梯资料中'}</p>
            </div>
            <Medal size={22} />
          </div>
          <strong className="ladder-rank">{profile ? profile.tierLabel : '青铜'}</strong>
          <div className="ladder-progress" aria-label="天梯积分进度">
            <i style={{ width: `${progress}%` }} />
          </div>
          <p>{profile ? `${profile.score} 分${profile.tier === 'MASTER' ? ' / 500 晋级犬王' : profile.tier === 'DOG_KING' ? ' · 犬王积分' : ' / 100 LP'}` : '0 / 100 LP'}</p>
        </section>

        <section className="ladder-panel paper-card">
          <div className="section-title">
            <div>
              <h3>犬王积分榜</h3>
              <p>{leaderboard?.playerRank ? `你的犬王排名：第 ${leaderboard.playerRank} 名` : '进入犬王后参与排名'}</p>
            </div>
            <Crown size={22} />
          </div>
          <div className="ladder-board">
            {(leaderboard?.leaderboard ?? []).slice(0, 5).map((entry) => (
              <div key={`${entry.rank}-${entry.name}`} className="ladder-row">
                <span>{entry.title}</span>
                <strong>{entry.name}</strong>
                <b>{entry.profile.score}</b>
              </div>
            ))}
            {leaderboard && leaderboard.leaderboard.length === 0 && <p className="apex-empty">还没有犬王，先冲上大师 500 分。</p>}
          </div>
        </section>
      </div>

      <section className="ladder-start paper-card">
        <div className="section-title">
          <div>
            <h3>选择天梯狗狗</h3>
            <p>开始天梯会进入独立匹配池，并按整局表现结算。</p>
          </div>
          <Trophy size={22} />
        </div>
        <div className="dog-select compact">
          <div className="dog-card-grid">
            {slots.map((dog, index) => dog ? (
              <div key={dog} role="button" tabIndex={0} className={`dog-card paper-card paper-dog-card ${selectedDog === dog ? 'selected' : ''}`} onClick={() => setSelectedDog(dog)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelectedDog(dog))}>
                <span className="dog-art-frame">
                  <img className="dog-avatar" src={dogAssets[dog]} alt="" />
                </span>
                <strong>{dogNames[dog]}</strong>
                <small className="card-copy"><RuleText text={dogTraits[dog]} /></small>
              </div>
            ) : (
              <div className="dog-card placeholder paper-card paper-dog-card" key={`ladder-dog-placeholder-${index}`} aria-hidden="true" />
            ))}
          </div>
          <aside className="dog-detail-panel paper-card">
            <span className="dog-detail-art">
              <img className="dog-avatar large" src={dogAssets[selectedDog]} alt="" />
            </span>
            <h2>{dogNames[selectedDog]}</h2>
            <p><RuleText text={dogStrategies[selectedDog]} /></p>
            {selectedDog === 'EMPEROR' && (
              <div className="lucky-number-picker">
                <strong>幸运数字</strong>
                <div>
                  {[1, 2, 3, 4, 5, 6].map((number) => (
                    <button key={number} type="button" className={luckyNumber === number ? 'selected' : ''} onClick={() => setLuckyNumber(number)}>{number}</button>
                  ))}
                </div>
              </div>
            )}
            <button className="primary action-button" onClick={startRun}>开始天梯</button>
          </aside>
        </div>
      </section>

      {overview && overview.recentSettlements.length > 0 && (
        <section className="ladder-panel paper-card">
          <div className="section-title">
            <div>
              <h3>最近结算</h3>
              <p>积分变化按整局胜败统一计算。</p>
            </div>
          </div>
          <div className="ladder-board">
            {overview.recentSettlements.map((settlement) => <LadderSettlementLine key={settlement.id} settlement={settlement} />)}
          </div>
        </section>
      )}
    </section>
  )
}

function LadderSettlementLine({ settlement }: { settlement: LadderSettlement }) {
  return (
    <div className="ladder-row settlement">
      <span>{settlement.wins}胜{settlement.losses}败</span>
      <strong>{ladderTierLabel[settlement.beforeTier]} {settlement.beforeScore} → {ladderTierLabel[settlement.afterTier]} {settlement.afterScore}</strong>
      <b className={settlement.delta >= 0 ? 'gain' : 'loss'}>{settlement.delta >= 0 ? '+' : ''}{settlement.delta}</b>
    </div>
  )
}

function DogSelect({ onPick }: { onPick: (choice: { dogType: DogType; luckyNumber?: number }) => void }) {
  const [selectedDog, setSelectedDog] = useState<DogType>('SHIBA')
  const [luckyNumber, setLuckyNumber] = useState(1)
  const slots = Array.from({ length: DOG_SELECTION_SLOT_COUNT }, (_, index) => dogOptions[index] ?? null)
  const startRun = () => {
    onPick(selectedDog === 'EMPEROR' ? { dogType: selectedDog, luckyNumber } : { dogType: selectedDog })
  }
  return (
    <section className="dog-select-screen" data-tutorial-anchor="dog-select">
      <div className="screen-heading">
        <h2>选择你的狗狗伙伴</h2>
        <p>每个狗狗都有独特的被动特性和策略玩法</p>
      </div>
      <div className="dog-select">
        <div className="dog-card-grid">
          {slots.map((dog, index) => dog ? (
            <div key={dog} role="button" tabIndex={0} className={`dog-card paper-card paper-dog-card ${selectedDog === dog ? 'selected' : ''}`} onClick={() => setSelectedDog(dog)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelectedDog(dog))}>
              <span className="dog-art-frame">
                <img className="dog-avatar" src={dogAssets[dog]} alt="" />
              </span>
              <strong>{dogNames[dog]}</strong>
              <small className="card-copy"><RuleText text={dogTraits[dog]} /></small>
              <span className="tag-row">{dogTags[dog].map((tag) => <b key={tag}>{tag}</b>)}</span>
            </div>
          ) : (
            <div className="dog-card placeholder paper-card paper-dog-card" key={`dog-placeholder-${index}`} aria-hidden="true" />
          ))}
        </div>
        <aside className="dog-detail-panel paper-card">
          <span className="dog-detail-art">
            <img className="dog-avatar large" src={dogAssets[selectedDog]} alt="" />
          </span>
          <h2>{dogNames[selectedDog]}</h2>
          <div className="detail-box">
            <strong>被动特性</strong>
            <p><RuleText text={dogTraits[selectedDog]} /></p>
          </div>
          <div className="detail-box">
            <strong>策略说明</strong>
            <p><RuleText text={dogStrategies[selectedDog]} /></p>
          </div>
          <div className="tag-row">
            {dogTags[selectedDog].map((tag) => <b key={tag}>{tag}</b>)}
          </div>
          {selectedDog === 'EMPEROR' && (
            <div className="lucky-number-picker">
              <strong>幸运数字</strong>
              <div>
                {[1, 2, 3, 4, 5, 6].map((number) => (
                  <button
                    key={number}
                    type="button"
                    className={luckyNumber === number ? 'selected' : ''}
                    onClick={() => setLuckyNumber(number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="primary action-button" onClick={startRun}>开始一局</button>
        </aside>
      </div>
    </section>
  )
}

function Shell({ children, run, error, feedbacks = [], musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { children: React.ReactNode; run?: Run; error?: string; feedbacks?: UiFeedbackEvent[]; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
  const visualTheme = run ? visualThemeForRound(run.round) : 'dogPark'
  return (
    <main className="app-shell">
      <TopBar run={run} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={onToggleMusic} onOpenLobby={onOpenLobby} onLogout={onLogout} />
      {error && <p className="error">{error}</p>}
      <div className={`app-visual-layer visual-theme-${visualTheme} high-impact-vfx`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
        <div className="screen-content">{children}</div>
        <FeedbackLayer feedbacks={feedbacks} />
      </div>
    </main>
  )
}

function FeedbackLayer({ feedbacks }: { feedbacks: UiFeedbackEvent[] }) {
  return (
    <div className="feedback-layer" aria-live="polite" aria-atomic="false">
      {feedbacks.map((feedback) => (
        <div key={feedback.id} className={`ui-feedback-toast ${feedback.tone}`} data-feedback-kind={feedback.kind}>
          <span>{feedback.label}</span>
        </div>
      ))}
    </div>
  )
}

function TopBar({ run, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { run?: Run; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
  const musicTitle = musicEnabled ? (musicBlocked ? '音乐待播放，点击重试' : '关闭音乐') : '开启音乐'
  return (
    <header className="topbar paper-card">
      <div className="brand-block compact">
        <img className="game-logo" src={gameIcon} alt="" />
        <div>
          <h1>狗骰对战</h1>
        </div>
      </div>
      {run && (
        <div className="stats">
          <DogTraitSummary run={run} />
          <ResourcePill icon={<Trophy size={16} />} label="胜场" value={`${run.wins}/12`} tone="win" />
          <ResourcePill icon={<Shield size={16} />} label="容错" value={`${5 - run.losses}`} tone={5 - run.losses <= 1 ? 'danger' : 'safe'} />
          <ResourcePill icon={<Coins size={16} />} label="金币" value={run.gold} tone="gold" />
          <ResourcePill icon={<Dice5 size={16} />} label="回合" value={run.round} tone="round" />
        </div>
      )}
      <div className="topbar-actions">
        {onOpenLobby && (
          <button className="icon-button" title="模式大厅" aria-label="模式大厅" onClick={onOpenLobby}>
            <House size={18} />
          </button>
        )}
        <IconButton title={musicTitle} onClick={onToggleMusic}>
          {musicEnabled ? <Music size={18} /> : <VolumeX size={18} />}
        </IconButton>
        <IconButton title="退出登录" onClick={onLogout}><LogOut size={18} /></IconButton>
      </div>
    </header>
  )
}

function DogTraitSummary({ run }: { run: Run }) {
  const trait = run.dogType === 'EMPEROR' && run.luckyNumber
    ? `${dogTraits[run.dogType]}（【天命数字】 ${run.luckyNumber}）`
    : dogTraits[run.dogType]
  return (
    <span className="dog-trait-summary" title={`${dogNames[run.dogType]}：${trait}`}>
      <img src={dogAssets[run.dogType]} alt="" />
      <span>当前狗狗</span>
      <strong>{dogNames[run.dogType]}</strong>
      <p><RuleText text={trait} /></p>
    </span>
  )
}

function NicknameSetup({ onSubmit }: { onSubmit: (nickname: string) => void | Promise<void> }) {
  const [nickname, setNickname] = useState('')
  const trimmed = nickname.trim()
  return (
    <section className="nickname-setup">
      <div className="screen-heading centered">
        <h2>设置昵称</h2>
        <p>昵称会显示在匹配和战斗记录里。</p>
      </div>
      <form
        className="nickname-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed.length >= 2) void onSubmit(trimmed)
        }}
      >
        <label>
          昵称
          <input value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} autoFocus />
        </label>
        <button className="primary action-button wide" disabled={trimmed.length < 2}>确认</button>
      </form>
    </section>
  )
}

function ResourcePill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <span className={`resource-pill ${tone}`} title={label}>
      {icon}<small>{label}</small><b>{value}</b>
    </span>
  )
}

function IconButton({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return <button className="icon-button" title={title} aria-label={title} disabled={disabled} onClick={onClick}>{children}</button>
}

function ShopChoiceSelect({ choices, onPick }: { choices: ShopType[]; onPick: (shopType: ShopType) => void }) {
  const [selectedChoice, setSelectedChoice] = useState<ShopType | null>(choices[0] ?? null)
  const slots = Array.from({ length: SHOP_CHOICE_SLOT_COUNT }, (_, index) => choices[index] ?? null)
  return (
    <section className="shop-choice-screen">
      <div className="screen-heading centered">
        <h2>选择本回合要访问的商店</h2>
        <p>不同商店提供不同类型的道具，选择适合你战术的商店</p>
      </div>
      <div className="choice-grid">
        {slots.map((choice, index) => choice ? (
          <div key={choice} role="button" tabIndex={0} className={`choice paper-card sticker-card ${selectedChoice === choice ? 'selected' : ''}`} onClick={() => setSelectedChoice(choice)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelectedChoice(choice))}>
            <span className="choice-icon">{shopChoiceIcon(choice)}</span>
            <strong>{shopNames[choice]}</strong>
            <span className="choice-copy"><RuleText text={shopDescriptions[choice]} /></span>
          </div>
        ) : (
          <div className="choice placeholder paper-card sticker-card" key={`choice-placeholder-${index}`} aria-hidden="true" />
        ))}
      </div>
      <button className="primary action-button choice-submit" disabled={!selectedChoice} onClick={() => selectedChoice && onPick(selectedChoice)}>
        进入 {selectedChoice ? shopNames[selectedChoice] : '商店'}
      </button>
    </section>
  )
}

function shopChoiceIcon(shopType: ShopType) {
  if (shopType === 'RELIC') return <Trophy size={36} />
  if (shopType === 'UPGRADE') return <PackagePlus size={36} />
  if (shopType === 'POTION') return <Sparkles size={36} />
  if (shopType === 'LARGE') return <Backpack size={36} />
  if (shopType === 'MEDIUM') return <Shield size={36} />
  if (shopType === 'SMALL') return <ShoppingBag size={36} />
  if (shopType === 'SMALL_DICE') return <Dice5 size={36} />
  if (shopType === 'BIG_DICE') return <Coins size={36} />
  return <Swords size={36} />
}

function handleChoiceCardKeyDown(event: KeyboardEvent<HTMLElement>, onChoose: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onChoose()
  }
}

function ClassRewardCeremony({ run, choices, onDismiss }: { run: Run; choices: ClassRewardChoice[]; onDismiss: () => void }) {
  const visualTheme = visualThemeForRound(run.round)
  const finalAwakening = run.round >= 6
  const title = finalAwakening ? '终阶觉醒' : '职业觉醒'
  const subtitle = finalAwakening ? '终阶职业装备已经解锁，构筑的核心能力将在这一回合定型。' : '职业路线开始成型，选择一件专属装备改变接下来的战斗节奏。'

  function handleCeremonyKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onDismiss()
    }
  }

  return (
    <section
      className={`class-reward-ceremony surprise-surface visual-theme-surface visual-theme-${visualTheme}`}
      data-visual-theme={visualTheme}
      style={{ ...visualThemeStyle(visualTheme), ...surpriseBackgroundStyle('classReward') }}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={handleCeremonyKeyDown}
      aria-label={`${dogNames[run.dogType]}${title}`}
    >
      <div className="ceremony-stage">
        <div className="ceremony-round-badge">第 {run.round} 回合</div>
        <img className="ceremony-dog-avatar" src={dogAssets[run.dogType]} alt="" />
        <div className="ceremony-copy">
          <span>{dogNames[run.dogType]} 专属装备授予</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="ceremony-reward-preview" aria-label="本次可选职业装备">
          {choices.map((choice) => {
            const triggerDice = triggerDiceLabel(choice.def)
            return (
            <span key={choice.defId} className={`ceremony-reward-chip ${qualityClass(choice.quality)}`}>
              <strong>{choice.def.name}</strong>
              <small>{choice.def.size}格{triggerDice ? ` · ${triggerDice}` : ''}</small>
            </span>
            )
          })}
        </div>
        <span className="ceremony-skip-hint">点击任意处继续</span>
      </div>
    </section>
  )
}

function ClassRewardSelect({ choices, visualTheme, onPick }: { choices: ClassRewardChoice[]; visualTheme: VisualThemeId; onPick: (defId: string) => void }) {
  const [selected, setSelected] = useState(choices[0]?.defId ?? '')
  return (
    <section className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择职业装备</h2>
        <p>先整理背包，再选择一个职业装备放入背包。</p>
      </div>
      <div className="reward-choice-grid">
        {choices.map((choice) => {
          const triggerDice = triggerDiceLabel(choice.def)
          return (
          <div key={choice.defId} role="button" tabIndex={0} className={`choice paper-card sticker-card reward-choice ${selected === choice.defId ? 'selected' : ''}`} onClick={() => setSelected(choice.defId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.defId))}>
            <strong>{choice.def.name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{qualityLabel[choice.quality]}</span>
            <span>{choice.def.size}格{triggerDice ? ` · ${triggerDice}` : ''}</span>
            <span className="choice-copy"><RuleText text={choice.def.description ?? effectText(choice.def, choice.quality)} /></span>
          </div>
          )
        })}
      </div>
      <button className="primary action-button choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>领取职业装备</button>
    </section>
  )
}

function EnchantCeremony({ run, choices, onDismiss }: { run: Run; choices: EnchantmentChoice[]; onDismiss: () => void }) {
  const visualTheme = visualThemeForRound(run.round)
  return (
    <section
      className={`class-reward-ceremony enchant-ceremony surprise-surface visual-theme-surface visual-theme-${visualTheme}`}
      data-visual-theme={visualTheme}
      style={{ ...visualThemeStyle(visualTheme), ...surpriseBackgroundStyle('enchant') }}
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(event) => handleChoiceCardKeyDown(event, onDismiss)}
      aria-label="附魔商店出现"
    >
      <div className="ceremony-stage">
        <div className="ceremony-round-badge">第 {run.round} 回合</div>
        <Sparkles className="ceremony-dog-avatar enchant-orb" size={96} />
        <div className="ceremony-copy">
          <span>神秘附魔商店</span>
          <h2>免费附魔</h2>
          <p>选择一种附魔，再点击任意装备施加；升级后会保留目标装备上的附魔。</p>
        </div>
        <div className="ceremony-reward-preview" aria-label="本次可选附魔">
          {choices.map((choice) => (
            <span key={choice.id} className="ceremony-reward-chip enchant-chip">
              <strong>{choice.enchant.label}</strong>
              <small>{choice.description}</small>
            </span>
          ))}
        </div>
        <span className="ceremony-skip-hint">点击任意处继续</span>
      </div>
    </section>
  )
}

function EnchantChoiceSelect({ choices, selectedId, visualTheme, onSelect }: { choices: EnchantmentChoice[]; selectedId: string; visualTheme: VisualThemeId; onSelect: (id: string) => void }) {
  return (
    <section className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme} enchant-panel`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择附魔</h2>
        <p>选中一个附魔后，点击装备栏或背包中的任意装备施加。</p>
      </div>
      <div className="reward-choice-grid">
        {choices.map((choice) => (
          <div key={choice.id} role="button" tabIndex={0} className={`choice paper-card sticker-card reward-choice enchant-choice ${selectedId === choice.id ? 'selected' : ''}`} onClick={() => onSelect(choice.id)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => onSelect(choice.id))}>
            <Sparkles size={28} />
            <strong>{choice.enchant.label}</strong>
            <span className="tip-tag">免费</span>
            <span className="choice-copy"><RuleText text={choice.description} /></span>
          </div>
        ))}
      </div>
      <small className="disabled-reason">当前选中：{choices.find((choice) => choice.id === selectedId)?.enchant.label ?? '请选择附魔'}</small>
    </section>
  )
}

function RelicChoiceSelect({ choices, visualTheme, onPick }: { choices: RelicChoice[]; visualTheme: VisualThemeId; onPick: (relicId: string) => void }) {
  const [selected, setSelected] = useState(choices[0]?.relicId ?? '')
  return (
    <section className={`shop-choice-screen reward-panel visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择遗物</h2>
        <p>免费选择一个遗物；重复遗物会直接升级。</p>
      </div>
      <div className="choice-grid relic-choice-grid">
        {choices.map((choice) => (
          <div key={choice.relicId} role="button" tabIndex={0} className={`choice paper-card sticker-card relic-choice ${selected === choice.relicId ? 'selected' : ''}`} onClick={() => setSelected(choice.relicId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.relicId))}>
            <RelicGlyph relic={choice} size={44} />
            <strong>{choice.def.name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{qualityLabel[choice.quality]}</span>
            <span className="choice-copy"><RuleText text={choice.def.description} /></span>
          </div>
        ))}
      </div>
      <button className="primary action-button choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>获得遗物</button>
    </section>
  )
}

function UpgradeChoiceSelect({ run, visualTheme }: { run: Run; visualTheme: VisualThemeId }) {
  const upgradeableCount = run.items.filter(canFreeUpgradeItem).length
  return (
    <section className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme} upgrade-panel`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择升级装备</h2>
        <p>点击装备栏或背包里任意未达到钻石的装备，免费提升 1 个品质。</p>
      </div>
      <div className="reward-choice-grid">
        <div className="choice paper-card sticker-card reward-choice enchant-choice selected">
          <PackagePlus size={28} />
          <strong>免费升级</strong>
          <span className="tip-tag">可升级 {upgradeableCount} 件</span>
          <span className="choice-copy">钻石品质已经满级，不能继续提升。</span>
        </div>
      </div>
    </section>
  )
}

function PotionChoiceSelect({ choices, selectedId, visualTheme, onSelect }: { choices: PotionChoice[]; selectedId: string; visualTheme: VisualThemeId; onSelect: (id: string) => void }) {
  return (
    <section className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme} potion-panel`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择药水</h2>
        <p>先选一瓶药水，再点击一件非职业装备，修改它的基础触发点数。</p>
      </div>
      <div className="reward-choice-grid">
        {choices.map((choice) => (
          <div key={choice.id} role="button" tabIndex={0} className={`choice paper-card sticker-card reward-choice enchant-choice ${selectedId === choice.id ? 'selected' : ''}`} onClick={() => onSelect(choice.id)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => onSelect(choice.id))}>
            <Sparkles size={28} />
            <strong>{choice.description}</strong>
            <span className="tip-tag">药水</span>
            <span className="choice-copy">修改基础触发点数；之后仍会被遗物和其他道具影响。</span>
          </div>
        ))}
      </div>
      <small className="disabled-reason">职业装备不可使用药水</small>
    </section>
  )
}

function ShopShelf({ run, selectedOfferId, draggingItemId, onInspectOffer, onReroll, onMatch }: { run: Run; selectedOfferId: string | null; draggingItemId: string | null; onInspectOffer: (offerId: string, element: HTMLElement) => void; onReroll: () => void; onMatch: () => void }) {
  const visualTheme = visualThemeForRound(run.round)
  return (
    <section className={`shop-shelf sketch-panel visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)} data-tutorial-anchor="shop-offers">
      <div className="section-title">
        <div>
          <h2>{shopNames[run.shopType]}</h2>
          <p>点击商品查看详情，确认后再购买。</p>
        </div>
        <div className="shop-actions">
          <SellDropZone active={Boolean(draggingItemId)} />
          <button className="reroll-button" onClick={onReroll} title={`刷新商店：${run.refreshCost} 金币`}>
            <RefreshCcw size={18} />
            <span className="price-tag"><Coins size={14} />{run.refreshCost}</span>
          </button>
        </div>
      </div>
      <div className="offer-row">
        {run.shopItems.map((offer) => (
          <ShopCard key={offer.offerId} offer={offer} selected={selectedOfferId === offer.offerId} ownedCount={shopOfferOwnedCount(run, offer)} affordable={run.gold >= offer.price} onClick={(element) => onInspectOffer(offer.offerId, element)} />
        ))}
      </div>
      <button className="primary action-button match-button" data-tutorial-anchor="match-button" onClick={onMatch}>
        <Swords size={18} /> 匹配
      </button>
    </section>
  )
}

function SellDropZone({ active }: { active: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'SELL_ZONE' })
  return (
    <div ref={setNodeRef} className={`sell-zone ${active ? 'active' : ''} ${isOver ? 'over' : ''}`}>
      <BadgeDollarSign size={18} />
      <span>拖到这里出售</span>
    </div>
  )
}

function ShopCard({ offer, selected, ownedCount, affordable, onClick }: { offer: ShopOffer; selected: boolean; ownedCount: number; affordable: boolean; onClick: (element: HTMLElement) => void }) {
  const def = offer.def
  const quality = normalizeQuality(offer.quality)
  const owned = ownedCount > 0
  const triggerDice = def ? triggerDiceLabel(def) : null
  return (
    <button className={`shop-card paper-shop-card paper-card ${qualityClass(offer.quality)} ${owned ? 'shop-card-owned' : ''} ${affordable ? '' : 'shop-card-unaffordable'} ${selected ? 'selected' : ''}`} onClick={(event) => onClick(event.currentTarget)}>
      <span className="quality-chip shop-quality-chip">{qualityLabel[quality]}</span>
      {owned && <span className="owned-badge" aria-label={`已拥有 ${ownedCount} 件同名装备`}>已拥有 x{ownedCount}</span>}
      {def && <img className="shop-item-icon" src={itemIcon(def)} alt="" />}
      <div className="shop-card-main">
        <span className={`size-badge ${def ? itemTone(def) : 'utility'}`}>{def?.size ?? '?'}格</span>
        <strong>{def?.name ?? offer.defId}</strong>
      </div>
      {def && <SizePreview size={def.size} />}
      {triggerDice && <span className="dice-line"><Dice5 size={15} /> {triggerDice}</span>}
      <span className="effect-line">{def ? effectText(def, quality) : '未知效果'}</span>
      <span className="price-tag"><Coins size={14} />{offer.price}{offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
    </button>
  )
}

function SizePreview({ size }: { size: number }) {
  return (
    <span className="size-preview" aria-label={`占用 ${size} 格`}>
      {[1, 2, 3, 4].map((slot) => <i key={slot} className={slot <= size ? 'filled' : ''} />)}
    </span>
  )
}

function InventoryBoard({ run, selectedItemId, draggingItemId, onSellRelic, onSelectItem, onSlotClick }: { run: Run; selectedItemId: string | null; draggingItemId: string | null; onSellRelic?: ((relicId: string) => void) | null; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
  const equipmentSlots = equipmentSlotCount(run.relics)
  const visualTheme = visualThemeForRound(run.round)
  return (
    <section className={`inventory-board expanded paper-inventory visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <GridPanel title="装备栏" subtitle={`${equipmentSlots} 格单行，从左向右触发`} icon={<Grid3X3 size={18} />} area="EQUIPMENT" tutorialAnchor="equipment-board" w={equipmentSlots} h={1} items={run.items} relics={run.relics ?? []} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      <div className="bag-relic-row">
        <RelicRail relics={run.relics ?? []} onSellRelic={onSellRelic ?? null} />
        <GridPanel title="背包" subtitle={`${BASE_EQUIPMENT_SLOT_COUNT} 格单行，战斗中默认不生效`} icon={<Backpack size={18} />} area="BAG" tutorialAnchor="bag-board" w={BASE_EQUIPMENT_SLOT_COUNT} h={1} items={run.items} relics={run.relics ?? []} selectedItemId={selectedItemId} draggingItemId={draggingItemId} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      </div>
    </section>
  )
}

function RelicRail({ relics, onSellRelic, compact = false }: { relics: Relic[]; onSellRelic?: ((relicId: string) => void) | null; compact?: boolean }) {
  const [selectedRelicId, setSelectedRelicId] = useState<string | null>(null)
  const [relicTipAnchor, setRelicTipAnchor] = useState<TipAnchor | null>(null)
  const selectedRelic = relics.find((relic) => relic.id === selectedRelicId) ?? null
  const closeRelicTip = () => {
    setSelectedRelicId(null)
    setRelicTipAnchor(null)
  }
  return (
    <aside className={`relic-rail ${compact ? 'compact' : ''}`}>
      <div className="grid-heading">
        <h3><Trophy size={18} />遗物</h3>
        <p>6槽，重复获得升级</p>
      </div>
      <div className="relic-slot-grid">
        {Array.from({ length: 6 }).map((_, index) => {
          const relic = relics.find((entry) => entry.slot === index)
          return (
            <div key={index} className={`relic-slot ${relic ? qualityClass(relic.quality) : ''}`}>
              {relic ? (
                <button
                  type="button"
                  className="relic-icon-button"
                  aria-label={`${qualityLabel[relic.quality]}遗物：${relic.def.name}`}
                  aria-pressed={selectedRelicId === relic.id}
                  title={`${qualityLabel[relic.quality]} ${relic.def.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedRelicId(selectedRelicId === relic.id ? null : relic.id)
                    setRelicTipAnchor(selectedRelicId === relic.id ? null : getFloatingTipPosition(event.currentTarget))
                  }}
                >
                  <RelicGlyph relic={relic} size={compact ? 24 : 30} />
                  <span className="relic-quality-dot" aria-hidden="true" />
                </button>
              ) : <span className="relic-empty-mark" aria-hidden="true" />}
            </div>
          )
        })}
      </div>
      <RelicFloatingTip relic={selectedRelic} anchor={relicTipAnchor} onClose={closeRelicTip} onSell={onSellRelic ? (relicId) => { onSellRelic(relicId); closeRelicTip() } : null} />
    </aside>
  )
}

function RelicGlyph({ relic, size }: { relic: Relic | RelicChoice; size: number }) {
  return <img className="relic-glyph" src={relicIcon(relic.def)} alt="" style={{ width: size, height: size }} />
}

function RelicFloatingTip({ relic, anchor, onClose, onSell }: { relic: Relic | null; anchor: TipAnchor | null; onClose: () => void; onSell?: ((relicId: string) => void) | null }) {
  useOutsideTipDismiss(Boolean(relic), onClose)
  if (!relic) return null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  return (
    <aside className="relic-floating-tip floating-tip paper-card" style={style}>
      <div className="tip-tags">
        <span className={`tip-tag ${qualityClass(relic.quality)}`}>{qualityLabel[relic.quality]}</span>
        {relic.def.tags.map((tag) => <span key={tag} className="tip-tag">{tag}</span>)}
      </div>
      <div className="relic-tip-identity">
        <span className={`relic-tip-icon ${qualityClass(relic.quality)}`}>
          <RelicGlyph relic={relic} size={44} />
        </span>
        <h3>{relic.def.name}</h3>
      </div>
      <p className="tip-description"><RuleText text={relic.def.description} /></p>
      {onSell && (
        <div className="tip-actions">
          <button className="danger-button wide" onClick={() => onSell(relic.id)}>
            <BadgeDollarSign size={18} /> 出售 +0
          </button>
        </div>
      )}
    </aside>
  )
}

function GridPanel({ title, subtitle, icon, area, tutorialAnchor, w, h, items, relics = [], selectedItemId, draggingItemId, onSelectItem, onSlotClick }: { title: string; subtitle: string; icon: React.ReactNode; area: Area; tutorialAnchor?: string; w: number; h: number; items: Item[]; relics?: Relic[]; selectedItemId: string | null; draggingItemId: string | null; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
  return (
    <div className="grid-panel" data-tutorial-anchor={tutorialAnchor}>
      <div className="grid-heading">
        <h3>{icon}{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="slot-grid" style={{ gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${h}, var(--board-slot-h))` }}>
        {Array.from({ length: w * h }).map((_, index) => {
          const x = index % w
          const y = Math.floor(index / w)
          return <Slot key={`${area}:${x}:${y}`} id={`${area}:${x}:${y}`} x={x} y={y} title={`${title} ${x + 1}-${y + 1}`} onClick={() => onSlotClick(area, x, y)} />
        })}
        {items.filter((item) => item.area === area).map((item) => (
          <DraggableItem key={item.id} item={item} relics={relics} selected={selectedItemId === item.id} dragging={draggingItemId === item.id} upgradeable={canUpgradeItem(item, items)} onSelect={(element) => onSelectItem(item.id, element)} />
        ))}
      </div>
    </div>
  )
}

function Slot({ id, x, y, title, onClick }: { id: string; x: number; y: number; title: string; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return <button ref={setNodeRef} style={{ gridColumn: x + 1, gridRow: y + 1 }} className={`slot ${isOver ? 'over' : ''}`} onClick={onClick} aria-label={title} title={title} />
}

function DraggableItem({ item, relics, selected, dragging, upgradeable, onSelect }: { item: Item; relics: Relic[]; selected: boolean; dragging: boolean; upgradeable: boolean; onSelect: (element: HTMLElement) => void }) {
  const { attributes, listeners, setNodeRef: setDraggableNodeRef } = useDraggable({ id: item.id })
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id: `UPGRADE_ITEM:${item.id}` })
  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableNodeRef(node)
    setDropNodeRef(node)
  }
  const style = {
    gridColumn: `${item.x + 1} / span ${item.def.width}`,
    gridRow: `${item.y + 1} / span ${item.def.height}`,
  }
  const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), relics)
  return (
    <button
      ref={setNodeRef}
      className={`item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${upgradeable ? 'can-upgrade' : ''} ${isOver ? 'upgrade-over' : ''}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(event.currentTarget)
      }}
      title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${item.def.size}格${triggerDice ? ` · 点数 ${triggerDice}` : ''}`}
      {...listeners}
      {...attributes}
    >
      <ItemCardContent item={item} relics={relics} upgradeable={upgradeable} />
    </button>
  )
}

function ItemCardContent({ item, relics = [], upgradeable = false }: { item: Item; relics?: Relic[]; upgradeable?: boolean }) {
  const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), relics)
  return (
    <>
      <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
      {upgradeable && <span className="upgrade-indicator" title="可升级">↑</span>}
      <img className="item-icon" src={itemIcon(item.def)} alt="" />
      <span>{item.def.name}</span>
      {item.enchant && <span className="enchant-badge"><Sparkles size={12} />附魔</span>}
      <SizePreview size={item.def.size} />
      {triggerDice && <small><Dice5 size={12} /> {triggerDice}</small>}
      <small className="item-effect">{effectText(item.def, normalizeQuality(item.quality))}</small>
      {item.enchant && <small className="item-effect enchant-text">{enchantmentText(item.enchant)}</small>}
    </>
  )
}

function DraggingItemOverlay({ item, relics = [] }: { item: Item | null; relics?: Relic[] }) {
  if (!item) return null
  return (
    <div
      className={`drag-overlay-item item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
      style={{ width: `calc(${item.def.width} * var(--slot-w))`, height: `calc(${item.def.height} * var(--board-slot-h))` }}
    >
      <ItemCardContent item={item} relics={relics} />
    </div>
  )
}

function FloatingTip({ run, item, offer, anchor, descriptionOverride, relicsOverride, onClose, onBuy, onSell, onUpgrade }: { run: Run; item: Item | null; offer: ShopOffer | null; anchor: TipAnchor | null; descriptionOverride?: string | null; relicsOverride?: Relic[] | null; onClose: () => void; onBuy: (() => void) | null; onSell: (() => void) | null; onUpgrade: (() => void) | null }) {
  const def = item?.def ?? offer?.def
  useOutsideTipDismiss(Boolean(def), onClose)
  if (!def) return null
  const isOffer = Boolean(offer)
  const quality = normalizeQuality(item?.quality ?? offer?.quality)
  const canAfford = !offer || run.gold >= offer.price
  const sellValue = item ? sellValueForItem(item) : null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  const tipTriggerDice = triggerDiceLabel(item ? itemTriggerDisplay(item) : def, item ? (relicsOverride ?? run.relics) : [])
  return (
    <aside className="floating-tip paper-card" style={style}>
      <div className="tip-tags">
        <span className={`size-badge ${itemTone(def)}`}>{def.size}格</span>
        <span className={`tip-tag ${qualityClass(quality)}`}>{qualityLabel[quality]}</span>
        <span className="tip-tag">{diceToneText(def)}</span>
        <span className="tip-tag">{effectToneText(def)}</span>
      </div>
      <div className="tip-body">
        <div className="tip-identity">
          <span className={`tip-icon-frame ${itemTone(def)}`}>
            <img className="tip-icon" src={itemIcon(def)} alt="" />
          </span>
          <h3>{def.name}</h3>
        </div>
        <div className="tip-grid-preview">
          <SizePreview size={def.size} />
          <span>占用 {def.size} 格</span>
        </div>
      </div>
      {tipTriggerDice && (
        <div className="tip-dice" aria-label={`触发点数 ${tipTriggerDice}`}>
          <Dice5 size={22} />
          {tipTriggerDice.split('/').map((face) => <span key={face}>{face}</span>)}
        </div>
      )}
      <p className="tip-description"><RuleText text={descriptionOverride ?? def.description ?? effectText(def, quality)} /></p>
      {item?.enchant && <p className="tip-description enchant-tip"><Sparkles size={16} /> <RuleText text={enchantmentText(item.enchant)} /></p>}
      {isOffer && (
        <div className="tip-price">
          <Coins size={16} />
          <span>价格 {offer?.price}{offer && offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
        </div>
      )}
      <div className="tip-actions">
        {isOffer && onBuy ? (
          <button className="primary action-button wide" data-tutorial-anchor="shop-buy" disabled={!canAfford} onClick={onBuy}>
            <PackagePlus size={18} /> 购买到背包
          </button>
        ) : (
          <>
            {onUpgrade && (
              <button className="primary action-button wide" onClick={onUpgrade}>
                <PackagePlus size={18} /> 升级
              </button>
            )}
            {onSell ? (
              <button className="danger-button wide" onClick={onSell}>
                <BadgeDollarSign size={18} /> 出售 +{sellValue}
              </button>
            ) : !onUpgrade ? (
              <small className="disabled-reason">战斗中仅查看物品详情</small>
            ) : null}
          </>
        )}
        {!canAfford && <small className="disabled-reason">金币不足，还差 {(offer?.price ?? 0) - run.gold} 金币。</small>}
      </div>
    </aside>
  )
}

function StatusFloatingTip({ statusTip, onClose }: { statusTip: StatusTipState | null; onClose: () => void }) {
  useOutsideTipDismiss(Boolean(statusTip), onClose)
  useEffect(() => {
    if (!statusTip) return undefined
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [statusTip, onClose])
  if (!statusTip) return null
  const { status, anchor, side, polarity } = statusTip
  const detail = statusTipDetails[status.type] ?? {
    polarity: polarity === 'positive' ? '正面效果' : '负面效果',
    timing: '状态存在期间生效',
    description: '这个状态会影响当前战斗。请以芯片上的数值和战斗日志为准。',
    source: '来源：装备、职业道具或遗物效果。',
  }
  const style = { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties
  return (
    <aside id={statusTipId} className="floating-tip paper-card status-floating-tip" style={style} role="tooltip">
      <div className="status-tip-title">
        <strong>{status.label}</strong>
        <span className={`tip-tag ${status.type}`}>{detail.polarity}</span>
      </div>
      <div className="tip-tags">
        <span className="tip-tag">{side === 'player' ? '我方' : '敌方'}</span>
        <span className="tip-tag">{statusText(status)}</span>
      </div>
      <p className="status-tip-description"><RuleText text={detail.description} /></p>
      <small><RuleText text={detail.timing} /></small>
      <small><RuleText text={detail.source} /></small>
    </aside>
  )
}

function ForfeitRunAction({ run, onForfeit }: { run: Run; onForfeit: () => void }) {
  return (
    <section className="forfeit-run-action paper-card" aria-label="放弃并结算当前跑局">
      <div>
        <strong>当前 {run.wins} 胜 {run.losses} 败</strong>
        <span>放弃后立即按当前记录结算，不会额外增加失败。</span>
      </div>
      <button className="danger-button action-button" type="button" onClick={onForfeit}>
        <Flag size={18} /> 放弃并结算
      </button>
    </section>
  )
}

function BattleView({ run, battle, currentEvent, eventIndex, speed, score, soundEnabled, onSpeed, onContinue, onRestart }: { run: Run; battle: Battle | null; currentEvent?: BattleEvent; eventIndex: number; speed: number; score: number; soundEnabled: boolean; onSpeed: (speed: number) => void; onContinue: () => void; onRestart: () => void }) {
  const [logOpen, setLogOpen] = useState(false)
  const [battleTip, setBattleTip] = useState<{ item: Item; owner: 'player' | 'opponent'; anchor: TipAnchor } | null>(null)
  const playback = battle ?? run.lastBattle
  const visualTheme = visualThemeForRound(run.round)
  const events = playback?.events ?? []
  const displayIndex = battle ? eventIndex : Math.max(0, events.length - 1)
  const event = currentEvent ?? events[Math.min(displayIndex, Math.max(0, events.length - 1))]
  const playerSnapshot = playback?.playerSnapshot ?? {
    name: '你的狗狗',
    dogType: run.dogType,
    luckyNumber: run.luckyNumber,
    wins: run.wins,
    losses: run.losses,
    round: run.round,
    items: run.items,
  }
  const opponentSnapshot = playback?.opponentSnapshot ?? {
    name: run.matchedGhost?.name ?? '离线狗狗',
    dogType: run.matchedGhost?.dogType ?? 'MUTT',
    luckyNumber: run.matchedGhost?.luckyNumber ?? null,
    wins: run.matchedGhost?.wins ?? 0,
    losses: run.matchedGhost?.losses ?? 0,
    round: run.matchedGhost?.round ?? run.round,
    items: [] as Item[],
  }
  const lastRollEvent = events.slice(0, displayIndex + 1).reverse().find((entry) => entry.kind === 'ROLL')
  const isFinished = Boolean(playback && (!battle || eventIndex >= events.length - 1))
  const targetEquipment = event && playback ? targetEquipmentItemsForBattleEvent(event, playerSnapshot, opponentSnapshot) : { owner: null, itemIds: [] }
  const presentation = battlePresentationWithEquipmentTarget(event ? createBattlePresentation(event) : null, targetEquipment)

  useEffect(() => {
    if (!presentation) return
    playFeedbackSound(soundCueForBattlePresentation(presentation.kind), { enabled: soundEnabled })
  }, [displayIndex, presentation?.kind, soundEnabled])

  return (
    <section className={`battle-panel visual-battle sketch-panel visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="battle-toolbar">
        <div className="battle-status">
          <h2>自动战斗</h2>
          <p>{event ? `${event.time}s · ${event.text}` : '准备播放战斗结果'}</p>
        </div>
        <div className="speed-row" aria-label="战斗速度">
          {[1, 2, 4].map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => onSpeed(value)}>{value}x</button>)}
        </div>
      </div>

      <BattleFxStage event={event} presentation={presentation} speed={speed} />
      <BattleEquipmentRow owner="opponent" snapshot={opponentSnapshot} events={events} displayIndex={displayIndex} activeEvent={event} targetItemIds={targetEquipment.owner === 'opponent' ? targetEquipment.itemIds : []} onInspect={(item, element) => setBattleTip({ item, owner: 'opponent', anchor: getFloatingTipPosition(element) })} />
      <BattleStage
        player={playerSnapshot}
        opponent={opponentSnapshot}
        event={event}
        presentation={presentation}
        lastRoll={lastRollEvent}
        finished={isFinished}
        winner={playback?.winner}
        visualTheme={visualTheme}
      />
      <BattleEquipmentRow owner="player" snapshot={playerSnapshot} events={events} displayIndex={displayIndex} activeEvent={event} targetItemIds={targetEquipment.owner === 'player' ? targetEquipment.itemIds : []} onInspect={(item, element) => setBattleTip({ item, owner: 'player', anchor: getFloatingTipPosition(element) })} />
      {battleTip && (
        <FloatingTip
          run={run}
          item={battleTip.item}
          offer={null}
          anchor={battleTip.anchor}
          descriptionOverride={growthDamageTextForBattleItem(battleTip.item, battleTip.owner, events, displayIndex)}
          relicsOverride={battleTip.owner === 'player' ? playerSnapshot.relics ?? [] : opponentSnapshot.relics ?? []}
          onClose={() => setBattleTip(null)}
          onBuy={null}
          onSell={null}
          onUpgrade={null}
        />
      )}

      {run.phase === 'COMPLETE' ? (
        <SettlementView run={run} score={score} onRestart={onRestart} />
      ) : run.phase === 'BATTLE' && isFinished && (
        <div className="battle-continue-row">
          <button className="primary action-button" data-tutorial-anchor="battle-continue" onClick={onContinue}>
            <ArrowRight size={18} /> 继续
          </button>
        </div>
      )}

      <CollapsedBattleLog events={events} eventIndex={displayIndex} open={logOpen} onToggle={() => setLogOpen((value) => !value)} />
    </section>
  )
}

function SettlementView({ run, score, onRestart }: { run: Run; score: number; onRestart: () => void }) {
  const visualTheme = visualThemeForRound(run.round)
  return (
    <section className="settlement-page surprise-surface" style={surpriseBackgroundStyle('settlement')}>
      <div className={`result handdrawn-result paper-card settlement-card visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={{ ...visualThemeStyle(visualTheme), ...surpriseBackgroundStyle('settlement') }}>
        <Trophy size={32} />
        <h2>跑局结束</h2>
        <div className="settlement-score-grid">
          <span>
            <small>胜场</small>
            <strong>{run.wins}</strong>
          </span>
          <span>
            <small>败场</small>
            <strong>{run.losses}</strong>
          </span>
          <span>
            <small>积分</small>
            <strong>{score}</strong>
          </span>
        </div>
        {run.ladderSettlement && <LadderSettlementSummary settlement={run.ladderSettlement} />}
        <button className="primary action-button" onClick={onRestart}>重新选择狗狗</button>
      </div>
    </section>
  )
}

function LadderSettlementSummary({ settlement }: { settlement: LadderSettlement }) {
  return (
    <div className="ladder-formula">
      <strong>{ladderTierLabel[settlement.beforeTier]} {settlement.beforeScore} → {ladderTierLabel[settlement.afterTier]} {settlement.afterScore}</strong>
      <p>
        基础 {settlement.baseScore >= 0 ? `+${settlement.baseScore}` : settlement.baseScore}
        {' '} - 段位税 {settlement.tierTax}
        {' '} - 败场 {settlement.lossPenalty}
        {settlement.perfectBonus > 0 ? ` + 完美 ${settlement.perfectBonus}` : ''}
        {settlement.newbieProtection > 0 ? ` + 新手保护 ${settlement.newbieProtection}` : ''}
        {' '} = {settlement.delta >= 0 ? `+${settlement.delta}` : settlement.delta}
      </p>
    </div>
  )
}

function BattleEquipmentRow({ owner, snapshot, events, displayIndex, activeEvent, targetItemIds = [], onInspect }: { owner: 'player' | 'opponent'; snapshot: BattleSnapshot; events: BattleEvent[]; displayIndex: number; activeEvent?: BattleEvent; targetItemIds?: string[]; onInspect: (item: Item, element: HTMLElement) => void }) {
  const items = snapshot.items.filter((item) => item.area === 'EQUIPMENT')
  const activeItemId = activeEvent?.actor === owner && activeEvent.kind === 'ITEM' ? activeEvent.itemId : null
  const activeVfxKind = battleVfxKind(activeEvent)
  const slots = equipmentSlotCount(snapshot.relics)
  return (
    <div className={`battle-equipment-row ${owner} sketch-panel`}>
      <div className="battle-row-title">
        <span>{owner === 'player' ? '你的装备栏' : '对手装备栏'}</span>
        <small>{snapshot.name} · {dogNames[snapshot.dogType]}</small>
      </div>
      <div className="battle-slot-grid" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
        {items.map((item) => {
          const growthText = growthDamageTextForBattleItem(item, owner, events, displayIndex)
          const boomCounterState = boomCounterStateForBattleItem(item, owner, events, displayIndex, activeEvent)
          const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), snapshot.relics ?? [])
          const triggerCountLabel = itemTriggerCountLabel(events, owner, item.id, displayIndex)
          const triggerCountPopping = activeItemId === item.id
          return (
          <button
            type="button"
            key={item.id}
            className={`battle-item item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${activeItemId === item.id ? `active battle-item-trigger vfx-trigger-${activeVfxKind}` : ''} ${targetItemIds.includes(item.id) ? 'battle-item-vfx-target' : ''} ${boomCounterState ? 'boom-counter' : ''} ${boomCounterState?.popping ? 'boom-counter-pop' : ''} ${triggerCountPopping ? 'trigger-count-pop' : ''}`}
            {...battleVfxAnchorAttrs('equipment-row', owner, item.id)}
            data-vfx-kind={battleVfxKind(activeEvent)}
            style={{
              gridColumn: `${item.x + 1} / span ${item.def.width}`,
              gridRow: 1,
            }}
            title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${growthText ?? effectText(item.def, normalizeQuality(item.quality))}`}
            onClick={(event) => onInspect(item, event.currentTarget)}
          >
            <img className="item-icon" src={itemIcon(item.def)} alt="" />
            <span className="quality-chip">{qualityLabel[normalizeQuality(item.quality)]}</span>
            <span>{item.def.name}</span>
            {item.enchant && <span className="enchant-badge"><Sparkles size={12} />附魔</span>}
            {triggerDice && <small><Dice5 size={12} /> {triggerDice}</small>}
            <small className="item-effect">{growthText ?? effectText(item.def, normalizeQuality(item.quality))}</small>
            {boomCounterState && (
              <span className="boom-counter-meter" aria-label={`爆鸣计数 ${boomCounterState.count}/${boomCounterState.max}`}>
                <i style={{ width: `${boomCounterState.progress}%` }} />
                <b>{boomCounterState?.count}/{boomCounterState.max}</b>
              </span>
            )}
            <span className={`trigger-count-stamp ${triggerCountLabel === 'x0' ? 'empty' : ''}`} aria-label={`褰撳眬瑙﹀彂娆℃暟 ${triggerCountLabel}`}>
              {triggerCountLabel}
            </span>
          </button>
          )
        })}
      </div>
      <RelicRail relics={snapshot.relics ?? []} compact />
    </div>
  )
}

function BattleStage({ player, opponent, event, presentation, lastRoll, finished, winner, visualTheme }: { player: BattleSnapshot; opponent: BattleSnapshot; event?: BattleEvent; presentation: PresentationEvent | null; lastRoll?: BattleEvent; finished: boolean; winner?: string; visualTheme: VisualThemeId }) {
  const [statusTip, setStatusTip] = useState<StatusTipState | null>(null)
  const inspectStatus = (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => {
    setStatusTip({ status, side, polarity, anchor: getFloatingTipPosition(element) })
  }
  const activeStatusKey = statusTip ? statusTipKey(statusTip.status, statusTip.side, statusTip.polarity) : null
  const playerMaxHp = event?.playerMaxHp ?? maxHealthForRound(player.round)
  const opponentMaxHp = event?.opponentMaxHp ?? maxHealthForRound(opponent.round)
  const playerHp = event?.playerHp ?? playerMaxHp
  const opponentHp = event?.opponentHp ?? opponentMaxHp
  const playerShield = event?.playerShield ?? 0
  const opponentShield = event?.opponentShield ?? 0
  const activePresentationKind = presentation?.kind ?? 'none'
  return (
    <div className={`battle-stage handdrawn-stage visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)} data-tutorial-anchor="battle-stage" data-presentation-kind={activePresentationKind}>
      <BattleDog
        side="opponent"
        snapshot={opponent}
        hp={opponentHp}
        maxHp={opponentMaxHp}
        shield={opponentShield}
        event={event}
        finished={finished}
        winner={winner}
        onStatusInspect={inspectStatus}
        activeStatusKey={activeStatusKey}
      />
      <BattleDice event={event} lastRoll={lastRoll} />
      <BattleDog
        side="player"
        snapshot={player}
        hp={playerHp}
        maxHp={playerMaxHp}
        shield={playerShield}
        event={event}
        finished={finished}
        winner={winner}
        onStatusInspect={inspectStatus}
        activeStatusKey={activeStatusKey}
      />
      <StatusFloatingTip statusTip={statusTip} onClose={() => setStatusTip(null)} />
    </div>
  )
}

function BattleDog({ side, snapshot, hp, maxHp, shield, event, finished, winner, onStatusInspect, activeStatusKey }: { side: 'player' | 'opponent'; snapshot: BattleSnapshot; hp: number; maxHp: number; shield: number; event?: BattleEvent; finished: boolean; winner?: string; onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void; activeStatusKey: string | null }) {
  const isActor = event?.actor === side
  const vfxKind = battleVfxKind(event)
  const vfxTargetSide = battleVfxTargetSide(event)
  const isTarget = vfxTargetSide === side || event?.target === 'both'
  const isVfxTarget = isTarget && vfxKind !== 'none' && vfxKind !== 'roll'
  const healing = isTarget && event?.effectType === 'HEAL'
  const lost = finished && winner && winner !== side
  const won = finished && winner === side
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0
  const shieldValue = Math.max(0, Math.round(shield))
  const shieldPercent = maxHp > 0 ? (shieldValue / maxHp) * 100 : 0
  const rows = side === 'player' ? event?.playerStatuses : event?.opponentStatuses
  const positiveStatuses = rows?.positive ?? []
  const negativeStatuses = rows?.negative ?? []
  const poisonStatus = negativeStatuses.find((status) => status.type === 'poison')
  const poisonPreviewPercent = maxHp > 0 ? ((poisonStatus?.tickDamage ?? 0) / maxHp) * 100 : 0
  const poisonPreviewLeft = Math.max(0, Math.min(100, hpPercent - poisonPreviewPercent))
  return (
    <div className={`battle-dog ${side} ${isActor ? 'attacking' : ''} ${isTarget && event?.effectType !== 'HEAL' ? 'hit' : ''} ${healing ? 'healing' : ''} ${isVfxTarget ? `vfx-target-${battleVfxKind(event)}` : ''} ${shieldValue > 0 ? 'status-shield' : ''} ${poisonStatus ? 'poisoned status-poison' : ''} ${won ? 'winner' : ''} ${lost ? 'loser' : ''}`} data-vfx-side={side}>
      <div className="hp" {...battleVfxAnchorAttrs('hp', side)}>
        <span><HeartPulse size={16} /> {snapshot.name}</span>
        <StatusEffectRow tone="positive" side={side} statuses={positiveStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />
        <div className="hp-bar">
          {shieldValue > 0 && <i className="hp-shield" style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />}
          <i className="hp-current" style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }} />
          {poisonPreviewPercent > 0 && <i className="hp-preview poison" style={{ left: `${poisonPreviewLeft}%`, width: `${Math.max(3, Math.min(100, poisonPreviewPercent))}%` }} />}
        </div>
        <StatusEffectRow tone="negative" side={side} statuses={negativeStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />
        <b>{Math.max(0, Math.round(hp))}/{maxHp}</b>
        {shieldValue > 0 && (
          <div className="shield-bar" aria-label={`护盾 ${shieldValue}`}>
            <i style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />
            <span><Shield size={13} /> 护盾 {shieldValue}</span>
          </div>
        )}
      </div>
      <img className="battle-dog-img" src={dogAssets[snapshot.dogType]} alt="" {...battleVfxAnchorAttrs('dog-avatar', side)} />
      <strong>{dogNames[snapshot.dogType]}</strong>
    </div>
  )
}

function StatusEffectRow({ tone, side, statuses, onStatusInspect, activeStatusKey }: { tone: 'positive' | 'negative'; side: 'player' | 'opponent'; statuses: BattleStatusEntry[]; onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void; activeStatusKey: string | null }) {
  const visible = statuses.slice(0, 3)
  const hidden = statuses.length - visible.length
  return (
    <div className={`status-effects ${tone}`} {...battleVfxAnchorAttrs(tone === 'positive' ? 'status-positive' : 'status-negative', side)}>
      {visible.map((status) => {
        const isActive = activeStatusKey === statusTipKey(status, side, tone)
        return (
          <button
            key={`${tone}-${status.type}`}
            type="button"
            className={`status-chip handdrawn-status-chip ${status.type}`}
            aria-label={`查看${status.label}说明`}
            aria-describedby={isActive ? statusTipId : undefined}
            aria-expanded={isActive}
            aria-controls={statusTipId}
            title={statusDescription(status)}
            onClick={(event) => onStatusInspect(status, side, tone, event.currentTarget)}
          >
            {statusText(status)}
          </button>
        )
      })}
      {hidden > 0 && <span className="status-chip handdrawn-status-chip more" title={statuses.map(statusText).join(' / ')}>+{hidden}</span>}
    </div>
  )
}

function statusTipKey(status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative') {
  return `${side}-${polarity}-${status.type}`
}

function statusText(status: BattleStatusEntry) {
  const stacks = statusStacks(status)
  if (status.type === 'thorns') return `${status.label} ${stacks}层 · 反伤${stacks * STATUS_THORNS_DAMAGE_PER_STACK}`
  if (status.type === 'poison') return `${status.label} ${status.stacks ?? 0}层 · 每秒${poisonTickDamage(status)}伤 · ${status.nextTickIn ?? 1}s`
  if (status.type === 'weak') return `${status.label} ${stacks}层 · 下次伤害-50%`
  if (status.type === 'fury') return `${status.label} ${stacks}层 · 伤害+${stacks * STATUS_FURY_DAMAGE_PER_STACK}`
  if (status.type === 'extraRoll') {
    return `${status.label} ${stacks}层 · 间隔-${formatStatusSeconds(stacks * STATUS_SPEED_REDUCTION_PER_STACK)}s`
  }
  if (status.type === 'poison') return `${status.label} ${status.stacks ?? 0}层 · ${status.nextTickIn ?? 1}s`
  if (status.stacks != null) return `${status.label} ${status.stacks}层`
  if (status.amount != null) return `${status.label} ${status.amount}`
  if (status.remaining != null) return `${status.label} ${status.remaining}s`
  return status.label
}

function statusStacks(status: BattleStatusEntry) {
  return status.stacks ?? status.amount ?? 0
}

function poisonTickDamage(status: BattleStatusEntry) {
  return status.tickDamage ?? status.stacks ?? 0
}

function formatStatusSeconds(seconds: number) {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1).replace(/\.0$/, '')
}

function statusDescription(status: BattleStatusEntry) {
  const detail = statusTipDetails[status.type]
  const values = statusText(status)
  if (!detail) return values
  return `${values}；${detail.timing}；${detail.description}`
}

function BattleDice({ event, lastRoll }: { event?: BattleEvent; lastRoll?: BattleEvent }) {
  const actor = event?.kind === 'ROLL' ? event.actor : lastRoll?.actor ?? event?.actor
  const roll = event?.roll ?? lastRoll?.roll
  return (
    <div className={`battle-dice handdrawn-dice ${event?.kind === 'ROLL' ? 'rolling' : ''}`}>
      <Dice5 size={32} />
      <b>{roll ?? '-'}</b>
      <span>{actor === 'opponent' ? '对手掷骰' : actor === 'player' ? '玩家掷骰' : '战斗结算'}</span>
    </div>
  )
}

function BattleFxStage({ event, presentation, speed }: { event?: BattleEvent; presentation: PresentationEvent | null; speed: number }) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const timeline = presentation ? buildFxTimeline(presentation, Boolean(reducedMotion)) : []

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas || !event || !presentation) return
    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * scale))
      canvas.height = Math.max(1, Math.floor(rect.height * scale))
      context.setTransform(scale, 0, 0, scale, 0, 0)
      return rect
    }
    let rect = resize()
    const fx = createBattleFxStyle(event)
    const anchorRoot = stage.parentElement ?? stage
    const sourceElement = queryBattleFxAnchor(anchorRoot, presentation.source)
    const targetElement = queryBattleFxAnchor(anchorRoot, presentation.target)
    const started = performance.now()
    const duration = Math.max(560, 1160 / Math.sqrt(speed))
    let frame = 0
    let particles = createMeteorSparkParticles(event, fx, rect.width * 0.5, rect.height * 0.5)
    let particlesReady = false

    const draw = (now: number) => {
      rect = resize()
      const points = resolveBattleFxPoints(stage, presentation, (anchor) => anchor === presentation.source ? sourceElement : targetElement)
      if (!particlesReady) {
        particles = createMeteorSparkParticles(event, fx, points.target.x, points.target.y)
        particlesReady = true
      }
      const t = Math.min(1, (now - started) / duration)
      context.clearRect(0, 0, rect.width, rect.height)
      drawMeteorBattleFxTrail(context, points.source.x, points.source.y, points.target.x, points.target.y, t, fx)
      for (const particle of particles) {
        const x = particle.x + particle.vx * t
        const y = particle.y + particle.vy * t
        context.globalAlpha = Math.max(0, 1 - t) * particle.alpha
        context.fillStyle = particle.color
        context.strokeStyle = particle.color
        context.lineWidth = particle.size
        if (particle.kind === 'slash') {
          context.beginPath()
          context.moveTo(x - 18, y - 8)
          context.lineTo(x + 18, y + 8)
          context.stroke()
        } else {
          context.beginPath()
          context.arc(x, y, particle.size + t * particle.grow, 0, Math.PI * 2)
          context.fill()
        }
      }
      drawMeteorImpactFlash(context, points.target.x, points.target.y, t, fx)
      drawHandwrittenBattleNumber(context, event, fx, points.target.x, points.target.y, t)
      context.globalAlpha = 1
      if (t < 1) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [event, presentation, speed])

  return (
    <div ref={stageRef} className="battle-fx-stage" data-vfx-kind={battleVfxKind(event)} data-timeline={timeline.map((step) => step.phase).join(' ')}>
      <canvas ref={canvasRef} className="battle-fx-canvas handdrawn-fx-canvas" data-vfx-kind={battleVfxKind(event)} aria-hidden="true" />
      {presentation && presentation.kind !== 'none' && (
        <span className={`battle-feedback-burst ${presentation.kind}`} aria-hidden="true">
          {presentation.kind === 'roll' ? '掷' : presentation.amount ?? ''}
        </span>
      )}
    </div>
  )
}

function drawMeteorBattleFxTrail(context: CanvasRenderingContext2D, actorX: number, actorY: number, targetX: number, targetY: number, t: number, fx: BattleVfxStyle) {
  if (fx.kind === 'none' || fx.kind === 'roll') return
  const palette = meteorPaletteForFx(fx)
  for (const meteor of meteorVolleyCues(fx)) {
    drawSingleMeteorProjectile(context, actorX, actorY, targetX, targetY, t, fx, meteor, palette)
  }
}

function drawSingleMeteorProjectile(context: CanvasRenderingContext2D, actorX: number, actorY: number, targetX: number, targetY: number, t: number, fx: BattleVfxStyle, meteor: MeteorCue, palette: string[]) {
  const localT = Math.max(0, Math.min(1, (t - meteor.delay) / meteor.duration))
  if (localT <= 0 || localT >= 1) return
  const distanceX = targetX - actorX
  const distanceY = targetY - actorY
  const distance = Math.max(1, Math.hypot(distanceX, distanceY))
  const normalX = -distanceY / distance
  const normalY = distanceX / distance
  const startX = actorX + normalX * meteor.lane * 8
  const startY = actorY + normalY * meteor.lane * 8
  const endX = targetX + normalX * meteor.lane * 4
  const endY = targetY + normalY * meteor.lane * 4
  const controlX = (startX + endX) * 0.5 + normalX * meteor.lane * 22
  const controlY = Math.min(startY, endY) - meteor.lift
  const progress = localT
  const tailProgress = Math.max(0, progress - 0.28)
  const currentX = quadraticPoint(startX, controlX, endX, progress)
  const currentY = quadraticPoint(startY, controlY, endY, progress)
  const tailX = quadraticPoint(startX, controlX, endX, tailProgress)
  const tailY = quadraticPoint(startY, controlY, endY, tailProgress)
  const midTailX = quadraticPoint(startX, controlX, endX, Math.max(0, progress - 0.14))
  const midTailY = quadraticPoint(startY, controlY, endY, Math.max(0, progress - 0.14))
  const primary = palette[Math.abs(Math.round(meteor.lane)) % palette.length] ?? fx.color
  const secondary = palette[(Math.abs(Math.round(meteor.lane)) + 1) % palette.length] ?? fx.accent
  const meteorPulse = 1 + Math.sin((t + meteor.delay) * Math.PI * 10) * 0.1
  const tailLayers = [
    { width: 26 * meteor.size, alpha: 0.2 * meteor.alpha, color: primary },
    { width: 15 * meteor.size, alpha: 0.46 * meteor.alpha, color: secondary },
    { width: 6 * meteor.size, alpha: 0.96 * meteor.alpha, color: '#ffffff' },
  ]
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const layer of tailLayers) {
    const gradient = context.createLinearGradient(tailX, tailY, currentX, currentY)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)')
    gradient.addColorStop(0.38, layer.color)
    gradient.addColorStop(1, '#ffffff')
    context.globalAlpha = layer.alpha
    context.strokeStyle = gradient
    context.lineWidth = layer.width
    context.shadowColor = layer.color
    context.shadowBlur = 24 + layer.width
    context.beginPath()
    context.moveTo(tailX, tailY)
    context.quadraticCurveTo(midTailX, midTailY, currentX, currentY)
    context.stroke()
  }
  const aura = context.createRadialGradient(currentX, currentY, 2, currentX, currentY, 24 * meteor.size * meteorPulse)
  aura.addColorStop(0, 'rgba(255, 255, 255, .98)')
  aura.addColorStop(0.2, secondary)
  aura.addColorStop(0.6, primary)
  aura.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.globalAlpha = 0.98 * meteor.alpha
  context.fillStyle = aura
  context.shadowColor = secondary
  context.shadowBlur = 34
  context.beginPath()
  context.arc(currentX, currentY, 25 * meteor.size * meteorPulse, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#ffffff'
  context.shadowBlur = 16
  context.beginPath()
  context.arc(currentX, currentY, 5.5 * meteor.size * meteorPulse, 0, Math.PI * 2)
  context.fill()
  if (localT > 0.78) {
    drawMeteorImpactFlash(context, endX, endY, (localT - 0.78) / 0.22, fx, meteor.size, primary, secondary)
  }
  context.restore()
}

function meteorVolleyCues(fx: BattleVfxStyle): MeteorCue[] {
  const meteorVolley = [
    { delay: 0.00, duration: 0.48, lane: -2.4, lift: 94, size: 1.08, alpha: 0.95 },
    { delay: 0.08, duration: 0.45, lane: 1.6, lift: 68, size: 0.86, alpha: 0.88 },
    { delay: 0.17, duration: 0.5, lane: -0.7, lift: 118, size: 1.0, alpha: 0.94 },
    { delay: 0.27, duration: 0.43, lane: 2.8, lift: 82, size: 0.78, alpha: 0.86 },
    { delay: 0.39, duration: 0.47, lane: 0.3, lift: 106, size: 1.16, alpha: 0.98 },
    { delay: 0.52, duration: 0.38, lane: -1.7, lift: 74, size: 0.84, alpha: 0.9 },
  ]
  if (fx.kind === 'miss') return meteorVolley.slice(0, 3)
  if (fx.kind === 'poison' || fx.kind === 'damage') return meteorVolley
  return meteorVolley.slice(0, 5)
}

function meteorPaletteForFx(fx: BattleVfxStyle) {
  if (fx.kind === 'damage') return ['#ff1744', '#ff7a18', '#ffd166']
  if (fx.kind === 'heal') return ['#00e676', '#69f0ae', '#d7ff73']
  if (fx.kind === 'shield') return ['#1e88ff', '#72d7ff', '#e3f2ff']
  if (fx.kind === 'poison') return ['#39ff14', '#00c853', '#b9f6ca']
  if (fx.kind === 'weak') return ['#b026ff', '#7c4dff', '#f0abfc']
  if (fx.kind === 'freeze') return ['#00d9ff', '#7dd3fc', '#ffffff']
  if (fx.kind === 'thorns') return ['#f59e0b', '#facc15', '#fff3b0']
  if (fx.kind === 'utility') return ['#38bdf8', '#818cf8', '#ffffff']
  return [fx.color, fx.accent, '#ffffff']
}

function drawMeteorImpactFlash(context: CanvasRenderingContext2D, targetX: number, targetY: number, t: number, fx: BattleVfxStyle, size = 1, primary = fx.color, secondary = fx.accent) {
  if (fx.kind === 'none' || fx.kind === 'roll' || t < 0.52) return
  const impactT = Math.min(1, t)
  const radius = (18 + impactT * 46) * size
  const alpha = Math.max(0, 1 - impactT)
  const gradient = context.createRadialGradient(targetX, targetY, 2, targetX, targetY, radius)
  gradient.addColorStop(0, 'rgba(255, 255, 255, .95)')
  gradient.addColorStop(0.22, secondary)
  gradient.addColorStop(0.56, primary)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.save()
  context.globalAlpha = alpha * 0.72
  context.fillStyle = gradient
  context.shadowColor = secondary
  context.shadowBlur = 38 * size
  context.beginPath()
  context.arc(targetX, targetY, radius, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = alpha * 0.76
  context.strokeStyle = secondary
  context.lineWidth = 3
  context.setLineDash([10, 8])
  context.beginPath()
  context.arc(targetX, targetY, radius * 0.72, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawHandwrittenBattleNumber(context: CanvasRenderingContext2D, event: BattleEvent, fx: BattleVfxStyle, targetX: number, centerY: number, t: number) {
  if (!event.amount || event.kind === 'ROLL') return
  const label = fx.kind === 'weak' ? '弱' : fx.kind === 'freeze' ? '冻' : fx.kind === 'miss' ? '抵消' : `${fx.prefix}${event.amount}`
  context.save()
  context.globalAlpha = Math.max(0, 1 - t)
  context.font = `950 40px ${HANDDRAWN_FONT_STACK}`
  context.textAlign = 'center'
  context.lineWidth = 7
  context.strokeStyle = 'rgba(255, 250, 241, .92)'
  context.fillStyle = fx.color
  const y = centerY - 48 - t * 42
  context.translate(targetX, y)
  context.rotate((fx.kind === 'damage' ? -2 : 1.2) * Math.PI / 180)
  context.strokeText(label, 0, 0)
  context.fillText(label, 0, 0)
  context.restore()
}

function createMeteorSparkParticles(event: BattleEvent, fx: BattleVfxStyle, x: number, y: number) {
  const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; grow: number; alpha: number; color: string; kind: 'dot' | 'slash' }> = []
  const palette = ['#ffffff', fx.accent, fx.color, event.kind === 'ROLL' ? '#ffffff' : '#fff4e4']
  const count = fx.particleCount + 7
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count
    const distance = 54 + (index % 7) * 18
    particles.push({
      x: x + Math.cos(angle) * 16,
      y: y + Math.sin(angle) * 10,
      vx: Math.cos(angle) * distance,
      vy: Math.sin(angle) * distance - (index % 3) * 10,
      size: fx.kind === 'poison' ? 9 + (index % 5) : fx.kind === 'freeze' ? 6 + (index % 4) : 3 + (index % 5),
      grow: fx.kind === 'poison' ? 24 : fx.kind === 'heal' || fx.kind === 'shield' ? 17 : 10,
      alpha: fx.kind === 'poison' ? 0.52 : fx.kind === 'miss' ? 0.68 : 0.96,
      color: palette[index % palette.length],
      kind: fx.kind === 'damage' && index % 4 === 0 ? 'slash' : 'dot',
    })
  }
  return particles
}

function quadraticPoint(start: number, control: number, end: number, t: number) {
  const inverse = 1 - t
  return inverse * inverse * start + 2 * inverse * t * control + t * t * end
}

function CollapsedBattleLog({ events, eventIndex, open, onToggle }: { events: BattleEvent[]; eventIndex: number; open: boolean; onToggle: () => void }) {
  const startIndex = open ? Math.max(0, eventIndex - 40) : Math.max(0, eventIndex - 3)
  const visible = events.slice(startIndex, eventIndex + 1)
  return (
    <div className={`battle-log-shell ${open ? 'open' : ''}`}>
      <button className="log-toggle" onClick={onToggle}>{open ? '收起日志' : '展开日志'}</button>
      <div className="battle-log">
        {visible.map((event, index) => {
          const absoluteIndex = startIndex + index
          return (
            <p key={`${event.time}-${index}-${event.text}`} className={`${event.actor} ${event.effectType === 'POISON' ? 'poison' : ''} ${absoluteIndex === eventIndex ? 'active-feedback' : ''}`}>{event.time}s · {event.text}</p>
          )
        })}
      </div>
    </div>
  )
}
