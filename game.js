/*
  NOIR: RED TIE — платформер для начинающих.
  Никаких библиотек! Вся игра — Canvas API + JavaScript.

  Структура: 1) уровни, 2) управление, 3) игровая логика,
             4) отрисовка, 5) игровой цикл.
*/

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GRAVITY = 0.55;
const SPEED = 3.65;
const JUMP = -11.5;

// Крыши: [x, y, ширина, высота]. Последняя крыша — выход.
// Сигареты: [x, y]. y — высота верхнего края крыши минус 25.
const levels = [
  {
    name: 'СТАРЫЙ КВАРТАЛ',
    platforms: [[0,345,265,200],[340,330,240,200],[660,345,240,200],[975,309,230,200],[1280,335,285,200],[1640,315,390,200]],
    items: [[132,320],[450,305],[776,320],[1085,284],[1410,310],[1810,290]],
    decor: [[180,'vent'],[515,'pipe'],[785,'vent'],[1160,'antenna'],[1470,'pipe'],[1920,'vent']]
  },
  {
    name: 'ПРОМЫШЛЕННАЯ ЗОНА',
    platforms: [[0,345,230,200],[311,311,215,200],[612,337,230,200],[933,305,215,200],[1229,335,224,200],[1541,304,220,200],[1850,328,320,200]],
    items: [[111,320],[411,286],[716,312],[1030,280],[1332,310],[1650,279],[2038,303]],
    decor: [[180,'pipe'],[455,'antenna'],[785,'pipe'],[1080,'vent'],[1360,'vent'],[1700,'pipe'],[2085,'antenna']]
  },
  {
    name: 'ЦЕНТР ГОРОДА',
    platforms: [[0,345,225,200],[318,301,190,200],[596,336,209,200],[900,295,195,200],[1190,336,200,200],[1480,294,198,200],[1770,327,218,200],[2080,307,300,200]],
    items: [[110,320],[418,276],[695,311],[992,270],[1285,311],[1577,269],[1885,302],[2240,282]],
    decor: [[145,'vent'],[435,'pipe'],[727,'antenna'],[1000,'pipe'],[1320,'vent'],[1595,'antenna'],[1920,'pipe'],[2300,'vent']]
  }
];

const hud = {
  level: document.getElementById('hud-level'),
  items: document.getElementById('hud-items'),
  score: document.getElementById('hud-score'),
  lives: document.getElementById('hud-lives'),
  best: document.getElementById('hud-best'),
  status: document.getElementById('status-text')
};
const overlay = document.getElementById('screen-overlay');
const overlayEyebrow = document.getElementById('overlay-eyebrow');
const overlayTitle = document.getElementById('overlay-title');
const overlayDescription = document.getElementById('overlay-description');
const overlayButton = document.getElementById('overlay-button');
const pauseButton = document.getElementById('pause-button');
const toast = document.getElementById('game-toast');

let state = 'menu';              // menu, playing, paused, levelComplete, gameOver, victory
let levelIndex = 0;
let currentLevel;
let cigarettes = [];
let player;
let lives = 3;
let score = 0;
let levelStartScore = 0;
let cameraX = 0;
let frame = 0;
let jumpBuffer = 0;
let notificationUntil = 0;
let pendingAction = () => startGame();
const keys = { left: false, right: false };

// Храним только рекорд, а не персональные данные.
let best = 0;
try { best = Number(localStorage.getItem('noir-red-tie-best')) || 0; } catch (error) {}

function saveBest() {
  if (score <= best) return;
  best = score;
  try { localStorage.setItem('noir-red-tie-best', String(best)); } catch (error) {}
}

function setupLevel() {
  currentLevel = levels[levelIndex];
  cigarettes = currentLevel.items.map(([x, y]) => ({ x, y, collected: false }));
  player = {
    x: 52, y: currentLevel.platforms[0][1] - 43,
    w: 25, h: 43, vx: 0, vy: 0,
    face: 1, grounded: true, coyote: 7, walk: 0
  };
  cameraX = 0;
  jumpBuffer = 0;
  levelStartScore = score;
  updateHud();
}

function startGame() {
  levelIndex = 0;
  score = 0;
  lives = 3;
  setupLevel();
  setState('playing');
}

function setState(nextState) {
  state = nextState;
  overlay.hidden = nextState === 'playing';
  pauseButton.textContent = nextState === 'paused' ? '▶ ПРОДОЛЖИТЬ' : 'Ⅱ ПАУЗА';
  hud.status.textContent = {
    menu: 'ОЖИДАНИЕ НАЧАЛА ДЕЛА', playing: 'ДЕТЕКТИВ НА МАРШРУТЕ',
    paused: 'ДЕЛО ПРИОСТАНОВЛЕНО', levelComplete: 'РАЙОН ПРОЙДЕН',
    gameOver: 'ДЕЛО ЗАКРЫТО', victory: 'ДЕЛО РАСКРЫТО'
  }[nextState];
  if (nextState !== 'playing') { keys.left = false; keys.right = false; }
}

function showOverlay(eyebrow, title, description, buttonText, action) {
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.innerHTML = title;
  overlayDescription.textContent = description;
  overlayButton.innerHTML = `${buttonText} <span>→</span>`;
  pendingAction = action;
}

overlayButton.addEventListener('click', () => pendingAction());

function togglePause() {
  if (state === 'playing') {
    setState('paused');
    showOverlay('ПАУЗА', 'ГОРОД <em>ПОДОЖДЁТ</em>', 'Переведи дух. Дело никуда не денется.', 'ПРОДОЛЖИТЬ', () => setState('playing'));
  } else if (state === 'paused') {
    setState('playing');
  }
}
pauseButton.addEventListener('click', togglePause);
document.getElementById('restart-button').addEventListener('click', startGame);

function pressJump() { jumpBuffer = 9; }
const controlKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyP', 'KeyR', 'Enter'];
window.addEventListener('keydown', event => {
  if (controlKeys.includes(event.code)) event.preventDefault();
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.left = true;
  if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.right = true;
  if ((event.code === 'Space' || event.code === 'KeyW' || event.code === 'ArrowUp') && !event.repeat) {
    if (state === 'playing') pressJump();
    else if (state === 'menu') startGame();
  }
  if (event.code === 'KeyP' && !event.repeat) togglePause();
  if (event.code === 'KeyR' && !event.repeat) startGame();
  if (event.code === 'Enter' && !event.repeat && state !== 'playing') pendingAction();
});
window.addEventListener('keyup', event => {
  if (event.code === 'KeyA' || event.code === 'ArrowLeft') keys.left = false;
  if (event.code === 'KeyD' || event.code === 'ArrowRight') keys.right = false;
});
window.addEventListener('blur', () => {
  keys.left = false;
  keys.right = false;
  if (state === 'playing') togglePause();
});

// Те же действия доступны на телефонах.
document.querySelectorAll('[data-control]').forEach(button => {
  const control = button.dataset.control;
  const release = () => {
    if (control !== 'jump') keys[control] = false;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (control === 'jump') { if (state === 'playing') pressJump(); }
    else keys[control] = true;
    button.classList.add('active');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

function updateHud() {
  const pickedUp = cigarettes.filter(item => item.collected).length;
  hud.level.textContent = String(levelIndex + 1).padStart(2, '0') + ' / 03';
  hud.items.textContent = `${pickedUp} / ${cigarettes.length}`;
  hud.score.textContent = String(score).padStart(4, '0');
  hud.lives.textContent = '♥ '.repeat(lives).trim() || '—';
  hud.best.textContent = String(Math.max(score, best)).padStart(4, '0');
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function showMessage(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  notificationUntil = frame + 95;
}

function loseLife() {
  lives--;
  score = levelStartScore; // при падении начинаем этот район сначала
  if (lives === 0) {
    saveBest();
    setState('gameOver');
    showOverlay('ДЕЛО ПРОВАЛЕНО', 'ТЕМНОТА <em>ПОБЕДИЛА</em>', `Итоговый счёт: ${score}. Попробуй снова — у каждого дела есть второй шанс.`, 'НАЧАТЬ ЗАНОВО', startGame);
    updateHud();
  } else {
    setupLevel();
    showMessage('Падение! Минус одна жизнь.');
  }
}

function finishLevel() {
  score += 50;
  saveBest();
  updateHud();
  if (levelIndex === levels.length - 1) {
    setState('victory');
    showOverlay('ДЕЛО ЗАКРЫТО', 'ГОРОД <em>ТВОЙ</em>', `Все три района пройдены. Твой счёт: ${score} очков.`, 'ИГРАТЬ ЕЩЁ', startGame);
    return;
  }
  setState('levelComplete');
  showOverlay(`РАЙОН ${String(levelIndex + 1).padStart(2, '0')} ПРОЙДЕН`, 'СЛЕД ВЕДЁТ <em>ДАЛЬШЕ</em>', `+50 очков за прохождение. Следующий район: ${levels[levelIndex + 1].name.toLowerCase()}.`, 'СЛЕДУЮЩИЙ РАЙОН', () => {
    levelIndex++;
    setupLevel();
    setState('playing');
  });
}

function update() {
  if (state !== 'playing') return;
  frame++;
  if (notificationUntil && frame > notificationUntil) {
    toast.classList.remove('visible');
    notificationUntil = 0;
  }

  // 1. Движение (влево / вправо)
  const direction = Number(keys.right) - Number(keys.left);
  player.vx = direction * SPEED;
  if (direction !== 0) {
    player.face = direction;
    player.walk += 0.2;
  }

  // 2. Прыжок. Можно нажать за 9 кадров до приземления (jump buffer).
  if (player.grounded) player.coyote = 7;
  else player.coyote = Math.max(0, player.coyote - 1);
  if (jumpBuffer > 0 && player.coyote > 0) {
    player.vy = JUMP;
    player.grounded = false;
    player.coyote = 0;
    jumpBuffer = 0;
  }
  jumpBuffer = Math.max(0, jumpBuffer - 1);

  // 3. Столкновения по горизонтали
  player.x += player.vx;
  for (const p of currentLevel.platforms) {
    const platform = { x: p[0], y: p[1], w: p[2], h: p[3] };
    if (!intersects(player, platform)) continue;
    if (player.vx > 0) player.x = platform.x - player.w;
    else if (player.vx < 0) player.x = platform.x + platform.w;
  }
  player.x = Math.max(0, player.x);

  // 4. Гравитация и столкновения по вертикали
  const previousTop = player.y;
  const previousBottom = player.y + player.h;
  player.vy = Math.min(player.vy + GRAVITY, 13);
  player.y += player.vy;
  player.grounded = false;
  for (const p of currentLevel.platforms) {
    const platform = { x: p[0], y: p[1], w: p[2], h: p[3] };
    if (!intersects(player, platform)) continue;
    if (player.vy >= 0 && previousBottom <= platform.y + 8) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
    } else if (player.vy < 0 && previousTop >= platform.y + platform.h - 8) {
      player.y = platform.y + platform.h;
      player.vy = 0;
    }
  }

  // 5. Сигареты (+10 очков за каждую)
  cigarettes.forEach(item => {
    const box = { x: item.x - 10, y: item.y - 7, w: 20, h: 15 };
    if (!item.collected && intersects(player, box)) {
      item.collected = true;
      score += 10;
      updateHud();
    }
  });

  // 6. Красная дверь: сработает, только если собрано всё
  const lastRoof = currentLevel.platforms[currentLevel.platforms.length - 1];
  const door = { x: lastRoof[0] + lastRoof[2] - 61, y: lastRoof[1] - 62, w: 29, h: 62 };
  if (intersects(player, door)) {
    if (cigarettes.every(item => item.collected)) {
      finishLevel();
      return;
    }
    if (notificationUntil < frame) showMessage('Сначала собери все сигареты!');
  }

  // 7. Падение между крышами
  if (player.y > HEIGHT + 100) {
    loseLife();
    return;
  }
  const worldWidth = lastRoof[0] + lastRoof[2];
  cameraX += (Math.max(0, Math.min(player.x - 230, worldWidth - WIDTH)) - cameraX) * 0.12;
}

// -------- РИСОВАНИЕ PIXEL ART --------
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function hash(n) { return (Math.sin(n * 127.1 + 78.233) * 43758.5453) % 1; }

function drawBackground() {
  rect(0, 0, WIDTH, HEIGHT, '#11131a');
  rect(0, 245, WIDTH, 205, '#181a21');
  // Небо, пиксельные облака и луна.
  rect(0, 55, WIDTH, 2, '#1d2029');
  rect(0, 92, WIDTH, 1, '#1b1d27');
  rect(565 - cameraX * 0.035, 62, 57, 57, '#d7d3cb');
  rect(555 - cameraX * 0.035, 73, 78, 35, '#d7d3cb');
  rect(572 - cameraX * 0.035, 83, 62, 22, '#eeebe2');
  rect(578 - cameraX * 0.035, 105, 45, 10, '#d7d3cb');
  rect(490 - cameraX * 0.025, 97, 28, 5, '#222630');
  rect(520 - cameraX * 0.025, 97, 68, 8, '#222630');

  // Два плана небоскрёбов — простой параллакс.
  const farOffset = Math.floor(cameraX * 0.18);
  const nearOffset = Math.floor(cameraX * 0.39);
  for (let i = -2; i < 27; i++) {
    const x = i * 75 - (farOffset % 75);
    const height = 85 + Math.abs(Math.floor(hash(i * 2 + 10) * 110));
    rect(x, 320 - height, 62, height + 140, '#222630');
    for (let wy = 320 - height + 13; wy < 312; wy += 19) {
      for (let wx = x + 10; wx < x + 58; wx += 15) {
        if (hash(wx * 0.1 + wy * 0.5) > 0.10) rect(wx, wy, 5, 8, '#313641');
      }
    }
  }
  for (let i = -2; i < 23; i++) {
    const x = i * 108 - (nearOffset % 108);
    const height = 60 + Math.abs(Math.floor(hash(i * 3 + 7) * 100));
    rect(x, 350 - height, 93, height + 150, '#292b32');
    rect(x + 7, 347 - height, 14, 4, '#34343a');
    for (let wy = 360 - height + 18; wy < 360; wy += 21) {
      for (let wx = x + 16; wx < x + 87; wx += 21) {
        const lit = hash(wx + wy * 0.7) > .27;
        rect(wx, wy, 7, 10, lit ? '#3d3d43' : '#20232a');
      }
    }
  }

  // Дождь — простые наклонные штрихи.
  for (let i = 0; i < 125; i++) {
    let x = ((i * 137 + frame * 2.7) % (WIDTH + 60)) - 30;
    let y = ((i * 79 + frame * 9.6) % (HEIGHT + 40)) - 20;
    rect(x, y, 1, 10 + (i % 4), '#50536074');
    rect(x - 2, y + 8, 1, 6, '#50536044');
  }
}

function drawRoofs() {
  currentLevel.platforms.forEach(([x, y, w, h], index) => {
    const sx = x - cameraX;
    if (sx + w < -30 || sx > WIDTH + 30) return;
    // Сама крыша непроходима: она совпадает с физическим прямоугольником.
    rect(sx, y, w, h, index % 2 === 0 ? '#33343a' : '#393a40');
    rect(sx, y, w, 8, '#88888a');
    rect(sx, y + 8, w, 4, '#222327');
    rect(sx, y + 13, w, 6, '#45454a');
    for (let wx = 16; wx < w - 20; wx += 38) {
      for (let wy = y + 39; wy < Math.min(HEIGHT, y + h); wy += 47) {
        rect(sx + wx, wy, 15, 21, '#202126');
        rect(sx + wx + 3, wy + 3, 9, 14, '#67646a');
        rect(sx + wx + 7, wy + 3, 2, 14, '#26262a');
      }
    }
  });
  currentLevel.decor.forEach(([x, type]) => {
    const platform = currentLevel.platforms.find(([px, py, pw]) => x >= px && x <= px + pw);
    if (!platform) return;
    const sx = x - cameraX;
    const y = platform[1];
    if (type === 'vent') {
      rect(sx, y - 23, 39, 23, '#686870');
      rect(sx + 5, y - 18, 28, 3, '#33333a');
      rect(sx + 5, y - 10, 28, 3, '#33333a');
    } else if (type === 'pipe') {
      rect(sx + 9, y - 35, 18, 35, '#4d4e55');
      rect(sx + 6, y - 37, 24, 7, '#919094');
      rect(sx + 14, y - 48, 4, 10, '#7e7e83');
    } else {
      rect(sx + 11, y - 55, 3, 55, '#838388');
      rect(sx - 8, y - 44, 41, 3, '#838388');
      rect(sx + 4, y - 60, 17, 3, '#acaaad');
      rect(sx + 10, y - 66, 4, 7, '#d43c48');
    }
  });
}

function drawCigarettes() {
  cigarettes.forEach((item, index) => {
    if (item.collected) return;
    const x = item.x - cameraX;
    const y = item.y + Math.round(Math.sin(frame * 0.065 + index) * 3);
    // Белая сигарета с красным огоньком; пиксельный предмет 17x7.
    rect(x - 9, y - 4, 19, 2, '#757278');
    rect(x - 9, y - 2, 19, 5, '#ebe8df');
    rect(x + 4, y - 2, 5, 5, '#b7a396');
    rect(x - 12, y - 2, 3, 5, '#d43c48');
    if (frame % 30 < 15) rect(x - 14, y - 5, 2, 2, '#ed5862');
  });
}

function drawDoor() {
  const p = currentLevel.platforms[currentLevel.platforms.length - 1];
  const x = p[0] + p[2] - 61 - cameraX;
  const y = p[1] - 62;
  const unlocked = cigarettes.every(item => item.collected);
  rect(x - 5, y - 5, 39, 67, unlocked ? '#6a343c' : '#39333a');
  rect(x, y, 29, 62, unlocked ? '#ba3540' : '#762c36');
  rect(x + 4, y + 4, 21, 54, unlocked ? '#d43c48' : '#65272f');
  rect(x + 20, y + 30, 3, 4, '#fff1e9');
  rect(x - 2, y - 17, 33, 10, '#151419');
  ctx.fillStyle = unlocked ? '#ffb2b8' : '#a77a7d';
  ctx.font = 'bold 8px monospace';
  ctx.fillText(unlocked ? 'EXIT' : 'LOCK', x + 1, y - 9);
  if (unlocked && frame % 40 < 20) rect(x - 6, y + 9, 2, 37, '#d43c48');
}

function drawDetective() {
  const p = player;
  const x = Math.round(p.x - cameraX);
  const y = Math.round(p.y);
  const stepping = p.grounded && Math.abs(p.vx) > 0.01 ? Math.round(Math.sin(p.walk) * 3) : 0;
  // Силуэт + ноги, пальто, руки, шляпа, лицо и красный галстук.
  rect(x + 6, y + 31, 5, 12 + stepping, '#19191e');
  rect(x + 16, y + 31, 5, 12 - stepping, '#19191e');
  rect(x + 3, y + 39 + stepping, 10, 4, '#15151a');
  rect(x + 14, y + 39 - stepping, 10, 4, '#15151a');
  rect(x + 4, y + 17, 19, 22, '#242428');
  rect(x + 2, y + 20, 7, 17, '#34343a');
  rect(x + 18, y + 20, 7, 17, '#34343a');
  rect(x + 10, y + 20, 6, 18, '#e1ddda');
  rect(x + 12, y + 20, 3, 14, '#c72f3e');
  rect(x + 11, y + 27, 4, 5, '#e34951');
  rect(x + 8, y + 9, 12, 13, '#dbd6cb');
  rect(x + (p.face > 0 ? 18 : 8), y + 14, 2, 2, '#17171b');
  rect(x + 6, y + 6, 16, 5, '#1b1b20');
  rect(x + 3, y + 10, 23, 4, '#18181c');
  rect(x + 7, y + 5, 15, 2, '#585259');
  // Галстук немного развивается при движении.
  if (Math.abs(p.vx) > 0.01) rect(x + (p.face > 0 ? 8 : 16), y + 27, 4, 2, '#bd2d3b');
}

function drawWorldText() {
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#b5b0b2';
  ctx.fillText(`${String(levelIndex + 1).padStart(2, '0')} / ${currentLevel.name}`, 20, 26);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#8f9298';
  ctx.fillText('КАЖДАЯ СИГАРЕТА — +10 ОЧКОВ', 20, 41);
  ctx.fillStyle = '#d43c48';
  ctx.fillText('● REC', WIDTH - 53, 26);
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawRoofs();
  drawCigarettes();
  drawDoor();
  drawDetective();
  drawWorldText();
}

// Постоянный игровой цикл с ограниченным шагом: даже на быстром мониторе
// скорость персонажа и сила тяжести остаются одинаковыми.
let previousTime = 0;
let accumulator = 0;
const STEP = 1000 / 60;
function gameLoop(time) {
  if (!previousTime) previousTime = time;
  accumulator += Math.min(time - previousTime, 50);
  previousTime = time;
  while (accumulator >= STEP) {
    update();
    accumulator -= STEP;
  }
  render();
  requestAnimationFrame(gameLoop);
}

setupLevel();
updateHud();
requestAnimationFrame(gameLoop);
