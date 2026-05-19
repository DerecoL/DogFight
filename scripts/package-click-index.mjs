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
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$self=$env:DOGFIGHT_SELF; $out=$env:DOGFIGHT_OUTPUT; $marker=\'__DOGFIGHT_HTML_PAYLOAD_BELOW__\'; $text=[IO.File]::ReadAllText($self,[Text.Encoding]::UTF8); $idx=$text.IndexOf($marker); if($idx -lt 0){ exit 1 }; $payload=$text.Substring($idx + $marker.Length).TrimStart([char]13,[char]10); $utf8=New-Object System.Text.UTF8Encoding($false); [IO.File]::WriteAllText($out,$payload,$utf8)"',
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

function defaultMockApiScript() {
  return String.raw`
(() => {
  window.__DOGFIGHT_STANDALONE__ = true;
  const storageKey = 'dogfight:standalone-state';
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
      const slot = findSlot(run.items, offer.defId, body.area || 'BAG');
      if (!slot) return error('目标区域空间不足');
      run.gold -= offer.price;
      run.shopItems = run.shopItems.filter((entry) => entry.offerId !== offer.offerId);
      run.items.push({ id: id(state, 'item'), defId: offer.defId, quality: offer.quality || 'BRONZE', area: body.area || 'BAG', ...slot });
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
      finishBattle(state, battle);
      saveState(state);
      return json({ run: publicRun(state.run), battle });
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
`
}

export async function buildStandaloneIndex({
  distDir = defaultDistDir,
  outputFile = defaultOutputFile,
  launcherFile = defaultLauncherFile,
  mockApiScript = defaultMockApiScript(),
} = {}) {
  const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8')
  const assetMap = await createAssetMap(distDir)
  const cssRefs = findAssetRefs(indexHtml, 'link', 'href').filter((ref) => ref.endsWith('.css'))
  const jsRefs = findAssetRefs(indexHtml, 'script', 'src').filter((ref) => ref.endsWith('.js'))
  const iconRef = findAssetRefs(indexHtml, 'link', 'href').find((ref) => /\.(png|svg|ico)$/i.test(ref))

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
    `    <script>${escapeScript(mockApiScript)}</script>`,
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
