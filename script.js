// --- MAZE CONFIGURATION (9 Rows x 11 Columns) ---
// Wall Bitmask: 1 = Top, 2 = Right, 4 = Bottom, 8 = Left
const ROWS = 9;
const COLS = 11;

let mazeWalls = [];

// The start and well stay in place, while the paths between them change.
const START_POS = { r: 8, c: 0 };
const WELL_POS = { r: 5, c: 9 };

// LevelUp Challenge: Dry Dirt Cracks (-15 Hydration penalty)
const DROPLET_COUNT = 8;
const HAZARD_COUNT = 2;
const EXTRA_PASSAGES = 30;
const DIFFICULTIES = {
  easy: { label: 'Easy', drainRate: 6 },
  medium: { label: 'Medium', drainRate: 12 },
  hard: { label: 'Hard', drainRate: 18 }
};

function shuffle(items) {
  return items.sort(() => Math.random() - 0.5);
}

// Generate a connected maze by carving paths through every cell.
function generateMaze() {
  mazeWalls = Array.from({ length: ROWS }, () => Array(COLS).fill(15));
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const directions = [
    { dr: -1, dc: 0, wall: 1, opposite: 4 },
    { dr: 0, dc: 1, wall: 2, opposite: 8 },
    { dr: 1, dc: 0, wall: 4, opposite: 1 },
    { dr: 0, dc: -1, wall: 8, opposite: 2 }
  ];

  function carve(r, c) {
    visited[r][c] = true;

    shuffle([...directions]).forEach(direction => {
      const nextR = r + direction.dr;
      const nextC = c + direction.dc;
      const insideGrid = nextR >= 0 && nextR < ROWS && nextC >= 0 && nextC < COLS;

      if (insideGrid && !visited[nextR][nextC]) {
        mazeWalls[r][c] -= direction.wall;
        mazeWalls[nextR][nextC] -= direction.opposite;
        carve(nextR, nextC);
      }
    });
  }

  carve(START_POS.r, START_POS.c);

  // Open extra walls to create loops and alternate routes.
  const possiblePassages = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < ROWS - 1) possiblePassages.push({ r, c, wall: 4, opposite: 1, nextR: r + 1, nextC: c });
      if (c < COLS - 1) possiblePassages.push({ r, c, wall: 2, opposite: 8, nextR: r, nextC: c + 1 });
    }
  }

  shuffle(possiblePassages)
    .slice(0, EXTRA_PASSAGES)
    .forEach(passage => {
      if (mazeWalls[passage.r][passage.c] & passage.wall) {
        mazeWalls[passage.r][passage.c] -= passage.wall;
        mazeWalls[passage.nextR][passage.nextC] -= passage.opposite;
      }
    });
}

function findPathToWell() {
  const directions = [
    { dr: -1, dc: 0, wall: 1 },
    { dr: 0, dc: 1, wall: 2 },
    { dr: 1, dc: 0, wall: 4 },
    { dr: 0, dc: -1, wall: 8 }
  ];
  const queue = [{ ...START_POS }];
  const previous = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  previous[START_POS.r][START_POS.c] = START_POS;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.r === WELL_POS.r && current.c === WELL_POS.c) break;

    directions.forEach(direction => {
      const nextR = current.r + direction.dr;
      const nextC = current.c + direction.dc;
      const insideGrid = nextR >= 0 && nextR < ROWS && nextC >= 0 && nextC < COLS;
      const canMove = !(mazeWalls[current.r][current.c] & direction.wall);

      if (insideGrid && canMove && previous[nextR][nextC] === null) {
        previous[nextR][nextC] = current;
        queue.push({ r: nextR, c: nextC });
      }
    });
  }

  const path = [];
  let current = { ...WELL_POS };
  while (current.r !== START_POS.r || current.c !== START_POS.c) {
    path.unshift(current);
    current = previous[current.r][current.c];
  }
  return path;
}

function randomOpenCells(count, excludedCells = []) {
  const availableCells = [];
  const excludedKeys = excludedCells.map(cell => `${cell.r},${cell.c}`);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isStart = r === START_POS.r && c === START_POS.c;
      const isWell = r === WELL_POS.r && c === WELL_POS.c;
      const isExcluded = excludedKeys.includes(`${r},${c}`);
      if (!isStart && !isWell && !isExcluded) availableCells.push({ r, c });
    }
  }

  return shuffle(availableCells).slice(0, count);
}

// --- GAME STATE ---
let playerPos = { ...START_POS };
let hydration = 100;
let droplets = [];
let hazards = [];
let timerInterval = null;
let gameStarted = false;
let gameOver = false;
let currentDifficulty = 'easy';

// --- DOM ELEMENTS ---
const mazeGridEl = document.getElementById('maze-grid');
const hydrationCountEl = document.getElementById('hydration-count');
const hydrationRateEl = document.getElementById('hydration-rate');
const hydrationBarEl = document.getElementById('hydration-bar');
const dropsLeftCountEl = document.getElementById('drops-left-count');
const feedbackBannerEl = document.getElementById('feedback-banner');
const resetBtn = document.getElementById('reset-btn');
const endModal = document.getElementById('end-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const finalScoreEl = document.getElementById('final-score');
const finalDropsEl = document.getElementById('final-drops');
const playAgainBtn = document.getElementById('play-again-btn');
const difficultySelect = document.getElementById('difficulty-select');

// --- INITIALIZE / RESET GAME ---
function initGame() {
  clearInterval(timerInterval);
  timerInterval = null;
  generateMaze();
  playerPos = { ...START_POS };
  hydration = 100;
  const pathCells = shuffle(findPathToWell().slice(0, -1)).slice(0, 6);
  const randomCells = randomOpenCells(DROPLET_COUNT + HAZARD_COUNT - pathCells.length, pathCells);
  droplets = [...pathCells, ...randomCells]
    .slice(0, DROPLET_COUNT)
    .map(cell => ({ ...cell, collected: false }));
  hazards = randomCells
    .slice(DROPLET_COUNT - pathCells.length)
    .map(cell => ({ ...cell, triggered: false }));
  gameStarted = false;
  gameOver = false;

  endModal.classList.add('hidden');
  stopConfetti();
  updateHUD();
  setFeedback('Press any arrow key (or WASD) to begin your journey!', '#ffc72c');
  renderMaze();
}

// --- RENDER MAZE GRID ---
function renderMaze() {
  mazeGridEl.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      const mask = mazeWalls[r][c];
      if (mask & 1) cell.classList.add('wall-top');
      if (mask & 2) cell.classList.add('wall-right');
      if (mask & 4) cell.classList.add('wall-bottom');
      if (mask & 8) cell.classList.add('wall-left');

      // Render Well Goal
      if (r === WELL_POS.r && c === WELL_POS.c) {
        const well = document.createElement('div');
        well.className = 'well-goal';
        well.innerHTML = '<div class="well-water"></div><span>WELL</span>';
        cell.appendChild(well);
      }

      // Render Uncollected Lost Droplets
      const drop = droplets.find(d => d.r === r && d.c === c && !d.collected);
      if (drop) {
        const dropEl = document.createElement('div');
        dropEl.className = 'lost-drop';
        dropEl.title = 'Lost Droplet (+20 Hydration)';
        cell.appendChild(dropEl);
      }

      // Render Hazards (LevelUp Challenge)
      const hazard = hazards.find(h => h.r === r && h.c === c && !h.triggered);
      if (hazard) {
        const hazEl = document.createElement('div');
        hazEl.className = 'hazard-patch';
        hazEl.title = 'Dry Dirt Crack (-15 Hydration)';
        hazEl.textContent = '!';
        cell.appendChild(hazEl);
      }

      // Render Player Drop
      if (r === playerPos.r && c === playerPos.c) {
        const playerEl = document.createElement('div');
        playerEl.className = 'player-drop';
        playerEl.textContent = '•‿•';
        // Visual feedback requirement: fade player drop when hydration < 30
        if (hydration < 30) {
          playerEl.style.opacity = Math.max(0.35, hydration / 40);
        }
        cell.appendChild(playerEl);
      }

      mazeGridEl.appendChild(cell);
    }
  }
}

// --- HYDRATION TIMER ---
function startTimer() {
  if (gameStarted || gameOver) return;
  gameStarted = true;
  const drainRate = DIFFICULTIES[currentDifficulty].drainRate;
  setFeedback(`Hydration draining at ${drainRate}/sec—hurry to the well!`, '#ffc72c');

  timerInterval = setInterval(() => {
    hydration = Math.max(0, hydration - drainRate);
    updateHUD();
    renderMaze();

    if (hydration <= 0) {
      endGame(false);
    } else if (hydration < 30) {
      setFeedback('Warning: Hydration critically low! Drop is fading!', '#ff6b6b');
    }
  }, 1000);
}

// --- PLAYER MOVEMENT & COLLISION ---
function movePlayer(dir) {
  if (gameOver) return;
  if (!gameStarted) startTimer();

  const { r, c } = playerPos;
  const currentMask = mazeWalls[r][c];
  let nextR = r;
  let nextC = c;

  if (dir === 'up') {
    if (r === 0 || (currentMask & 1) || (mazeWalls[r - 1][c] & 4)) {
      setFeedback('Blocked by an earthen wall!', '#ff9f43');
      return;
    }
    nextR--;
  } else if (dir === 'right') {
    if (c === COLS - 1 || (currentMask & 2) || (mazeWalls[r][c + 1] & 8)) {
      setFeedback('Blocked by an earthen wall!', '#ff9f43');
      return;
    }
    nextC++;
  } else if (dir === 'down') {
    if (r === ROWS - 1 || (currentMask & 4) || (mazeWalls[r + 1][c] & 1)) {
      setFeedback('Blocked by an earthen wall!', '#ff9f43');
      return;
    }
    nextR++;
  } else if (dir === 'left') {
    if (c === 0 || (currentMask & 8) || (mazeWalls[r][c - 1] & 2)) {
      setFeedback('Blocked by an earthen wall!', '#ff9f43');
      return;
    }
    nextC--;
  }

  playerPos = { r: nextR, c: nextC };
  checkTileInteractions();
  updateHUD();
  renderMaze();
}

// --- CHECK COLLECTIBLES, OBSTACLES & WIN ---
function checkTileInteractions() {
  // 1. Check Lost Droplets (+20 Hydration, capped at 100)
  const foundDrop = droplets.find(
    d => d.r === playerPos.r && d.c === playerPos.c && !d.collected
  );
  if (foundDrop) {
    foundDrop.collected = true;
    hydration = Math.min(100, hydration + 20);
    setFeedback('Rescued a lost droplet! +20 Hydration!', '#7bed9f');
  }

  // 2. Check Dry Crack Obstacle (-15 Hydration)
  const hitHazard = hazards.find(
    h => h.r === playerPos.r && h.c === playerPos.c && !h.triggered
  );
  if (hitHazard) {
    hitHazard.triggered = true;
    hydration = Math.max(0, hydration - 15);
    setFeedback('Ouch! Stepped on dry cracked earth! -15 Hydration!', '#ff6b6b');
    if (hydration <= 0) {
      endGame(false);
      return;
    }
  }

  // 3. Check Win Condition (Reached the Well)
  if (playerPos.r === WELL_POS.r && playerPos.c === WELL_POS.c) {
    endGame(true);
  }
}

// --- HUD UPDATES ---
function updateHUD() {
  hydrationCountEl.textContent = hydration;
  hydrationRateEl.textContent = DIFFICULTIES[currentDifficulty].drainRate;
  hydrationBarEl.style.width = `${hydration}%`;

  if (hydration < 30) {
    hydrationBarEl.style.backgroundColor = '#d9534f';
  } else if (hydration < 60) {
    hydrationBarEl.style.backgroundColor = '#ffc72c';
  } else {
    hydrationBarEl.style.backgroundColor = '#0b7a9f';
  }

  const remainingDrops = droplets.filter(d => !d.collected).length;
  dropsLeftCountEl.textContent = remainingDrops;
}

function setFeedback(text, color) {
  feedbackBannerEl.textContent = text;
  feedbackBannerEl.style.color = color;
}

// --- END GAME LOGIC ---
function endGame(won) {
  gameOver = true;
  clearInterval(timerInterval);

  const rescuedCount = droplets.filter(d => d.collected).length;
  finalScoreEl.textContent = `${hydration} / 100`;
  finalDropsEl.textContent = `${rescuedCount} / ${droplets.length}`;

  if (won) {
    launchConfetti();
    if (rescuedCount === droplets.length) {
      modalTitle.textContent = 'Incredible! Every Drop Saved!';
      modalMessage.textContent =
        'You guided all 8 lost droplets safely to the well with ' +
        hydration +
        ' hydration remaining! Just like charity: water, your commitment to leaving no one behind transforms entire communities.';
    } else if (rescuedCount > 0) {
      modalTitle.textContent = 'You Reached the Clean Well!';
      modalMessage.textContent =
        `You made it home and rescued ${rescuedCount} lost droplet(s) along the way! Every drop brought together helps sustain clean water for all.`;
    } else {
      modalTitle.textContent = 'You Made It Solo!';
      modalMessage.textContent =
        'You speed-ran straight to the well before dehydrating, but 8 lost droplets were left behind. Try again to see how many you can bring home!';
    }
  } else {
    modalTitle.textContent = 'Completely Dehydrated!';
    modalMessage.textContent =
      'The earth drank first and your droplet seeped into the soil. Collect lost droplets (+20 hydration) along your path to survive the journey!';
  }

  endModal.classList.remove('hidden');
}

// --- KEYBOARD & BUTTON EVENT LISTENERS ---
window.addEventListener('keydown', e => {
  const keyMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left'
  };
  if (keyMap[e.code]) {
    e.preventDefault();
    movePlayer(keyMap[e.code]);
  }
});

document.querySelectorAll('.dpad-btn').forEach(btn => {
  btn.addEventListener('click', () => movePlayer(btn.dataset.dir));
});

resetBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);
difficultySelect.addEventListener('change', () => {
  currentDifficulty = difficultySelect.value;
  initGame();
});

// --- CONFETTI CELEBRATION (LevelUp +5pts) ---
const confettiCanvas = document.getElementById('confetti-canvas');
const ctx = confettiCanvas.getContext('2d');
let confettiPieces = [];
let confettiAnimId = null;

function launchConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const colors = ['#ffc72c', '#0b7a9f', '#587846', '#7be0ff', '#ffffff'];

  confettiPieces = Array.from({ length: 110 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * confettiCanvas.height - confettiCanvas.height,
    size: Math.random() * 8 + 5,
    speedY: Math.random() * 3 + 2,
    speedX: (Math.random() - 0.5) * 2,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  function updateConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    confettiAnimId = requestAnimationFrame(updateConfetti);
  }
  updateConfetti();
}

function stopConfetti() {
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

// Start Prototype on Load
initGame();