(() => {
  const canvas = document.querySelector('#game-canvas');
  const scoreElement = document.querySelector('#score');
  const bestElement = document.querySelector('#best-score');
  const stateElement = document.querySelector('#game-state');
  const startButton = document.querySelector('#start-game');
  const pauseButton = document.querySelector('#pause-game');
  const restartButton = document.querySelector('#restart-game');
  const touchButtons = document.querySelectorAll('[data-direction]');

  if (!canvas || !scoreElement || !bestElement || !stateElement || !startButton || !pauseButton || !restartButton) return;

  const context = canvas.getContext('2d');
  const columns = 32;
  const rows = 18;
  const cellSize = canvas.width / columns;
  const tickRate = 140;
  const enemyCount = 3;
  const enemyWarningDistance = 4;
  const bestKey = 'point-worm-best-score';
  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const keyDirections = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right'
  };

  let worm = [];
  let food = { x: 0, y: 0 };
  let enemies = [];
  let direction = directions.right;
  let queuedDirection = direction;
  let timerId = null;
  let state = 'ready';
  let score = 0;
  let startedAt = 0;
  let elapsedMs = 0;
  let bestScore = readBestScore();

  function readBestScore() {
    try { return Number.parseInt(localStorage.getItem(bestKey) || '0', 10) || 0; } catch { return 0; }
  }

  function writeBestScore(value) {
    try { localStorage.setItem(bestKey, String(value)); } catch { /* storage may be unavailable */ }
  }

  function samePosition(first, second) { return first.x === second.x && first.y === second.y; }
  function distance(first, second) { return Math.abs(first.x - second.x) + Math.abs(first.y - second.y); }
  function randomCell() { return { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) }; }
  function occupied(position) {
    return worm.some((segment) => samePosition(segment, position)) || enemies.some((enemy) => samePosition(enemy.position, position));
  }

  function freeCell() {
    let position = randomCell();
    let attempts = 0;
    while (occupied(position) && attempts < 200) { position = randomCell(); attempts += 1; }
    return position;
  }

  function resetGame() {
    stopTimer();
    worm = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
    direction = directions.right;
    queuedDirection = direction;
    enemies = [];
    while (enemies.length < enemyCount) {
      const position = freeCell();
      enemies.push({ position, direction: directions.left });
    }
    food = freeCell();
    score = 0;
    elapsedMs = 0;
    state = 'ready';
    updateStatus();
    draw();
  }

  function startGame() {
    if (state === 'running') return;
    if (state === 'ready' || state === 'over') resetGame();
    state = 'running';
    startedAt = Date.now() - elapsedMs;
    stopTimer();
    timerId = window.setInterval(tick, tickRate);
    updateStatus();
  }

  function stopTimer() {
    if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
  }

  function pauseGame() {
    if (state !== 'running') return;
    state = 'paused';
    elapsedMs = Date.now() - startedAt;
    stopTimer();
    updateStatus();
  }

  function restartGame() { resetGame(); startGame(); }

  function setDirection(name) {
    const next = directions[name];
    if (!next || (next.x === -direction.x && next.y === -direction.y)) return;
    queuedDirection = next;
  }

  function moveEnemy(enemy) {
    const options = Object.values(directions).filter((candidate) => !(candidate.x === -enemy.direction.x && candidate.y === -enemy.direction.y));
    if (Math.random() < 0.45) enemy.direction = options[Math.floor(Math.random() * options.length)];
    let next = { x: enemy.position.x + enemy.direction.x, y: enemy.position.y + enemy.direction.y };
    if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows) {
      const valid = options.filter((candidate) => {
        const point = { x: enemy.position.x + candidate.x, y: enemy.position.y + candidate.y };
        return point.x >= 0 && point.x < columns && point.y >= 0 && point.y < rows;
      });
      enemy.direction = valid[Math.floor(Math.random() * valid.length)] || directions.right;
      next = { x: enemy.position.x + enemy.direction.x, y: enemy.position.y + enemy.direction.y };
    }
    enemy.position = next;
  }

  function tick() {
    direction = queuedDirection;
    const head = { x: worm[0].x + direction.x, y: worm[0].y + direction.y };
    const ateFood = samePosition(head, food);
    const nextWorm = [head, ...worm];
    if (!ateFood) nextWorm.pop();
    worm = nextWorm;
    enemies.forEach(moveEnemy);
    elapsedMs = Date.now() - startedAt;
    score = Math.floor(elapsedMs / 1000);
    const hitWall = head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows;
    const hitSelf = worm.slice(1).some((segment) => samePosition(head, segment));
    const hitEnemy = enemies.some((enemy) => samePosition(head, enemy.position) || worm.some((segment) => samePosition(enemy.position, segment)));
    if (hitWall || hitSelf || hitEnemy) { endGame(); return; }
    if (ateFood) food = freeCell();
    updateStatus();
    draw();
  }

  function endGame() {
    state = 'over';
    stopTimer();
    if (score > bestScore) { bestScore = score; writeBestScore(bestScore); }
    updateStatus();
    draw();
  }

  function updateStatus() {
    scoreElement.textContent = String(score);
    bestElement.textContent = String(bestScore);
    stateElement.textContent = state.toUpperCase();
    pauseButton.disabled = state !== 'running';
    startButton.disabled = state === 'running';
  }

  function drawCell(position, color, inset = 1) {
    context.fillStyle = color;
    context.fillRect(position.x * cellSize + inset, position.y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2);
  }

  function drawEnemy(enemy) {
    const near = distance(enemy.position, worm[0]) <= enemyWarningDistance;
    const blinking = near && Math.floor(Date.now() / 180) % 2 === 0;
    if (blinking) {
      context.save();
      context.shadowColor = '#ffb3bd';
      context.shadowBlur = 14;
      drawCell(enemy.position, '#ffb3bd', 0);
      context.restore();
    } else {
      drawCell(enemy.position, '#ff1f3d', 2);
    }
  }

  function draw() {
    context.fillStyle = '#050101';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(255, 31, 61, 0.08)';
    for (let x = 0; x <= columns; x += 1) { context.beginPath(); context.moveTo(x * cellSize, 0); context.lineTo(x * cellSize, canvas.height); context.stroke(); }
    for (let y = 0; y <= rows; y += 1) { context.beginPath(); context.moveTo(0, y * cellSize); context.lineTo(canvas.width, y * cellSize); context.stroke(); }
    drawCell(food, '#ff6576', 3);
    enemies.forEach(drawEnemy);
    worm.forEach((segment, index) => drawCell(segment, index === 0 ? '#f8e9eb' : '#ff6576', 1));
    if (state === 'ready' || state === 'paused' || state === 'over') {
      context.fillStyle = 'rgba(5, 1, 1, 0.68)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f8e9eb';
      context.font = 'bold 18px monospace';
      context.textAlign = 'center';
      context.fillText(state === 'over' ? 'GAME OVER' : state === 'paused' ? 'PAUSED' : 'PRESS START', canvas.width / 2, canvas.height / 2);
    }
  }

  document.addEventListener('keydown', (event) => {
    if (document.querySelector('#air-state')?.textContent.startsWith('RUNNING')) return;
    if (keyDirections[event.key]) { event.preventDefault(); setDirection(keyDirections[event.key]); }
    if (event.key === ' ' && state === 'running') pauseGame();
  });
  touchButtons.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', pauseGame);
  restartButton.addEventListener('click', restartGame);
  resetGame();
})();
