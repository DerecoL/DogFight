import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  ArrowRight,
  Backpack,
  BadgeDollarSign,
  Brush,
  Coins,
  Crown,
  Dice5,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  Gamepad2,
  Grid3X3,
  Heart,
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
  Trash2,
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
import { extraTriggerDiceLabel, itemTriggerCountLabel, triggerDiceLabel } from './item-trigger-display'
import { itemVisualProfile } from './item-visual-profile'
import { mergeDogfightRunPreview, previewShopPurchase, previewShopReroll } from './shop-optimistic'
import { ALL_ITEM_DEFS } from './server/game/data'
import { queryBattleFxAnchor, resolveBattleFxPoints } from './battle-vfx-coordinates'
import { battleProjectileCues, type BattleProjectileCue } from './battle-vfx-projectiles'
import {
  buildBattleReview,
  filterBattleEvents,
  type BattleLogFilter,
  type BattleReview,
  type BattleReviewSideStats,
} from './battle-review'
import { TERM_DEFS } from './shared/rule-terms'
import { RUN_LOSS_LIMIT } from './shared/game-rules'
import { LANGUAGE_STORAGE_KEY, useLanguage, type Language } from './i18n'
import {
  localizeDog,
  localizeItemDef,
  localizeQuality,
  localizeRelicDef,
  localizeShopType,
} from './i18n/game-text'
import { localizeBattleEventText, localizeFeedbackText, localizeServerError } from './i18n/battle-text'
import {
  BoneHealthBar,
  ChoiceCard as HanddrawnChoiceCard,
  DogBadge,
  DynamicDice,
  FloatingPaperTip,
  HanddrawnButton,
  HanddrawnFrame,
  HanddrawnListButton,
  HanddrawnNumberButton,
  HanddrawnSlotButton,
  HanddrawnTabButton,
  HanddrawnTextButton,
  IconButton as HanddrawnIconButton,
  ItemFrame,
  RelicIconButton,
  ResourcePill as HanddrawnResourcePill,
  StatusChip,
} from './ui'
import './App.css'
import './ui/handdrawn.css'

type DogType = 'SHIBA' | 'SAMOYED' | 'MUTT' | 'BULLY' | 'EMPEROR' | 'FROG'
type Phase = 'MAP' | 'SHOP' | 'CHOICE' | 'CLASS_REWARD' | 'ENCHANT_CHOICE' | 'RELIC_CHOICE' | 'UPGRADE_CHOICE' | 'POTION_CHOICE' | 'PREP' | 'MATCH' | 'BATTLE' | 'COMPLETE'
type Area = 'EQUIPMENT' | 'BAG'
type ShopType = 'GENERAL' | 'LARGE' | 'MEDIUM' | 'SMALL' | 'SMALL_DICE' | 'BIG_DICE' | 'RELIC' | 'UPGRADE' | 'UPGRADE_SILVER' | 'UPGRADE_GOLD' | 'UPGRADE_DIAMOND' | 'POTION'
type ItemQuality = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
type GameMode = 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK'
type AppScreen = 'LOBBY' | 'CASUAL' | 'LADDER' | 'DOGFIGHT' | 'PEAK' | 'SHOP' | 'ACHIEVEMENTS' | 'SETTINGS'
type HistoryModeTab = 'ALL' | 'CASUAL' | 'DOGFIGHT' | 'PEAK' | 'LADDER'
type HistoryRunMode = Exclude<HistoryModeTab, 'ALL'>
type RunMode = 'CASUAL' | 'LADDER'
type LadderTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'MASTER' | 'DOG_KING'
type VisualThemeId = 'dogPark' | 'backAlley' | 'royalKennel'
type SurpriseBackgroundId = 'classReward' | 'enchant' | 'settlement'
type PendingShopAction = 'buy' | 'reroll' | null

const BOOM_COUNTER_TRIGGER_THRESHOLD = 50
const FREEZE_STACK_TRIGGER_THRESHOLD = 10
const HANDDRAWN_FONT_STACK = '"Comic Sans MS", "Microsoft YaHei", "KaiTi", "Kaiti SC", "DFKai-SB", cursive, sans-serif'
const isTapTapChannel = import.meta.env.VITE_CHANNEL === 'taptap'
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

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
type MapMonsterEquipmentItem = Omit<Item, 'def'>
type ExplorationMapNodeKind = 'PLAYER_BATTLE' | 'MONSTER_BATTLE' | 'SHOP_FIXED' | 'SHOP_UNKNOWN' | 'SHOP_EQUIPMENT' | 'REST' | 'EVENT'
type ExplorationEventType = 'GOLD_CACHE' | 'RESTORE_TOLERANCE' | 'FREE_EQUIPMENT' | 'FREE_UPGRADE' | 'RELIC_GIFT' | 'RISKY_COMMISSION'
type ExplorationMapMonster = { name: string; dogType: DogType; seed?: string; round?: number; equipment?: MapMonsterEquipmentItem[]; possibleRewards: Array<{ defId: string; quality: ItemQuality }> }
type ExplorationMapNode = {
  id: string
  layer: number
  column: number
  x?: number
  kind: ExplorationMapNodeKind
  nextNodeIds: string[]
  shopType?: ShopType
  monster?: ExplorationMapMonster
  event?: { type: ExplorationEventType; title: string; description: string }
}
type ExplorationPendingReward = { nodeId: string; defId: string; quality: ItemQuality }
type ExplorationMapState = {
  version: 1
  mapIndex: number
  currentNodeId: string | null
  completedNodeIds: string[]
  availableNodeIds: string[]
  nodes: ExplorationMapNode[]
  pendingReward?: ExplorationPendingReward | null
}
type MapDrawingTool = 'inspect' | 'brush' | 'eraser'
type MapDraftPoint = { x: number; y: number }
type MapDraftStroke = { id: string; points: MapDraftPoint[] }
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
type BattleReservoirEntry = {
  itemId: string
  duration: number
  progress: number
  nextAt: number
  speedMultiplier: number
}
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
  reservoirs?: { player: BattleReservoirEntry[]; opponent: BattleReservoirEntry[] }
  statusChanged?: string[]
  roll?: number
  itemId?: string
  targetItemId?: string
  defId?: string
  itemTriggerCount?: number
  multiIndex?: number
  multiTotal?: number
  boomCounterItemId?: string
  boomCounterValue?: number
  boomCounterMax?: number
  boomCounterChanged?: boolean
  freezeStackItemId?: string
  freezeStackValue?: number
  freezeStackMax?: number
  freezeStackChanged?: boolean
  effectType?: string
  amount?: number
  target?: BattleTarget
  sourceHpDelta?: number
  targetHpDelta?: number
}
type BattleVfxKind = PresentationKind
type BattleVfxStyle = { kind: BattleVfxKind; color: string; accent: string; prefix: string; particleCount: number }
type MeteorCue = BattleProjectileCue
type MeteorSparkParticle = { x: number; y: number; vx: number; vy: number; size: number; grow: number; alpha: number; color: string; kind: 'dot' | 'slash' }
type BattleFxInstance = {
  id: string
  key: string
  event: BattleEvent
  presentation: PresentationEvent
  fx: BattleVfxStyle
  startedAt: number
  durationMs: number
  particles: MeteorSparkParticle[]
  particlesReady: boolean
}
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
  mapState?: ExplorationMapState | null
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
type SeasonInfo = { id: string; name: string; status: string; startedAt: string; endedAt: string | null }
type LadderMeResponse = { season: SeasonInfo; profile: LadderProfile; recentSettlements: LadderSettlement[] }
type LadderLeaderboardEntry = { rank: number; title: string; name: string; profile: LadderProfile }
type LadderLeaderboardResponse = { season: SeasonInfo; leaderboard: LadderLeaderboardEntry[]; playerRank: number | null; playerProfile: LadderProfile }
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
type ArchivedApexSnapshot = Pick<ApexEntry, 'id' | 'name' | 'dogType' | 'luckyNumber' | 'wins' | 'losses' | 'round' | 'rank' | 'challengeWins' | 'items' | 'relics' | 'createdAt'>
type SeasonPlayerSummary = {
  id: string
  seasonId: string
  seasonName: string
  ladderTier: LadderTier | null
  ladderTierLabel: string | null
  ladderScore: number | null
  ladderHighestTier: LadderTier | null
  ladderHighestTierLabel: string | null
  ladderGamesPlayed: number
  ladderTotalWins: number
  ladderTotalLosses: number
  dogKingRank: number | null
  apexRank: number | null
  apexDogType: DogType | null
  apexWins: number | null
  apexLosses: number | null
  apexRound: number | null
  apexChallengeWins: number | null
  apexSnapshot: ArchivedApexSnapshot | null
  createdAt: string
}
type PlayerRunHistoryResponse = { history: PlayerRunHistory; seasonSummaries: SeasonPlayerSummary[] }
type AuthUser = { id: string; account: string; nickname: string | null }
type TapTapCallbackResult = { code?: string; errMsg?: string }
type TapTapApi = {
  checkSession?: (options: { success?: () => void; fail?: (error: TapTapCallbackResult) => void; complete?: () => void }) => void | Promise<void>
  login: (options: { timeout?: number; success?: (result: TapTapCallbackResult) => void; fail?: (error: TapTapCallbackResult) => void; complete?: () => void }) => void
}
declare global {
  var tap: TapTapApi | undefined
}
type AccountWallet = { balance: number; dailyEarned: number; dailyKey: string }
type CosmeticType = 'TITLE' | 'AVATAR' | 'BACKGROUND' | 'DOG_SKIN' | 'BATTLE_EFFECT'
type CosmeticRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
type ShopCatalogItem = { id: string; name: string; description: string; type: CosmeticType; rarity: CosmeticRarity; price: number; section: 'PERMANENT' | 'FEATURED'; assetKey: string; sku?: string; purchaseType: string; source: string; owned: boolean; equipped: boolean }
type AccountShopResponse = { wallet: AccountWallet; sections: { permanent: ShopCatalogItem[]; featured: ShopCatalogItem[] } }
type AchievementEntry = { id: string; title: string; description: string; category: string; hidden: boolean; target: number; progress: number; reward: number; completed: boolean; claimable: boolean; claimed: boolean }
type AchievementsResponse = { wallet: AccountWallet; achievements: AchievementEntry[] }
type DailyTaskEntry = { taskId: string; slot: string; progress: number; target: number; reward: number; claimedAt: string | null; def?: { title: string; description: string } }
type DailyTasksResponse = { wallet: AccountWallet; dateKey: string; refreshUsed: boolean; tasks: DailyTaskEntry[] }
type CosmeticsResponse = { inventory: Array<{ catalogItemId: string; item?: ShopCatalogItem }>; equipped: Array<{ slot: CosmeticType; catalogItemId: string; item?: ShopCatalogItem }> }
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
  rank: number | null
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
  placementRank: number | null
  battles: ApexBattleSummary[]
}
type ApexBoardId = 'overall' | 'daily'
type ApexLeaderboards = Record<ApexBoardId, ApexEntry[]>
type ApexReports = Record<ApexBoardId, ApexChallengeReport>
type ApexEntries = Record<ApexBoardId, ApexEntry>
type ApexOverview = { season: SeasonInfo; leaderboards: ApexLeaderboards; candidates: Run[]; dailyBoardKey: string; dailyResetHour: number }
type ApexSubmitResponse = { season: SeasonInfo; entries: ApexEntries; reports: ApexReports; leaderboards: ApexLeaderboards; dailyBoardKey: string; dailyResetHour: number }
function apexRankText(rank: number | null) {
  return rank == null ? '未上榜' : `第 ${rank} 名`
}
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
type ItemDropHandler = (itemId: string, overId: string) => void

const dogNames: Record<DogType, string> = { SHIBA: '柴犬', SAMOYED: '萨摩耶', MUTT: '土狗', BULLY: '恶霸', EMPEROR: '狗皇帝', FROG: '祖灵' }
const dogTraits: Record<DogType, string> = {
  SHIBA: '20% 概率改掷为【小点】 1/2/3',
  SAMOYED: '20% 概率改掷为【大点】 4/5/6',
  MUTT: '20% 概率【额外投掷】一次',
  BULLY: '40% 概率使本次触发的【大型物品】效果翻倍',
  EMPEROR: '指定【天命数字】，命中时 50% 概率使触发效果翻倍',
  FROG: '显式点数装备改为【蓄水】触发，可被职业装备提速',
}
const dogAssets: Record<DogType, string> = {
  SHIBA: '/assets/dogs/shiba.webp',
  SAMOYED: '/assets/dogs/samoyed.webp',
  MUTT: '/assets/dogs/mutt.webp',
  BULLY: '/assets/dogs/bully.webp',
  EMPEROR: '/assets/dogs/emperor.webp',
  FROG: '/assets/dogs/zuling.jpg',
}
const cosmeticBackgroundAssets: Record<string, string> = {
  'bg-dog-park-night': '/assets/backgrounds/storybook-dog-park.webp',
  'bg-royal-kennel': '/assets/backgrounds/storybook-royal-kennel.webp',
}
const cosmeticBackgroundClasses: Record<string, string> = {
  'bg-dog-park-night': 'cosmetic-background-dog-park-night',
  'bg-royal-kennel': 'cosmetic-background-royal-kennel',
}
const cosmeticAvatarClasses: Record<string, string> = {
  'avatar-bone': 'cosmetic-avatar-bone',
  'avatar-crown': 'cosmetic-avatar-crown',
}
const cosmeticAvatarGlyphs: Record<string, string> = {
  'avatar-bone': '骨',
  'avatar-crown': '冠',
}
const cosmeticDogSkinClasses: Record<string, { dogType: DogType; className: string }> = {
  'skin-shiba-scarf': { dogType: 'SHIBA', className: 'dog-badge-skin-shiba-scarf' },
  'skin-samoyed-snow': { dogType: 'SAMOYED', className: 'dog-badge-skin-samoyed-snow' },
}
const cosmeticBattleFxClasses: Record<string, string> = {
  'fx-gold-dice': 'battle-fx-gold-dice',
  'fx-aurora-roll': 'battle-fx-aurora-roll',
}
const dogBrawlTownBackground = '/assets/backgrounds/dog-brawl-town.jpg'
const visualThemeAssets: Record<VisualThemeId, string> = {
  dogPark: dogBrawlTownBackground,
  backAlley: dogBrawlTownBackground,
  royalKennel: dogBrawlTownBackground,
}
const surpriseBackgrounds: Record<SurpriseBackgroundId, string> = {
  classReward: '/assets/backgrounds/canine-fighting-study.webp',
  settlement: '/assets/backgrounds/canine-anatomy-run.webp',
  enchant: '/assets/backgrounds/canine-comparative-anatomy.webp',
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

function equippedCosmeticByType(cosmetics: CosmeticsResponse | null | undefined, type: CosmeticType) {
  const equipped = cosmetics?.equipped.find((entry) => entry.slot === type)
  return equipped?.item ?? cosmetics?.inventory.find((entry) => entry.catalogItemId === equipped?.catalogItemId)?.item ?? null
}

function equippedCosmeticProfile(cosmetics: CosmeticsResponse | null | undefined) {
  return {
    title: equippedCosmeticByType(cosmetics, 'TITLE'),
    avatar: equippedCosmeticByType(cosmetics, 'AVATAR'),
    background: equippedCosmeticByType(cosmetics, 'BACKGROUND'),
    dogSkin: equippedCosmeticByType(cosmetics, 'DOG_SKIN'),
    battleEffect: equippedCosmeticByType(cosmetics, 'BATTLE_EFFECT'),
  }
}

function cosmeticTitleLabel(title: ShopCatalogItem | null | undefined) {
  return title?.name ?? '未装备称号'
}

function cosmeticAvatarClass(avatar: ShopCatalogItem | null | undefined) {
  return avatar ? cosmeticAvatarClasses[avatar.id] ?? '' : ''
}

function cosmeticAvatarGlyph(avatar: ShopCatalogItem | null | undefined) {
  return avatar ? cosmeticAvatarGlyphs[avatar.id] ?? '像' : '狗'
}

function cosmeticBackgroundClass(equippedCosmetics: CosmeticsResponse | null | undefined) {
  const background = equippedCosmeticByType(equippedCosmetics, 'BACKGROUND')
  return background ? cosmeticBackgroundClasses[background.id] ?? '' : ''
}

function cosmeticBackgroundStyle(equippedCosmetics: CosmeticsResponse | null | undefined) {
  const background = equippedCosmeticByType(equippedCosmetics, 'BACKGROUND')
  const asset = background ? cosmeticBackgroundAssets[background.id] : null
  return asset ? { '--app-illustration-bg': `url("${asset}")` } as React.CSSProperties : undefined
}

function cosmeticDogSkinClass(equippedCosmetics: CosmeticsResponse | null | undefined, dogType: DogType, side: 'player' | 'opponent' = 'player') {
  if (side !== 'player') return ''
  const skin = equippedCosmeticByType(equippedCosmetics, 'DOG_SKIN')
  const config = skin ? cosmeticDogSkinClasses[skin.id] : null
  return config?.dogType === dogType ? config.className : ''
}

function cosmeticDogAsset(equippedCosmetics: CosmeticsResponse | null | undefined, dogType: DogType, side: 'player' | 'opponent' = 'player') {
  return cosmeticDogSkinClass(equippedCosmetics, dogType, side) ? dogAssets[dogType] : dogAssets[dogType]
}

function cosmeticBattleFxClass(equippedCosmetics: CosmeticsResponse | null | undefined) {
  const battleEffect = equippedCosmeticByType(equippedCosmetics, 'BATTLE_EFFECT')
  return battleEffect ? cosmeticBattleFxClasses[battleEffect.id] ?? '' : ''
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
  UPGRADE_SILVER: '白银商店',
  UPGRADE_GOLD: '黄金商店',
  UPGRADE_DIAMOND: '钻石商店',
  POTION: '药水商店',
}
const itemIcons: Record<string, string> = {
  'starter-1': '/assets/sticker-icons/starter-1.webp',
  'starter-2': '/assets/sticker-icons/starter-2.webp',
  'starter-3': '/assets/sticker-icons/starter-3.webp',
  'starter-4': '/assets/sticker-icons/starter-4.webp',
  'starter-5': '/assets/sticker-icons/starter-5.webp',
  'starter-6': '/assets/sticker-icons/starter-6.webp',
  'small-bite': '/assets/sticker-icons/small-bite.webp',
  'lucky-paw': '/assets/sticker-icons/lucky-paw.webp',
  'milk-bone': '/assets/sticker-icons/milk-bone.webp',
  'rubber-ball': '/assets/sticker-icons/rubber-ball.webp',
  'spiked-collar': '/assets/sticker-icons/spiked-collar.webp',
  'training-disc': '/assets/sticker-icons/training-disc.webp',
  'guard-vest': '/assets/sticker-icons/guard-vest.webp',
  'giant-bone': '/assets/sticker-icons/giant-bone.webp',
  'dog-house': '/assets/sticker-icons/dog-house.webp',
  'dog-gold-ingot': '/assets/sticker-icons/dog-gold-ingot.webp',
  'dog-silver-ingot': '/assets/sticker-icons/dog-silver-ingot.webp',
  'patting-bear': '/assets/sticker-icons/patting-bear.webp',
  'poisoned-dog-fang': '/assets/sticker-icons/poisoned-dog-fang.webp',
  'lotus-sea': '/assets/sticker-icons/lotus-sea.webp',
  'kyushu-bracer': '/assets/sticker-icons/kyushu-bracer.webp',
  'v3-broken-canine': '/assets/sticker-icons/v3-broken-canine.webp',
  'v3-chew-scratch-post': '/assets/sticker-icons/v3-chew-scratch-post.webp',
  'v3-cone-collar': '/assets/sticker-icons/v3-cone-collar.webp',
  'v3-dog-catnip': '/assets/sticker-icons/v3-dog-catnip.webp',
  'v3-flea-disc': '/assets/sticker-icons/v3-flea-disc.webp',
  'v3-large-bone-sword': '/assets/sticker-icons/v3-large-bone-sword.webp',
  'v3-wooden-shield': '/assets/sticker-icons/v3-wooden-shield.webp',
  'v3-spiked-vest': '/assets/sticker-icons/v3-spiked-vest.webp',
  'v3-hydrant-axe': '/assets/sticker-icons/v3-hydrant-axe.webp',
  'v3-dinosaur-leg-bone': '/assets/sticker-icons/v3-dinosaur-leg-bone.webp',
  'v3-auto-waterer': '/assets/sticker-icons/v3-auto-waterer.webp',
  'v3-night-patrol-light': '/assets/sticker-icons/v3-night-patrol-light.webp',
  'v3-blood-mad-fang': '/assets/sticker-icons/v3-blood-mad-fang.webp',
  'v3-fermented-trash-bin': '/assets/sticker-icons/v3-fermented-trash-bin.webp',
  'v3-golden-kennel': '/assets/sticker-icons/v3-golden-kennel.webp',
  'v4-blood-contract-fang': '/assets/sticker-icons/v4-blood-contract-fang.webp',
  'v4-boom-counter': '/assets/sticker-icons/v4-boom-counter.webp',
  'v4-growing-chew-sword': '/assets/sticker-icons/v4-growing-chew-sword.webp',
  'v4-reverse-fur-comb': '/assets/sticker-icons/v4-reverse-fur-comb.webp',
  'v5-shattered-tooth-gear': '/assets/sticker-icons/v5-shattered-tooth-gear.webp',
  'v5-poison-blood-pump': '/assets/sticker-icons/v5-poison-blood-pump.webp',
  'v5-biteback-shield': '/assets/sticker-icons/v5-biteback-shield.webp',
  'v5-barkproof-earmuffs': '/assets/sticker-icons/v5-barkproof-earmuffs.webp',
  'v5-offbeat-metronome': '/assets/sticker-icons/v5-offbeat-metronome.webp',
  'v5-bitter-kibble': '/assets/sticker-icons/v5-bitter-kibble.webp',
  'v5-thornbreaker-chew': '/assets/sticker-icons/v5-thornbreaker-chew.webp',
  'shiba-speed-katana': '/assets/sticker-icons/shiba-speed-katana.webp',
  'shiba-great-katana': '/assets/sticker-icons/shiba-great-katana.webp',
  'shiba-swallow-katana': '/assets/sticker-icons/shiba-swallow-katana.webp',
  'shiba-shadow-clone': '/assets/sticker-icons/shiba-shadow-clone.webp',
  'shiba-break': '/assets/sticker-icons/shiba-break.webp',
  'shiba-poison': '/assets/sticker-icons/shiba-poison.webp',
  'samoyed-soft-fur': '/assets/sticker-icons/samoyed-soft-fur.webp',
  'samoyed-thorn-fur': '/assets/sticker-icons/samoyed-thorn-fur.webp',
  'samoyed-frost-fur': '/assets/sticker-icons/samoyed-frost-fur.webp',
  'samoyed-avalanche-core': '/assets/sticker-icons/samoyed-avalanche-core.webp',
  'samoyed-absolute-zero': '/assets/sticker-icons/samoyed-absolute-zero.webp',
  'samoyed-cold-proof': '/assets/sticker-icons/samoyed-cold-proof.webp',
  'mutt-old-collar': '/assets/sticker-icons/mutt-old-collar.webp',
  'mutt-counting-collar': '/assets/sticker-icons/mutt-counting-collar.webp',
  'mutt-charged-collar': '/assets/sticker-icons/mutt-charged-collar.webp',
  'mutt-chase-tail': '/assets/sticker-icons/mutt-chase-tail.webp',
  'mutt-chase-car': '/assets/sticker-icons/mutt-chase-car.webp',
  'mutt-eat-air': '/assets/sticker-icons/mutt-eat-air.webp',
  'bully-vault': '/assets/sticker-icons/bully-vault.webp',
  'bully-gym': '/assets/sticker-icons/bully-gym.webp',
  'bully-armband': '/assets/sticker-icons/bully-armband.webp',
  'bully-sacrifice': '/assets/sticker-icons/bully-sacrifice.webp',
  'bully-colossus': '/assets/sticker-icons/bully-colossus.webp',
  'bully-demolish': '/assets/sticker-icons/bully-demolish.webp',
  'emperor-dice-cup': '/assets/sticker-icons/emperor-dice-cup.webp',
  'emperor-minister': '/assets/sticker-icons/emperor-minister.webp',
  'emperor-robe': '/assets/sticker-icons/emperor-robe.webp',
  'emperor-curtain': '/assets/sticker-icons/emperor-curtain.webp',
  'emperor-edict': '/assets/sticker-icons/emperor-edict.webp',
  'emperor-fallen': '/assets/sticker-icons/emperor-fallen.webp',
  'frog-lily-pump': '/assets/sticker-icons/frog-lily-pump.webp',
  'frog-croak-drum': '/assets/sticker-icons/frog-croak-drum.webp',
  'frog-raindrop-funnel': '/assets/sticker-icons/frog-raindrop-funnel.webp',
  'frog-lotus-echo': '/assets/sticker-icons/frog-lotus-echo.webp',
  'frog-rainy-season': '/assets/sticker-icons/frog-rainy-season.webp',
  'frog-full-pond-gate': '/assets/sticker-icons/frog-full-pond-gate.webp',
}
const mapNodeIcons: Record<ExplorationMapNodeKind, string> = {
  PLAYER_BATTLE: '/assets/map-icons/player-battle.webp',
  MONSTER_BATTLE: '/assets/map-icons/monster-battle.webp',
  SHOP_FIXED: '/assets/map-icons/shop-fixed.webp',
  SHOP_UNKNOWN: '/assets/map-icons/shop-unknown.webp',
  SHOP_EQUIPMENT: '/assets/map-icons/shop-equipment.webp',
  REST: '/assets/map-icons/rest.webp',
  EVENT: '/assets/map-icons/event.webp',
}
const relicIcons: Record<string, string> = {
  'midas-left': '/assets/sticker-icons/midas-left.webp',
  'midas-right': '/assets/sticker-icons/midas-right.webp',
  'half-die-left': '/assets/sticker-icons/half-die-left.webp',
  'half-die-right': '/assets/sticker-icons/half-die-right.webp',
  'carrot': '/assets/sticker-icons/carrot.webp',
  'tissue': '/assets/sticker-icons/tissue.webp',
  'v3-two-sided-gold-tag': '/assets/sticker-icons/v3-two-sided-gold-tag.webp',
  'v3-balanced-food-bowl': '/assets/sticker-icons/v3-balanced-food-bowl.webp',
  'v3-lucky-foxtail': '/assets/sticker-icons/v3-lucky-foxtail.webp',
  'v3-bad-dog-manual': '/assets/sticker-icons/v3-bad-dog-manual.webp',
  'v3-fluffed-spike-collar': '/assets/sticker-icons/v3-fluffed-spike-collar.webp',
  'v3-husky-engine': '/assets/sticker-icons/v3-husky-engine.webp',
  'v3-fourth-dimensional-kennel': '/assets/sticker-icons/v3-fourth-dimensional-kennel.webp',
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
const EARLY_HP_GROWTH_ROUNDS = 6
const MID_ROUND_HP_GROWTH = 60
const MID_HP_GROWTH_ROUNDS = 2
const LATE_ROUND_HP_GROWTH = 70
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
const dogOptions: DogType[] = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR', 'FROG']
const SHOP_CHOICE_SLOT_COUNT = 9
const battleLogFilters: BattleLogFilter[] = ['all', 'damage', 'sustain', 'status', 'equipment']
const dogStrategies: Record<DogType, string> = {
  SHIBA: '适合新手，专注于持续输出伤害',
  SAMOYED: '适合押【大点】构筑，爆发窗口更集中',
  MUTT: '适合随机和连击构筑，上限更高但波动更大',
  BULLY: '适合【大型物品】构筑，围绕 4 格道具打爆发',
  EMPEROR: '适合围绕一个核心点数堆叠道具，命中【天命数字】时有爆发上限',
  FROG: '适合显式点数装备和水位提速构筑，用稳定计时换取持续触发',
}
const dogTags: Record<DogType, string[]> = {
  SHIBA: ['进攻', '简单'],
  SAMOYED: ['爆发', '中等'],
  MUTT: ['随机', '困难'],
  BULLY: ['大型', '爆发'],
  EMPEROR: ['幸运', '爆发'],
  FROG: ['蓄水', '稳定'],
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
  UPGRADE_SILVER: '免费选择一件青铜装备，提升 1 个品质',
  UPGRADE_GOLD: '免费选择一件黄金品质以下的装备，提升 1 个品质',
  UPGRADE_DIAMOND: '免费选择一件钻石品质以下的装备，提升 1 个品质',
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
  const res = await fetch(`${apiBaseUrl}${url}`, { credentials: 'include', headers, ...options })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || '请求失败')
  return data
}

function currentTapTapApi() {
  const globalWithTap = globalThis as typeof globalThis & { tap?: TapTapApi }
  return globalWithTap.tap
}

function requestTapTapLoginCode(tap: TapTapApi) {
  tap.checkSession?.({
    success: () => undefined,
    fail: () => undefined,
  })
  return new Promise<string>((resolve, reject) => {
    tap.login({
      timeout: 10_000,
      success: (result) => {
        if (result.code) {
          resolve(result.code)
          return
        }
        reject(new Error(result.errMsg || 'TapTap 登录失败，请重试'))
      },
      fail: (error) => reject(new Error(error.errMsg || 'TapTap 登录失败，请重试')),
    })
  })
}

function itemTone(def: ItemDef) {
  return itemVisualProfile(def).className
}

const iconAssetVersion = 'sticker-20260530-v3'

function versionedIconSrc(src: string) {
  return src.startsWith('data:') ? src : `${src}?v=${iconAssetVersion}`
}

function itemIcon(def: ItemDef) {
  return versionedIconSrc(itemIcons[def.id] ?? '/assets/sticker-icons/starter-1.webp')
}

function itemDefById(defId: string) {
  return ALL_ITEM_DEFS.find((def) => def.id === defId) ?? null
}

function ItemArtIcon({ def, className }: { def: ItemDef; className: string }) {
  return <img className={className} src={itemIcon(def)} alt="" decoding="async" />
}

function prioritizeDragCollisions(collisions: Collision[]) {
  const upgradeCollisions = collisions.filter((collision) => String(collision.id).startsWith('UPGRADE_ITEM:'))
  return upgradeCollisions.length > 0 ? upgradeCollisions : collisions
}

const dragCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return prioritizeDragCollisions(pointerCollisions)
  return prioritizeDragCollisions(rectIntersection(args))
}

const dndMeasuring = { droppable: { strategy: MeasuringStrategy.BeforeDragging } }

function isItemArtDebugRoute() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('itemArtGallery')
}

function relicIcon(def: RelicDef) {
  return versionedIconSrc(relicIcons[def.id] ?? '/assets/sticker-icons/v3-two-sided-gold-tag.webp')
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
  return { ...item.def, triggerDiceOverride: item.triggerDiceOverride, enchant: item.enchant }
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
  poison: { kind: 'poison', color: '#22c55e', accent: '#a7f3d0', prefix: '-', particleCount: 46 },
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
  const damage = growthDamageValueForBattleItem(item, owner, events, displayIndex)
  if (damage == null) return null
  return `当前伤害 ${damage}；每次成功触发后，本局内后续伤害继续提升。`
}

function growthDamageValueForBattleItem(item: Item, owner: 'player' | 'opponent', events: BattleEvent[], displayIndex: number) {
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
  return baseDamage + growth
}

function battleCardAdaptiveFontSize(text: string, base: number, min: number) {
  const length = [...text].length
  if (length <= 6) return base
  if (length <= 10) return Math.max(min, base - 1)
  if (length <= 14) return Math.max(min, base - 2)
  return min
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

function freezeStackStateForBattleItem(item: Item, owner: 'player' | 'opponent', events: BattleEvent[], displayIndex: number, activeEvent?: BattleEvent) {
  if (item.def.advancedEffect !== 'FREEZE_STACK') return null
  const latest = events.slice(0, displayIndex + 1).reverse().find((event) => event.actor === owner && event.freezeStackItemId === item.id)
  const max = latest?.freezeStackMax ?? FREEZE_STACK_TRIGGER_THRESHOLD
  const count = Math.max(0, Math.min(max, latest?.freezeStackValue ?? 0))
  const progress = max > 0 ? Math.round((count / max) * 100) : 0
  const popping = activeEvent?.actor === owner && activeEvent.freezeStackItemId === item.id && activeEvent.freezeStackChanged === true
  return { count, max, progress, popping }
}

function reservoirStateForBattleItem(event: BattleEvent | undefined, owner: 'player' | 'opponent', itemId: string) {
  return event?.reservoirs?.[owner]?.find((entry) => entry.itemId === itemId) ?? null
}

function enchantmentText(enchant?: Enchantment | null) {
  if (!enchant) return ''
  if (enchant.kind === 'EXTRA_DICE') return `附魔：额外在 ${enchant.dice.join('/')} 点触发`
  if (enchant.kind === 'BASE_EFFECT') {
    const effect = enchant.effect === 'DAMAGE' ? '造成伤害' : enchant.effect === 'HEAL' ? '回复生命' : '获得护盾'
    return `附魔：触发时额外${effect} ${enchant.amount}`
  }
  if (enchant.kind === 'SPECIAL') {
    const effect = enchant.effect === 'THORNS' ? '【荆棘】' : enchant.effect === 'FURY' ? '【激昂】' : enchant.effect === 'POISON' ? '【中毒】' : '【虚弱】'
    return `附魔：触发时额外触发 ${enchant.amount} 层${effect}`
  }
  const target = enchant.target === 'LEFT' ? '左侧' : enchant.target === 'RIGHT' ? '右侧' : '【相邻】'
  if (enchant.kind === 'TRIGGER_NEIGHBOR') return `附魔：触发时额外触发${target}装备`
  if (enchant.kind === 'BUFF_NEIGHBOR_EFFECT') {
    const effect = enchant.effect === 'DAMAGE' ? '攻击' : enchant.effect === 'HEAL' ? '回复生命' : '增加护盾'
    return `附魔：触发时使${target}装备下次${effect} +${enchant.amount}`
  }
  const effect = enchant.effect === 'LIFESTEAL' ? '【吸血】' : enchant.effect === 'THORNS' ? '【荆棘】' : '【净化】'
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
  const midRounds = Math.min(Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS), MID_HP_GROWTH_ROUNDS)
  const lateRounds = Math.max(0, completedRounds - EARLY_HP_GROWTH_ROUNDS - MID_HP_GROWTH_ROUNDS)
  return BASE_MAX_HP + earlyRounds * EARLY_ROUND_HP_GROWTH + midRounds * MID_ROUND_HP_GROWTH + lateRounds * LATE_ROUND_HP_GROWTH
}

function dogfightPhaseLabel(phase: DogfightRoomPhase) {
  if (phase === 'LOBBY') return '等待开局'
  if (phase === 'DOG_SELECT') return '选狗阶段'
  if (phase === 'SHOP') return '商店阶段'
  if (phase === 'BATTLE') return '战斗阶段'
  return '房间结束'
}

function dogfightLives(member: DogfightMember) {
  return member.eliminated ? 0 : Math.max(0, RUN_LOSS_LIMIT - member.losses)
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

function upgradeShopMaxQuality(shopType: ShopType): ItemQuality {
  if (shopType === 'UPGRADE_SILVER') return 'SILVER'
  if (shopType === 'UPGRADE_GOLD') return 'GOLD'
  return 'DIAMOND'
}

function canFreeUpgradeItem(item: Item, shopType: ShopType = 'UPGRADE') {
  const maxQuality = upgradeShopMaxQuality(shopType)
  return qualityOrder.indexOf(normalizeQuality(item.quality)) < qualityOrder.indexOf(maxQuality)
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

function useDeferredTipAnchor(setTipAnchor: (anchor: TipAnchor | null) => void) {
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const cancelTipAnchor = useCallback(() => {
    if (timeoutRef.current == null) return
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }, [])
  const scheduleTipAnchor = useCallback((element: HTMLElement) => {
    cancelTipAnchor()
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null
      if (!element.isConnected) return
      const anchor = getFloatingTipPosition(element)
      setTipAnchor(anchor)
    }, 80)
  }, [cancelTipAnchor, setTipAnchor])

  useEffect(() => cancelTipAnchor, [cancelTipAnchor])

  return { scheduleTipAnchor, cancelTipAnchor }
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
    const onPointerDown = (event: globalThis.PointerEvent) => {
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
            <HanddrawnTextButton
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
            </HanddrawnTextButton>
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
  if (isItemArtDebugRoute()) return <ItemArtDebugGallery />
  return <GameApp />
}

function GameApp() {
  const { t, language } = useLanguage()
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
  const [pendingShopAction, setPendingShopAction] = useState<PendingShopAction>(null)
  const [battle, setBattle] = useState<Battle | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [ceremonyDismissedRounds, setCeremonyDismissedRounds] = useState(() => new Set<string>())
  const [musicEnabled, setMusicEnabled] = useState(() => localStorage.getItem(musicPreferenceKey) !== 'off')
  const [musicBlocked, setMusicBlocked] = useState(false)
  const [appHasAudioFocus, setAppHasAudioFocus] = useState(() => !document.hidden && document.hasFocus())
  const [runHistory, setRunHistory] = useState<PlayerRunHistory>(emptyRunHistory)
  const [seasonSummaries, setSeasonSummaries] = useState<SeasonPlayerSummary[]>([])
  const [currentSeason, setCurrentSeason] = useState<SeasonInfo | null>(null)
  const [ladderProfile, setLadderProfile] = useState<LadderProfile | null>(null)
  const [equippedCosmetics, setEquippedCosmetics] = useState<CosmeticsResponse | null>(null)
  const [historyOverlayOpen, setHistoryOverlayOpen] = useState(false)
  const [casualTutorialState, setCasualTutorialState] = useState<CasualTutorialState>(defaultCasualTutorialState)
  const [tutorialOfferInspected, setTutorialOfferInspected] = useState(false)
  const [tutorialBought, setTutorialBought] = useState(false)
  const [tutorialPlaced, setTutorialPlaced] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }))
  const hasBattle = Boolean(battle)
  const { scheduleTipAnchor, cancelTipAnchor } = useDeferredTipAnchor(setTipAnchor)

  const loadRunHistory = useCallback(async () => {
    const data = await api<PlayerRunHistoryResponse>('/runs/history')
    setRunHistory(data.history)
    setSeasonSummaries(data.seasonSummaries)
  }, [])

  const loadLadderProfile = useCallback(async () => {
    const data = await api<LadderMeResponse>('/ladder/me')
    setCurrentSeason(data.season)
    setLadderProfile(data.profile)
  }, [])

  const loadCosmetics = useCallback(async () => {
    const data = await api<CosmeticsResponse>('/cosmetics/me')
    setEquippedCosmetics(data)
    return data
  }, [])

  useEffect(() => {
    api<{ user: AuthUser; activeRun: Run | null }>('/me')
      .then((data) => {
        setUser(data.user)
        setCasualTutorialState(data.user ? readCasualTutorialState(data.user.id) : defaultCasualTutorialState)
        setRun(data.activeRun)
        void loadRunHistory().catch(() => undefined)
        void loadLadderProfile().catch(() => undefined)
        void loadCosmetics().catch(() => undefined)
      })
      .catch(() => undefined)
  }, [loadCosmetics, loadLadderProfile, loadRunHistory])

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
  const activeMapNode = run?.mapState?.currentNodeId
    ? run.mapState.nodes.find((node) => node.id === run.mapState?.currentNodeId) ?? null
    : null
  const selectedEnchant = run?.phase === 'ENCHANT_CHOICE'
    ? run.enchantChoices.find((choice) => choice.id === selectedEnchantId) ?? run.enchantChoices[0] ?? null
    : null
  const selectedPotion = run?.phase === 'POTION_CHOICE'
    ? run.potionChoices.find((choice) => choice.id === selectedPotionId) ?? run.potionChoices[0] ?? null
    : null
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
          setEquippedCosmetics(null)
        } else if ('activeRun' in data) {
          setRun(data.activeRun ?? null)
          setCasualTutorialState(readCasualTutorialState(data.user.id))
        }
        setNeedsNicknameSetup(Boolean(data.user && data.needsNickname))
        if (data.user) {
          void loadRunHistory().catch(() => undefined)
          void loadLadderProfile().catch(() => undefined)
          void loadCosmetics().catch(() => undefined)
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

  const tapTapLoginAvailable = isTapTapChannel && Boolean(currentTapTapApi()?.login)
  const loginWithTapTap = () => {
    const tap = currentTapTapApi()
    if (!tap) {
      setError('当前环境未检测到 TapTap 登录能力')
      return
    }
    void action(async () => {
      const code = await requestTapTapLoginCode(tap)
      return api('/auth/taptap', { method: 'POST', body: JSON.stringify({ code }) })
    }, { failure: 'action-failed', failureLabel: 'TapTap 登录失败，请重试' })
  }

  const rerollShop = async () => {
    if (!run || pendingShopAction) return
    const previousRun = run
    const preview = previewShopReroll(run)
    if (!preview) {
      pushUiFeedback('gold-shortage')
      return
    }

    setError('')
    setPendingShopAction('reroll')
    setSelectedOfferId(null)
    setTipAnchor(null)
    setRun(preview)
    pushUiFeedback('reroll-success')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/shop/reroll`, { method: 'POST' })
      setRun(data.run)
      void loadRunHistory().catch(() => undefined)
      void loadLadderProfile().catch(() => undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败'
      setRun(previousRun)
      setError(message)
      pushUiFeedback(message.includes('金币') ? 'gold-shortage' : 'action-failed', message)
    } finally {
      setPendingShopAction(null)
    }
  }

  const buySelectedOffer = async () => {
    if (!run || !selectedOffer || pendingShopAction) return
    const previousRun = run
    const preview = previewShopPurchase(run, selectedOffer.offerId)
    if (!preview) {
      pushUiFeedback('gold-shortage')
      return
    }

    markBoughtForTutorial()
    setError('')
    setPendingShopAction('buy')
    setSelectedOfferId(null)
    setTipAnchor(null)
    setRun(preview)
    pushUiFeedback('buy-success')
    try {
      const data = await api<{ run: Run }>(`/runs/${run.id}/shop/buy`, { method: 'POST', body: JSON.stringify({ offerId: selectedOffer.offerId, area: 'BAG' }) })
      setRun(data.run)
      void loadRunHistory().catch(() => undefined)
      void loadLadderProfile().catch(() => undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败'
      setRun(previousRun)
      setError(message)
      pushUiFeedback(message.includes('金币') ? 'gold-shortage' : 'action-failed', message)
    } finally {
      setPendingShopAction(null)
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

  const skipUpgradeChoice = () => {
    if (!run) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void action(
      () => api(`/runs/${run.id}/upgrade/skip`, { method: 'POST' }),
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

  const selectMapNode = (nodeId: string) => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/map/select`, { method: 'POST', body: JSON.stringify({ nodeId }) }),
      { success: 'place-success', failure: 'action-failed' },
    )
  }

  const resolveMapEvent = () => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/map/event`, { method: 'POST' }),
      { success: 'reward-picked', failure: 'action-failed' },
    )
  }

  const completeMapNode = () => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/map/complete-node`, { method: 'POST' }),
      { success: 'place-success', failure: 'action-failed' },
    )
  }

  const claimMapReward = () => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/map/monster-reward/claim`, { method: 'POST' }),
      { success: 'reward-picked', failure: 'place-failed' },
    )
  }

  const skipMapReward = () => {
    if (!run) return
    void action(
      () => api(`/runs/${run.id}/map/monster-reward/skip`, { method: 'POST' }),
      { success: 'place-success', failure: 'action-failed' },
    )
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
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    if (run?.phase === 'ENCHANT_CHOICE' && selectedEnchant) {
      applyEnchant(itemId)
      return
    }
    if (run?.phase === 'UPGRADE_CHOICE') {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item && canFreeUpgradeItem(item, run.shopType)) {
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
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }

  const closeShopTip = () => {
    cancelTipAnchor()
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

  const onDragStart = () => {
    cancelTipAnchor()
    setTipAnchor(null)
  }
  const onDragEnd = (event: DragEndEvent) => {
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    handleItemDrop(itemId, overId)
  }
  const handleItemDrop: ItemDropHandler = (itemId, overId) => {
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      const sourceItem = run?.items.find((item) => item.id === itemId)
      const targetItem = run?.items.find((item) => item.id === targetItemId)
      if (targetItem?.id === itemId) return
      if (canUpgradeDrop(sourceItem, targetItem)) {
        upgradeItem(itemId, targetItemId)
      } else if (targetItem && targetItem.id !== itemId) {
        moveItem(itemId, targetItem.area, targetItem.x, targetItem.y)
      } else {
        pushUiFeedback('upgrade-failed')
      }
      return
    }
    if (overId === 'SELL_ZONE' && (run?.phase === 'SHOP' || run?.phase === 'MAP')) {
      setSelectedItemId(null)
      setTipAnchor(null)
      void action(
        () => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }),
        { success: 'sell-success' },
      )
      return
    }
    const slot = overId ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
    else pushUiFeedback('place-failed')
  }
  const onDragCancel = () => undefined

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
        <HanddrawnFrame as="section" variant="panel" ornament="corner" className="auth-panel paper-card sticker-card">
          <div className="brand-block">
            <img className="game-logo" src={gameIcon} alt="" />
            <div>
              <h1>{t('appTitle')}</h1>
              <p>{t('appSubtitle')}</p>
            </div>
          </div>
          <LanguageSelector />
          {tapTapLoginAvailable && (
            <ActionButton onClick={loginWithTapTap}>TapTap 登录</ActionButton>
          )}
          {isTapTapChannel && !tapTapLoginAvailable && (
            <p className="error">当前环境未检测到 TapTap 登录能力，可继续使用调试账号登录。</p>
          )}
          <label>账号<input value={account} autoCapitalize="none" onChange={(e) => setAccount(e.target.value)} /></label>
          <label>密码<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p className="error">{localizeServerError(error, language)}</p>}
          <div className="row">
            <ActionButton onClick={() => action(() => api('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) }))}>登录</ActionButton>
            <ActionButton variant="secondary" onClick={() => action(() => api('/auth/register', { method: 'POST', body: JSON.stringify({ account, password }) }))}>注册</ActionButton>
          </div>
        </HanddrawnFrame>
        <FeedbackLayer feedbacks={uiFeedbacks} />
      </main>
    )
  }

  if (needsNicknameSetup) {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <NicknameSetup onSubmit={(nickname) => action(() => api('/profile/nickname', { method: 'POST', body: JSON.stringify({ nickname }) }))} />
      </Shell>
    )
  }

  if (appScreen === 'LOBBY') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <PlayerRunHistoryPanel history={runHistory} ladderProfile={ladderProfile} season={currentSeason} seasonSummaries={seasonSummaries} onOpen={() => setHistoryOverlayOpen(true)} onEnterShop={() => setAppScreen('SHOP')} onEnterAchievements={() => setAppScreen('ACHIEVEMENTS')} onEnterSettings={() => setAppScreen('SETTINGS')} />
        <ModeLobby run={run} runHistory={runHistory} onOpen={() => setHistoryOverlayOpen(true)} onEnterCasual={handleEnterCasual} onReplayTutorial={startCasualTutorial} onEnterLadder={() => setAppScreen('LADDER')} onEnterDogfight={() => setAppScreen('DOGFIGHT')} onEnterPeak={() => setAppScreen('PEAK')} />
        {historyOverlayOpen && <PlayerHistoryOverlay history={runHistory} onClose={() => setHistoryOverlayOpen(false)} />}
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'SHOP') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <AccountShopScreen onCosmeticsChange={loadCosmetics} />
      </Shell>
    )
  }

  if (appScreen === 'ACHIEVEMENTS') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <AchievementsScreen />
      </Shell>
    )
  }

  if (appScreen === 'SETTINGS') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <AccountSettingsScreen onCosmeticsChange={loadCosmetics} />
      </Shell>
    )
  }

  if (appScreen === 'LADDER' && run?.mode !== 'LADDER') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <LadderHome onStart={(choice) => action(() => api('/runs', { method: 'POST', body: JSON.stringify({ ...choice, mode: 'LADDER' }) }))} />
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'DOGFIGHT') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogfightLobby soundEnabled={musicEnabled} />
        {tutorialGuide}
      </Shell>
    )
  }

  if (appScreen === 'PEAK') {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <ApexArena />
        {tutorialGuide}
      </Shell>
    )
  }

  if (!run) {
    return (
      <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
        <DogSelect onPick={(choice) => action(() => api('/runs', { method: 'POST', body: JSON.stringify(choice) }))} />
        {tutorialGuide}
      </Shell>
    )
  }
  return (
    <Shell feedbacks={uiFeedbacks} cosmetics={equippedCosmetics} user={user} run={run} error={error} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={toggleMusic} onOpenLobby={() => setAppScreen('LOBBY')} onLogout={() => action(() => api('/auth/logout', { method: 'POST' }).then(() => ({ user: null })))}>
      {!battle && run.phase === 'MAP' && run.mapState && (
        <DndContext sensors={sensors} measuring={dndMeasuring} collisionDetection={dragCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <ExplorationMapView
            run={run}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            tipAnchor={tipAnchor}
            onSelectNode={selectMapNode}
            onResolveEvent={resolveMapEvent}
            onClaimReward={claimMapReward}
            onSkipReward={skipMapReward}
            onDrop={handleItemDrop}
            onSellRelic={sellRelic}
            onSelectItem={onInspectItem}
            onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            onCloseTip={closeShopTip}
            onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
          />
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay />
          </DragOverlay>
        </DndContext>
      )}

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
        <DndContext sensors={sensors} measuring={dndMeasuring} collisionDetection={dragCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <section className="reward-workbench">
            <ClassRewardSelect
              choices={run.classRewardChoices}
              visualTheme={visualThemeForRound(run.round)}
              onPick={(defId) => action(() => api(`/runs/${run.id}/class-reward/select`, { method: 'POST', body: JSON.stringify({ defId }) }), { success: 'reward-picked' })}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              onDrop={handleItemDrop}
              onSellRelic={sellRelic}
              onSelectItem={onInspectItem}
              onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)}
            />
            <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null} />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay />
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
            onDrop={handleItemDrop}
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
          <UpgradeChoiceSelect run={run} visualTheme={visualThemeForRound(run.round)} onSkip={skipUpgradeChoice} />
          <InventoryBoard
            run={run}
            selectedItemId={selectedItemId}
            onDrop={handleItemDrop}
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
            onDrop={handleItemDrop}
            onSellRelic={sellRelic}
            onSelectItem={onInspectItem}
            onSlotClick={() => undefined}
          />
          <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={closeShopTip} onBuy={null} onSell={null} onUpgrade={null} />
        </section>
      )}

      {!battle && run.phase === 'SHOP' && (
        <DndContext sensors={sensors} measuring={dndMeasuring} collisionDetection={dragCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <section className="shop-workbench">
            <ShopShelf
              run={run}
              selectedOfferId={selectedOfferId}
              onInspectOffer={onInspectOffer}
              pendingAction={pendingShopAction}
              onReroll={() => void rerollShop()}
              matchLabel={activeMapNode?.kind === 'PLAYER_BATTLE' ? '进入战斗' : run.mapState?.currentNodeId ? '返回地图' : '匹配'}
              onMatch={() => run.mapState?.currentNodeId ? completeMapNode() : action(() => api(`/runs/${run.id}/battle/match`, { method: 'POST' }), { success: 'battle-start' })}
            />
            <InventoryBoard
              run={run}
              selectedItemId={selectedItemId}
              onDrop={handleItemDrop}
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
              busy={pendingShopAction === 'buy'}
              onBuy={selectedOffer ? () => void buySelectedOffer() : null}
              onSell={() => selectedItem && action(() => api(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId: selectedItem.id }) }), { success: 'sell-success' })}
              onUpgrade={selectedItem && canUpgradeItem(selectedItem, run.items) ? () => upgradeItem(selectedItem.id) : null}
            />
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay />
          </DragOverlay>
        </DndContext>
      )}

      {!battle && (run.phase === 'MATCH' || run.phase === 'PREP') && (
        <DndContext sensors={sensors} measuring={dndMeasuring} collisionDetection={dragCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
          <section className="match-panel" data-tutorial-anchor="battle-start">
            {run.phase === 'MATCH' ? (
              <>
                <DogBadge dogType={run.matchedGhost?.dogType ?? 'SHIBA'} src={dogAssets[run.matchedGhost?.dogType ?? 'SHIBA']} size="lg" className="dog-avatar large" />
                <h2>匹配到 {run.matchedGhost?.name}</h2>
                <p>{dogNames[run.matchedGhost?.dogType ?? 'SHIBA']} · {run.matchedGhost?.wins}胜 {run.matchedGhost?.losses}败 · 第 {run.matchedGhost?.round} 回合</p>
              </>
            ) : (
              <>
                <h2>整备阶段</h2>
                <p>整理装备与遗物后再匹配对手。</p>
              </>
            )}
            <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={handleItemDrop} onSellRelic={sellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && moveItem(selectedItemId, area, x, y)} />
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
            <ActionButton data-tutorial-anchor={run.phase === 'MATCH' ? 'battle-start' : 'match-button'} onClick={() => action(() => api(run.phase === 'PREP' ? `/runs/${run.id}/battle/match` : `/runs/${run.id}/battle/start`, { method: 'POST' }), { success: 'battle-start' })}>
              <Dice5 size={18} /> {run.phase === 'PREP' ? '匹配对手' : '开始战斗'}
            </ActionButton>
          </section>
          <DragOverlay dropAnimation={null} zIndex={1000}>
            <DraggingItemOverlay />
          </DragOverlay>
        </DndContext>
      )}

      {(run.phase === 'BATTLE' || run.phase === 'COMPLETE' || battle) && (
        <BattleView
          run={run}
          battle={battle}
          cosmetics={equippedCosmetics}
          currentEvent={currentEvent}
          eventIndex={eventIndex}
          speed={speed}
          score={score}
          soundEnabled={musicEnabled}
          onSpeed={setSpeed}
          onContinue={() => void finishBattle()}
          onRestart={() => {
            setRun(null)
            setAppScreen('LOBBY')
          }}
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
        <ActionButton variant="secondary" type="button" onClick={onSkip}>跳过引导</ActionButton>
      </div>
    </aside>
  )
}

function AccountShopScreen({ onCosmeticsChange }: { onCosmeticsChange: () => Promise<CosmeticsResponse> }) {
  const [shop, setShop] = useState<AccountShopResponse | null>(null)
  const [cosmetics, setCosmetics] = useState<CosmeticsResponse | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const [shopData, cosmeticsData] = await Promise.all([api<AccountShopResponse>('/shop'), api<CosmeticsResponse>('/cosmetics/me')])
    setShop(shopData)
    setCosmetics(cosmeticsData)
  }, [])
  useEffect(() => { void load().catch((err) => setError(err instanceof Error ? err.message : '加载失败')) }, [load])
  const purchase = async (catalogItemId: string) => {
    setShop(await api<AccountShopResponse>('/shop/purchase', { method: 'POST', body: JSON.stringify({ catalogItemId }) }))
    setCosmetics(await api<CosmeticsResponse>('/cosmetics/me'))
    await onCosmeticsChange()
  }
  const equip = async (catalogItemId: string) => {
    setCosmetics(await api<CosmeticsResponse>('/cosmetics/equip', { method: 'POST', body: JSON.stringify({ catalogItemId }) }))
    setShop(await api<AccountShopResponse>('/shop'))
    await onCosmeticsChange()
  }
  return (
    <section className="account-shop-screen">
      <div className="screen-heading">
        <div><p className="eyebrow">账号商城</p><h1>外观商店</h1></div>
        <span className="account-currency-pill"><Coins size={18} /> {shop?.wallet.balance ?? 0}</span>
      </div>
      {error && <p className="error">{error}</p>}
      {shop && <>
        <ShopCatalogSection title="常驻区" items={shop.sections.permanent} equipped={cosmetics?.equipped ?? []} onPurchase={purchase} onEquip={equip} />
        <ShopCatalogSection title="精选轮换区" items={shop.sections.featured} equipped={cosmetics?.equipped ?? []} onPurchase={purchase} onEquip={equip} />
      </>}
    </section>
  )
}

function ShopCatalogSection({ title, items, equipped, onPurchase, onEquip }: { title: string; items: ShopCatalogItem[]; equipped: CosmeticsResponse['equipped']; onPurchase: (catalogItemId: string) => Promise<void>; onEquip: (catalogItemId: string) => Promise<void> }) {
  const equippedIds = new Set(equipped.map((entry) => entry.catalogItemId))
  return (
    <section className="shop-section">
      <h2>{title}</h2>
      <div className="shop-section-grid">
        {items.map((item) => {
          const isEquipped = equippedIds.has(item.id) || item.equipped
          return (
            <article key={item.id} className={`shop-cosmetic-card rarity-${item.rarity.toLowerCase()}`}>
              <CosmeticBadge type={item.type} rarity={item.rarity} />
              <strong>{item.name}</strong>
              <p>{item.description}</p>
              <span className="cosmetic-type">{cosmeticTypeLabel(item.type)} · {rarityLabel(item.rarity)}</span>
              <div className="shop-card-actions">
                <span><Coins size={14} /> {item.price}</span>
                {isEquipped ? <button disabled>已装备</button> : item.owned ? <button onClick={() => void onEquip(item.id)}>装备</button> : <button onClick={() => void onPurchase(item.id)}>购买</button>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function AchievementsScreen() {
  const [achievements, setAchievements] = useState<AchievementsResponse | null>(null)
  const [daily, setDaily] = useState<DailyTasksResponse | null>(null)
  const [category, setCategory] = useState('全部')
  const load = useCallback(async () => {
    const [achievementData, dailyData] = await Promise.all([api<AchievementsResponse>('/achievements'), api<DailyTasksResponse>('/daily-tasks')])
    setAchievements(achievementData)
    setDaily(dailyData)
  }, [])
  useEffect(() => { void load() }, [load])
  const claimAchievement = async (achievementId: string) => setAchievements(await api<AchievementsResponse>(`/achievements/${achievementId}/claim`, { method: 'POST' }))
  const claimTask = async (taskId: string) => setDaily(await api<DailyTasksResponse>(`/daily-tasks/${taskId}/claim`, { method: 'POST' }))
  const refreshTasks = async () => setDaily(await api<DailyTasksResponse>('/daily-tasks/refresh', { method: 'POST' }))
  const list = achievements?.achievements ?? []
  const categories = ['全部', ...Array.from(new Set(list.map((entry) => entry.category)))]
  const visible = category === '全部' ? list : list.filter((entry) => entry.category === category)
  return (
    <section className="achievements-screen">
      <div className="screen-heading">
        <div><p className="eyebrow">长期目标</p><h1>成就与每日任务</h1></div>
        <span className="account-currency-pill"><Coins size={18} /> {achievements?.wallet.balance ?? 0}</span>
      </div>
      <section className="daily-task-panel">
        <div className="panel-title-row"><h2>每日任务 {daily?.dateKey}</h2><button disabled={daily?.refreshUsed} onClick={() => void refreshTasks()}><RefreshCcw size={16} /> 刷新</button></div>
        {daily?.tasks.map((task) => (
          <div key={task.taskId} className="daily-task-row">
            <div><strong>{task.def?.title ?? task.taskId}</strong><span>{task.def?.description}</span></div>
            <progress value={task.progress} max={task.target} />
            {task.claimedAt ? <button disabled>已领取</button> : task.progress >= task.target ? <button onClick={() => void claimTask(task.taskId)}>领取 {task.reward}</button> : <span>{task.progress}/{task.target}</span>}
          </div>
        ))}
      </section>
      <div className="achievement-tabs">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="achievement-grid">
        {visible.map((entry) => (
          <article key={entry.id} className={`achievement-card ${entry.hidden ? 'hidden' : ''} ${entry.claimable ? 'claimable' : ''}`}>
            <div><strong>{entry.title}</strong><span>{entry.category}</span></div>
            <p>{entry.description}</p>
            <progress value={entry.progress} max={entry.target} />
            <div className="shop-card-actions">
              <span>{entry.progress}/{entry.target} · {entry.reward}</span>
              {entry.claimed ? <button disabled>已领取</button> : entry.claimable ? <button onClick={() => void claimAchievement(entry.id)}>领取</button> : <button disabled>未完成</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const cosmeticTypeOrder: CosmeticType[] = ['TITLE', 'AVATAR', 'BACKGROUND', 'DOG_SKIN', 'BATTLE_EFFECT']

function defaultCosmeticItem(type: CosmeticType): ShopCatalogItem {
  const labels: Record<CosmeticType, string> = {
    TITLE: '默认称号',
    AVATAR: '默认头像',
    BACKGROUND: '默认主页',
    DOG_SKIN: '默认狗狗',
    BATTLE_EFFECT: '默认特效',
  }
  const descriptions: Record<CosmeticType, string> = {
    TITLE: '不装备称号，显示账号原始样式。',
    AVATAR: '使用初始狗狗头像。',
    BACKGROUND: '使用游戏初始主页背景。',
    DOG_SKIN: '使用狗狗原本的外观。',
    BATTLE_EFFECT: '使用基础战斗表现。',
  }
  return {
    id: `default-${type.toLowerCase()}`,
    name: labels[type],
    description: descriptions[type],
    type,
    rarity: 'COMMON',
    price: 0,
    section: 'PERMANENT',
    assetKey: `default.${type.toLowerCase()}`,
    purchaseType: 'GRANT_ONLY',
    source: 'CODE',
    owned: true,
    equipped: false,
  }
}

function AccountSettingsScreen({ onCosmeticsChange }: { onCosmeticsChange: () => Promise<CosmeticsResponse> }) {
  const [cosmetics, setCosmetics] = useState<CosmeticsResponse | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => setCosmetics(await api<CosmeticsResponse>('/cosmetics/me')), [])
  useEffect(() => { void load().catch((err) => setError(err instanceof Error ? err.message : '加载失败')) }, [load])
  const equip = async (catalogItemId: string) => {
    setError('')
    try {
      setCosmetics(await api<CosmeticsResponse>('/cosmetics/equip', { method: 'POST', body: JSON.stringify({ catalogItemId }) }))
      await onCosmeticsChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : '装备失败')
    }
  }
  const unequip = async (cosmeticType: CosmeticType) => {
    setError('')
    try {
      setCosmetics(await api<CosmeticsResponse>('/cosmetics/equip', { method: 'POST', body: JSON.stringify({ catalogItemId: null, cosmeticType }) }))
      await onCosmeticsChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复默认失败')
    }
  }
  const ownedItems = (cosmetics?.inventory ?? [])
    .map((entry) => entry.item)
    .filter((item): item is ShopCatalogItem => Boolean(item))
  const equippedBySlot = new Map((cosmetics?.equipped ?? []).map((entry) => [entry.slot, entry.catalogItemId]))
  const cosmeticGroups = cosmeticTypeOrder.map((type) => ({
    type,
    label: cosmeticTypeLabel(type),
    items: ownedItems.filter((item) => item.type === type),
  }))

  return (
    <section className="account-settings-screen">
      <div className="screen-heading">
        <div><p className="eyebrow">个人设置</p><h1>时装与展示</h1></div>
      </div>
      {error && <p className="error">{error}</p>}
      {cosmetics ? cosmeticGroups.map((group) => (
        <section className="shop-section" key={group.type}>
          <h2>{group.label}</h2>
          <div className="shop-section-grid">
            {(() => {
              const defaultItem = defaultCosmeticItem(group.type)
              const isEquipped = !equippedBySlot.has(group.type)
              return (
                <article key={`${group.type}-default`} className={`shop-cosmetic-card account-setting-card rarity-${defaultItem.rarity.toLowerCase()} ${isEquipped ? 'equipped' : ''}`}>
                  <CosmeticBadge type={defaultItem.type} rarity={defaultItem.rarity} />
                  <strong>{defaultItem.name}</strong>
                  <p>{defaultItem.description}</p>
                  <span className="cosmetic-type">默认 · 免费</span>
                  <div className="shop-card-actions">
                    <span>{isEquipped ? '当前默认' : '初始外观'}</span>
                    {isEquipped ? <button disabled>已选择</button> : <button onClick={() => void unequip(group.type)}>选择默认</button>}
                  </div>
                </article>
              )
            })()}
            {group.items.map((item) => {
              const isEquipped = equippedBySlot.get(item.type) === item.id || item.equipped
              return (
                <article key={item.id} className={`shop-cosmetic-card account-setting-card rarity-${item.rarity.toLowerCase()} ${isEquipped ? 'equipped' : ''}`}>
                  <CosmeticBadge type={item.type} rarity={item.rarity} />
                  <strong>{item.name}</strong>
                  <p>{item.description}</p>
                  <span className="cosmetic-type">{rarityLabel(item.rarity)} · 已拥有</span>
                  <div className="shop-card-actions">
                    <span>{isEquipped ? '当前装备' : '可装备'}</span>
                    {isEquipped ? <button disabled>已装备</button> : <button onClick={() => void equip(item.id)}>装备</button>}
                  </div>
                </article>
              )
            })}
          </div>
          {group.items.length === 0 && <p className="account-settings-empty">暂无已拥有的{group.label}，可先去商城购买。</p>}
        </section>
      )) : <p className="account-settings-empty">正在读取个人时装...</p>}
    </section>
  )
}

function CosmeticBadge({ type, rarity }: { type: CosmeticType; rarity: CosmeticRarity }) {
  const icon = type === 'TITLE' ? <Medal size={20} /> : type === 'AVATAR' ? <PawPrint size={20} /> : type === 'BACKGROUND' ? <House size={20} /> : type === 'DOG_SKIN' ? <Crown size={20} /> : <Sparkles size={20} />
  return <span className={`cosmetic-badge rarity-${rarity.toLowerCase()}`}>{icon}</span>
}

function cosmeticTypeLabel(type: CosmeticType) {
  return ({ TITLE: '称号', AVATAR: '头像', BACKGROUND: '主页背景', DOG_SKIN: '狗狗皮肤', BATTLE_EFFECT: '战斗特效' } as Record<CosmeticType, string>)[type]
}

function rarityLabel(rarity: CosmeticRarity) {
  return ({ COMMON: '普通', RARE: '稀有', EPIC: '史诗', LEGENDARY: '传说' } as Record<CosmeticRarity, string>)[rarity]
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
        <ActionButton variant="secondary" className="tutorial-replay-button" type="button" onClick={onReplayTutorial}>新手引导</ActionButton>
      <div className="mode-grid">
        {modeCards.map((mode) => (
          <HanddrawnFrame as="article" variant="card" ornament="corner" key={mode.id} className={`mode-card paper-card sticker-card ${mode.locked ? 'locked' : 'available'}`}>
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
              <ActionButton className="mode-action" data-tutorial-anchor="mode-casual" onClick={onEnterCasual}>{casualAction}</ActionButton>
            ) : mode.id === 'LADDER' ? (
              <ActionButton className="mode-action" onClick={onEnterLadder}>{ladderAction}</ActionButton>
            ) : mode.id === 'DOGFIGHT' ? (
              <ActionButton className="mode-action" onClick={onEnterDogfight}>进入斗狗模式</ActionButton>
            ) : mode.id === 'PEAK' ? (
              <ActionButton className="mode-action" onClick={onEnterPeak}>进入巅峰模式</ActionButton>
            ) : (
              <ActionButton variant="secondary" className="mode-action" disabled>
                <Lock size={18} /> 未解锁
              </ActionButton>
            )}
          </HanddrawnFrame>
        ))}
      </div>
    </section>
  )
}

function PlayerRunHistoryPanel({ history, ladderProfile, season, seasonSummaries, onOpen, onEnterShop, onEnterAchievements, onEnterSettings }: { history: PlayerRunHistory; ladderProfile: LadderProfile | null; season: SeasonInfo | null; seasonSummaries: SeasonPlayerSummary[]; onOpen: () => void; onEnterShop: () => void; onEnterAchievements: () => void; onEnterSettings: () => void }) {
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
            <p>{season?.name ?? '当前赛季'} · {rankScore} 分</p>
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
        <div className="account-panel-actions">
          <button className="account-panel-button" type="button" onClick={onEnterShop}><ShoppingBag size={18} /> 商城</button>
          <button className="account-panel-button" type="button" onClick={onEnterAchievements}><Medal size={18} /> 成就</button>
          <button className="account-panel-button" type="button" onClick={onEnterSettings}><Sparkles size={18} /> 个人设置</button>
          <HanddrawnTextButton className="history-open-action account-panel-button" onClick={onOpen}>查看详情和装备</HanddrawnTextButton>
        </div>
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
      <SeasonHistoryList summaries={seasonSummaries} />
    </section>
  )
}

function SeasonHistoryList({ summaries }: { summaries: SeasonPlayerSummary[] }) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<ArchivedApexSnapshot | null>(null)
  return (
    <div className="season-history-list" aria-label="赛季历史">
      <div className="season-history-heading">
        <span>赛季历史</span>
        <small>{summaries.length > 0 ? `${summaries.length} 个已结束赛季` : '赛季结束后会保存在这里'}</small>
      </div>
      {summaries.length > 0 ? summaries.slice(0, 3).map((summary) => (
        <article className="season-history-card" key={summary.id}>
          <div>
            <strong>{summary.seasonName}</strong>
            <p>天梯 {summary.ladderTierLabel ?? '未参赛'}{summary.ladderScore != null ? ` · ${summary.ladderScore} 分` : ''}{summary.dogKingRank ? ` · 犬王第 ${summary.dogKingRank} 名` : ''}</p>
            <p>{summary.apexRank ? `巅峰第 ${summary.apexRank} 名 · ${summary.apexWins}胜${summary.apexLosses}败` : '巅峰未入榜'}</p>
          </div>
          {summary.apexSnapshot && (
            <ActionButton variant="secondary" className="season-snapshot-action" onClick={() => setSelectedSnapshot(summary.apexSnapshot)}>
              <Eye size={18} /> 巅峰配置快照
            </ActionButton>
          )}
        </article>
      )) : (
        <p className="season-history-empty">暂无赛季历史</p>
      )}
      {selectedSnapshot && <ApexConfigOverlay entry={apexEntryFromArchive(selectedSnapshot)} onClose={() => setSelectedSnapshot(null)} />}
    </div>
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
  const { scheduleTipAnchor, cancelTipAnchor } = useDeferredTipAnchor(setTipAnchor)
  const runs = activeTab === 'ALL' ? history.recentRuns : history.recentRuns.filter((entry) => entry.mode === activeTab)
  const selectedRun = runs.find((entry) => entry.id === selectedRunId) ?? runs[0] ?? null
  const bestRun = history.bestRun

  const closeTip = () => {
    cancelTipAnchor()
    setInspectedItem(null)
    setTipAnchor(null)
  }
  const inspectItem = (item: Item, element: HTMLElement) => {
    setInspectedItem(item)
    setTipAnchor(null)
    scheduleTipAnchor(element)
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
          <IconButton title="关闭个人战绩" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </header>

        <div className="history-mode-tabs" role="tablist" aria-label="战绩模式">
          {historyModeTabs.map((tab) => {
            const count = tab.id === 'ALL' ? history.recentRuns.length : history.recentRuns.filter((entry) => entry.mode === tab.id).length
            return (
              <HanddrawnTabButton key={tab.id} active={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setSelectedRunId(null); closeTip() }}>
                {tab.label}<small>{count}</small>
              </HanddrawnTabButton>
            )
          })}
        </div>

        <div className="history-detail-layout">
          <section className="history-run-browser" aria-label="历史对局列表">
            {runs.length > 0 ? runs.map((entry) => (
              <HanddrawnListButton key={entry.id} className="history-detail-row" selected={selectedRun?.id === entry.id} onClick={() => { setSelectedRunId(entry.id); closeTip() }}>
                <DogBadge dogType={entry.dogType} src={dogAssets[entry.dogType]} size="sm" className="dog-avatar small" />
                <span>{dogNames[entry.dogType]}</span>
                <strong>{entry.wins}胜 {entry.losses}败</strong>
                <small>{runStatusText(entry.status)} · 第 {entry.round} 回合 · 装备 {entry.items.length}</small>
              </HanddrawnListButton>
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
            return (
            <ItemFrame
              as="button"
              type="button"
              key={item.id}
              className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
              style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
              title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
              onClick={(event) => onInspectItem(item, event.currentTarget)}
            >
              <ItemCardContent item={item} relics={entry.relics} />
            </ItemFrame>
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
          <ActionButton onClick={() => void enterRoom('CREATE')}><House size={18} /> 创建房间</ActionButton>
          <ActionButton variant="secondary" disabled={!selectedRoomId} onClick={() => void enterRoom('JOIN')}><Swords size={18} /> 加入房间</ActionButton>
          <ActionButton onClick={() => void enterRoom('MATCH')}><RadioTower size={18} /> 随机匹配</ActionButton>
          <p className="muted-note">玩家席位先进入房间，开局后统一 15 秒选择斗狗；不足 8 人由机器人补齐。</p>
        </aside>
        <section className="dogfight-room-list">
          <div className="panel-heading">
            <h3>房间列表</h3>
            <ActionButton variant="secondary" onClick={() => void loadRooms()} disabled={loading}><RefreshCcw size={18} /> 刷新</ActionButton>
          </div>
          {rooms.length === 0 ? (
            <p className="apex-empty">暂无房间，创建一个斗狗房间开始。</p>
          ) : rooms.map((room) => (
            <article key={room.id} className={`dogfight-room-card ${selectedRoomId === room.id ? 'selected' : ''}`}>
              <div>
                <strong>{room.hostName} 的房间</strong>
                <p>{room.status === 'WAITING' ? '等待中' : room.status === 'ACTIVE' ? `${dogfightPhaseLabel(room.phase)} · 第 ${room.currentRound} 回合` : '已结束'} · 真人 {room.memberCount}/{room.maxPlayers} · 存活 {room.aliveCount}/{room.targetPlayerCount}</p>
              </div>
              <ActionButton
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
              </ActionButton>
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
  const [battle, setBattle] = useState<Battle | null>(null)
  const [battleId, setBattleId] = useState<string | null>(null)
  const [dismissedAutoBattleId, setDismissedAutoBattleId] = useState<string | null>(null)
  const [eventIndex, setEventIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }))
  const { scheduleTipAnchor, cancelTipAnchor } = useDeferredTipAnchor(setTipAnchor)
  const run = room.currentRun
  const currentMember = room.currentRunMember ?? (run ? room.members.find((member) => member.runId === run.id) ?? null : null)
  const selectedItem = run?.items.find((item) => item.id === selectedItemId) || null
  const selectedOffer = run?.shopItems.find((offer) => offer.offerId === selectedOfferId) || null
  const selectedEnchant = run?.enchantChoices.find((choice) => choice.id === selectedEnchantId) ?? run?.enchantChoices[0] ?? null
  const selectedPotion = run?.potionChoices.find((choice) => choice.id === selectedPotionId) ?? run?.potionChoices[0] ?? null
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
      } else if (data.run) {
        onRoomChange(mergeDogfightRunPreview(room, data.run))
        void refreshRoom().catch(() => undefined)
      } else {
        void refreshRoom()
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

  const skipUpgradeChoice = () => {
    if (!run || currentMember?.ready) return
    setTipAnchor(null)
    setSelectedItemId(null)
    void runAction(() => api<{ run: Run }>(`/runs/${run.id}/upgrade/skip`, { method: 'POST' }))
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
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }

  const onInspectItem = (itemId: string, element: HTMLElement) => {
    if (run?.phase === 'ENCHANT_CHOICE' && selectedEnchant) {
      applyEnchant(itemId)
      return
    }
    if (run?.phase === 'UPGRADE_CHOICE') {
      const item = run.items.find((entry) => entry.id === itemId)
      if (item && canFreeUpgradeItem(item, run.shopType)) {
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
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }

  const closeTip = () => {
    cancelTipAnchor()
    setSelectedItemId(null)
    setSelectedOfferId(null)
    setTipAnchor(null)
  }

  const onDragStart = () => {
    cancelTipAnchor()
    setTipAnchor(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    if (!run || currentMember?.ready) return
    const itemId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    handleItemDrop(itemId, overId)
  }
  const handleItemDrop: ItemDropHandler = (itemId, overId) => {
    if (!run || currentMember?.ready) return
    if (overId.startsWith('UPGRADE_ITEM:')) {
      const targetItemId = overId.slice('UPGRADE_ITEM:'.length)
      const sourceItem = run.items.find((item) => item.id === itemId)
      const targetItem = run.items.find((item) => item.id === targetItemId)
      if (targetItem?.id === itemId) return
      if (canUpgradeDrop(sourceItem, targetItem)) {
        upgradeItem(itemId, targetItemId)
      } else if (targetItem) {
        moveItem(itemId, targetItem.area, targetItem.x, targetItem.y)
      }
      return
    }
    if (overId === 'SELL_ZONE' && run.phase === 'SHOP') {
      setSelectedItemId(null)
      setTipAnchor(null)
      void runAction(() => api<{ run: Run }>(`/runs/${run.id}/shop/sell`, { method: 'POST', body: JSON.stringify({ itemId }) }))
      return
    }
    const slot = overId ? parseSlotId(overId) : null
    if (slot) moveItem(itemId, slot.area, slot.x, slot.y)
  }
  const onDragCancel = () => undefined

  const battleRun = battleToRun(battle) ?? run

  return (
    <section className="dogfight-room-view">
      <div className="dogfight-room-toolbar">
        <ActionButton variant="secondary" onClick={onLeave}><House size={18} /> 返回房间列表</ActionButton>
        <ActionButton variant="secondary" onClick={() => void refreshRoom()}><RefreshCcw size={18} /> 刷新房间</ActionButton>
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
        {room.isHost && room.status === 'WAITING' && <ActionButton onClick={startRoom}>开始房间</ActionButton>}
        {run && room.phase === 'SHOP' && !currentMember?.ready && !currentMember?.eliminated && <ActionButton onClick={readyRoom}>完成本回合</ActionButton>}
        {run && room.phase === 'BATTLE' && !currentMember?.ready && !currentMember?.eliminated && <ActionButton onClick={readyRoom}>完成本回合</ActionButton>}
      </div>

      <div className="dogfight-room-columns">
        <aside className="dogfight-survivor-board">
          <h3>房间玩家</h3>
          {sortedDogfightMembers(room.members).map((member) => (
            <HanddrawnListButton
              key={member.id}
              className={`dogfight-player-frame ${member.kind.toLowerCase()} ${member.eliminated ? 'eliminated' : ''} ${selectedBattleMemberId === member.id ? 'selected' : ''}`}
              selected={selectedBattleMemberId === member.id}
              onClick={() => {
                setSelectedMemberId(member.id)
                if (member.currentBattleId) void loadBattle(member.currentBattleId)
              }}
            >
              {member.dogType ? <DogBadge dogType={member.dogType} src={dogAssets[member.dogType]} size="sm" className="dog-avatar small" /> : <PawPrint size={28} />}
              <div>
                <strong>{member.nickname}{member.isHost ? ' · 房主' : ''}</strong>
                <p>{member.dogType ? dogNames[member.dogType] : '等待选狗'} · {member.kind === 'BOT' ? '参赛者' : '玩家'} · {member.wins}胜 {member.losses}败</p>
              </div>
              <b>{dogfightLives(member)}</b>
            </HanddrawnListButton>
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
            <DndContext sensors={sensors} measuring={dndMeasuring} collisionDetection={dragCollisionDetection} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
              <DogfightRunWorkbench
                run={run}
                selectedItemId={selectedItemId}
                selectedOfferId={selectedOfferId}
                onDrop={handleItemDrop}
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
                onSkipUpgradeChoice={skipUpgradeChoice}
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
                <DraggingItemOverlay />
              </DragOverlay>
            </DndContext>
          ) : (
            <p className="apex-empty">{room.phase === 'BATTLE' ? '战斗生成中，可以点击左侧玩家框或右侧场次切换观战。' : '你正在观战这个房间。可以查看房间战况和历史战报。'}</p>
          )}
        </main>

        <section className="dogfight-battle-dock">
          <h3>本轮场次</h3>
          {room.battles.length === 0 ? <p className="apex-empty">暂无战报</p> : room.battles.slice().reverse().map((entry) => (
            <HanddrawnListButton key={entry.id} className="dogfight-battle-row" onClick={() => void loadBattle(entry.id)}>
              第 {entry.round} 回合 · {entry.opponentKind === 'PLAYER' ? '玩家对战' : '离线训练'} · 回放
            </HanddrawnListButton>
          ))}
        </section>
      </div>
    </section>
  )
}

function DogfightRunWorkbench({ run, selectedItemId, selectedOfferId, selectedItem, selectedOffer, tipAnchor, onDrop, onInspectOffer, onInspectItem, onMoveItem, onReroll, onBuy, onSell, onSellRelic, onUpgrade, onChoice, onClassReward, onRelic, onUpgradeChoice, onSkipUpgradeChoice, selectedEnchantId, onEnchantChoice, selectedPotionId, onPotionChoice, onCloseTip }: {
  run: Run
  selectedItemId: string | null
  selectedOfferId: string | null
  onDrop: ItemDropHandler
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
  onSkipUpgradeChoice: () => void
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
        <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={onDrop} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={onUpgrade} />
      </section>
    )
  }
  if (run.phase === 'ENCHANT_CHOICE') {
    return (
      <section className="reward-workbench enchant-workbench">
        <EnchantChoiceSelect choices={run.enchantChoices} selectedId={selectedEnchantId} visualTheme={visualThemeForRound(run.round)} onSelect={onEnchantChoice} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={onDrop} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={null} />
      </section>
    )
  }
  if (run.phase === 'RELIC_CHOICE') return <RelicChoiceSelect choices={run.relicChoices} visualTheme={visualThemeForRound(run.round)} onPick={onRelic} />
  if (run.phase === 'UPGRADE_CHOICE') {
    return (
      <section className="reward-workbench upgrade-workbench">
        <UpgradeChoiceSelect run={run} visualTheme={visualThemeForRound(run.round)} onSkip={onSkipUpgradeChoice} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={onDrop} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={selectedItem && canFreeUpgradeItem(selectedItem) ? () => onUpgradeChoice(selectedItem.id) : null} />
      </section>
    )
  }
  if (run.phase === 'POTION_CHOICE') {
    return (
      <section className="reward-workbench potion-workbench">
        <PotionChoiceSelect choices={run.potionChoices} selectedId={selectedPotionId} visualTheme={visualThemeForRound(run.round)} onSelect={onPotionChoice} />
        <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={onDrop} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={() => undefined} />
        <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={null} />
      </section>
    )
  }
  return (
    <section className="shop-workbench dogfight-workbench">
      {run.phase === 'SHOP' && <ShopShelf run={run} selectedOfferId={selectedOfferId} onInspectOffer={onInspectOffer} onReroll={onReroll} onMatch={() => undefined} />}
      <InventoryBoard run={run} selectedItemId={selectedItemId} onDrop={onDrop} onSellRelic={onSellRelic} onSelectItem={onInspectItem} onSlotClick={(area, x, y) => selectedItemId && onMoveItem(selectedItemId, area, x, y)} />
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
  const [selectedApexEntry, setSelectedApexEntry] = useState<ApexEntry | null>(null)
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
        season: result.season,
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
  const activeSeasonName = overview?.season.name ?? '读取中'

  return (
    <section className="apex-screen">
      <div className="screen-heading centered">
        <h2>巅峰竞技场</h2>
        <p>巅峰赛季：{activeSeasonName} · 保存战斗结束后的死数据，自动从榜尾向上挑战，失败后固定在当前名次。</p>
      </div>
      <div className="apex-toolbar">
        <ActionButton variant="secondary" onClick={() => void loadApex()} disabled={loading}>
          <RefreshCcw size={18} /> 刷新
        </ActionButton>
      </div>
      {error && <p className="error">{error}</p>}
      {reports && submittedEntries && (
        <div className="apex-report">
          <Trophy size={30} />
          <div>
            <h3>{submittedEntries.overall.name} 已投入巅峰榜</h3>
            <p>总榜{apexRankText(reports.overall.placementRank)}，当日榜{apexRankText(reports.daily.placementRank)}。新记录防守连胜从 {submittedEntries.overall.challengeWins} 开始。</p>
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
                <DogBadge dogType={candidate.dogType} src={dogAssets[candidate.dogType]} size="sm" className="dog-avatar small" />
                <div>
                  <strong>{dogNames[candidate.dogType]} · {candidate.wins}胜{candidate.losses}败</strong>
                  <p>第 {candidate.round} 回合 · 遗物 {candidate.relics.length} · 装备 {candidate.items.length}</p>
                </div>
                <ActionButton disabled={Boolean(submittingRunId)} onClick={() => void submitRun(candidate.id)}>
                  <Crown size={18} /> {submittingRunId === candidate.id ? '挑战中' : '投入巅峰'}
                </ActionButton>
              </article>
            ))}
          </div>
        </section>
        <section className="apex-leaderboard">
          <div className="panel-heading">
            <h3>{activeBoardLabel}</h3>
            <p>{activeApexBoard === 'daily' ? `每日 05:00 更新 · ${overview?.dailyBoardKey ?? ''}` : '初始50个种子数据会随着玩家提交逐步被挤下去。'}</p>
            <div className="apex-tabs" role="tablist" aria-label="巅峰榜切换">
              <HanddrawnTabButton role="tab" aria-selected={activeApexBoard === 'overall'} active={activeApexBoard === 'overall'} onClick={() => setActiveApexBoard('overall')}>总榜</HanddrawnTabButton>
              <HanddrawnTabButton role="tab" aria-selected={activeApexBoard === 'daily'} active={activeApexBoard === 'daily'} onClick={() => setActiveApexBoard('daily')}>当日榜</HanddrawnTabButton>
            </div>
          </div>
          <div className="apex-rank-list">
            {leaderboard.map((entry) => (
              <div className="apex-rank-entry" key={entry.id}>
                <article className={`apex-rank-row ${entry.isSeed ? 'seed' : ''} ${entry.isMine ? 'player-entry' : ''}`}>
                  <b>{entry.rank == null ? '未上榜' : `#${entry.rank}`}</b>
                  <DogBadge dogType={entry.dogType} src={dogAssets[entry.dogType]} size="sm" className="dog-avatar small" />
                  <div>
                    <strong>{entry.name}</strong>
                    <p>{dogNames[entry.dogType]} · {entry.wins}胜{entry.losses}败 · 第 {entry.round} 回合</p>
                  </div>
                  {entry.isMine && <span className="apex-self-marker">我的记录</span>}
                  <span>{entry.isSeed ? '种子' : `防守连胜 ${entry.challengeWins}`}</span>
                  <ActionButton variant="secondary" className="apex-config-toggle" onClick={() => setSelectedApexEntry(entry)}>
                    查看配置
                  </ActionButton>
                </article>
              </div>
            ))}
          </div>
        </section>
      </div>
      {selectedApexEntry && <ApexConfigOverlay entry={selectedApexEntry} onClose={() => setSelectedApexEntry(null)} />}
    </section>
  )
}

function ApexConfigOverlay({ entry, onClose }: { entry: ApexEntry; onClose: () => void }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="apex-config-overlay" role="dialog" aria-modal="true" aria-label="巅峰配置详情" onClick={onClose}>
      <section className="apex-config-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="apex-config-header">
          <div>
            <span>{entry.rank == null ? '未上榜' : `#${entry.rank}`} · {entry.isSeed ? '种子' : `防守连胜 ${entry.challengeWins}`}</span>
            <h3>{entry.name}</h3>
            <p>{dogNames[entry.dogType]} · {entry.wins}胜{entry.losses}败 · 第 {entry.round} 回合</p>
          </div>
          <IconButton title="关闭巅峰配置" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </header>
        <ApexSnapshotDetails entry={entry} />
      </section>
    </div>,
    document.body,
  )
}

function apexEntryFromArchive(snapshot: ArchivedApexSnapshot): ApexEntry {
  return {
    ...snapshot,
    sourceRunId: null,
    boardType: 'OVERALL',
    boardKey: 'archived-season',
    isSeed: false,
    isMine: true,
  }
}

function ApexSnapshotDetails({ entry }: { entry: ApexEntry }) {
  const [inspectedItem, setInspectedItem] = useState<Item | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const { scheduleTipAnchor, cancelTipAnchor } = useDeferredTipAnchor(setTipAnchor)
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
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }
  const closeTip = () => {
    cancelTipAnchor()
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
            return (
            <ItemFrame
              as="button"
              type="button"
              key={item.id}
              className={`battle-item item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
              style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
              title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
              onClick={(event) => setInspectedItemWithAnchor(item, event.currentTarget)}
            >
              <ItemCardContent item={item} relics={entry.relics} />
            </ItemFrame>
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
  const season = overview?.season
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
        <p>当前赛季：{season?.name ?? '读取中'} · 12 胜或 5 败结算积分，低段位更宽松，高段位按犬王积分榜竞争。</p>
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
                  <DogBadge dogType={dog} src={dogAssets[dog]} selected={selectedDog === dog} className="dog-avatar" />
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
              <DogBadge dogType={selectedDog} src={dogAssets[selectedDog]} size="lg" className="dog-avatar large" />
            </span>
            <h2>{dogNames[selectedDog]}</h2>
            <p><RuleText text={dogStrategies[selectedDog]} /></p>
            {selectedDog === 'EMPEROR' && (
              <div className="lucky-number-picker">
                <strong>幸运数字</strong>
                <div>
                  {[1, 2, 3, 4, 5, 6].map((number) => (
                    <HanddrawnNumberButton key={number} selected={luckyNumber === number} onClick={() => setLuckyNumber(number)}>{number}</HanddrawnNumberButton>
                  ))}
                </div>
              </div>
            )}
            <ActionButton onClick={startRun}>开始天梯</ActionButton>
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
  const { language } = useLanguage()
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
                <DogBadge dogType={dog} src={dogAssets[dog]} selected={selectedDog === dog} className="dog-avatar" />
              </span>
              <strong>{localizeDog(dog, language).name}</strong>
              <small className="card-copy"><RuleText text={localizeDog(dog, language).trait} /></small>
              <span className="tag-row">{dogTags[dog].map((tag) => <b key={tag}>{tag}</b>)}</span>
            </div>
          ) : (
            <div className="dog-card placeholder paper-card paper-dog-card" key={`dog-placeholder-${index}`} aria-hidden="true" />
          ))}
        </div>
        <aside className="dog-detail-panel paper-card">
          <span className="dog-detail-art">
            <DogBadge dogType={selectedDog} src={dogAssets[selectedDog]} size="lg" className="dog-avatar large" />
          </span>
          <h2>{localizeDog(selectedDog, language).name}</h2>
          <div className="detail-box">
            <strong>被动特性</strong>
            <p><RuleText text={localizeDog(selectedDog, language).trait} /></p>
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
                  <HanddrawnNumberButton
                    key={number}
                    selected={luckyNumber === number}
                    onClick={() => setLuckyNumber(number)}
                  >
                    {number}
                  </HanddrawnNumberButton>
                ))}
              </div>
            </div>
          )}
          <ActionButton onClick={startRun}>开始一局</ActionButton>
        </aside>
      </div>
    </section>
  )
}

function Shell({ children, run, error, feedbacks = [], cosmetics: equippedCosmetics, user, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { children: React.ReactNode; run?: Run; error?: string; feedbacks?: UiFeedbackEvent[]; cosmetics?: CosmeticsResponse | null; user?: AuthUser | null; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
  const { language } = useLanguage()
  const visualTheme = run ? visualThemeForRound(run.round) : 'dogPark'
  const profile = equippedCosmeticProfile(equippedCosmetics)
  return (
    <main className={`app-shell ${cosmeticBackgroundClass(equippedCosmetics)}`} style={cosmeticBackgroundStyle(equippedCosmetics)}>
      <TopBar run={run} user={user} profile={profile} musicEnabled={musicEnabled} musicBlocked={musicBlocked} onToggleMusic={onToggleMusic} onOpenLobby={onOpenLobby} onLogout={onLogout} />
      {error && <p className="error">{localizeServerError(error, language)}</p>}
      <div className={`app-visual-layer visual-theme-${visualTheme} high-impact-vfx`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
        <div className="screen-content">{children}</div>
        <FeedbackLayer feedbacks={feedbacks} />
      </div>
    </main>
  )
}

function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage()
  const options: Array<{ value: Language; label: string }> = [
    { value: 'zh-CN', label: t('chinese') },
    { value: 'en-US', label: t('english') },
  ]

  return (
    <div className="language-selector" aria-label={t('language')} data-storage-key={LANGUAGE_STORAGE_KEY}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === language ? 'active' : ''}
          aria-pressed={option.value === language}
          onClick={() => setLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function FeedbackLayer({ feedbacks }: { feedbacks: UiFeedbackEvent[] }) {
  const { language } = useLanguage()
  return (
    <div className="feedback-layer" aria-live="polite" aria-atomic="false">
      {feedbacks.map((feedback) => (
        <div key={feedback.id} className={`ui-feedback-toast ${feedback.tone}`} data-feedback-kind={feedback.kind}>
          <span>{localizeFeedbackText(feedback.label, language)}</span>
        </div>
      ))}
    </div>
  )
}

function TopBar({ run, user, profile, musicEnabled, musicBlocked, onToggleMusic, onOpenLobby, onLogout }: { run?: Run; user?: AuthUser | null; profile: ReturnType<typeof equippedCosmeticProfile>; musicEnabled: boolean; musicBlocked: boolean; onToggleMusic: () => void; onOpenLobby?: () => void; onLogout: () => void }) {
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
          <ResourcePill icon={<Shield size={16} />} label="容错" value={`${RUN_LOSS_LIMIT - run.losses}`} tone={RUN_LOSS_LIMIT - run.losses <= 1 ? 'danger' : 'safe'} />
          <ResourcePill icon={<Coins size={16} />} label="金币" value={run.gold} tone="gold" />
          <ResourcePill icon={<Dice5 size={16} />} label="回合" value={run.round} tone="round" />
        </div>
      )}
      {user && (
        <div className="topbar-profile" title={`${user.nickname ?? user.account} · ${cosmeticTitleLabel(profile.title)}`}>
          <span className={`topbar-profile-avatar ${cosmeticAvatarClass(profile.avatar)}`}>{cosmeticAvatarGlyph(profile.avatar)}</span>
          <div>
            <strong>{user.nickname ?? user.account}</strong>
            <small>{cosmeticTitleLabel(profile.title)}</small>
          </div>
        </div>
      )}
      <div className="topbar-actions">
        <LanguageSelector />
        {onOpenLobby && (
          <IconButton title="模式大厅" aria-label="模式大厅" onClick={onOpenLobby}>
            <House size={18} />
          </IconButton>
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
  const { language } = useLanguage()
  const dogText = localizeDog(run.dogType, language)
  const trait = run.dogType === 'EMPEROR' && run.luckyNumber
    ? language === 'en-US' ? `${dogText.trait} (Destiny Number ${run.luckyNumber})` : `${dogText.trait}（【天命数字】 ${run.luckyNumber}）`
    : dogText.trait
  return (
    <span className="dog-trait-summary" title={`${dogText.name}：${trait}`}>
      <img src={dogAssets[run.dogType]} alt="" />
      <span>当前狗狗</span>
      <strong>{dogText.name}</strong>
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
        <ActionButton wide disabled={trimmed.length < 2}>确认</ActionButton>
      </form>
    </section>
  )
}

function ResourcePill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return <HanddrawnResourcePill icon={icon} label={label} value={value} tone={tone} />
}

function IconButton({ children, title, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return <HanddrawnIconButton title={title} aria-label={title} disabled={disabled} onClick={onClick} {...props}>{children}</HanddrawnIconButton>
}

function ActionButton({ children, className, variant = 'primary', wide = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; wide?: boolean }) {
  const legacyClass = variant === 'danger'
    ? 'danger-button'
    : variant === 'secondary'
      ? 'secondary action-button'
      : variant === 'ghost'
        ? 'ghost action-button'
        : 'primary action-button'
  return (
    <HanddrawnButton variant={variant} wide={wide} className={`${legacyClass} ${wide ? 'wide' : ''} ${className ?? ''}`.trim()} {...props}>
      {children}
    </HanddrawnButton>
  )
}

const mapNodeLabels: Record<ExplorationMapNodeKind, string> = {
  PLAYER_BATTLE: '玩家对战',
  MONSTER_BATTLE: '怪物战斗',
  SHOP_FIXED: '固定商店',
  SHOP_UNKNOWN: '? 商店',
  SHOP_EQUIPMENT: '装备商店',
  REST: '休息点',
  EVENT: '事件',
}

function ExplorationMapView({
  run,
  selectedItemId,
  selectedItem,
  tipAnchor,
  onSelectNode,
  onResolveEvent,
  onClaimReward,
  onSkipReward,
  onDrop,
  onSellRelic,
  onSelectItem,
  onSlotClick,
  onCloseTip,
  onUpgrade,
}: {
  run: Run
  selectedItemId: string | null
  selectedItem: Item | null
  tipAnchor: TipAnchor | null
  onSelectNode: (nodeId: string) => void
  onResolveEvent: () => void
  onClaimReward: () => void
  onSkipReward: () => void
  onDrop: ItemDropHandler
  onSellRelic: (relicId: string) => void
  onSelectItem: (itemId: string, element: HTMLElement) => void
  onSlotClick: (area: Area, x: number, y: number) => void
  onCloseTip: () => void
  onUpgrade: (() => void) | null
}) {
  const map = run.mapState
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null)
  const [drawingTool, setDrawingTool] = useState<MapDrawingTool>('inspect')
  const [draftStrokes, setDraftStrokes] = useState<MapDraftStroke[]>([])
  const [activeDraftStroke, setActiveDraftStroke] = useState<MapDraftStroke | null>(null)
  const [previewRewardOffer, setPreviewRewardOffer] = useState<ShopOffer | null>(null)
  const [mapRewardTipAnchor, setMapRewardTipAnchor] = useState<TipAnchor | null>(null)
  const [selectedMonsterEquipmentNodeId, setSelectedMonsterEquipmentNodeId] = useState<string | null>(null)
  const activeDraftStrokeRef = useRef<MapDraftStroke | null>(null)
  const activeDraftPointerRef = useRef<number | null>(null)
  if (!map) return null
  const completed = new Set(map.completedNodeIds)
  const available = new Set(map.availableNodeIds)
  const currentNode = map.currentNodeId ? map.nodes.find((node) => node.id === map.currentNodeId) ?? null : null
  const currentEvent = currentNode?.kind === 'EVENT' ? currentNode.event : null
  const pendingRewardDef = map.pendingReward ? itemDefById(map.pendingReward.defId) : null
  const currentLayer = completed.size > 0
    ? Math.max(...map.completedNodeIds.map((nodeId) => map.nodes.find((node) => node.id === nodeId)?.layer ?? 0)) + 1
    : 0
  const mapLayerCount = Math.max(1, ...map.nodes.map((node) => node.layer + 1))
  const selectedMapNode = selectedNodeId
    ? map.nodes.find((node) => node.id === selectedNodeId) ?? currentNode
    : currentNode ?? map.nodes.find((node) => available.has(node.id)) ?? map.nodes[0] ?? null
  const previewMapNode = previewNodeId && previewNodeId !== selectedMapNode?.id
    ? map.nodes.find((node) => node.id === previewNodeId) ?? null
    : null
  const selectedMonsterEquipmentNode = selectedMonsterEquipmentNodeId
    ? map.nodes.find((node) => node.id === selectedMonsterEquipmentNodeId && node.kind === 'MONSTER_BATTLE') ?? null
    : null
  const routeFocusNode = previewMapNode ?? selectedMapNode
  const orientation: 'horizontal' | 'vertical' = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 'vertical' : 'horizontal'
  const mapLayerMarkers = Array.from({ length: mapLayerCount }, (_, index) => index)
  const inspectedRouteNodeIds = new Set<string>()
  if (routeFocusNode) {
    inspectedRouteNodeIds.add(routeFocusNode.id)
    routeFocusNode.nextNodeIds.forEach((id) => inspectedRouteNodeIds.add(id))
    map.nodes.filter((node) => node.nextNodeIds.includes(routeFocusNode.id)).forEach((node) => inspectedRouteNodeIds.add(node.id))
  }
  const setActiveDraft = (stroke: MapDraftStroke | null) => {
    activeDraftStrokeRef.current = stroke
    setActiveDraftStroke(stroke)
  }
  const clearMapRewardTip = () => {
    setPreviewRewardOffer(null)
    setMapRewardTipAnchor(null)
  }
  const enterMapNode = (nodeId: string) => {
    setDraftStrokes([])
    setActiveDraft(null)
    setPreviewNodeId(null)
    setSelectedMonsterEquipmentNodeId(null)
    clearMapRewardTip()
    onSelectNode(nodeId)
  }
  const inspectMapReward = (reward: { defId: string; quality: ItemQuality }, element: HTMLElement) => {
    setPreviewRewardOffer(previewMapRewardAsOffer(reward))
    setMapRewardTipAnchor(getFloatingTipPosition(element))
  }
  const handleDraftPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingTool === 'inspect') return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = mapDraftPointFromPointer(event)
    activeDraftPointerRef.current = event.pointerId
    if (drawingTool === 'eraser') {
      setDraftStrokes((strokes) => eraseDraftStrokesNearPoint(strokes, point))
      return
    }
    setActiveDraft({ id: `draft-${Date.now()}-${event.pointerId}`, points: [point] })
  }
  const handleDraftPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingTool === 'inspect' || activeDraftPointerRef.current !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = mapDraftPointFromPointer(event)
    if (drawingTool === 'eraser') {
      setDraftStrokes((strokes) => eraseDraftStrokesNearPoint(strokes, point))
      return
    }
    const current = activeDraftStrokeRef.current
    if (!current) return
    const previous = current.points.at(-1)
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.45) return
    setActiveDraft({ ...current, points: [...current.points, point] })
  }
  const finishDraftStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeDraftPointerRef.current !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const current = activeDraftStrokeRef.current
    if (current && current.points.length > 1) setDraftStrokes((strokes) => [...strokes, current])
    setActiveDraft(null)
    activeDraftPointerRef.current = null
  }
  return (
    <section className="exploration-map-screen">
      <div className="exploration-map-overlay">
        <div className="exploration-map-shell">
          <div className="exploration-map-topbar">
            <div className="map-title-placard">
              <PawPrint size={28} />
              <div>
              <h2>探索地图</h2>
              <p>第 {map.mapIndex + 1} 张地图 · 第 {Math.min(mapLayerCount, currentLayer + 1)} / {mapLayerCount} 层</p>
              </div>
            </div>
            <div className="map-run-stats">
              <ResourcePill icon={<Trophy size={16} />} label="胜场" value={`${run.wins}/12`} tone="gold" />
              <ResourcePill icon={<Heart size={16} />} label="容错" value={`${Math.max(0, RUN_LOSS_LIMIT - run.losses)}/${RUN_LOSS_LIMIT}`} tone="pink" />
              <ResourcePill icon={<Coins size={16} />} label="金币" value={run.gold} tone="gold" />
            </div>
          </div>

          <div className="exploration-map-route-board">
            <div className="map-route-canvas" data-orientation={orientation}>
              <div className="map-layer-marker-row" aria-hidden="true">
                {mapLayerMarkers.map((layer) => (
                  <span key={layer} className="map-layer-marker" style={{ '--marker-x': mapLayerMarkerPosition(layer, mapLayerCount) } as React.CSSProperties}>{layer + 1}</span>
                ))}
              </div>
              <svg className="map-route-layer map-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {map.nodes.flatMap((node) => node.nextNodeIds.map((nextId) => {
                  const next = map.nodes.find((entry) => entry.id === nextId)
                  if (!next) return null
                  const start = mapNodePosition(node, orientation, mapLayerCount)
                  const end = mapNodePosition(next, orientation, mapLayerCount)
                  const active = completed.has(node.id) && available.has(next.id)
                  const done = completed.has(node.id) && completed.has(next.id)
                  const inspected = inspectedRouteNodeIds.has(node.id) && inspectedRouteNodeIds.has(next.id)
                  return (
                    <path
                      key={`${node.id}:${next.id}`}
                      className={`map-route-path ${active ? 'available' : ''} ${done ? 'completed' : ''} ${inspected ? 'inspected' : ''}`}
                      d={routePathData(start, end, orientation)}
                    />
                  )
                }))}
              </svg>
              {map.nodes.map((node) => (
                <MapNodeButton
                  key={node.id}
                  node={node}
                  completed={completed.has(node.id)}
                  available={available.has(node.id)}
                  current={map.currentNodeId === node.id}
                  selected={selectedMapNode?.id === node.id}
                  previewed={previewMapNode?.id === node.id}
                  orientation={orientation}
                  onPreview={setPreviewNodeId}
                  onSelect={setSelectedNodeId}
                />
              ))}
              <svg
                className={`map-route-layer map-route-draft-svg map-route-draft-surface tool-${drawingTool}`}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-label="手绘预期路线"
                onPointerDown={handleDraftPointerDown}
                onPointerMove={handleDraftPointerMove}
                onPointerUp={finishDraftStroke}
                onPointerCancel={finishDraftStroke}
              >
                {draftStrokes.map((stroke) => (
                  <path key={stroke.id} className="map-route-draft-stroke" d={draftStrokePath(stroke.points)} />
                ))}
                {activeDraftStroke && <path className="map-route-draft-stroke active" d={draftStrokePath(activeDraftStroke.points)} />}
              </svg>
              <div className="map-drawing-toolbar" role="toolbar" aria-label="路线草稿工具">
                <button type="button" className={drawingTool === 'inspect' ? 'active' : ''} title="查看节点" aria-label="查看节点" onClick={() => setDrawingTool('inspect')}><Eye size={18} /></button>
                <button type="button" className={drawingTool === 'brush' ? 'active' : ''} title="画笔" aria-label="画笔" onClick={() => setDrawingTool('brush')}><Brush size={18} /></button>
                <button type="button" className={drawingTool === 'eraser' ? 'active' : ''} title="橡皮" aria-label="橡皮" onClick={() => setDrawingTool('eraser')}><Eraser size={18} /></button>
                <button type="button" title="清空草稿" aria-label="清空草稿" disabled={draftStrokes.length === 0 && !activeDraftStroke} onClick={() => { setDraftStrokes([]); setActiveDraft(null) }}><Trash2 size={18} /></button>
              </div>
              <div className="map-route-legend" aria-label="路线颜色图示">
                <span><i className="map-route-legend-swatch available" />可选择</span>
                <span><i className="map-route-legend-swatch inspected" />当前查看</span>
                <span><i className="map-route-legend-swatch completed" />已完成</span>
                <span><i className="map-route-legend-swatch locked" />未解锁</span>
              </div>
            </div>

            <aside className="map-node-detail-panel">
              {currentEvent && (
                <div className="map-side-card map-current-event">
                  <MapNodeSticker kind="EVENT" size="md" />
                  <div>
                    <h3>{currentEvent.title}</h3>
                    <p>{currentEvent.description}</p>
                  </div>
                  <ActionButton onClick={onResolveEvent}>处理事件</ActionButton>
                </div>
              )}
              {map.pendingReward && (
                <div className="map-side-card map-current-reward">
                  <div className="map-reward-copy">
                    {pendingRewardDef ? <ItemArt def={pendingRewardDef} className="map-reward-art" /> : <MapNodeSticker kind="MONSTER_BATTLE" size="md" />}
                    <div>
                      <h3>待领取掉落</h3>
                      <p>{pendingRewardDef?.name ?? map.pendingReward.defId} · {qualityLabel[normalizeQuality(map.pendingReward.quality)]}</p>
                    </div>
                  </div>
                  <div className="map-reward-actions">
                    <SellDropZone />
                    <ActionButton onClick={onClaimReward}>领取</ActionButton>
                    <ActionButton variant="secondary" onClick={onSkipReward}>放弃</ActionButton>
                  </div>
                </div>
              )}
              {selectedMapNode && (
                <MapNodeDetail
                  node={selectedMapNode}
                  available={available.has(selectedMapNode.id)}
                  current={map.currentNodeId === selectedMapNode.id}
                  completed={completed.has(selectedMapNode.id)}
                  tone="selected"
                  onSelect={enterMapNode}
                  onInspectReward={inspectMapReward}
                  onInspectMonsterEquipment={setSelectedMonsterEquipmentNodeId}
                />
              )}
              {previewMapNode && (
                <MapNodeDetail
                  node={previewMapNode}
                  available={available.has(previewMapNode.id)}
                  current={map.currentNodeId === previewMapNode.id}
                  completed={completed.has(previewMapNode.id)}
                  tone="preview"
                  allowEntry={false}
                  onSelect={enterMapNode}
                  onInspectReward={inspectMapReward}
                  onInspectMonsterEquipment={setSelectedMonsterEquipmentNodeId}
                />
              )}
            </aside>
          </div>
          {map.pendingReward && (
            <HanddrawnFrame as="section" variant="panel" ornament="wood" className="map-reward-inventory paper-card">
              <InventoryBoard
                run={run}
                selectedItemId={selectedItemId}
                onDrop={onDrop}
                onSellRelic={onSellRelic}
                onSelectItem={onSelectItem}
                onSlotClick={onSlotClick}
              />
              <FloatingTip run={run} item={selectedItem} offer={null} anchor={tipAnchor} onClose={onCloseTip} onBuy={null} onSell={null} onUpgrade={onUpgrade} />
            </HanddrawnFrame>
          )}
          <FloatingTip run={run} item={null} offer={previewRewardOffer} anchor={mapRewardTipAnchor} onClose={clearMapRewardTip} onBuy={null} onSell={null} onUpgrade={null} />
          {selectedMonsterEquipmentNode && <MonsterEquipmentPreviewModal node={selectedMonsterEquipmentNode} onClose={() => setSelectedMonsterEquipmentNodeId(null)} />}
        </div>
      </div>
    </section>
  )
}

function mapNodePosition(node: Pick<ExplorationMapNode, 'layer' | 'column' | 'x'>, orientation: 'horizontal' | 'vertical' = 'horizontal', layerCount = 10) {
  const lane = typeof node.x === 'number' ? node.x : ([0.18, 0.5, 0.82][node.column] ?? 0.5)
  const staggeredLane = lane + mapNodeDisplayLaneOffset(node)
  const layerDivisor = Math.max(1, layerCount - 1)
  const progress = 0.06 + node.layer * (0.88 / layerDivisor)
  if (orientation === 'vertical') {
    return { x: Math.max(8, Math.min(92, staggeredLane * 100)), y: progress * 100 }
  }
  return { x: progress * 100, y: Math.max(8, Math.min(92, staggeredLane * 100)) }
}

function mapLayerMarkerPosition(layer: number, layerCount: number) {
  const layerDivisor = Math.max(1, layerCount - 1)
  return `${(0.06 + layer * (0.88 / layerDivisor)) * 100}%`
}

function mapNodeDisplayLaneOffset(node: Pick<ExplorationMapNode, 'layer' | 'column'>) {
  const layerWave = node.layer % 2 === 0 ? -0.045 : 0.045
  const columnNudge = node.column % 2 === 0 ? -0.018 : 0.018
  return layerWave + columnNudge
}

function routePathData(start: { x: number; y: number }, end: { x: number; y: number }, orientation: 'horizontal' | 'vertical') {
  if (orientation === 'vertical') {
    const middleY = start.y + (end.y - start.y) * 0.5
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${start.x.toFixed(2)} ${middleY.toFixed(2)}, ${end.x.toFixed(2)} ${middleY.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  }
  const middleX = start.x + (end.x - start.x) * 0.5
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${middleX.toFixed(2)} ${start.y.toFixed(2)}, ${middleX.toFixed(2)} ${end.y.toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

function mapDraftPointFromPointer(event: ReactPointerEvent<SVGSVGElement>): MapDraftPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100)),
  }
}

function draftStrokePath(points: MapDraftPoint[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
}

function eraseDraftStrokesNearPoint(strokes: MapDraftStroke[], point: MapDraftPoint) {
  const eraseRadius = 4.2
  return strokes.filter((stroke) => !stroke.points.some((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) <= eraseRadius))
}

function previewMapRewardAsOffer(reward: { defId: string; quality: ItemQuality }): ShopOffer | null {
  const def = itemDefById(reward.defId)
  if (!def) return null
  return { offerId: `map-preview-${reward.defId}-${reward.quality}`, defId: reward.defId, quality: reward.quality, price: -1, discount: 1, def }
}

function MapNodeButton({ node, completed, available, current, selected, previewed, orientation, onPreview, onSelect }: { node: ExplorationMapNode; completed: boolean; available: boolean; current: boolean; selected: boolean; previewed: boolean; orientation: 'horizontal' | 'vertical'; onPreview: (nodeId: string) => void; onSelect: (nodeId: string) => void }) {
  const position = mapNodePosition(node, orientation)
  const locked = !available && !completed && !current
  return (
    <button
      className={`map-node compact-route-node ${node.kind.toLowerCase().replaceAll('_', '-')} ${available ? 'available' : ''} ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${selected ? 'selected' : ''} ${previewed ? 'previewed' : ''} ${locked ? 'locked' : ''}`}
      style={{ '--node-x': position.x, '--node-y': position.y } as React.CSSProperties}
      aria-disabled={!available}
      onPointerEnter={() => onPreview(node.id)}
      onFocus={() => onPreview(node.id)}
      onClick={() => onSelect(node.id)}
      aria-label={mapNodeTitle(node)}
    >
      <MapNodeSticker kind={node.kind} />
      <span className="map-node-title">{mapNodeTitle(node)}</span>
    </button>
  )
}

function MapNodeDetail({ node, available, current, completed, tone = 'selected', allowEntry = true, onSelect, onInspectReward, onInspectMonsterEquipment }: { node: ExplorationMapNode; available: boolean; current: boolean; completed: boolean; tone?: 'selected' | 'preview'; allowEntry?: boolean; onSelect: (nodeId: string) => void; onInspectReward: (reward: { defId: string; quality: ItemQuality }, element: HTMLElement) => void; onInspectMonsterEquipment: (nodeId: string) => void }) {
  return (
    <div className={`map-side-card map-node-detail ${tone === 'preview' ? 'map-node-detail-preview' : 'map-node-detail-selected'} ${tone} ${available ? 'available' : ''} ${current ? 'current' : ''} ${completed ? 'completed' : ''}`}>
      <MapNodeSticker kind={node.kind} size="lg" />
      <div>
        {tone === 'preview' && <span className="map-node-detail-mode">滑过预览</span>}
        <span className="map-node-detail-kicker">第 {node.layer + 1} 层</span>
        <h3>
          {node.kind === 'MONSTER_BATTLE' ? (
            <button type="button" className="monster-equipment-name-button" onClick={() => onInspectMonsterEquipment(node.id)}>
              {mapNodeTitle(node)}
            </button>
          ) : mapNodeTitle(node)}
        </h3>
        <p>{mapNodePreview(node)}</p>
      </div>
      {node.kind === 'MONSTER_BATTLE' && <MapRewardPreviewLinks node={node} onInspectReward={onInspectReward} />}
      {available && allowEntry && <ActionButton className="map-enter-action" onClick={() => onSelect(node.id)}>前往</ActionButton>}
      {available && !allowEntry && <strong className="map-node-state-copy muted">点击节点后可在上方确认</strong>}
      {current && <strong className="map-node-state-copy">当前处理中</strong>}
      {completed && <strong className="map-node-state-copy">已完成</strong>}
      {!available && !current && !completed && <strong className="map-node-state-copy muted">路线未解锁</strong>}
    </div>
  )
}

function monsterEquipmentItems(node: ExplorationMapNode): Item[] {
  const equipment: Item[] = []
  for (const item of node.monster?.equipment ?? []) {
    if (item.area !== 'EQUIPMENT') continue
    const def = itemDefById(item.defId)
    if (!def) continue
    equipment.push({ ...item, def })
  }
  return equipment.sort((a, b) => a.x - b.x || a.y - b.y)
}

function MonsterEquipmentPreviewModal({ node, onClose }: { node: ExplorationMapNode; onClose: () => void }) {
  const [inspectedItem, setInspectedItem] = useState<Item | null>(null)
  const [tipAnchor, setTipAnchor] = useState<TipAnchor | null>(null)
  const { scheduleTipAnchor, cancelTipAnchor } = useDeferredTipAnchor(setTipAnchor)
  const equipment = monsterEquipmentItems(node)
  const previewRun = monsterEquipmentPreviewRun(node, equipment)
  const inspectItem = (item: Item, element: HTMLElement) => {
    setInspectedItem(item)
    setTipAnchor(null)
    scheduleTipAnchor(element)
  }
  const closeTip = () => {
    cancelTipAnchor()
    setInspectedItem(null)
    setTipAnchor(null)
  }
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="map-monster-equipment-modal" role="dialog" aria-modal="true" aria-label="野怪装备栏预览" onClick={onClose}>
      <section className="map-monster-equipment-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="map-monster-equipment-header">
          <div>
            <span>野怪配置 · 第 {node.monster?.round ?? node.layer + 1} 回合</span>
            <h3>{mapNodeTitle(node)}</h3>
            <p>{node.monster ? dogNames[node.monster.dogType] : '怪物战斗'} · 点击装备查看详情</p>
          </div>
          <IconButton title="关闭野怪装备预览" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </header>
        <div className="battle-equipment-row opponent map-monster-equipment-preview">
          <div className="battle-row-title">
            <span>野怪装备栏</span>
            <small>{equipment.length > 0 ? `${equipment.length} 件装备` : '暂无装备'}</small>
          </div>
          <div className="battle-slot-grid" style={{ gridTemplateColumns: `repeat(${BASE_EQUIPMENT_SLOT_COUNT}, minmax(0, 1fr))` }}>
            {Array.from({ length: BASE_EQUIPMENT_SLOT_COUNT }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
            {equipment.map((item) => (
              <ItemFrame
                as="button"
                type="button"
                key={item.id}
                className={`battle-item item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)}`}
                style={{ gridColumn: `${item.x + 1} / span ${item.def.width}`, gridRow: 1 }}
                title={`${qualityLabel[normalizeQuality(item.quality)]} ${item.def.name} · ${effectText(item.def, normalizeQuality(item.quality))}`}
                onClick={(event) => inspectItem(item, event.currentTarget)}
              >
                <ItemCardContent item={item} relics={[]} />
              </ItemFrame>
            ))}
          </div>
        </div>
        <FloatingTip run={previewRun} item={inspectedItem} offer={null} anchor={tipAnchor} onClose={closeTip} onBuy={null} onSell={null} onUpgrade={null} />
      </section>
    </div>,
    document.body,
  )
}

function monsterEquipmentPreviewRun(node: ExplorationMapNode, equipment: Item[]): Run {
  return {
    id: `monster-preview-${node.id}`,
    mode: 'CASUAL',
    dogType: node.monster?.dogType ?? 'MUTT',
    luckyNumber: null,
    wins: 0,
    losses: 0,
    round: node.monster?.round ?? node.layer + 1,
    gold: 0,
    phase: 'MAP',
    status: 'ACTIVE',
    shopType: 'GENERAL',
    shopItems: [],
    choices: [],
    classRewardChoices: [],
    enchantChoices: [],
    potionChoices: [],
    relicChoices: [],
    relics: [],
    refreshCost: 1,
    matchedGhost: null,
    lastBattle: null,
    ladderSettlement: null,
    mapState: null,
    items: equipment,
  }
}

function MapRewardPreviewLinks({ node, onInspectReward }: { node: ExplorationMapNode; onInspectReward: (reward: { defId: string; quality: ItemQuality }, element: HTMLElement) => void }) {
  const rewards = node.monster?.possibleRewards.slice(0, 3) ?? []
  if (rewards.length === 0) return <p className="map-node-state-copy muted">预期掉落：暂无明确装备</p>
  return (
    <div className="map-reward-preview-links" aria-label="预期掉落">
      <span className="map-node-detail-kicker">预期掉落</span>
      <div>
        {rewards.map((reward) => {
          const def = itemDefById(reward.defId)
          return (
            <button
              key={`${reward.defId}-${reward.quality}`}
              type="button"
              className="map-reward-preview-link"
              onClick={(event) => {
                event.stopPropagation()
                onInspectReward(reward, event.currentTarget)
              }}
            >
              {def?.name ?? reward.defId}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MapNodeSticker({ kind, size = 'md' }: { kind: ExplorationMapNodeKind; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`map-node-sticker ${size}`}>
      <img className="map-node-icon" src={versionedIconSrc(mapNodeIcons[kind])} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

function mapNodeTitle(node: ExplorationMapNode) {
  if (node.kind === 'SHOP_FIXED' && node.shopType) return shopNames[node.shopType]
  if (node.kind === 'MONSTER_BATTLE') return node.monster?.name ?? mapNodeLabels[node.kind]
  if (node.kind === 'EVENT') return node.event?.title ?? mapNodeLabels[node.kind]
  return mapNodeLabels[node.kind]
}

function mapNodePreview(node: ExplorationMapNode) {
  if (node.kind === 'SHOP_FIXED' && node.shopType) return '直接进入'
  if (node.kind === 'SHOP_UNKNOWN') return '随机三选一'
  if (node.kind === 'SHOP_EQUIPMENT') return '装备三选一'
  if (node.kind === 'REST') return '恢复容错'
  if (node.kind === 'PLAYER_BATTLE') return '计胜负'
  if (node.kind === 'EVENT') return node.event?.description ?? '随机收益'
  if (node.kind === 'MONSTER_BATTLE') {
    const rewards = node.monster?.possibleRewards
      .map((reward) => itemDefById(reward.defId)?.name ?? reward.defId)
      .slice(0, 3)
      .join(' / ')
    return rewards ? `掉落 ${rewards}` : '不扣容错'
  }
  return ''
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
          <HanddrawnChoiceCard key={choice} role="button" tabIndex={0} selected={selectedChoice === choice} onClick={() => setSelectedChoice(choice)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelectedChoice(choice))}>
            <span className="choice-icon">{shopChoiceIcon(choice)}</span>
            <strong>{shopNames[choice]}</strong>
            <span className="choice-copy"><RuleText text={shopDescriptions[choice]} /></span>
          </HanddrawnChoiceCard>
        ) : (
          <div className="choice placeholder paper-card sticker-card" key={`choice-placeholder-${index}`} aria-hidden="true" />
        ))}
      </div>
      <ActionButton className="choice-submit" disabled={!selectedChoice} onClick={() => selectedChoice && onPick(selectedChoice)}>
        进入 {selectedChoice ? shopNames[selectedChoice] : '商店'}
      </ActionButton>
    </section>
  )
}

function shopChoiceIcon(shopType: ShopType) {
  if (shopType === 'RELIC') return <Trophy size={36} />
  if (shopType === 'UPGRADE' || shopType === 'UPGRADE_SILVER' || shopType === 'UPGRADE_GOLD' || shopType === 'UPGRADE_DIAMOND') return <PackagePlus size={36} />
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
  const { language } = useLanguage()
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
      aria-label={`${localizeDog(run.dogType, language).name}${title}`}
    >
      <div className="ceremony-stage">
        <div className="ceremony-round-badge">第 {run.round} 回合</div>
        <DogBadge dogType={run.dogType} src={dogAssets[run.dogType]} size="lg" className="ceremony-dog-avatar" />
        <div className="ceremony-copy">
          <span>{localizeDog(run.dogType, language).name} 专属装备授予</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="ceremony-reward-preview" aria-label="本次可选职业装备">
          {choices.map((choice) => {
            const triggerDice = triggerDiceLabel(choice.def)
            return (
            <span key={choice.defId} className={`ceremony-reward-chip ${qualityClass(choice.quality)}`}>
              <strong>{localizeItemDef(choice.def, language).name}</strong>
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
  const { language } = useLanguage()
  const [selected, setSelected] = useState(choices[0]?.defId ?? '')
  return (
    <HanddrawnFrame as="section" variant="panel" ornament="corner" className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择职业装备</h2>
        <p>先整理背包，再选择一个职业装备放入背包。</p>
      </div>
      <div className="reward-choice-grid">
        {choices.map((choice) => {
          const triggerDice = triggerDiceLabel(choice.def)
          return (
          <HanddrawnChoiceCard key={choice.defId} role="button" tabIndex={0} className="reward-choice" selected={selected === choice.defId} onClick={() => setSelected(choice.defId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.defId))}>
            <strong>{localizeItemDef(choice.def, language).name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{language === 'en-US' ? localizeQuality(choice.quality, language) : qualityLabel[choice.quality]}</span>
            <span>{choice.def.size}格{triggerDice ? ` · ${triggerDice}` : ''}</span>
            <span className="choice-copy"><RuleText text={language === 'en-US' ? localizeItemDef(choice.def, language).description : (choice.def.description ?? effectText(choice.def, choice.quality))} /></span>
          </HanddrawnChoiceCard>
          )
        })}
      </div>
      <ActionButton className="choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>领取职业装备</ActionButton>
    </HanddrawnFrame>
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
          <HanddrawnChoiceCard key={choice.id} role="button" tabIndex={0} className="reward-choice enchant-choice" selected={selectedId === choice.id} onClick={() => onSelect(choice.id)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => onSelect(choice.id))}>
            <Sparkles size={28} />
            <strong>{choice.enchant.label}</strong>
            <span className="tip-tag">免费</span>
            <span className="choice-copy"><RuleText text={choice.description} /></span>
          </HanddrawnChoiceCard>
        ))}
      </div>
      <small className="disabled-reason">当前选中：{choices.find((choice) => choice.id === selectedId)?.enchant.label ?? '请选择附魔'}</small>
    </section>
  )
}

function RelicChoiceSelect({ choices, visualTheme, onPick }: { choices: RelicChoice[]; visualTheme: VisualThemeId; onPick: (relicId: string) => void }) {
  const { language } = useLanguage()
  const [selected, setSelected] = useState(choices[0]?.relicId ?? '')
  return (
    <section className={`shop-choice-screen reward-panel visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择遗物</h2>
        <p>免费选择一个遗物；重复遗物会直接升级。</p>
      </div>
      <div className="choice-grid relic-choice-grid">
        {choices.map((choice) => (
          <HanddrawnChoiceCard key={choice.relicId} role="button" tabIndex={0} className="relic-choice" selected={selected === choice.relicId} onClick={() => setSelected(choice.relicId)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => setSelected(choice.relicId))}>
            <RelicGlyph relic={choice} size={44} />
            <strong>{localizeRelicDef(choice.def, language).name}</strong>
            <span className={`tip-tag ${qualityClass(choice.quality)}`}>{language === 'en-US' ? localizeQuality(choice.quality, language) : qualityLabel[choice.quality]}</span>
            <span className="choice-copy"><RuleText text={localizeRelicDef(choice.def, language).description} /></span>
          </HanddrawnChoiceCard>
        ))}
      </div>
      <ActionButton className="choice-submit" disabled={!selected} onClick={() => selected && onPick(selected)}>获得遗物</ActionButton>
    </section>
  )
}

function UpgradeChoiceSelect({ run, visualTheme, onSkip }: { run: Run; visualTheme: VisualThemeId; onSkip: () => void }) {
  const maxQuality = upgradeShopMaxQuality(run.shopType)
  const upgradeableCount = run.items.filter((item) => canFreeUpgradeItem(item, run.shopType)).length
  return (
    <HanddrawnFrame as="section" variant="panel" ornament="corner" className={`reward-panel paper-card visual-theme-surface visual-theme-${visualTheme} upgrade-panel`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="screen-heading centered">
        <h2>选择升级装备</h2>
        <p>点击装备栏或背包里任意{qualityLabel[maxQuality]}品质以下的装备，免费提升 1 个品质。</p>
      </div>
      <div className="reward-choice-grid">
        <HanddrawnChoiceCard className="reward-choice enchant-choice" selected>
          <PackagePlus size={28} />
          <strong>{shopNames[run.shopType]}</strong>
          <span className="tip-tag">可升级 {upgradeableCount} 件</span>
          <span className="choice-copy">{qualityLabel[maxQuality]}及以上品质不能在本商店继续提升。</span>
        </HanddrawnChoiceCard>
      </div>
      <ActionButton variant="secondary" className="choice-submit" onClick={onSkip}>
        <ArrowRight size={18} /> 放弃升级
      </ActionButton>
    </HanddrawnFrame>
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
          <HanddrawnChoiceCard key={choice.id} role="button" tabIndex={0} className="reward-choice enchant-choice" selected={selectedId === choice.id} onClick={() => onSelect(choice.id)} onKeyDown={(event) => handleChoiceCardKeyDown(event, () => onSelect(choice.id))}>
            <Sparkles size={28} />
            <strong>{choice.description}</strong>
            <span className="tip-tag">药水</span>
            <span className="choice-copy">修改基础触发点数；之后仍会被遗物和其他道具影响。</span>
          </HanddrawnChoiceCard>
        ))}
      </div>
      <small className="disabled-reason">职业装备不可使用药水</small>
    </section>
  )
}

function ShopShelf({ run, selectedOfferId, pendingAction = null, matchLabel = '匹配', onInspectOffer, onReroll, onMatch }: { run: Run; selectedOfferId: string | null; pendingAction?: PendingShopAction; matchLabel?: string; onInspectOffer: (offerId: string, element: HTMLElement) => void; onReroll: () => void; onMatch: () => void }) {
  const { language } = useLanguage()
  const visualTheme = visualThemeForRound(run.round)
  const busy = pendingAction !== null
  return (
    <HanddrawnFrame as="section" variant="tray" ornament="wood" className={`shop-shelf sketch-panel visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)} data-tutorial-anchor="shop-offers">
      <div className="section-title">
        <div>
          <h2>{language === 'en-US' ? localizeShopType(run.shopType, language) : shopNames[run.shopType]}</h2>
          <p>点击商品查看详情，确认后再购买。</p>
        </div>
        <div className="shop-actions">
          <SellDropZone />
          <HanddrawnButton variant="secondary" className="reroll-button" onClick={onReroll} disabled={busy || run.gold < run.refreshCost} aria-busy={pendingAction === 'reroll'} title={`刷新商店：${run.refreshCost} 金币`}>
            <RefreshCcw size={18} />
            <span className="price-tag"><Coins size={14} />{run.refreshCost}</span>
          </HanddrawnButton>
        </div>
      </div>
      <div className="offer-row">
        {run.shopItems.map((offer) => (
          <ShopCard key={offer.offerId} offer={offer} selected={selectedOfferId === offer.offerId} ownedCount={shopOfferOwnedCount(run, offer)} affordable={run.gold >= offer.price} disabled={busy} onClick={(element) => onInspectOffer(offer.offerId, element)} />
        ))}
      </div>
      <ActionButton className="match-button" data-tutorial-anchor="match-button" onClick={onMatch} disabled={busy}>
        <Swords size={18} /> {matchLabel}
      </ActionButton>
    </HanddrawnFrame>
  )
}

function SellDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: 'SELL_ZONE' })
  return (
    <div ref={setNodeRef} data-drop-id="SELL_ZONE" className={`sell-zone ${isOver ? 'over' : ''}`}>
      <BadgeDollarSign size={18} />
      <span>拖到这里出售</span>
    </div>
  )
}

function ShopCard({ offer, selected, ownedCount, affordable, disabled = false, onClick }: { offer: ShopOffer; selected: boolean; ownedCount: number; affordable: boolean; disabled?: boolean; onClick: (element: HTMLElement) => void }) {
  const { language } = useLanguage()
  const def = offer.def
  const quality = normalizeQuality(offer.quality)
  const localizedDef = def ? localizeItemDef(def, language) : null
  const owned = ownedCount > 0
  const triggerDice = def ? triggerDiceLabel(def) : null
  const visual = def ? itemVisualProfile(def) : null
  return (
    <ItemFrame as="button" disabled={disabled} className={`shop-card paper-shop-card paper-card ${visual?.className ?? 'item-tone-utility'} ${qualityClass(offer.quality)} ${owned ? 'shop-card-owned' : ''} ${affordable ? '' : 'shop-card-unaffordable'} ${selected ? 'selected' : ''}`} onClick={(event) => onClick(event.currentTarget)}>
      <span className="quality-chip shop-quality-chip">{language === 'en-US' ? localizeQuality(quality, language) : qualityLabel[quality]}</span>
      {owned && <span className="owned-badge" aria-label={`已拥有 ${ownedCount} 件同名装备`}>已拥有 x{ownedCount}</span>}
      {def && visual && (
        <ItemArt def={def} visual={visual} className="shop-card-art" />
      )}
      <div className="shop-card-main">
        <strong>{localizedDef?.name ?? def?.name ?? offer.defId}</strong>
        <span className={`size-badge ${visual?.className ?? 'item-tone-utility'}`}>{def?.size ?? '?'}格</span>
      </div>
      <div className="shop-card-meta">
        {def && <SizePreview size={def.size} />}
        {triggerDice && <span className="dice-line"><Dice5 size={15} /> {triggerDice}</span>}
      </div>
      <span className="effect-line">{def ? (language === 'en-US' ? localizedDef?.description : effectText(def, quality)) : '未知效果'}</span>
      <span className="price-tag"><Coins size={14} />{offer.price}{offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
    </ItemFrame>
  )
}

function SizePreview({ size }: { size: number }) {
  return (
    <span className="size-preview" aria-label={`占用 ${size} 格`}>
      {[1, 2, 3, 4].map((slot) => <i key={slot} className={slot <= size ? 'filled' : ''} />)}
    </span>
  )
}

function InventoryBoard({ run, selectedItemId, onDrop, onSellRelic, onSelectItem, onSlotClick }: { run: Run; selectedItemId: string | null; onDrop: ItemDropHandler; onSellRelic?: ((relicId: string) => void) | null; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
  const equipmentSlots = equipmentSlotCount(run.relics)
  const visualTheme = visualThemeForRound(run.round)
  return (
    <section className={`inventory-board expanded paper-inventory visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <GridPanel title="装备栏" subtitle={`${equipmentSlots} 格单行，从左向右触发`} icon={<Grid3X3 size={18} />} area="EQUIPMENT" tutorialAnchor="equipment-board" w={equipmentSlots} h={1} items={run.items} relics={run.relics ?? []} selectedItemId={selectedItemId} onDrop={onDrop} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      <div className="bag-relic-row">
        <RelicRail relics={run.relics ?? []} onSellRelic={onSellRelic ?? null} />
        <GridPanel title="背包" subtitle={`${BASE_EQUIPMENT_SLOT_COUNT} 格单行，战斗中默认不生效`} icon={<Backpack size={18} />} area="BAG" tutorialAnchor="bag-board" w={BASE_EQUIPMENT_SLOT_COUNT} h={1} items={run.items} relics={run.relics ?? []} selectedItemId={selectedItemId} onDrop={onDrop} onSelectItem={onSelectItem} onSlotClick={onSlotClick} />
      </div>
    </section>
  )
}

function RelicRail({ relics, onSellRelic, compact = false }: { relics: Relic[]; onSellRelic?: ((relicId: string) => void) | null; compact?: boolean }) {
  const { language } = useLanguage()
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
          const localizedRelic = relic ? localizeRelicDef(relic.def, language) : null
          const qualityText = relic ? (language === 'en-US' ? localizeQuality(relic.quality, language) : qualityLabel[relic.quality]) : ''
          return (
            <div key={index} className={`relic-slot ${relic ? qualityClass(relic.quality) : ''}`}>
              {relic ? (
                <RelicIconButton
                  className="relic-icon-button"
                  aria-label={`${qualityText}遗物：${localizedRelic?.name ?? relic.def.name}`}
                  aria-pressed={selectedRelicId === relic.id}
                  title={`${qualityText} ${localizedRelic?.name ?? relic.def.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedRelicId(selectedRelicId === relic.id ? null : relic.id)
                    setRelicTipAnchor(selectedRelicId === relic.id ? null : getFloatingTipPosition(event.currentTarget))
                  }}
                >
                  <RelicGlyph relic={relic} size={compact ? 24 : 30} />
                  <span className="relic-quality-dot" aria-hidden="true" />
                </RelicIconButton>
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
  const { language } = useLanguage()
  useOutsideTipDismiss(Boolean(relic), onClose)
  if (!relic) return null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  const localizedRelic = localizeRelicDef(relic.def, language)
  const qualityText = language === 'en-US' ? localizeQuality(relic.quality, language) : qualityLabel[relic.quality]
  return (
    <FloatingPaperTip className="relic-floating-tip" style={style}>
      <div className="tip-tags">
        <span className={`tip-tag ${qualityClass(relic.quality)}`}>{qualityText}</span>
        {relic.def.tags.map((tag) => <span key={tag} className="tip-tag">{tag}</span>)}
      </div>
      <div className="relic-tip-identity">
        <span className={`relic-tip-icon ${qualityClass(relic.quality)}`}>
          <RelicGlyph relic={relic} size={44} />
        </span>
        <h3>{localizedRelic.name}</h3>
      </div>
      <p className="tip-description"><RuleText text={localizedRelic.description} /></p>
      {onSell && (
        <div className="tip-actions">
          <ActionButton variant="danger" wide onClick={() => onSell(relic.id)}>
            <BadgeDollarSign size={18} /> 出售 +0
          </ActionButton>
        </div>
      )}
    </FloatingPaperTip>
  )
}

function GridPanel({ title, subtitle, icon, area, tutorialAnchor, w, h, items, relics = [], selectedItemId, onDrop, onSelectItem, onSlotClick }: { title: string; subtitle: string; icon: React.ReactNode; area: Area; tutorialAnchor?: string; w: number; h: number; items: Item[]; relics?: Relic[]; selectedItemId: string | null; onDrop: ItemDropHandler; onSelectItem: (itemId: string, element: HTMLElement) => void; onSlotClick: (area: Area, x: number, y: number) => void }) {
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
          <DraggableItem key={item.id} item={item} relics={relics} selected={selectedItemId === item.id} upgradeable={canUpgradeItem(item, items)} onDrop={onDrop} onSelect={(element) => onSelectItem(item.id, element)} />
        ))}
      </div>
    </div>
  )
}

function Slot({ id, x, y, title, onClick }: { id: string; x: number; y: number; title: string; onClick: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return <HanddrawnSlotButton nodeRef={setNodeRef} data-drop-id={id} over={isOver} style={{ gridColumn: x + 1, gridRow: y + 1 }} onClick={onClick} aria-label={title} title={title} />
}

function dropIdFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return ''
  return target.closest<HTMLElement>('[data-drop-id]')?.dataset.dropId ?? ''
}

function createFastDragGhost(item: Item) {
  const ghost = document.createElement('div')
  ghost.className = `drag-overlay-item drag-overlay-ghost ${itemTone(item.def)} ${qualityClass(item.quality)}`
  ghost.style.width = `calc(${item.def.width} * var(--slot-w))`
  ghost.style.height = `calc(${item.def.height} * var(--board-slot-h))`
  const quality = document.createElement('span')
  quality.className = 'quality-chip'
  quality.textContent = qualityLabel[normalizeQuality(item.quality)]
  const mark = document.createElement('span')
  mark.className = 'drag-ghost-mark'
  mark.textContent = item.def.name.slice(0, 1)
  const name = document.createElement('strong')
  name.textContent = item.def.name
  const size = document.createElement('small')
  size.textContent = `${item.def.size}格`
  ghost.append(quality, mark, name, size)
  document.body.appendChild(ghost)
  return ghost
}

function startFastItemDrag(event: ReactPointerEvent<HTMLElement>, item: Item, onDrop: ItemDropHandler, onDragState: (dragging: boolean) => void, onClick: (source: HTMLElement) => void) {
  if (event.button !== 0) return false
  const startX = event.clientX
  const startY = event.clientY
  const source = event.currentTarget
  let dragging = false
  let ghost: HTMLElement | null = null
  const moveGhost = (x: number, y: number) => {
    if (!ghost) return
    ghost.style.transform = `translate3d(${x + 10}px, ${y + 10}px, 0)`
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerCancel, true)
    source.classList.remove('dragging', 'input-active')
    ghost?.remove()
    ghost = null
    if (dragging) window.setTimeout(() => source.classList.remove('fast-drag-suppress-click'), 0)
    onDragState(false)
  }
  const beginDrag = (x: number, y: number) => {
    dragging = true
    source.classList.add('fast-drag-suppress-click')
    ghost = createFastDragGhost(item)
    moveGhost(x, y)
    onDragState(true)
  }
  const onPointerMove = (moveEvent: PointerEvent) => {
    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
    if (!dragging && distance >= 2) beginDrag(moveEvent.clientX, moveEvent.clientY)
    if (!dragging) return
    moveEvent.preventDefault()
    moveGhost(moveEvent.clientX, moveEvent.clientY)
  }
  const onPointerUp = (upEvent: PointerEvent) => {
    if (dragging) {
      upEvent.preventDefault()
      const overId = dropIdFromEventTarget(upEvent.target)
      cleanup()
      onDrop(item.id, overId)
      return
    }
    cleanup()
    onClick(source)
  }
  const onPointerCancel = () => cleanup()
  window.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', onPointerUp, true)
  window.addEventListener('pointercancel', onPointerCancel, true)
  return true
}

function DraggableItem({ item, relics, selected, upgradeable, onDrop, onSelect }: { item: Item; relics: Relic[]; selected: boolean; upgradeable: boolean; onDrop: ItemDropHandler; onSelect: (element: HTMLElement) => void }) {
  const { language } = useLanguage()
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({ id: `UPGRADE_ITEM:${item.id}` })
  const nodeRef = useRef<HTMLElement | null>(null)
  const suppressClickRef = useRef(false)
  const setNodeRef = (node: HTMLElement | null) => {
    nodeRef.current = node
    setDropNodeRef(node)
  }
  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    startFastItemDrag(event, item, onDrop, (isDragging) => {
      suppressClickRef.current = isDragging
      if (isDragging) nodeRef.current?.classList.remove('input-active')
    }, onSelect)
  }
  const style = {
    gridColumn: `${item.x + 1} / span ${item.def.width}`,
    gridRow: `${item.y + 1} / span ${item.def.height}`,
  }
  const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), relics)
  const localizedDef = localizeItemDef(item.def, language)
  const qualityText = language === 'en-US' ? localizeQuality(normalizeQuality(item.quality), language) : qualityLabel[normalizeQuality(item.quality)]
  return (
    <ItemFrame
      as="button"
      ref={setNodeRef}
      data-drop-id={`UPGRADE_ITEM:${item.id}`}
      className={`item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${selected ? 'selected' : ''} ${upgradeable ? 'can-upgrade' : ''} ${isOver ? 'upgrade-over' : ''}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation()
        if (suppressClickRef.current || event.currentTarget.classList.contains('fast-drag-suppress-click')) {
          event.preventDefault()
          suppressClickRef.current = false
          return
        }
        onSelect(event.currentTarget)
      }}
      onPointerDown={handlePointerDown}
      title={`${qualityText} ${localizedDef.name} · ${item.def.size}${language === 'en-US' ? ' slots' : '格'}${triggerDice ? ` · ${language === 'en-US' ? 'Dice' : '点数'} ${triggerDice}` : ''}`}
    >
      <ItemCardContent item={item} relics={relics} upgradeable={upgradeable} />
      </ItemFrame>
  )
}

function ItemCardContent({ item, relics = [], upgradeable = false }: { item: Item; relics?: Relic[]; upgradeable?: boolean }) {
  const { language } = useLanguage()
  const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), relics)
  const extraTriggerDice = extraTriggerDiceLabel(itemTriggerDisplay(item), relics)
  const visual = itemVisualProfile(item.def)
  const localizedDef = localizeItemDef(item.def, language)
  const qualityText = language === 'en-US' ? localizeQuality(normalizeQuality(item.quality), language) : qualityLabel[normalizeQuality(item.quality)]
  const effect = language === 'en-US' ? localizedDef.description : effectText(item.def, normalizeQuality(item.quality))
  return (
    <>
      <span className="quality-chip">{qualityText}</span>
      <ItemArt def={item.def} visual={visual} />
      <span className="item-card-copy">
      {upgradeable && <span className="upgrade-indicator" title="可升级">↑</span>}
      <span>{localizedDef.name}</span>
      {item.enchant && <span className="enchant-badge"><Sparkles size={12} />附魔</span>}
      <SizePreview size={item.def.size} />
      {triggerDice && <small><Dice5 size={12} /> {triggerDice}</small>}
      {extraTriggerDice && <small className="extra-trigger-dice"><Sparkles size={12} /> 额外 {extraTriggerDice}</small>}
      <small className="item-effect">{effect}</small>
      {item.enchant && <small className="item-effect enchant-text">{enchantmentText(item.enchant)}</small>}
      </span>
    </>
  )
}

function ItemArt({ def, visual = itemVisualProfile(def), className = '' }: { def: ItemDef; visual?: ReturnType<typeof itemVisualProfile>; className?: string }) {
  return (
    <span className={`item-art-window ${className} ${visual.className} icon-art`} data-art-aspect={visual.artAspect}>
      <ItemArtIcon def={def} className="item-card-icon-art" />
    </span>
  )
}

const itemArtToneLabels: Record<ReturnType<typeof itemVisualProfile>['tone'], string> = {
  damage: '攻击',
  poison: '毒',
  shield: '护盾',
  heal: '治疗',
  weak: '虚弱/控制',
  freeze: '冻结',
  thorns: '荆棘',
  economy: '经济',
  growth: '成长',
  counter: '计数爆发',
  trigger: '功能触发',
  utility: '通用',
}

function ItemArtDebugGallery() {
  const toneCounts = ALL_ITEM_DEFS.reduce<Record<string, number>>((counts, def) => {
    const visual = itemVisualProfile(def)
    counts[visual.tone] = (counts[visual.tone] ?? 0) + 1
    return counts
  }, {})
  return (
    <main className="item-art-debug-gallery">
      <header className="item-art-debug-header">
        <div>
          <span className="tip-tag">开发调试</span>
          <h1>装备卡面画芯画廊</h1>
          <p>集中检查 tone、画芯画幅、首批 WebP 和缺图回退；访问参数：?itemArtGallery=1。</p>
        </div>
        <div className="item-art-debug-stats">
          {Object.entries(toneCounts).map(([tone, count]) => (
            <span key={tone} className={`tip-tag item-tone-${tone}`}>{itemArtToneLabels[tone as keyof typeof itemArtToneLabels] ?? tone} {count}</span>
          ))}
        </div>
      </header>
      <section className="item-art-debug-grid">
        {ALL_ITEM_DEFS.map((def) => {
          const visual = itemVisualProfile(def)
          const quality = normalizeQuality(def.defaultQuality)
          return (
            <article key={def.id} className={`item-art-debug-card paper-card ${visual.className} ${qualityClass(quality)}`}>
              <ItemArt def={def} visual={visual} />
              <div className="item-art-debug-copy">
                <strong>{def.name}</strong>
                <span>{def.size}格 · {itemArtToneLabels[visual.tone]} · 图标</span>
                <small>{def.id}</small>
                <small><RuleText text={def.description ?? effectText(def, quality)} /></small>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function DraggingItemGhost({ item }: { item: Item }) {
  const { language } = useLanguage()
  const localizedDef = localizeItemDef(item.def, language)
  const quality = normalizeQuality(item.quality)
  const qualityText = language === 'en-US' ? localizeQuality(quality, language) : qualityLabel[quality]
  return (
    <div
      className={`drag-overlay-item drag-overlay-ghost ${itemTone(item.def)} ${qualityClass(item.quality)}`}
      style={{ width: `calc(${item.def.width} * var(--slot-w))`, height: `calc(${item.def.height} * var(--board-slot-h))` }}
    >
      <span className="quality-chip">{qualityText}</span>
      <span className="drag-ghost-mark" aria-hidden="true">{localizedDef.name.slice(0, 1)}</span>
      <strong>{localizedDef.name}</strong>
      <small>{item.def.size}{language === 'en-US' ? ' slots' : '格'}</small>
    </div>
  )
}

function DraggingItemOverlay({ item = null }: { item?: Item | null }) {
  return item ? <DraggingItemGhost item={item} /> : null
}

function FloatingTip({ run, item, offer, anchor, descriptionOverride, relicsOverride, busy = false, onClose, onBuy, onSell, onUpgrade }: { run: Run; item: Item | null; offer: ShopOffer | null; anchor: TipAnchor | null; descriptionOverride?: string | null; relicsOverride?: Relic[] | null; busy?: boolean; onClose: () => void; onBuy: (() => void) | null; onSell: (() => void) | null; onUpgrade: (() => void) | null }) {
  const { language } = useLanguage()
  const def = item?.def ?? offer?.def
  useOutsideTipDismiss(Boolean(def && anchor), onClose)
  if (!def || !anchor) return null
  const isOffer = Boolean(offer)
  const quality = normalizeQuality(item?.quality ?? offer?.quality)
  const canAfford = !offer || offer.price < 0 || run.gold >= offer.price
  const sellValue = item ? sellValueForItem(item) : null
  const style = anchor ? { '--tip-x': `${anchor.x}px`, '--tip-y': `${anchor.y}px` } as React.CSSProperties : undefined
  const tipTriggerDice = triggerDiceLabel(item ? itemTriggerDisplay(item) : def, item ? (relicsOverride ?? run.relics) : [])
  const tipExtraTriggerDice = item ? extraTriggerDiceLabel(itemTriggerDisplay(item), relicsOverride ?? run.relics) : null
  const visual = itemVisualProfile(def)
  const localizedDef = localizeItemDef(def, language)
  const qualityText = language === 'en-US' ? localizeQuality(quality, language) : qualityLabel[quality]
  const descriptionText = language === 'en-US' ? localizedDef.description : (descriptionOverride ?? def.description ?? effectText(def, quality))
  const tip = (
    <FloatingPaperTip className="floating-tip paper-card" style={style}>
      <div className="tip-tags">
        <span className={`size-badge ${visual.className}`}>{def.size}格</span>
        <span className={`tip-tag ${qualityClass(quality)}`}>{qualityText}</span>
        <span className="tip-tag">{diceToneText(def)}</span>
        <span className="tip-tag">{effectToneText(def)}</span>
      </div>
      <div className="tip-body">
        <div className="tip-identity">
          <span className={`tip-icon-frame ${visual.className}`}>
            <ItemArt def={def} visual={visual} className="tip-art-preview" />
          </span>
          <h3>{localizedDef.name}</h3>
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
      {tipExtraTriggerDice && (
        <div className="tip-dice extra-trigger-dice" aria-label={`额外触发点数 ${tipExtraTriggerDice}`}>
          <Sparkles size={22} />
          <strong>额外</strong>
          {tipExtraTriggerDice.split('/').map((face) => <span key={face}>{face}</span>)}
        </div>
      )}
      <p className="tip-description"><RuleText text={descriptionText} /></p>
      {item?.enchant && <p className="tip-description enchant-tip"><Sparkles size={16} /> <RuleText text={enchantmentText(item.enchant)} /></p>}
      {isOffer && offer && offer.price >= 0 && (
        <div className="tip-price">
          <Coins size={16} />
          <span>价格 {offer?.price}{offer && offer.discount < 1 ? ` · ${Math.round(offer.discount * 10)}折` : ''}</span>
        </div>
      )}
      <div className="tip-actions">
        {isOffer && onBuy ? (
          <ActionButton className="wide" data-tutorial-anchor="shop-buy" disabled={!canAfford || busy} aria-busy={busy} onClick={onBuy}>
            <PackagePlus size={18} /> 购买到背包
          </ActionButton>
        ) : (
          <>
            {onUpgrade && (
              <ActionButton className="wide" onClick={onUpgrade}>
                <PackagePlus size={18} /> 升级
              </ActionButton>
            )}
            {onSell ? (
              <ActionButton variant="danger" wide onClick={onSell}>
                <BadgeDollarSign size={18} /> 出售 +{sellValue}
              </ActionButton>
            ) : !onUpgrade ? (
              <small className="disabled-reason">战斗中仅查看物品详情</small>
            ) : null}
          </>
        )}
        {!canAfford && <small className="disabled-reason">金币不足，还差 {(offer?.price ?? 0) - run.gold} 金币。</small>}
      </div>
    </FloatingPaperTip>
  )
  if (typeof document === 'undefined') return tip
  return createPortal(tip, document.body)
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
  const tip = (
    <FloatingPaperTip id={statusTipId} className="status-floating-tip" style={style} role="tooltip" onPointerDown={(event) => event.stopPropagation()}>
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
    </FloatingPaperTip>
  )
  if (typeof document === 'undefined') return tip
  return createPortal(tip, document.body)
}

function ForfeitRunAction({ run, onForfeit }: { run: Run; onForfeit: () => void }) {
  return (
    <section className="forfeit-run-action paper-card" aria-label="放弃并结算当前跑局">
      <div>
        <strong>当前 {run.wins} 胜 {run.losses} 败</strong>
        <span>放弃后立即按当前记录结算，不会额外增加失败。</span>
      </div>
      <ActionButton variant="danger" type="button" onClick={onForfeit}>
        <Flag size={18} /> 放弃并结算
      </ActionButton>
    </section>
  )
}

function BattleView({ run, battle, cosmetics: equippedCosmetics, currentEvent, eventIndex, speed, score, soundEnabled, onSpeed, onContinue, onRestart }: { run: Run; battle: Battle | null; cosmetics?: CosmeticsResponse | null; currentEvent?: BattleEvent; eventIndex: number; speed: number; score: number; soundEnabled: boolean; onSpeed: (speed: number) => void; onContinue: () => void; onRestart: () => void }) {
  const { language } = useLanguage()
  const [logOpen, setLogOpen] = useState(false)
  const [battleTip, setBattleTip] = useState<{ item: Item; owner: 'player' | 'opponent'; anchor: TipAnchor } | null>(null)
  const [settlementHidden, setSettlementHidden] = useState(false)
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
  const presentationKind = presentation?.kind

  useEffect(() => {
    if (!presentationKind) return
    playFeedbackSound(soundCueForBattlePresentation(presentationKind), { enabled: soundEnabled })
  }, [displayIndex, presentationKind, soundEnabled])

  useEffect(() => {
    setSettlementHidden(false)
  }, [run.id, run.phase])

  const battleFxClass = cosmeticBattleFxClass(equippedCosmetics)
  return (
    <section className={`battle-panel visual-battle sketch-panel visual-theme-${visualTheme} ${battleFxClass}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)}>
      <div className="battle-toolbar">
        <div className="battle-status">
          <h2>自动战斗</h2>
          <p>{event ? `${event.time}s · ${localizeBattleEventText(event.text, language)}` : localizeBattleEventText('准备播放战斗结果', language)}</p>
        </div>
        <div className="speed-row" aria-label="战斗速度">
          {[1, 2, 4].map((value) => <HanddrawnTabButton key={value} active={speed === value} onClick={() => onSpeed(value)}>{value}x</HanddrawnTabButton>)}
        </div>
      </div>

      <BattleFxStage event={event} eventIndex={displayIndex} presentation={presentation} speed={speed} battleFxClass={cosmeticBattleFxClass(equippedCosmetics)} />
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
        cosmetics={equippedCosmetics}
        battleFxClass={cosmeticBattleFxClass(equippedCosmetics)}
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
        settlementHidden ? (
          <IconButton className="settlement-show-button" title="显示结算" onClick={() => setSettlementHidden(false)}>
            <Eye size={18} />
          </IconButton>
        ) : (
          <SettlementView run={run} score={score} onReturnLobby={onRestart} onHide={() => setSettlementHidden(true)} />
        )
      ) : run.phase === 'BATTLE' && isFinished && (
        <div className="battle-continue-row">
          <ActionButton data-tutorial-anchor="battle-continue" onClick={onContinue}>
            <ArrowRight size={18} /> 继续
          </ActionButton>
        </div>
      )}

      <CollapsedBattleLog events={events} eventIndex={displayIndex} open={logOpen} onToggle={() => setLogOpen((value) => !value)} />
    </section>
  )
}

function SettlementView({ run, score, onReturnLobby, onHide }: { run: Run; score: number; onReturnLobby: () => void; onHide: () => void }) {
  const visualTheme = visualThemeForRound(run.round)
  const review = run.lastBattle ? buildBattleReview(run.lastBattle) : null
  return (
    <section className="settlement-page surprise-surface" style={surpriseBackgroundStyle('settlement')}>
      <IconButton className="settlement-hide-button" title="隐藏结算" onClick={onHide}>
        <EyeOff size={18} />
      </IconButton>
      <HanddrawnFrame as="div" variant="panel" ornament="ribbon" className={`result handdrawn-result paper-card settlement-card visual-theme-surface visual-theme-${visualTheme}`} data-visual-theme={visualTheme} style={{ ...visualThemeStyle(visualTheme), ...surpriseBackgroundStyle('settlement') }}>
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
        {run.lastBattle && review && <BattleReviewDashboard battle={run.lastBattle} review={review} />}
        <ActionButton onClick={onReturnLobby}>返回大厅</ActionButton>
      </HanddrawnFrame>
    </section>
  )
}

function BattleReviewDashboard({ battle, review }: { battle: Battle; review: BattleReview }) {
  const { language, t } = useLanguage()
  return (
    <section className="battle-review-dashboard" aria-label={t('battleReviewTitle')}>
      <div className="battle-review-heading">
        <strong>{t('battleReviewTitle')}</strong>
        {review.systemDamage > 0 && <span className="tip-tag">{t('battleReviewSystemDamage')} {review.systemDamage}</span>}
      </div>
      <div className="battle-review-side-grid">
        <BattleReviewSideCard
          stats={review.player}
          sideLabel={t('battleReviewPlayer')}
          topItemName={battleReviewTopItemName(battle, review.player, language)}
        />
        <BattleReviewSideCard
          stats={review.opponent}
          sideLabel={t('battleReviewOpponent')}
          topItemName={battleReviewTopItemName(battle, review.opponent, language)}
        />
      </div>
    </section>
  )
}

function BattleReviewSideCard({ stats, sideLabel, topItemName }: { stats: BattleReviewSideStats; sideLabel: string; topItemName: string | null }) {
  const { t } = useLanguage()
  return (
    <article className={`battle-review-side-card ${stats.side}`}>
      <header>
        <span>{sideLabel}</span>
        <strong>{stats.label}</strong>
      </header>
      <div className="battle-review-metrics">
        <span className="battle-review-metric"><small>{t('battleReviewDamage')}</small><strong>{stats.damage}</strong></span>
        <span className="battle-review-metric"><small>{t('battleReviewHealing')}</small><strong>{stats.healing}</strong></span>
        <span className="battle-review-metric"><small>{t('battleReviewShield')}</small><strong>{stats.shield}</strong></span>
        <span className="battle-review-metric"><small>{t('battleReviewPoisonDamage')}</small><strong>{stats.poisonDamage}</strong></span>
        <span className="battle-review-metric"><small>{t('battleReviewStatuses')}</small><strong>{stats.statusEvents}</strong></span>
      </div>
      <div className="battle-review-top-item">
        <small>{t('battleReviewTopItem')}</small>
        <strong>{stats.topItem && topItemName ? `${topItemName} · ${stats.topItem.contribution}` : t('battleReviewNoItem')}</strong>
      </div>
    </article>
  )
}

function battleReviewTopItemName(battle: Battle, stats: BattleReviewSideStats, language: Language) {
  if (!stats.topItem) return null
  const snapshot = stats.side === 'player' ? battle.playerSnapshot : battle.opponentSnapshot
  const item = snapshot?.items.find((entry) => entry.id === stats.topItem?.itemId)
  return item ? localizeItemDef(item.def, language).name : stats.topItem.name
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
  const { language } = useLanguage()
  const items = snapshot.items.filter((item) => item.area === 'EQUIPMENT')
  const dogText = localizeDog(snapshot.dogType, language)
  const activeItemId = activeEvent?.actor === owner && activeEvent.kind === 'ITEM' ? activeEvent.itemId : null
  const activeVfxKind = battleVfxKind(activeEvent)
  const slots = equipmentSlotCount(snapshot.relics)
  return (
    <div className={`battle-equipment-row ${owner} sketch-panel`}>
      <div className="battle-row-title">
        <span>{owner === 'player' ? '你的装备栏' : '对手装备栏'}</span>
        <small>{snapshot.name} · {dogText.name}</small>
      </div>
      <div className="battle-slot-grid" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {Array.from({ length: slots }).map((_, x) => <i key={x} className="battle-slot" style={{ gridColumn: x + 1, gridRow: 1 }} />)}
        {items.map((item) => {
          const growthText = growthDamageTextForBattleItem(item, owner, events, displayIndex)
          const growthNumber = growthDamageValueForBattleItem(item, owner, events, displayIndex)
          const boomCounterState = boomCounterStateForBattleItem(item, owner, events, displayIndex, activeEvent)
          const freezeStackState = freezeStackStateForBattleItem(item, owner, events, displayIndex, activeEvent)
          const reservoirState = reservoirStateForBattleItem(activeEvent, owner, item.id)
          const triggerDice = triggerDiceLabel(itemTriggerDisplay(item), snapshot.relics ?? [])
          const triggerCountLabel = itemTriggerCountLabel(events, owner, item.id, displayIndex)
          const triggerCountPopping = activeItemId === item.id
          const localizedDef = localizeItemDef(item.def, language)
          const qualityText = language === 'en-US' ? localizeQuality(normalizeQuality(item.quality), language) : qualityLabel[normalizeQuality(item.quality)]
          const itemEffect = language === 'en-US' ? localizedDef.description : (growthText ?? effectText(item.def, normalizeQuality(item.quality)))
          const slotLabel = language === 'en-US' ? `${item.def.size} slots` : `占${item.def.size}格`
          const diceLabel = triggerDice ?? (language === 'en-US' ? 'No dice' : '无点数')
          const enchantText = item.enchant ? enchantmentText(item.enchant) : null
          const fullEnchantText = item.enchant ? ` · ${enchantmentText(item.enchant)}` : ""
          const infoTextForScale = `${diceLabel}${enchantText ?? ''}${growthNumber ?? ''}`
          return (
          <ItemFrame
            as="button"
            type="button"
            key={item.id}
            className={`battle-item item-card paper-item-card ${itemTone(item.def)} ${qualityClass(item.quality)} ${activeItemId === item.id ? `active battle-item-trigger vfx-trigger-${activeVfxKind}` : ''} ${targetItemIds.includes(item.id) ? 'battle-item-vfx-target' : ''} ${boomCounterState ? 'boom-counter' : ''} ${boomCounterState?.popping ? 'boom-counter-pop' : ''} ${freezeStackState ? 'freeze-stack' : ''} ${freezeStackState?.popping ? 'freeze-stack-pop' : ''} ${reservoirState ? 'frog-reservoir-card' : ''} ${triggerCountPopping ? 'trigger-count-pop' : ''}`}
            {...battleVfxAnchorAttrs('equipment-row', owner, item.id)}
            data-vfx-kind={battleVfxKind(activeEvent)}
            style={{
              gridColumn: `${item.x + 1} / span ${item.def.width}`,
              gridRow: 1,
              '--battle-name-size': `${battleCardAdaptiveFontSize(localizedDef.name, 13, 9)}px`,
              '--battle-info-size': `${battleCardAdaptiveFontSize(infoTextForScale, 11, 8)}px`,
            } as React.CSSProperties}
            title={`${qualityText} ${localizedDef.name} · ${slotLabel} · ${language === 'en-US' ? 'Dice' : '点数'} ${diceLabel} · ${itemEffect}${fullEnchantText}`}
            onClick={(event) => onInspect(item, event.currentTarget)}
          >
            {reservoirState && (
              <span
                className="frog-reservoir-fill"
                style={{ height: `${Math.round(Math.max(0, Math.min(1, reservoirState.progress)) * 100)}%` }}
                aria-hidden="true"
              />
            )}
            <span className="battle-item-icon-frame">
              <img className="item-icon" src={itemIcon(item.def)} alt="" />
            </span>
            <span className="battle-item-name" title={localizedDef.name}>{localizedDef.name}</span>
            <span className="battle-item-info">
              <span className="battle-item-dice" title={`${language === 'en-US' ? 'Dice' : '点数'} ${diceLabel}`}><Dice5 size={12} />{diceLabel}</span>
              {enchantText && <span className="battle-enchant-overlay" title={enchantText}><Sparkles size={11} />{enchantText}</span>}
              {growthNumber != null && <span className="battle-item-growth-number" title={growthText ?? String(growthNumber)}>{growthNumber}</span>}
            </span>
            {boomCounterState && (
              <span className="boom-counter-meter" aria-label={`爆鸣计数 ${boomCounterState.count}/${boomCounterState.max}`}>
                <i style={{ width: `${boomCounterState.progress}%` }} />
                <b>{boomCounterState?.count}/{boomCounterState.max}</b>
              </span>
            )}
            {freezeStackState && (
              <span className="freeze-stack-meter" aria-label={`冻结计数 ${freezeStackState.count}/${freezeStackState.max}`}>
                <i style={{ width: `${freezeStackState.progress}%` }} />
                <b>{freezeStackState.count}/{freezeStackState.max}</b>
              </span>
            )}
            <span className={`trigger-count-stamp ${triggerCountLabel === 'x0' ? 'empty' : ''}`} aria-label={`褰撳眬瑙﹀彂娆℃暟 ${triggerCountLabel}`}>
              {triggerCountLabel}
            </span>
          </ItemFrame>
          )
        })}
      </div>
      <RelicRail relics={snapshot.relics ?? []} compact />
    </div>
  )
}

function BattleStage({ player, opponent, event, presentation, lastRoll, finished, winner, visualTheme, cosmetics, battleFxClass }: { player: BattleSnapshot; opponent: BattleSnapshot; event?: BattleEvent; presentation: PresentationEvent | null; lastRoll?: BattleEvent; finished: boolean; winner?: string; visualTheme: VisualThemeId; cosmetics?: CosmeticsResponse | null; battleFxClass?: string }) {
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
    <div className={`battle-stage handdrawn-stage visual-theme-surface visual-theme-${visualTheme} ${battleFxClass ?? ''}`} data-visual-theme={visualTheme} style={visualThemeStyle(visualTheme)} data-tutorial-anchor="battle-stage" data-presentation-kind={activePresentationKind}>
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
        cosmetics={cosmetics}
      />
      <BattleDice event={event} lastRoll={lastRoll} battleFxClass={battleFxClass} />
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
        cosmetics={cosmetics}
      />
      <StatusFloatingTip statusTip={statusTip} onClose={() => setStatusTip(null)} />
    </div>
  )
}

function BattleDog({ side, snapshot, hp, maxHp, shield, event, finished, winner, onStatusInspect, activeStatusKey, cosmetics: equippedCosmetics }: { side: 'player' | 'opponent'; snapshot: BattleSnapshot; hp: number; maxHp: number; shield: number; event?: BattleEvent; finished: boolean; winner?: string; onStatusInspect: (status: BattleStatusEntry, side: 'player' | 'opponent', polarity: 'positive' | 'negative', element: HTMLElement) => void; activeStatusKey: string | null; cosmetics?: CosmeticsResponse | null }) {
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
      <BoneHealthBar
        name={snapshot.name}
        hp={hp}
        maxHp={maxHp}
        shield={shieldValue}
        poisonPreviewDamage={poisonStatus?.tickDamage ?? 0}
        side={side}
        data-hp-percent={hpPercent}
        data-poison-preview-left={poisonPreviewLeft}
        data-poison-preview-percent={poisonPreviewPercent}
        statusSlotTop={<StatusEffectRow tone="positive" side={side} statuses={positiveStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />}
        statusSlotBottom={<StatusEffectRow tone="negative" side={side} statuses={negativeStatuses} onStatusInspect={onStatusInspect} activeStatusKey={activeStatusKey} />}
        {...battleVfxAnchorAttrs('hp', side)}
      >
        {shieldValue > 0 && (
          <div className="shield-bar" aria-label={`护盾 ${shieldValue}`}>
            <i style={{ width: `${Math.max(6, Math.min(100, shieldPercent))}%` }} />
            <span><Shield size={13} /> 护盾 {shieldValue}</span>
          </div>
        )}
      </BoneHealthBar>
      <DogBadge dogType={snapshot.dogType} src={cosmeticDogAsset(equippedCosmetics, snapshot.dogType, side)} size="battle" side={side} status={poisonStatus ? 'poison' : shieldValue > 0 ? 'shield' : won ? 'winner' : lost ? 'loser' : undefined} skinClass={cosmeticDogSkinClass(equippedCosmetics, snapshot.dogType, side)} className="battle-dog-img" {...battleVfxAnchorAttrs('dog-avatar', side)} />
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
          <StatusChip
            key={`${tone}-${status.type}`}
            type="button"
            className={`status-chip handdrawn-status-chip ${status.type}`}
            aria-label={`查看${status.label}说明`}
            aria-describedby={isActive ? statusTipId : undefined}
            aria-expanded={isActive}
            aria-controls={statusTipId}
            title={statusDescription(status)}
            onClick={(event) => {
              event.stopPropagation()
              onStatusInspect(status, side, tone, event.currentTarget)
            }}
          >
            {statusText(status)}
          </StatusChip>
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

function BattleDice({ event, lastRoll, battleFxClass = '' }: { event?: BattleEvent; lastRoll?: BattleEvent; battleFxClass?: string }) {
  const actor = event?.kind === 'ROLL' ? event.actor : lastRoll?.actor ?? event?.actor
  const roll = event?.roll ?? lastRoll?.roll
  return (
    <DynamicDice
      roll={roll}
      actor={actor === 'opponent' || actor === 'player' ? actor : 'system'}
      rolling={event?.kind === 'ROLL'}
      label={actor === 'opponent' ? '对手掷骰' : actor === 'player' ? '玩家掷骰' : '战斗结算'}
      className={`battle-dice handdrawn-dice ${battleFxClass}`}
    />
  )
}

function BattleFxStage({ event, eventIndex, presentation, speed, battleFxClass = '' }: { event?: BattleEvent; eventIndex: number; presentation: PresentationEvent | null; speed: number; battleFxClass?: string }) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [activeFxInstances, setActiveFxInstances] = useState<BattleFxInstance[]>([])
  const instancesRef = useRef<BattleFxInstance[]>([])
  const lastCueKeyRef = useRef<string | null>(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const timeline = presentation ? buildFxTimeline(presentation, Boolean(reducedMotion)) : []
  const cueKey = event && presentation ? battleFxCueKey(event, presentation, eventIndex) : null

  useEffect(() => {
    if (!cueKey || !event || !presentation || presentation.kind === 'none') {
      if (!cueKey) lastCueKeyRef.current = null
      return
    }
    if (lastCueKeyRef.current === cueKey) return
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const instance: BattleFxInstance = {
      id: `${cueKey}-${Math.round(startedAt)}`,
      key: cueKey,
      event,
      presentation,
      fx: createBattleFxStyle(event),
      startedAt,
      durationMs: battleFxInstanceDuration(speed),
      particles: [],
      particlesReady: false,
    }
    const nextInstances = [...instancesRef.current, instance].slice(-14)
    instancesRef.current = nextInstances
    lastCueKeyRef.current = cueKey
    setActiveFxInstances(nextInstances)
  }, [cueKey, event, presentation, speed])

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas || activeFxInstances.length === 0) return
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
    let frame = 0

    const draw = (now: number) => {
      rect = resize()
      context.clearRect(0, 0, rect.width, rect.height)
      const anchorRoot = stage.parentElement ?? stage
      const survivors: BattleFxInstance[] = []
      for (const instance of instancesRef.current) {
        const t = Math.min(1, (now - instance.startedAt) / instance.durationMs)
        if (t >= 1) continue
        const sourceElement = queryBattleFxAnchor(anchorRoot, instance.presentation.source)
        const targetElement = queryBattleFxAnchor(anchorRoot, instance.presentation.target)
        const points = resolveBattleFxPoints(stage, instance.presentation, (anchor) => anchor === instance.presentation.source ? sourceElement : targetElement)
        if (!instance.particlesReady) {
          instance.particles = createMeteorSparkParticles(instance.event, instance.fx, points.target.x, points.target.y)
          instance.particlesReady = true
        }
        drawMeteorBattleFxTrail(context, points.source.x, points.source.y, points.target.x, points.target.y, t, instance.fx)
        for (const particle of instance.particles) {
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
        drawMeteorImpactFlash(context, points.target.x, points.target.y, t, instance.fx)
        drawHandwrittenBattleNumber(context, instance.event, instance.fx, points.target.x, points.target.y, t)
        survivors.push(instance)
      }
      context.globalAlpha = 1
      if (survivors.length !== instancesRef.current.length) {
        instancesRef.current = survivors
        setActiveFxInstances(survivors)
      }
      if (survivors.length > 0) frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [activeFxInstances.length])

  return (
    <div ref={stageRef} className={`battle-fx-stage ${battleFxClass}`} data-vfx-kind={battleVfxKind(event)} data-timeline={timeline.map((step) => step.phase).join(' ')}>
      <canvas ref={canvasRef} className="battle-fx-canvas handdrawn-fx-canvas" data-vfx-kind={battleVfxKind(event)} aria-hidden="true" />
    </div>
  )
}

function battleFxCueKey(event: BattleEvent, presentation: PresentationEvent, eventIndex: number) {
  return [
    eventIndex,
    event.time,
    event.actor,
    event.kind,
    event.itemId ?? '',
    event.targetItemId ?? '',
    event.effectType ?? '',
    event.amount ?? '',
    presentation.kind,
    presentation.source.anchor,
    presentation.source.side,
    presentation.source.id ?? '',
    presentation.target.anchor,
    presentation.target.side,
    presentation.target.id ?? '',
  ].join('|')
}

function battleFxInstanceDuration(speed: number) {
  return Math.max(560, 1160 / Math.sqrt(speed))
}

function drawMeteorBattleFxTrail(context: CanvasRenderingContext2D, actorX: number, actorY: number, targetX: number, targetY: number, t: number, fx: BattleVfxStyle) {
  if (fx.kind === 'none' || fx.kind === 'roll') return
  for (const meteor of meteorVolleyCues(fx)) {
    drawSingleMeteorProjectile(context, actorX, actorY, targetX, targetY, t, fx, meteor)
  }
}

function drawSingleMeteorProjectile(context: CanvasRenderingContext2D, actorX: number, actorY: number, targetX: number, targetY: number, t: number, fx: BattleVfxStyle, meteor: MeteorCue) {
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
  const primary = meteor.palette[Math.abs(Math.round(meteor.lane)) % meteor.palette.length] ?? fx.color
  const secondary = meteor.palette[(Math.abs(Math.round(meteor.lane)) + 1) % meteor.palette.length] ?? fx.accent
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
  const palette = meteorPaletteForFx(fx)
  return battleProjectileCues(fx.kind).map((cue) => ({ ...cue, palette }))
}

function meteorPaletteForFx(fx: BattleVfxStyle) {
  return battleProjectileCues(fx.kind)[0]?.palette ?? [fx.color, fx.accent, '#ffffff']
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

function createMeteorSparkParticles(event: BattleEvent, fx: BattleVfxStyle, x: number, y: number): MeteorSparkParticle[] {
  const particles: MeteorSparkParticle[] = []
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
  const { language, t } = useLanguage()
  const [activeFilter, setActiveFilter] = useState<BattleLogFilter>('all')
  const indexedEvents = events.slice(0, eventIndex + 1).map((event, absoluteIndex) => ({ ...event, absoluteIndex }))
  const filteredEvents = filterBattleEvents(indexedEvents, activeFilter)
  const visible = filteredEvents.slice(open ? -40 : -3)
  return (
    <div className={`battle-log-shell ${open ? 'open' : ''}`}>
      <HanddrawnTextButton className="log-toggle" onClick={onToggle}>{open ? '收起日志' : '展开日志'}</HanddrawnTextButton>
      <div className="battle-log-filters" aria-label="战斗日志分类">
        {battleLogFilters.map((filter) => (
          <HanddrawnTabButton
            key={filter}
            className={`battle-log-filter ${activeFilter === filter ? 'active' : ''}`}
            active={activeFilter === filter}
            data-log-filter={filter}
            onClick={() => setActiveFilter(filter)}
          >
            {battleLogFilterLabel(filter, t)}
          </HanddrawnTabButton>
        ))}
      </div>
      <div className="battle-log">
        {visible.length > 0 ? visible.map((event, index) => (
          <p key={`${event.time}-${index}-${event.text}`} className={`${event.actor} ${event.effectType === 'POISON' ? 'poison' : ''} ${event.absoluteIndex === eventIndex ? 'active-feedback' : ''}`}>{event.time}s · {localizeBattleEventText(event.text, language)}</p>
        )) : <p className="system battle-log-empty">{t('battleLogFilterEmpty')}</p>}
      </div>
    </div>
  )
}

function battleLogFilterLabel(filter: BattleLogFilter, t: ReturnType<typeof useLanguage>['t']) {
  if (filter === 'damage') return t('battleLogFilterDamage')
  if (filter === 'sustain') return t('battleLogFilterSustain')
  if (filter === 'status') return t('battleLogFilterStatus')
  if (filter === 'equipment') return t('battleLogFilterEquipment')
  return t('battleLogFilterAll')
}
