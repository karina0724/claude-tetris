'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d'],
    mode: 'retro',
  },
  neon: {
    colors: ['#00e5ff', '#ffea00', '#e040fb', '#69f0ae', '#ff5252', '#448aff', '#ff9100'],
    mode: 'neon',
  },
  pastel: {
    colors: ['#a8dadc', '#ffe8a3', '#d8bfd8', '#b5e8b5', '#f4a8a8', '#b8d4f0', '#f5cba7'],
    mode: 'pastel',
  },
  pixel: {
    colors: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d'],
    mode: 'pixel',
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const MAX_START_LEVEL = 10;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const themeToggleBtn = document.getElementById('theme-toggle');

const startScreen = document.getElementById('start-screen');
const startScoreTable = document.getElementById('start-score-table');
const startStats = document.getElementById('start-stats');
const startLevelSelect = document.getElementById('start-level-select');
const skinSelect = document.getElementById('skin-select');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');

const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const viewControlsBtn = document.getElementById('view-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const pauseLevelSelect = document.getElementById('pause-level-select');

const gameOverEl = document.getElementById('game-over');
const overlayScore = document.getElementById('overlay-score');
const newRecordBox = document.getElementById('new-record-box');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const gameoverScoreTable = document.getElementById('gameover-score-table');
const gameoverStats = document.getElementById('gameover-stats');
const gameoverRestartBtn = document.getElementById('gameover-restart-btn');
const gameoverMenuBtn = document.getElementById('gameover-menu-btn');

const THEME_STORAGE_KEY = 'tetris-theme';
const SKIN_STORAGE_KEY = 'tetris-skin';
const START_LEVEL_STORAGE_KEY = 'tetris-start-level';
const SCORES_STORAGE_KEY = 'tetris-highscores';
const STATS_STORAGE_KEY = 'tetris-stats';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor = '#22222e';
let COLORS = null;
let skinMode = 'retro';
let started = false;
let menuOpen = true;
let combo = 0;
let startLevel = 1;
let bestCombo = 0;
let maxLines = 0;

function applyTheme(theme) {
  document.body.classList.toggle('light-mode', theme === 'light');
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  themeToggleBtn.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
}

function toggleTheme() {
  const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  applyTheme(newTheme);
}

function applySkin(name) {
  const skin = SKINS[name] ? name : 'retro';
  skinMode = SKINS[skin].mode;
  COLORS = [null, ...SKINS[skin].colors];
  document.body.dataset.skin = skin;
  skinSelect.value = skin;
}

function changeSkin() {
  const name = skinSelect.value;
  localStorage.setItem(SKIN_STORAGE_KEY, name);
  applySkin(name);
}

function populateLevelSelect(select) {
  for (let i = 1; i <= MAX_START_LEVEL; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = i;
    select.appendChild(opt);
  }
}

function loadStartLevel() {
  const v = parseInt(localStorage.getItem(START_LEVEL_STORAGE_KEY), 10);
  return Number.isInteger(v) && v >= 1 && v <= MAX_START_LEVEL ? v : 1;
}

function setStartLevel(value) {
  startLevel = value;
  localStorage.setItem(START_LEVEL_STORAGE_KEY, String(value));
  startLevelSelect.value = String(value);
  pauseLevelSelect.value = String(value);
}

function loadScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORES_STORAGE_KEY));
    if (Array.isArray(raw)) return raw.filter(e => e && typeof e.score === 'number');
  } catch (e) { /* corrupted storage, fall back to empty */ }
  return [];
}

function saveScore(name, scoreValue, linesValue, levelValue) {
  const list = loadScores();
  const entry = { name, score: scoreValue, lines: linesValue, level: levelValue };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 5);
  localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(list));
  return list.indexOf(entry);
}

function qualifiesForTop(scoreValue) {
  const list = loadScores();
  return list.length < 5 || scoreValue > list[list.length - 1].score;
}

function renderScoreTable(container, highlightIndex) {
  const list = loadScores();
  container.innerHTML = '';
  if (!list.length) {
    const row = document.createElement('div');
    row.className = 'score-row empty';
    row.textContent = 'Sin records todavía';
    container.appendChild(row);
    return;
  }
  list.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'score-row' + (i === highlightIndex ? ' highlight' : '');
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name;
    const points = document.createElement('span');
    points.className = 'points';
    points.textContent = entry.score.toLocaleString();
    row.append(rank, name, points);
    container.appendChild(row);
  });
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_STORAGE_KEY));
    if (raw && typeof raw.bestCombo === 'number' && typeof raw.maxLines === 'number') return raw;
  } catch (e) { /* corrupted storage, fall back to zeros */ }
  return { bestCombo: 0, maxLines: 0 };
}

function saveStats() {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify({ bestCombo, maxLines }));
}

function statsLine() {
  return `Mejor combo: ${bestCombo} · Máx. líneas: ${maxLines}`;
}

function resetScores() {
  localStorage.removeItem(SCORES_STORAGE_KEY);
  bestCombo = 0;
  maxLines = 0;
  saveStats();
  refreshStartScreen();
}

function refreshStartScreen() {
  renderScoreTable(startScoreTable, -1);
  startStats.textContent = statsLine();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + startLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > bestCombo) {
      bestCombo = combo;
      saveStats();
    }
  } else {
    combo = 0;
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo;
}

function pathRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
  } else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

function drawPixelTexture(context, px, py, size) {
  const step = Math.max(2, Math.floor(size / 6));
  context.fillStyle = 'rgba(0,0,0,0.15)';
  for (let yy = py + step; yy < py + size - step; yy += step * 2)
    for (let xx = px + step; xx < px + size - step; xx += step * 2)
      context.fillRect(xx, yy, step, step);
  context.fillStyle = 'rgba(255,255,255,0.18)';
  context.fillRect(px + 1, py + 1, size - 2, 3);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;

  switch (skinMode) {
    case 'neon':
      context.shadowBlur = 12;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      break;
    case 'pastel':
      context.fillStyle = color;
      pathRoundRect(context, px + 1, py + 1, size - 2, size - 2, 6);
      context.fill();
      break;
    case 'pixel':
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      drawPixelTexture(context, px, py, size);
      break;
    default:
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  menuOpen = true;
  cancelAnimationFrame(animId);

  if (lines > maxLines) {
    maxLines = lines;
    saveStats();
  }

  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  gameoverStats.textContent = statsLine();
  renderScoreTable(gameoverScoreTable, -1);

  const qualifies = qualifiesForTop(score);
  newRecordBox.classList.toggle('hidden', !qualifies);
  gameOverEl.classList.remove('hidden');
  if (qualifies) {
    playerNameInput.value = '';
    playerNameInput.focus();
  }
}

function saveCurrentScore() {
  const name = playerNameInput.value.trim() || 'AAA';
  const idx = saveScore(name, score, lines, level);
  newRecordBox.classList.add('hidden');
  renderScoreTable(gameoverScoreTable, idx);
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  menuOpen = paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    pauseControlsList.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseLevelSelect.value = String(startLevel);
    pauseMenu.classList.remove('hidden');
  }
}

function showStartScreen() {
  gameOverEl.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  menuOpen = true;
  gameOver = false;
  started = false;
  cancelAnimationFrame(animId);
  refreshStartScreen();
  startScreen.classList.remove('hidden');
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  paused = false;
  gameOver = false;
  menuOpen = false;
  started = true;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  startScreen.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  pauseControlsList.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause();
    return;
  }
  if (menuOpen || paused || gameOver || !started) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

themeToggleBtn.addEventListener('click', toggleTheme);
skinSelect.addEventListener('change', changeSkin);
playBtn.addEventListener('click', init);
resetScoresBtn.addEventListener('click', resetScores);
startLevelSelect.addEventListener('change', () => setStartLevel(parseInt(startLevelSelect.value, 10)));
pauseLevelSelect.addEventListener('change', () => setStartLevel(parseInt(pauseLevelSelect.value, 10)));

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
viewControlsBtn.addEventListener('click', () => pauseControlsList.classList.toggle('hidden'));

saveScoreBtn.addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    saveCurrentScore();
  }
});
gameoverRestartBtn.addEventListener('click', init);
gameoverMenuBtn.addEventListener('click', showStartScreen);

populateLevelSelect(startLevelSelect);
populateLevelSelect(pauseLevelSelect);

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
applySkin(localStorage.getItem(SKIN_STORAGE_KEY) || 'retro');
setStartLevel(loadStartLevel());

({ bestCombo, maxLines } = loadStats());
refreshStartScreen();
