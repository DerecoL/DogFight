import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const defaultDistDir = path.resolve('dist')
const defaultOutputFile = path.resolve('dist-click', 'index.html')
const defaultLauncherFile = path.resolve('dist-click', 'DogFight-standalone.cmd')

const mimeTypes = new Map([
  ['.css', 'text/css'],
  ['.js', 'text/javascript'],
  ['.html', 'text/html'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.mp3', 'audio/mpeg'],
  ['.ico', 'image/x-icon'],
])

function posixPath(value) {
  return value.split(path.sep).join('/')
}

async function listFiles(dir) {
  const entries = await readdir(dir)
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const details = await stat(fullPath)
    if (details.isDirectory()) files.push(...await listFiles(fullPath))
    else files.push(fullPath)
  }
  return files
}

function escapeScript(text) {
  return text.replace(/<\/script/gi, '<\\/script')
}

function createLauncher(html) {
  const marker = '__DOGFIGHT_HTML_PAYLOAD_BELOW__'
  const header = [
    '@echo off',
    'setlocal',
    'set "DOGFIGHT_SELF=%~f0"',
    'set "DOGFIGHT_OUTPUT=%TEMP%\\DogFight-standalone-index.html"',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$self=$env:DOGFIGHT_SELF; $out=$env:DOGFIGHT_OUTPUT; $marker=\'__DOGFIGHT_HTML_PAYLOAD_BELOW__\'; $text=[IO.File]::ReadAllText($self,[Text.Encoding]::UTF8); $idx=$text.LastIndexOf($marker); if($idx -lt 0){ exit 1 }; $payload=$text.Substring($idx + $marker.Length).TrimStart([char]13,[char]10); $utf8=New-Object System.Text.UTF8Encoding($false); [IO.File]::WriteAllText($out,$payload,$utf8)"',
    'if errorlevel 1 (',
    '  echo Failed to unpack DogFight.',
    '  pause',
    '  exit /b 1',
    ')',
    'set "BROWSER="',
    'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not defined BROWSER if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not defined BROWSER if exist "%ProgramFiles%\\Mozilla Firefox\\firefox.exe" set "BROWSER=%ProgramFiles%\\Mozilla Firefox\\firefox.exe"',
    'if not defined BROWSER if exist "%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe" set "BROWSER=%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe"',
    'if defined BROWSER (',
    '  start "" "%BROWSER%" "%DOGFIGHT_OUTPUT%"',
    ') else (',
    '  start "" "%DOGFIGHT_OUTPUT%"',
    ')',
    'exit /b 0',
    marker,
  ].join('\r\n')
  return `${header}\r\n${html}`
}

async function createAssetMap(distDir) {
  const files = await listFiles(distDir)
  const assetMap = new Map()
  for (const file of files) {
    if (path.basename(file) === 'index.html') continue
    const relative = posixPath(path.relative(distDir, file))
    const mime = mimeTypes.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream'
    const data = await readFile(file)
    assetMap.set(`/${relative}`, `data:${mime};base64,${data.toString('base64')}`)
  }
  return assetMap
}

function replaceAssetUrls(text, assetMap) {
  let output = text
  const entries = [...assetMap.entries()].sort((a, b) => b[0].length - a[0].length)
  for (const [url, dataUri] of entries) {
    output = output.split(url).join(dataUri)
    output = output.split(url.slice(1)).join(dataUri)
  }
  return output
}

function findAssetRefs(html, tagName, attrName) {
  const refs = []
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  const attrPattern = new RegExp(`${attrName}=["']([^"']+)["']`, 'i')
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0]
    const attr = tag.match(attrPattern)
    if (attr) refs.push(attr[1])
  }
  return refs
}

function titleFrom(html) {
  return html.match(/<title>(.*?)<\/title>/i)?.[1] ?? 'DogFight'
}

async function defaultMockApiScript(buildId = new Date().toISOString().replace(/[-:.TZ]/g, '')) {
  if (buildId) return currentMockApiScript(buildId)

  return String.raw`
(() => {
  window.__DOGFIGHT_STANDALONE__ = true;
  const buildId = '__DOGFIGHT_BUILD_ID__';
  window.__DOGFIGHT_STANDALONE_BUILD_ID__ = buildId;
  const storageKey = 'dogfight:standalone-state:' + buildId;
  const qualities = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
  const itemDefs = [
    ...[1, 2, 3, 4, 5, 6].map((n) => itemDef('starter-' + n, n + '点牙咬', 1, 2, [n], ['starter'], 'DAMAGE', 5)),
    itemDef('small-bite', '小型咬击', 1, 3, [1, 2, 3], ['small'], 'DAMAGE', 4),
    itemDef('lucky-paw', '幸运爪垫', 1, 4, [6], ['big'], 'DAMAGE', 12),
    itemDef('milk-bone', '牛奶骨头', 1, 4, [2, 4], ['heal'], 'HEAL', 6),
    itemDef('rubber-ball', '橡胶球', 2, 6, [3, 5], ['medium'], 'DAMAGE', 9),
    itemDef('spiked-collar', '尖刺项圈', 2, 7, [4, 5, 6], ['big', 'medium'], 'DAMAGE', 8),
    itemDef('training-disc', '训练飞盘', 2, 6, [1, 6], ['medium'], 'DAMAGE', 10),
    itemDef('guard-vest', '护卫背心', 3, 8, [1, 3, 5], ['medium', 'heal'], 'HEAL', 8),
    itemDef('giant-bone', '巨型骨棒', 4, 10, [5, 6], ['large', 'big'], 'DAMAGE', 16),
    itemDef('dog-house', '小狗窝', 4, 9, [1, 2], ['large', 'small'], 'HEAL', 12),
  ];
  const defs = Object.fromEntries(itemDefs.map((def) => [def.id, def]));
  const shopTypes = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'];
  const dogTypes = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'];
  const dogNames = { SHIBA: '柴犬', SAMOYED: '萨摩耶', MUTT: '土狗', BULLY: '恶霸', EMPEROR: '狗皇帝' };
  const originalFetch = window.fetch.bind(window);

  function itemDef(id, name, size, price, dice, tags, effectType, amount) {
    return {
      id,
      name,
      size,
      width: size,
      height: 1,
      price,
      dice,
      tags,
      effect: { type: effectType, amount },
      description: diceText(dice) + '时' + (effectType === 'HEAL' ? '回复' : '造成') + amount + (effectType === 'HEAL' ? '生命' : '伤害'),
    };
  }

  function diceText(dice) {
    return '掷出 ' + dice.join('/') + ' 点';
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || defaultState();
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function defaultState() {
    return { user: null, run: null, nextId: 1 };
  }

  function id(state, prefix) {
    state.nextId += 1;
    return prefix + '-' + state.nextId;
  }

  function qualityAmount(amount, quality) {
    return Math.round(amount * Math.pow(1.5, Math.max(0, qualities.indexOf(quality || 'BRONZE'))));
  }

  function publicItem(item) {
    return { ...item, quality: item.quality || 'BRONZE', def: defs[item.defId] || defs['starter-1'] };
  }

  function publicRun(run) {
    if (!run) return null;
    return {
      ...run,
      shopItems: (run.shopItems || []).map((offer) => ({ ...offer, quality: offer.quality || 'BRONZE', def: defs[offer.defId] || defs['starter-1'] })),
      classRewardChoices: [],
      relicChoices: [],
      relics: [],
      matchedGhost: run.matchedGhost || null,
      lastBattle: run.lastBattle || null,
      items: (run.items || []).map(publicItem),
    };
  }

  function shopPool(type) {
    return itemDefs.filter((def) => {
      if (def.tags.includes('starter')) return false;
      if (type === 'LARGE') return def.size === 4;
      if (type === 'MEDIUM') return def.size === 2 || def.size === 3;
      if (type === 'SMALL') return def.size === 1;
      if (type === 'SMALL_DICE') return def.dice.some((n) => n <= 3);
      if (type === 'BIG_DICE') return def.dice.some((n) => n >= 4);
      return true;
    });
  }

  function createShop(state, type = 'GENERAL') {
    const pool = shopPool(type);
    return Array.from({ length: 5 }, (_, index) => {
      const def = pool[(state.nextId + index) % pool.length];
      return { offerId: id(state, 'offer'), defId: def.id, price: def.price, discount: 1, quality: 'BRONZE' };
    });
  }

  function initialItems(state) {
    return [1, 2, 3, 4, 5, 6].map((n, index) => ({
      id: id(state, 'item'),
      defId: 'starter-' + n,
      quality: 'BRONZE',
      area: 'EQUIPMENT',
      x: index,
      y: 0,
    }));
  }

  function overlaps(a, b) {
    const aw = defs[a.defId]?.width || 1;
    const bw = defs[b.defId]?.width || 1;
    return a.area === b.area && a.y === b.y && a.x < b.x + bw && b.x < a.x + aw;
  }

  function canPlace(items, candidate) {
    const width = defs[candidate.defId]?.width || 1;
    if (candidate.x < 0 || candidate.y !== 0 || candidate.x + width > 12) return false;
    return !items.some((item) => item.id !== candidate.id && overlaps(item, candidate));
  }

  function findSlot(items, defId, area) {
    const width = defs[defId]?.width || 1;
    for (let x = 0; x <= 12 - width; x += 1) {
      const candidate = { id: 'candidate', defId, area, x, y: 0 };
      if (canPlace(items, candidate)) return { x, y: 0 };
    }
    return null;
  }

  async function parseBody(options) {
    if (!options?.body) return {};
    if (typeof options.body === 'string') return JSON.parse(options.body || '{}');
    return {};
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  function error(message, status = 400) {
    return json({ error: message }, status);
  }

  function requireUser(state) {
    if (!state.user) return null;
    return state.user;
  }

  function createGhost(run) {
    const dogType = dogTypes[(run.round + run.wins + run.losses) % dogTypes.length];
    const ghostItems = initialItems({ nextId: 1000 });
    return {
      name: '离线狗狗 R' + run.round,
      dogType,
      luckyNumber: dogType === 'EMPEROR' ? ((run.round % 6) + 1) : null,
      wins: Math.max(0, run.wins - 1),
      losses: run.losses,
      round: run.round,
      items: ghostItems,
      relics: [],
    };
  }

  function snapshot(name, runOrGhost) {
    return {
      name,
      dogType: runOrGhost.dogType,
      luckyNumber: runOrGhost.luckyNumber || null,
      wins: runOrGhost.wins,
      losses: runOrGhost.losses,
      round: runOrGhost.round,
      items: (runOrGhost.items || []).map(publicItem),
      relics: [],
    };
  }

  function simulateBattle(run, user) {
    const opponent = run.matchedGhost || createGhost(run);
    let playerHp = 100;
    let opponentHp = 100;
    const events = [];
    let time = 0;
    const push = (event) => events.push({ ...event, time: Number(time.toFixed(1)), playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp) });
    const sides = [
      { actor: 'player', name: user.nickname || '本地玩家', fighter: run },
      { actor: 'opponent', name: opponent.name, fighter: opponent },
    ];
    push({ actor: 'system', kind: 'ROLL', target: 'none', text: '战斗开始，双方自动掷骰。' });
    for (let round = 0; round < 10 && playerHp > 0 && opponentHp > 0; round += 1) {
      for (const side of sides) {
        if (playerHp <= 0 || opponentHp <= 0) break;
        const roll = ((round + (side.actor === 'player' ? run.id.length : 3)) % 6) + 1;
        time += 0.8;
        push({ actor: side.actor, kind: 'ROLL', effectType: 'ROLL', target: 'none', roll, text: (side.actor === 'player' ? '玩家' : '对手') + '掷出 ' + roll + ' 点。' });
        const equipped = (side.fighter.items || []).filter((item) => item.area === 'EQUIPMENT').sort((a, b) => a.x - b.x);
        for (const item of equipped) {
          const def = defs[item.defId];
          if (!def || !def.dice.includes(roll)) continue;
          const amount = qualityAmount(def.effect.amount, item.quality);
          time += 0.25;
          if (def.effect.type === 'HEAL') {
            if (side.actor === 'player') playerHp = Math.min(100, playerHp + amount);
            else opponentHp = Math.min(100, opponentHp + amount);
            push({ actor: side.actor, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'HEAL', amount, target: side.actor, text: def.name + ' 回复 ' + amount + ' 生命。' });
          } else if (side.actor === 'player') {
            opponentHp -= amount;
            push({ actor: 'player', kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'DAMAGE', amount, target: 'opponent', text: def.name + ' 造成 ' + amount + ' 点伤害。' });
          } else {
            playerHp -= amount;
            push({ actor: 'opponent', kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'DAMAGE', amount, target: 'player', text: def.name + ' 造成 ' + amount + ' 点伤害。' });
          }
          if (playerHp <= 0 || opponentHp <= 0) break;
        }
      }
    }
    const winner = playerHp >= opponentHp ? 'player' : 'opponent';
    time += 0.5;
    push({ actor: 'system', kind: 'END', target: 'none', text: winner === 'player' ? '你赢下了这一局。' : '对手赢下了这一局。' });
    return {
      winner,
      duration: Number(time.toFixed(1)),
      playerHp: Math.max(0, playerHp),
      opponentHp: Math.max(0, opponentHp),
      events,
      playerSnapshot: snapshot(user.nickname || '本地玩家', run),
      opponentSnapshot: snapshot(opponent.name, opponent),
    };
  }

  function finishBattle(state, battle) {
    const run = state.run;
    const playerWon = battle.winner === 'player';
    run.wins += playerWon ? 1 : 0;
    run.losses += playerWon ? 0 : 1;
    run.round += 1;
    run.gold += 5 + run.round * 2;
    run.matchedGhost = null;
    run.lastBattle = battle;
    run.status = run.wins >= 12 || run.losses >= 3 ? 'COMPLETE' : 'ACTIVE';
    run.phase = run.status === 'COMPLETE' ? 'COMPLETE' : run.round <= 2 ? 'SHOP' : 'CHOICE';
    run.refreshCost = 1;
    run.shopType = 'GENERAL';
    run.choices = run.phase === 'CHOICE' ? ['GENERAL', 'SMALL', 'BIG_DICE'] : [];
    run.shopItems = run.phase === 'SHOP' ? createShop(state, 'GENERAL') : [];
  }

  async function handleApi(pathname, options) {
    const state = loadState();
    const method = (options?.method || 'GET').toUpperCase();
    const body = await parseBody(options);
    const user = requireUser(state);

    if (pathname === '/health') return json({ ok: true });
    if (pathname === '/me') return user ? json({ user, activeRun: publicRun(state.run) }) : error('未登录', 401);
    if (pathname === '/auth/logout' && method === 'POST') {
      state.user = null;
      state.run = null;
      saveState(state);
      return json({ ok: true });
    }
    if ((pathname === '/auth/login' || pathname === '/auth/register') && method === 'POST') {
      state.user = {
        id: 'local-user',
        email: body.email || 'player@dogdice.test',
        nickname: pathname.endsWith('register') ? null : '本地玩家',
      };
      saveState(state);
      return json(pathname.endsWith('register') ? { user: state.user, needsNickname: true } : { user: state.user, activeRun: publicRun(state.run) });
    }
    if (!user) return error('未登录', 401);
    if (pathname === '/profile/nickname' && method === 'POST') {
      const nickname = String(body.nickname || '').trim();
      if (nickname.length < 2 || nickname.length > 16) return error('昵称需要 2-16 个字符');
      state.user.nickname = nickname;
      saveState(state);
      return json({ user: state.user });
    }
    if (pathname === '/runs' && method === 'POST') {
      const dogType = dogTypes.includes(body.dogType) ? body.dogType : 'SHIBA';
      state.run = {
        id: id(state, 'run'),
        dogType,
        luckyNumber: dogType === 'EMPEROR' ? Number(body.luckyNumber || 1) : null,
        wins: 0,
        losses: 0,
        round: 0,
        gold: 10,
        phase: 'SHOP',
        status: 'ACTIVE',
        shopType: 'GENERAL',
        shopItems: [],
        choices: [],
        refreshCost: 1,
        matchedGhost: null,
        lastBattle: null,
        items: initialItems(state),
      };
      state.run.shopItems = createShop(state, 'GENERAL');
      saveState(state);
      return json({ run: publicRun(state.run) });
    }
    const runMatch = pathname.match(/^\/runs\/([^/]+)(.*)$/);
    if (!runMatch || !state.run || runMatch[1] !== state.run.id) return error('跑局不存在', 404);
    const run = state.run;
    const action = runMatch[2];

    if (action === '/shop/reroll' && method === 'POST') {
      if (run.gold < run.refreshCost) return error('金币不足');
      run.gold -= run.refreshCost;
      run.refreshCost += 1;
      run.shopItems = createShop(state, run.shopType || 'GENERAL');
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/shop/buy' && method === 'POST') {
      const offer = run.shopItems.find((entry) => entry.offerId === body.offerId);
      if (!offer) return error('商品不存在', 404);
      if (run.gold < offer.price) return error('金币不足');
      const offerQuality = normalizeQuality(offer.quality);
      const upgradeTarget = run.items.find((entry) => entry.defId === offer.defId && normalizeQuality(entry.quality) === offerQuality && nextQuality(entry.quality));
      if (upgradeTarget) {
        upgradeTarget.quality = nextQuality(upgradeTarget.quality);
        run.gold -= offer.price;
        run.shopItems = run.shopItems.filter((entry) => entry.offerId !== offer.offerId);
        saveState(state);
        return json({ run: publicRun(run) });
      }
      const slot = findSlot(run.items, offer.defId, body.area || 'BAG');
      if (!slot) return error('目标区域空间不足');
      run.gold -= offer.price;
      run.shopItems = run.shopItems.filter((entry) => entry.offerId !== offer.offerId);
      run.items.push({ id: id(state, 'item'), defId: offer.defId, quality: offerQuality, area: body.area || 'BAG', ...slot });
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/shop/sell' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      if (!item) return error('道具不存在', 404);
      const def = defs[item.defId] || defs['starter-1'];
      run.items = run.items.filter((entry) => entry.id !== item.id);
      run.gold += def.tags.includes('starter') ? 1 : Math.max(1, Math.floor(def.price / 2));
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/items/move' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      if (!item) return error('道具不存在', 404);
      const candidate = { ...item, area: body.area, x: Number(body.x), y: Number(body.y) };
      if (!canPlace(run.items, candidate)) return error('目标位置不可放置');
      Object.assign(item, candidate);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/items/upgrade' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      const target = body.targetItemId ? run.items.find((entry) => entry.id === body.targetItemId) : item;
      const consumed = body.targetItemId
        ? item
        : run.items.find((entry) => entry.id !== item?.id && entry.defId === item?.defId && entry.quality === item?.quality);
      if (!item || !target || !consumed || item.defId !== target.defId || item.quality !== target.quality) return error('需要两个完全相同品质的道具');
      const nextQuality = qualities[qualities.indexOf(target.quality) + 1];
      if (!nextQuality) return error('钻石品质已满级');
      target.quality = nextQuality;
      run.items = run.items.filter((entry) => entry.id !== consumed.id);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/choice/select' && method === 'POST') {
      const shopType = shopTypes.includes(body.shopType) ? body.shopType : 'GENERAL';
      run.phase = 'SHOP';
      run.shopType = shopType;
      run.choices = [];
      run.shopItems = createShop(state, shopType);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/battle/match' && method === 'POST') {
      run.phase = 'MATCH';
      run.matchedGhost = createGhost(run);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/battle/start' && method === 'POST') {
      if (run.phase !== 'MATCH') return error('请先匹配对手');
      const battle = simulateBattle(run, user);
      run.phase = 'BATTLE';
      run.lastBattle = battle;
      saveState(state);
      return json({ run: publicRun(state.run), battle });
    }
    if (action === '/battle/finish' && method === 'POST') {
      if (run.phase !== 'BATTLE' || !run.lastBattle) return error('当前没有待结算战斗');
      finishBattle(state, run.lastBattle);
      saveState(state);
      return json({ run: publicRun(state.run) });
    }
    return error('离线单文件版本暂不支持该操作', 404);
  }

  window.fetch = async (input, options = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    try {
      const resolved = new URL(rawUrl, window.location.href);
      if (rawUrl?.startsWith('/api') || resolved.pathname.startsWith('/api')) {
        const pathname = rawUrl.startsWith('/api') ? rawUrl.slice(4) || '/' : resolved.pathname.slice(4) || '/';
        return handleApi(pathname, options);
      }
    } catch {
      if (typeof rawUrl === 'string' && rawUrl.startsWith('/api')) {
        return handleApi(rawUrl.slice(4) || '/', options);
      }
    }
    return originalFetch(input, options);
  };
})();
`.replace('__DOGFIGHT_BUILD_ID__', buildId)
}

async function loadStandaloneGameData() {
  const dataModule = await import(pathToFileURL(path.resolve('src/server/game/data.ts')).href)
  return {
    itemDefs: dataModule.ITEM_DEFS,
    classRewardDefs: dataModule.CLASS_REWARD_DEFS,
    relicDefs: dataModule.RELIC_DEFS,
  }
}

function jsValue(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

async function currentMockApiScript(buildId) {
  const gameData = await loadStandaloneGameData()
  return String.raw`
(() => {
  window.__DOGFIGHT_STANDALONE__ = true;
  const buildId = ${JSON.stringify(buildId)};
  window.__DOGFIGHT_STANDALONE_BUILD_ID__ = buildId;
  const storageKey = 'dogfight:standalone-state:' + buildId;
  const gameData = ${jsValue(gameData)};
  const itemDefs = gameData.itemDefs;
  const classRewardDefs = gameData.classRewardDefs;
  const relicDefs = gameData.relicDefs;
  const allItemDefs = [...itemDefs, ...classRewardDefs];
  const defs = Object.fromEntries(allItemDefs.map((def) => [def.id, def]));
  const relicDefsById = Object.fromEntries(relicDefs.map((def) => [def.id, def]));
  const qualities = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
  const shopTypes = ['GENERAL', 'LARGE', 'MEDIUM', 'SMALL', 'SMALL_DICE', 'BIG_DICE'];
  const choiceTypes = [...shopTypes, 'RELIC'];
  const dogTypes = ['SHIBA', 'SAMOYED', 'MUTT', 'BULLY', 'EMPEROR'];
  const originalFetch = window.fetch.bind(window);
  const profiles = {
    SHIBA: { shopPreference: ['SMALL', 'SMALL_DICE', 'GENERAL'], itemTags: ['small', 'attack-speed', 'trigger', 'extra-roll', 'poison'], classRewards: ['shiba-shadow-clone', 'shiba-break', 'shiba-speed-katana', 'shiba-swallow-katana'], relics: ['midas-right', 'half-die-right'], keepStarterDice: [1, 2, 3], preferredDice: [1, 2, 3] },
    SAMOYED: { shopPreference: ['BIG_DICE', 'MEDIUM', 'GENERAL'], itemTags: ['big', 'heal', 'thorn', 'weak'], classRewards: ['samoyed-absolute-zero', 'samoyed-soft-fur', 'samoyed-avalanche-core', 'samoyed-frost-fur'], relics: ['midas-left', 'half-die-left'], keepStarterDice: [4, 5, 6], preferredDice: [4, 5, 6] },
    MUTT: { shopPreference: ['GENERAL', 'MEDIUM', 'SMALL'], itemTags: ['extra-roll', 'medium', 'late'], classRewards: ['mutt-eat-air', 'mutt-chase-tail', 'mutt-counting-collar', 'mutt-charged-collar'], relics: ['midas-left', 'midas-right'], keepStarterDice: [1, 3, 6], preferredDice: [1, 2, 3, 4, 5, 6] },
    BULLY: { shopPreference: ['LARGE', 'MEDIUM', 'BIG_DICE'], itemTags: ['large', 'big', 'medium'], classRewards: ['bully-sacrifice', 'bully-colossus', 'bully-gym', 'bully-vault'], relics: ['midas-left', 'half-die-left'], keepStarterDice: [4, 5], preferredDice: [4, 5, 6] },
    EMPEROR: { shopPreference: ['GENERAL', 'BIG_DICE', 'SMALL_DICE'], itemTags: ['lucky', 'big', 'small'], classRewards: ['emperor-curtain', 'emperor-edict', 'emperor-dice-cup', 'emperor-minister'], relics: ['midas-left', 'midas-right'], keepStarterDice: [1, 4, 6], preferredDice: [1, 2, 3, 4, 5, 6] },
  };

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || defaultState();
    } catch {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function defaultState() {
    return { user: null, run: null, nextId: 1 };
  }

  function id(state, prefix) {
    state.nextId += 1;
    return prefix + '-' + state.nextId;
  }

  function createRng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return () => {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
  }

  function normalizeQuality(quality) {
    return qualities.includes(quality) ? quality : 'BRONZE';
  }

  function nextQuality(quality) {
    return qualities[qualities.indexOf(normalizeQuality(quality)) + 1] || null;
  }

  function qualityAmount(amount, quality) {
    return Math.round(amount * Math.pow(1.5, qualities.indexOf(normalizeQuality(quality))));
  }

  function qualityMultiplier(quality) {
    return Math.pow(1.5, qualities.indexOf(normalizeQuality(quality)));
  }

  function relicQualityRatio(def, quality) {
    return qualityMultiplier(quality) / qualityMultiplier(def.defaultQuality);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function relicEffectScale(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? clamp(0.5 * relicQualityRatio(def, quality), 0.25, 1) : 1;
  }

  function relicRollBiasChance(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? clamp(0.3 * relicQualityRatio(def, quality), 0, 0.95) : 0;
  }

  function relicOpeningThorns(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? Math.max(1, Math.round(5 * relicQualityRatio(def, quality))) : 0;
  }

  function relicPoisonTickBonus(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? Math.max(1, Math.round(2 * relicQualityRatio(def, quality))) : 0;
  }

  function relicEmptyRollMisses(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? Math.max(1, Math.round(2 / relicQualityRatio(def, quality))) : 3;
  }

  function relicEquipmentEffectScale(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? clamp(0.85 * relicQualityRatio(def, quality), 0.5, 1) : 1;
  }

  function relicDescription(relicId, quality) {
    const def = relicDefsById[relicId];
    if (!def) return '';
    const retained = Math.round(relicEffectScale(relicId, quality) * 100);
    const rollBias = Math.round(relicRollBiasChance(relicId, quality) * 100);
    const effectReduction = 100 - retained;
    const extraEquipmentReduction = 100 - Math.round(relicEquipmentEffectScale(relicId, quality) * 100);
    const descriptions = {
      MIRROR_BIG_TO_SMALL: '你场上所有绑定在 4~6 点数的道具，现在在掷出对应减3的点数（即1~3）时也会触发，映射触发保留 ' + retained + '% 效果',
      MIRROR_SMALL_TO_BIG: '你场上所有绑定在 1~3 点数的道具，现在在掷出对应加3的点数（即4~6）时也会触发，映射触发保留 ' + retained + '% 效果',
      ONLY_BIG_HALF_EFFECT: '你只能掷出4~6的点数，但所有装备效果降低 ' + effectReduction + '%',
      ONLY_SMALL_HALF_EFFECT: '你只能掷出1~3的点数，但所有装备效果降低 ' + effectReduction + '%',
      EXTREME_ROLL_BIAS: '你的投掷结果出现【极值】（1和6）的概率绝对值提升 ' + rollBias + '%。',
      MIDDLE_ROLL_BIAS: '你的投掷结果出现 3 和 4 的概率绝对值提升 ' + rollBias + '%。',
      EMPTY_ROLL_LARGE_SAFETY: '当你连续 ' + relicEmptyRollMisses(relicId, quality) + ' 次投掷“空过”时，下一次投掷必定为你随机触发一件【大型物品】（若没有则触发中型）。',
      POISON_TICK_BONUS: '敌方身上的【中毒】状态每次结算时，额外造成 ' + relicPoisonTickBonus(relicId, quality) + ' 点伤害。',
      OPENING_THORNS: '战斗开始时，你直接获得 ' + relicOpeningThorns(relicId, quality) + ' 层【荆棘】。',
      HUSKY_ENGINE: def.description,
      EXTRA_EQUIPMENT_REDUCED_EFFECT: '你可以突破背包限制，将第 13 个装备放入战斗区，但你所有装备的触发效果降低 ' + extraEquipmentReduction + '%。',
    };
    return descriptions[def.effect] || def.description;
  }

  function relicDefForQuality(relicId, quality) {
    const def = relicDefsById[relicId];
    return def ? { ...def, description: relicDescription(relicId, quality) } : def;
  }

  function publicItem(item) {
    return { ...item, quality: normalizeQuality(item.quality), def: defs[item.defId] || defs['starter-1'] };
  }

  function normalizeRelics(relics) {
    return (relics || [])
      .filter((relic) => Boolean(relicDefsById[relic.relicId]))
      .map((relic, index) => ({ id: relic.id, relicId: relic.relicId, quality: normalizeQuality(relic.quality), slot: Number.isInteger(relic.slot) ? relic.slot : index }))
      .slice(0, 6);
  }

  function publicRelics(relics) {
    return normalizeRelics(relics).map((relic) => ({ ...relic, def: relicDefForQuality(relic.relicId, relic.quality) }));
  }

  function relicChoiceQuality(relics, relicId) {
    const existing = normalizeRelics(relics).find((relic) => relic.relicId === relicId);
    return existing ? nextQuality(existing.quality) || existing.quality : relicDefsById[relicId]?.defaultQuality || 'BRONZE';
  }

  function publicSnapshot(snapshot) {
    if (!snapshot) return null;
    return { ...snapshot, items: (snapshot.items || []).map(publicItem), relics: publicRelics(snapshot.relics || []) };
  }

  function publicBattle(battle) {
    if (!battle) return null;
    return { ...battle, playerSnapshot: publicSnapshot(battle.playerSnapshot), opponentSnapshot: publicSnapshot(battle.opponentSnapshot) };
  }

  function publicRun(run) {
    if (!run) return null;
    return {
      ...run,
      shopItems: (run.shopItems || []).map((offer) => ({ ...offer, quality: normalizeQuality(offer.quality), def: defs[offer.defId] || defs['starter-1'] })),
      classRewardChoices: (run.classRewardChoices || []).map((defId) => ({ defId, def: defs[defId], quality: normalizeQuality(defs[defId]?.defaultQuality) })),
      relicChoices: (run.relicChoices || []).map((relicId) => {
        const quality = relicChoiceQuality(run.relics || [], relicId);
        return { relicId, def: relicDefForQuality(relicId, quality), quality };
      }),
      relics: publicRelics(run.relics || []),
      matchedGhost: run.matchedGhost ? publicSnapshot(run.matchedGhost) : null,
      lastBattle: publicBattle(run.lastBattle),
      items: (run.items || []).map(publicItem),
    };
  }

  function shopPool(type) {
    return itemDefs.filter((def) => {
      if (def.tags.includes('starter')) return false;
      if (type === 'GENERAL') return true;
      if (type === 'LARGE') return def.size === 4;
      if (type === 'MEDIUM') return def.size === 2 || def.size === 3;
      if (type === 'SMALL') return def.size === 1;
      if (type === 'SMALL_DICE') return def.dice.some((n) => n <= 3);
      if (type === 'BIG_DICE') return def.dice.some((n) => n >= 4);
      return false;
    });
  }

  function createShop(state, type = 'GENERAL', seed = '') {
    const rng = createRng(seed || (state.nextId + '-' + type));
    const pool = shopPool(type);
    const offers = Array.from({ length: 5 }, () => {
      const def = pick(rng, pool);
      const discount = rng() < 0.2 ? pick(rng, [0.5, 0.6, 0.7, 0.8]) : 1;
      return { offerId: id(state, 'offer'), defId: def.id, price: Math.max(1, Math.floor(def.price * discount)), discount, quality: 'BRONZE' };
    });
    if (type === 'GENERAL' && offers.every((offer) => offer.price > 5)) {
      const affordable = [...pool].sort((a, b) => a.price - b.price)[0];
      offers[0] = { offerId: id(state, 'offer'), defId: affordable.id, price: affordable.price, discount: 1, quality: 'BRONZE' };
    }
    return offers;
  }

  function createChoices(seed, round = 0) {
    const rng = createRng(seed);
    const choices = [];
    while (choices.length < 3) {
      const next = pick(rng, shopTypes);
      if (!choices.includes(next)) choices.push(next);
    }
    if (round >= 4 && rng() < 0.33) choices[Math.floor(rng() * choices.length)] = 'RELIC';
    return choices;
  }

  function createRelicChoices(currentRelics, seed) {
    const rng = createRng(seed);
    const normalized = normalizeRelics(currentRelics);
    const hasOpenSlot = normalized.length < 6;
    const currentById = new Map(normalized.map((relic) => [relic.relicId, relic]));
    const pool = relicDefs.filter((relic) => {
      const owned = currentById.get(relic.id);
      if (owned?.quality === 'DIAMOND') return false;
      return hasOpenSlot || Boolean(owned);
    });
    const choices = [];
    while (choices.length < 3 && choices.length < pool.length) {
      const next = pick(rng, pool);
      if (!choices.includes(next.id)) choices.push(next.id);
    }
    return choices;
  }

  function applyRelicChoice(currentRelics, relicId, state) {
    const def = relicDefsById[relicId];
    const relics = normalizeRelics(currentRelics);
    if (!def) return relics;
    const existing = relics.find((relic) => relic.relicId === relicId);
    if (existing) {
      const quality = nextQuality(existing.quality);
      return quality ? relics.map((relic) => relic.id === existing.id ? { ...relic, quality } : relic) : relics;
    }
    if (relics.length >= 6) return relics;
    return [...relics, { id: id(state, 'relic'), relicId, quality: def.defaultQuality, slot: relics.length }];
  }

  function initialItems(state) {
    return [1, 2, 3, 4, 5, 6].map((n, index) => ({ id: id(state, 'item'), defId: 'starter-' + n, quality: 'BRONZE', area: 'EQUIPMENT', x: index, y: 0 }));
  }

  function canPlace(items, moving, area = moving.area, x = moving.x, y = moving.y) {
    const def = defs[moving.defId];
    if (!def || def.height !== 1) return false;
    if (x < 0 || y < 0 || x + def.width > 12 || y + 1 > 1) return false;
    const occupied = new Set();
    for (const item of items) {
      if (item.id === moving.id || item.area !== area) continue;
      const other = defs[item.defId] || defs['starter-1'];
      for (let ox = item.x; ox < item.x + other.width; ox += 1) occupied.add(ox + ',' + item.y);
    }
    for (let cx = x; cx < x + def.width; cx += 1) {
      if (occupied.has(cx + ',' + y)) return false;
    }
    return true;
  }

  function findSlot(items, defId, area) {
    const def = defs[defId] || defs['starter-1'];
    const probe = { id: '__new__', defId, quality: 'BRONZE', area, x: 0, y: 0 };
    for (let x = 0; x <= 12 - def.width; x += 1) {
      if (canPlace(items, probe, area, x, 0)) return { x, y: 0 };
    }
    return null;
  }

  function classRewardChoices(dogType, round) {
    return classRewardDefs.filter((item) => item.classDog === dogType && item.unlockRound === round).map((item) => item.id);
  }

  function dogTypeFor(input) {
    return input.dogType || dogTypes[(input.round + input.wins + input.losses) % dogTypes.length];
  }

  function upgradeQuality(base, steps) {
    let quality = normalizeQuality(base);
    for (let i = 0; i < steps; i += 1) {
      const next = nextQuality(quality);
      if (!next) break;
      quality = next;
    }
    return quality;
  }

  function scoreDef(def, profile, rng) {
    const tagScore = def.tags.reduce((score, tag) => score + (profile.itemTags.includes(tag) ? 12 : 0), 0);
    const diceScore = def.dice.reduce((score, die) => score + (profile.preferredDice.includes(die) ? 3 : 0), 0);
    const classScore = def.kind === 'CLASS_EQUIPMENT' ? 50 : 0;
    return classScore + tagScore + diceScore + def.size * 2 + rng();
  }

  function uniqueById(items) {
    const seen = new Set();
    return items.filter((item) => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function starterDefs(profile, round) {
    const dice = round <= 1 ? profile.keepStarterDice.slice(0, 3) : profile.keepStarterDice.slice(0, 2);
    return dice.map((n) => defs['starter-' + n]).filter(Boolean);
  }

  function offlineClassRewardDefs(dogType, profile, round) {
    if (round < 3) return [];
    const unlocked = classRewardDefs.filter((def) => def.classDog === dogType && def.unlockRound && def.unlockRound <= round);
    const byRound = new Map();
    for (const def of unlocked) byRound.set(def.unlockRound, [...(byRound.get(def.unlockRound) || []), def]);
    return [...byRound.entries()].sort(([a], [b]) => a - b).map(([, candidates]) => candidates.sort((a, b) => {
      const preferredA = profile.classRewards.indexOf(a.id);
      const preferredB = profile.classRewards.indexOf(b.id);
      return (preferredA === -1 ? 99 : preferredA) - (preferredB === -1 ? 99 : preferredB);
    })[0]);
  }

  function offlineShopDefs(profile, round) {
    const pools = profile.shopPreference.flatMap((shopType) => shopPool(shopType));
    return uniqueById(pools).slice(0, Math.max(2, round + 1));
  }

  function qualityFor(def, input) {
    const base = normalizeQuality(def.defaultQuality);
    if (def.kind === 'CLASS_EQUIPMENT') return base;
    if (input.round <= 1) return def.tags.includes('starter') ? 'BRONZE' : 'SILVER';
    const strength = input.round + input.wins - input.losses;
    return upgradeQuality(base, Math.max(0, Math.floor((strength - 5) / 4)));
  }

  function placeEquipment(candidates, input, rng, profile) {
    const scored = uniqueById(candidates).map((def) => ({ def, score: scoreDef(def, profile, rng) })).sort((a, b) => b.score - a.score);
    const items = [];
    for (const { def } of scored) {
      const item = { id: 'offline-' + items.length + '-' + def.id, defId: def.id, quality: qualityFor(def, input), area: 'EQUIPMENT', x: 0, y: 0 };
      for (let x = 0; x <= 12 - def.width; x += 1) {
        if (canPlace(items, item, 'EQUIPMENT', x, 0)) {
          items.push({ ...item, x, y: 0 });
          break;
        }
      }
    }
    return items;
  }

  function buildOfflineRelics(profile, input, rng) {
    if (input.round < 4) return [];
    const count = input.round >= 7 || input.wins >= 6 ? 2 : 1;
    const preferred = profile.relics.map((id) => relicDefsById[id]).filter((def) => def && def.unlockRound <= input.round);
    const fallback = relicDefs.filter((def) => def.unlockRound <= input.round);
    const pool = uniqueById([...preferred, ...fallback]);
    const rank = (id) => {
      const index = profile.relics.indexOf(id);
      return index === -1 ? 99 : index;
    };
    const relics = [];
    for (const def of pool.sort((a, b) => (rank(a.id) - rank(b.id)) || rng() - 0.5)) {
      if (relics.length >= count) break;
      relics.push({ id: 'offline-relic-' + relics.length + '-' + def.id, relicId: def.id, quality: def.defaultQuality, slot: relics.length });
    }
    return relics;
  }

  function buildOfflineFighter(input) {
    const dogType = dogTypeFor(input);
    const profile = profiles[dogType];
    const rng = createRng(input.seed || ('offline-' + dogType + '-' + input.round + '-' + input.wins + '-' + input.losses));
    const luckyNumber = dogType === 'EMPEROR' ? Math.floor(rng() * 6) + 1 : null;
    const candidates = [...starterDefs(profile, input.round), ...offlineClassRewardDefs(dogType, profile, input.round), ...offlineShopDefs(profile, input.round)];
    return { name: '种子狗狗 R' + input.round, dogType, luckyNumber, wins: input.wins, losses: input.losses, round: input.round, items: placeEquipment(candidates, input, rng, profile), relics: buildOfflineRelics(profile, input, rng) };
  }

  function createGhost(run) {
    return buildOfflineFighter({ round: run.round, wins: run.wins, losses: run.losses });
  }

  function snapshot(name, runOrGhost) {
    return {
      name,
      dogType: runOrGhost.dogType,
      luckyNumber: runOrGhost.luckyNumber || null,
      wins: runOrGhost.wins,
      losses: runOrGhost.losses,
      round: runOrGhost.round,
      items: (runOrGhost.items || []).map((item) => ({ id: item.id, defId: item.defId, quality: normalizeQuality(item.quality), area: item.area, x: item.x, y: item.y })),
      relics: normalizeRelics(runOrGhost.relics || []),
    };
  }

  function simulateBattle(run, user) {
    const opponent = run.matchedGhost || createGhost(run);
    let playerHp = 100;
    let opponentHp = 100;
    const events = [];
    let time = 0;
    const push = (event) => events.push({ ...event, time: Number(time.toFixed(1)), playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp) });
    const sides = [{ actor: 'player', fighter: run }, { actor: 'opponent', fighter: opponent }];
    push({ actor: 'system', kind: 'ROLL', target: 'none', text: '战斗开始，双方自动掷骰。' });
    for (let round = 0; round < 10 && playerHp > 0 && opponentHp > 0; round += 1) {
      for (const side of sides) {
        if (playerHp <= 0 || opponentHp <= 0) break;
        const roll = ((round + (side.actor === 'player' ? run.id.length : 3)) % 6) + 1;
        time += 0.8;
        push({ actor: side.actor, kind: 'ROLL', effectType: 'ROLL', target: 'none', roll, text: (side.actor === 'player' ? '玩家' : '对手') + '掷出 ' + roll + ' 点。' });
        const equipped = (side.fighter.items || []).filter((item) => item.area === 'EQUIPMENT').sort((a, b) => a.x - b.x);
        for (const item of equipped) {
          const def = defs[item.defId];
          if (!def || !def.dice.includes(roll)) continue;
          const amount = qualityAmount(def.effect?.amount || 0, item.quality);
          time += 0.25;
          if (def.effect?.type === 'HEAL') {
            if (side.actor === 'player') playerHp = Math.min(100, playerHp + amount);
            else opponentHp = Math.min(100, opponentHp + amount);
            push({ actor: side.actor, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'HEAL', amount, target: side.actor, text: def.name + ' 回复 ' + amount + ' 生命。' });
          } else if (side.actor === 'player') {
            opponentHp -= amount;
            push({ actor: 'player', kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'DAMAGE', amount, target: 'opponent', text: def.name + ' 造成 ' + amount + ' 点伤害。' });
          } else {
            playerHp -= amount;
            push({ actor: 'opponent', kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'DAMAGE', amount, target: 'player', text: def.name + ' 造成 ' + amount + ' 点伤害。' });
          }
          if (playerHp <= 0 || opponentHp <= 0) break;
        }
      }
    }
    const winner = playerHp >= opponentHp ? 'player' : 'opponent';
    time += 0.5;
    push({ actor: 'system', kind: 'END', target: 'none', text: winner === 'player' ? '你赢下了这一局。' : '对手赢下了这一局。' });
    return { winner, duration: Number(time.toFixed(1)), playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp), events, playerSnapshot: snapshot(user.nickname || '本地玩家', run), opponentSnapshot: snapshot(opponent.name, opponent) };
  }

  function simulateBattleV3(run, user) {
    const opponent = run.matchedGhost || createGhost(run);
    let playerHp = 100;
    let opponentHp = 100;
    const state = {
      player: { shield: 0, poison: 0, weak: 0, thorns: 0, disabledItemIds: [] },
      opponent: { shield: 0, poison: 0, weak: 0, thorns: 0, disabledItemIds: [] },
    };
    const events = [];
    let time = 0;
    const push = (event) => events.push({ ...event, time: Number(time.toFixed(1)), playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp) });
    const hpOf = (side) => side === 'player' ? playerHp : opponentHp;
    const setHp = (side, hp) => {
      if (side === 'player') playerHp = hp;
      else opponentHp = hp;
    };
    const opponentOf = (side) => side === 'player' ? 'opponent' : 'player';
    const fighterOf = (side) => side === 'player' ? run : opponent;
    const equippedOf = (fighter) => (fighter.items || []).filter((item) => item.area === 'EQUIPMENT').sort((a, b) => a.x - b.x);
    const relicWithEffect = (fighter, effect) => normalizeRelics(fighter.relics || []).find((relic) => relicDefsById[relic.relicId]?.effect === effect) || null;
    const hasRelicEffect = (fighter, effect) => Boolean(relicWithEffect(fighter, effect));
    const hasShieldImmunity = (side) => state[side].shield > 0 && equippedOf(fighterOf(side)).some((item) => defs[item.defId]?.advancedEffect === 'SHIELD_IMMUNITY');
    const applyDamage = (side, amount, shieldDamage = amount) => {
      const before = hpOf(side);
      const shieldBefore = state[side].shield;
      const shieldUsed = Math.min(shieldBefore, shieldDamage);
      state[side].shield -= shieldUsed;
      const absorbed = shieldBefore > 0 ? Math.min(amount, shieldUsed) : 0;
      const after = Math.max(0, before - (amount - absorbed));
      setHp(side, after);
      return { before, after, delta: after - before };
    };
    const applyDirectHealthDamage = (side, amount) => {
      const before = hpOf(side);
      const after = Math.max(0, before - amount);
      setHp(side, after);
      return { before, after, delta: after - before };
    };
    const addPoison = (side, amount) => {
      if (hasShieldImmunity(side)) return false;
      state[side].poison += amount;
      return true;
    };
    const addWeak = (side, amount) => {
      if (hasShieldImmunity(side)) return false;
      state[side].weak += amount;
      return true;
    };
    const playerOpeningThorns = relicWithEffect(run, 'OPENING_THORNS');
    const opponentOpeningThorns = relicWithEffect(opponent, 'OPENING_THORNS');
    if (playerOpeningThorns) state.player.thorns += relicOpeningThorns(playerOpeningThorns.relicId, playerOpeningThorns.quality);
    if (opponentOpeningThorns) state.opponent.thorns += relicOpeningThorns(opponentOpeningThorns.relicId, opponentOpeningThorns.quality);
    push({ actor: 'system', kind: 'ROLL', target: 'none', text: '战斗开始，双方自动掷骰。' });
    for (let round = 0; round < 10 && playerHp > 0 && opponentHp > 0; round += 1) {
      for (const side of ['player', 'opponent']) {
        if (playerHp <= 0 || opponentHp <= 0) break;
        const fighter = fighterOf(side);
        const roll = ((round + (side === 'player' ? run.id.length : 3)) % 6) + 1;
        time += 0.8;
        push({ actor: side, kind: 'ROLL', effectType: 'ROLL', target: 'none', roll, text: (side === 'player' ? '玩家' : '对手') + '掷出 ' + roll + ' 点。' });
        for (const item of equippedOf(fighter)) {
          const def = defs[item.defId];
          if (!def || !def.dice.includes(roll)) continue;
          if (state[side].disabledItemIds.includes(item.id)) {
            state[side].disabledItemIds = state[side].disabledItemIds.filter((id) => id !== item.id);
            push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'UTILITY', amount: 0, target: 'none', text: def.name + ' 被【失效】抵消。' });
            continue;
          }
          const target = opponentOf(side);
          const advanced = def.advancedEffect || 'NONE';
          const amount = qualityAmount(def.effect?.amount || 0, item.quality);
          time += 0.25;
          if (def.effect?.type === 'HEAL') {
            setHp(side, Math.min(100, hpOf(side) + amount));
            if (advanced === 'CLEANSE_ONE') {
              if (state[side].poison > 0) state[side].poison -= 1;
              else if (state[side].weak > 0) state[side].weak -= 1;
            }
            push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'HEAL', amount, target: side, text: def.name + ' 回复 ' + amount + ' 生命。' });
          } else if (advanced === 'GAIN_SHIELD' || advanced === 'SHIELD_IMMUNITY') {
            state[side].shield += amount;
            push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'UTILITY', amount, target: side, text: def.name + ' 获得 ' + amount + ' 点护盾。' });
          } else if (advanced === 'GAIN_SHIELD_THORNS') {
            state[side].shield += amount;
            state[side].thorns += qualityAmount(1, item.quality);
            push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'UTILITY', amount, target: side, text: def.name + ' 获得护盾与荆棘。' });
          } else if (advanced === 'POISON_ON_ROLL') {
            const poisonAmount = qualityAmount(3, item.quality);
            if (addPoison(target, poisonAmount)) push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'POISON', amount: poisonAmount, target, text: def.name + ' 叠加 ' + poisonAmount + ' 层【中毒】。' });
          } else if (advanced === 'APPLY_POISON' || advanced === 'POISON_AND_DISABLE_RIGHTMOST') {
            if (addPoison(target, amount)) push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'POISON', amount, target, text: def.name + ' 叠加 ' + amount + ' 层【中毒】。' });
            if (advanced === 'POISON_AND_DISABLE_RIGHTMOST') {
              const rightmost = equippedOf(fighterOf(target)).at(-1);
              if (rightmost) state[target].disabledItemIds.push(rightmost.id);
            }
          } else {
            const result = applyDamage(target, amount, advanced === 'DOUBLE_SHIELD_DAMAGE' ? amount * 2 : amount);
            if (advanced === 'APPLY_WEAK_ON_HIT') addWeak(target, qualityAmount(1, item.quality));
            if (advanced === 'LIFESTEAL') setHp(side, Math.min(100, hpOf(side) + Math.max(0, -result.delta)));
            push({ actor: side, kind: 'ITEM', itemId: item.id, defId: item.defId, effectType: 'DAMAGE', amount: Math.max(0, -result.delta), target, text: def.name + ' 造成 ' + Math.max(0, -result.delta) + ' 点伤害。' });
          }
          if (playerHp <= 0 || opponentHp <= 0) break;
        }
      }
      for (const side of ['player', 'opponent']) {
        if (state[side].poison <= 0) continue;
        const source = side === 'player' ? opponent : run;
        const poisonBonusRelic = relicWithEffect(source, 'POISON_TICK_BONUS');
        const damage = state[side].poison + (poisonBonusRelic ? relicPoisonTickBonus(poisonBonusRelic.relicId, poisonBonusRelic.quality) : 0);
        const result = applyDirectHealthDamage(side, damage);
        push({ actor: 'system', kind: 'POISON', effectType: 'POISON', amount: damage, target: side, text: '【中毒】结算，' + (side === 'player' ? '玩家' : '对手') + '受到 ' + Math.max(0, -result.delta) + ' 点伤害。' });
      }
    }
    const winner = playerHp >= opponentHp ? 'player' : 'opponent';
    time += 0.5;
    push({ actor: 'system', kind: 'END', target: 'none', text: winner === 'player' ? '你赢下了这一局。' : '对手赢下了这一局。' });
    return { winner, duration: Number(time.toFixed(1)), playerHp: Math.max(0, playerHp), opponentHp: Math.max(0, opponentHp), events, playerSnapshot: snapshot(user.nickname || '本地玩家', run), opponentSnapshot: snapshot(opponent.name, opponent) };
  }

  function finishBattle(state, battle) {
    const run = state.run;
    const playerWon = battle.winner === 'player';
    run.wins += playerWon ? 1 : 0;
    run.losses += playerWon ? 0 : 1;
    run.round += 1;
    run.gold += 5 + run.round * 2;
    run.matchedGhost = null;
    run.lastBattle = battle;
    run.status = run.wins >= 12 || run.losses >= 3 ? 'COMPLETE' : 'ACTIVE';
    const nextClassRewards = classRewardChoices(run.dogType, run.round);
    run.phase = run.status === 'COMPLETE' ? 'COMPLETE' : nextClassRewards.length > 0 ? 'CLASS_REWARD' : run.round <= 2 ? 'SHOP' : 'CHOICE';
    run.refreshCost = 1;
    run.classRewardChoices = run.phase === 'CLASS_REWARD' ? nextClassRewards : [];
    run.relicChoices = [];
    if (run.phase === 'SHOP') {
      run.shopType = 'GENERAL';
      run.choices = [];
      run.shopItems = createShop(state, 'GENERAL', run.id + '-round-' + run.round);
    } else if (run.phase === 'CHOICE') {
      run.choices = createChoices(run.id + '-choices-' + run.round, run.round);
      run.shopItems = [];
    } else {
      run.shopItems = [];
      run.choices = [];
    }
  }

  async function parseBody(options) {
    if (!options?.body) return {};
    if (typeof options.body === 'string') return JSON.parse(options.body || '{}');
    return {};
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  function error(message, status = 400) {
    return json({ error: message }, status);
  }

  async function handleApi(pathname, options) {
    const state = loadState();
    const method = (options?.method || 'GET').toUpperCase();
    const body = await parseBody(options);
    const user = state.user;

    if (pathname === '/health') return json({ ok: true });
    if (pathname === '/me') return user ? json({ user, activeRun: publicRun(state.run) }) : error('未登录', 401);
    if (pathname === '/auth/logout' && method === 'POST') {
      state.user = null;
      state.run = null;
      saveState(state);
      return json({ ok: true });
    }
    if ((pathname === '/auth/login' || pathname === '/auth/register') && method === 'POST') {
      state.user = { id: 'local-user', email: body.email || 'player@dogdice.test', nickname: pathname.endsWith('register') ? null : '本地玩家' };
      saveState(state);
      return json(pathname.endsWith('register') ? { user: state.user, needsNickname: true } : { user: state.user, activeRun: publicRun(state.run) });
    }
    if (!user) return error('未登录', 401);
    if (pathname === '/profile/nickname' && method === 'POST') {
      const nickname = String(body.nickname || '').trim();
      if (nickname.length < 2 || nickname.length > 16) return error('昵称需要 2-16 个字符');
      state.user.nickname = nickname;
      saveState(state);
      return json({ user: state.user });
    }
    if (pathname === '/runs' && method === 'POST') {
      const dogType = dogTypes.includes(body.dogType) ? body.dogType : 'SHIBA';
      state.run = { id: id(state, 'run'), dogType, luckyNumber: dogType === 'EMPEROR' ? Number(body.luckyNumber || 1) : null, wins: 0, losses: 0, round: 0, gold: 10, phase: 'SHOP', status: 'ACTIVE', shopType: 'GENERAL', shopItems: [], choices: [], classRewardChoices: [], relicChoices: [], relics: [], refreshCost: 1, matchedGhost: null, lastBattle: null, items: initialItems(state) };
      state.run.shopItems = createShop(state, 'GENERAL', state.run.id + '-new-shop');
      saveState(state);
      return json({ run: publicRun(state.run) });
    }
    const runMatch = pathname.match(/^\/runs\/([^/]+)(.*)$/);
    if (!runMatch || !state.run || runMatch[1] !== state.run.id) return error('跑局不存在', 404);
    const run = state.run;
    const action = runMatch[2];

    if (action === '/shop/reroll' && method === 'POST') {
      if (run.gold < run.refreshCost) return error('金币不足');
      run.gold -= run.refreshCost;
      run.refreshCost += 1;
      run.shopItems = createShop(state, run.shopType || 'GENERAL', run.id + '-' + run.round + '-' + run.refreshCost);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/shop/buy' && method === 'POST') {
      const offer = run.shopItems.find((entry) => entry.offerId === body.offerId);
      const offerQuality = offer ? normalizeQuality(offer.quality) : 'BRONZE';
      if (offer && run.gold >= offer.price) {
        const upgradeTarget = run.items.find((entry) => entry.defId === offer.defId && normalizeQuality(entry.quality) === offerQuality && nextQuality(entry.quality));
        if (upgradeTarget) {
          upgradeTarget.quality = nextQuality(upgradeTarget.quality);
          run.gold -= offer.price;
          run.shopItems = run.shopItems.filter((entry) => entry.offerId !== offer.offerId);
          saveState(state);
          return json({ run: publicRun(run) });
        }
      }
      if (!offer) return error('商品不存在', 404);
      if (run.gold < offer.price) return error('金币不足');
      const slot = findSlot(run.items, offer.defId, body.area || 'BAG');
      if (!slot) return error('目标区域空间不足');
      run.gold -= offer.price;
      run.shopItems = run.shopItems.filter((entry) => entry.offerId !== offer.offerId);
      run.items.push({ id: id(state, 'item'), defId: offer.defId, quality: offerQuality, area: body.area || 'BAG', ...slot });
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/shop/sell' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      if (!item) return error('道具不存在', 404);
      const def = defs[item.defId] || defs['starter-1'];
      run.items = run.items.filter((entry) => entry.id !== item.id);
      run.gold += def.tags.includes('starter') ? 1 : Math.max(1, Math.floor(def.price / 2));
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/items/move' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      if (!item) return error('道具不存在', 404);
      const candidate = { ...item, area: body.area, x: Number(body.x), y: Number(body.y) };
      if (!canPlace(run.items, candidate, candidate.area, candidate.x, candidate.y)) return error('目标位置不可放置');
      Object.assign(item, candidate);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/items/upgrade' && method === 'POST') {
      const item = run.items.find((entry) => entry.id === body.itemId);
      const target = body.targetItemId ? run.items.find((entry) => entry.id === body.targetItemId) : item;
      const consumed = body.targetItemId ? item : run.items.find((entry) => entry.id !== item?.id && entry.defId === item?.defId && normalizeQuality(entry.quality) === normalizeQuality(item?.quality));
      if (!item || !target || !consumed || item.defId !== target.defId || normalizeQuality(item.quality) !== normalizeQuality(target.quality)) return error('需要两个完全相同品质的道具');
      const quality = nextQuality(target.quality);
      if (!quality) return error('钻石品质已满级');
      target.quality = quality;
      run.items = run.items.filter((entry) => entry.id !== consumed.id);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/choice/select' && method === 'POST') {
      if (run.phase !== 'CHOICE') return error('当前不在三选一');
      const shopType = choiceTypes.includes(body.shopType) ? body.shopType : 'GENERAL';
      if (!run.choices.includes(shopType)) return error('无效选择');
      if (shopType === 'RELIC') {
        run.phase = 'RELIC_CHOICE';
        run.shopType = 'RELIC';
        run.choices = [];
        run.shopItems = [];
        run.relicChoices = createRelicChoices(run.relics || [], run.id + '-relic-' + run.round + '-' + state.nextId);
        saveState(state);
        return json({ run: publicRun(run) });
      }
      run.phase = 'SHOP';
      run.shopType = shopType;
      run.refreshCost = 1;
      run.choices = [];
      run.shopItems = createShop(state, shopType, run.id + '-choice-' + shopType);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/class-reward/select' && method === 'POST') {
      if (run.phase !== 'CLASS_REWARD') return error('当前不在职业奖励');
      if (!run.classRewardChoices.includes(body.defId)) return error('无效职业装备');
      const def = defs[body.defId];
      const slot = findSlot(run.items, body.defId, 'BAG');
      if (!def || !slot) return error('背包空间不足');
      run.items.push({ id: id(state, 'item'), defId: body.defId, quality: normalizeQuality(def.defaultQuality), area: 'BAG', ...slot });
      run.phase = 'CHOICE';
      run.classRewardChoices = [];
      run.choices = createChoices(run.id + '-choices-' + run.round, run.round);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/relic/select' && method === 'POST') {
      if (run.phase !== 'RELIC_CHOICE') return error('当前不在遗物选择');
      if (!run.relicChoices.includes(body.relicId)) return error('无效遗物');
      run.relics = applyRelicChoice(run.relics || [], body.relicId, state);
      run.relicChoices = [];
      run.phase = 'PREP';
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/battle/match' && method === 'POST') {
      run.phase = 'MATCH';
      run.matchedGhost = createGhost(run);
      saveState(state);
      return json({ run: publicRun(run) });
    }
    if (action === '/battle/start' && method === 'POST') {
      if (run.phase !== 'MATCH') return error('请先匹配对手');
      const battle = simulateBattleV3(run, user);
      run.phase = 'BATTLE';
      run.lastBattle = battle;
      saveState(state);
      return json({ run: publicRun(state.run), battle: publicBattle(battle) });
    }
    if (action === '/battle/finish' && method === 'POST') {
      if (run.phase !== 'BATTLE' || !run.lastBattle) return error('当前没有待结算战斗');
      finishBattle(state, run.lastBattle);
      saveState(state);
      return json({ run: publicRun(state.run) });
    }
    return error('离线单文件版本暂不支持该操作', 404);
  }

  window.fetch = async (input, options = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    try {
      const resolved = new URL(rawUrl, window.location.href);
      if (rawUrl?.startsWith('/api') || resolved.pathname.startsWith('/api')) {
        const pathname = rawUrl.startsWith('/api') ? rawUrl.slice(4) || '/' : resolved.pathname.slice(4) || '/';
        return handleApi(pathname, options);
      }
    } catch {
      if (typeof rawUrl === 'string' && rawUrl.startsWith('/api')) return handleApi(rawUrl.slice(4) || '/', options);
    }
    return originalFetch(input, options);
  };
})();
`
}

export async function buildStandaloneIndex({
  distDir = defaultDistDir,
  outputFile = defaultOutputFile,
  launcherFile = defaultLauncherFile,
  mockApiScript,
} = {}) {
  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8')
  const assetMap = await createAssetMap(distDir)
  const cssRefs = findAssetRefs(indexHtml, 'link', 'href').filter((ref) => ref.endsWith('.css'))
  const jsRefs = findAssetRefs(indexHtml, 'script', 'src').filter((ref) => ref.endsWith('.js'))
  const iconRef = findAssetRefs(indexHtml, 'link', 'href').find((ref) => /\.(png|svg|ico)$/i.test(ref))
  const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const resolvedMockApiScript = mockApiScript ?? await defaultMockApiScript(buildId)

  const styles = []
  for (const ref of cssRefs) {
    const cssPath = path.join(distDir, ref.replace(/^\/+/, ''))
    styles.push(replaceAssetUrls(await readFile(cssPath, 'utf8'), assetMap))
  }

  const scripts = []
  for (const ref of jsRefs) {
    const jsPath = path.join(distDir, ref.replace(/^\/+/, ''))
    scripts.push(replaceAssetUrls(await readFile(jsPath, 'utf8'), assetMap))
  }

  const iconData = iconRef ? assetMap.get(iconRef) : ''
  const html = [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    iconData ? `    <link rel="icon" href="${iconData}" />` : '',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${titleFrom(indexHtml)}</title>`,
    `    <style>${styles.join('\n')}</style>`,
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    `    <script>${escapeScript(resolvedMockApiScript)}</script>`,
    `    <script type="module">${escapeScript(scripts.join('\n'))}</script>`,
    '  </body>',
    '</html>',
    '',
  ].filter(Boolean).join('\n')

  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, html, 'utf8')
  await mkdir(path.dirname(launcherFile), { recursive: true })
  const launcher = createLauncher(html)
  await writeFile(launcherFile, launcher, 'utf8')
  return {
    outputFile,
    launcherFile,
    bytes: Buffer.byteLength(html),
    launcherBytes: Buffer.byteLength(launcher),
  }
}

if (import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href && process.argv[1]) {
  const currentFile = fileURLToPath(import.meta.url)
  if (path.resolve(process.argv[1]) === currentFile) {
    const result = await buildStandaloneIndex()
    console.log(`Wrote ${result.outputFile} (${result.bytes} bytes)`)
    console.log(`Wrote ${result.launcherFile} (${result.launcherBytes} bytes)`)
  }
}
