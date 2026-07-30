(() => {
  const canvas = document.querySelector('#airplane-canvas');
  const scoreElement = document.querySelector('#air-score');
  const healthElement = document.querySelector('#air-health');
  const stateElement = document.querySelector('#air-state');
  const startButton = document.querySelector('#air-start');
  const pauseButton = document.querySelector('#air-pause');
  const restartButton = document.querySelector('#air-restart');
  const touchButtons = document.querySelectorAll('[data-airplane-direction]');
  if (!canvas || !scoreElement || !healthElement || !stateElement || !startButton || !pauseButton || !restartButton) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const tickRate = 50;
  const enemyLimit = 5;
  let timerId = null;
  let state = 'ready';
  let player;
  let enemies;
  let bullets;
  let enemyBullets;
  let health;
  let destroyed;
  let boss;
  let lastSpawn = 0;
  let lastShot = 0;
  let lastDamage = -Infinity;
  let upgraded = false;
  let keys = new Set();

  function reset() {
    stopTimer();
    state = 'ready';
    player = { x: width / 2, y: height - 48, speed: 5 };
    enemies = [];
    bullets = [];
    enemyBullets = [];
    health = 4;
    destroyed = 0;
    boss = null;
    lastSpawn = 0;
    lastShot = 0;
    lastDamage = -Infinity;
    upgraded = false;
    keys = new Set();
    updateStatus();
    draw();
  }

  function start() {
    if (state === 'running') return;
    if (state === 'ready' || state === 'over' || state === 'won') reset();
    state = 'running';
    stopTimer();
    timerId = window.setInterval(tick, tickRate);
    updateStatus();
  }

  function stopTimer() {
    if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
  }

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    stopTimer();
    updateStatus();
  }

  function restart() { reset(); start(); }

  function shoot(now) {
    if (now - lastShot < (upgraded ? 180 : 280)) return;
    lastShot = now;
    if (upgraded) {
      bullets.push({ x: player.x - 8, y: player.y - 16, dx: 0, dy: -8 }, { x: player.x + 8, y: player.y - 16, dx: 0, dy: -8 });
    } else bullets.push({ x: player.x, y: player.y - 16, dx: 0, dy: -8 });
  }

  function spawnEnemy(now) {
    if (boss || now - lastSpawn < 900 || enemies.length >= enemyLimit) return;
    lastSpawn = now;
    enemies.push({ x: 26 + Math.random() * (width - 52), y: -18, w: 18, h: 18, speed: 1.2 + Math.random() * 1.2, phase: Math.random() * 6, shotAt: now + 700 + Math.random() * 900 });
  }

  function spawnBoss() {
    if (boss || destroyed < 5) return;
    boss = { x: width / 2, y: 48, w: 70, h: 34, health: 12, maxHealth: 12, dx: 2.2, shotAt: 0 };
  }

  function overlaps(a, b) { return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2; }

  function damage() {
    const now = performance.now();
    if (now - lastDamage < 500) return;
    lastDamage = now;
    health -= 1;
    if (health <= 0) { health = 0; state = 'over'; stopTimer(); }
  }

  function updatePlayer() {
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) player.x -= player.speed;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) player.x += player.speed;
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) player.y -= player.speed;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) player.y += player.speed;
    player.x = Math.max(18, Math.min(width - 18, player.x));
    player.y = Math.max(20, Math.min(height - 20, player.y));
  }

  function tick() {
    const now = performance.now();
    updatePlayer();
    if (keys.has(' ') || keys.has('Space')) shoot(now);
    spawnEnemy(now);
    enemies.forEach((enemy) => {
      enemy.y += enemy.speed;
      enemy.x += Math.sin(now / 500 + enemy.phase) * 0.8;
      if (now >= enemy.shotAt) { enemyBullets.push({ x: enemy.x, y: enemy.y + 10, w: 5, h: 10, dy: 3.8 }); enemy.shotAt = now + 1200; }
      if (overlaps(player, enemy)) { damage(); enemy.y = height + 40; }
    });
    enemies = enemies.filter((enemy) => enemy.y < height + 40);
    bullets.forEach((bullet) => { bullet.x += bullet.dx; bullet.y += bullet.dy; });
    enemyBullets.forEach((bullet) => { bullet.y += bullet.dy; if (overlaps(player, bullet)) { damage(); bullet.y = height + 30; } });
    bullets = bullets.filter((bullet) => bullet.y > -20 && bullet.y < height + 20);
    enemyBullets = enemyBullets.filter((bullet) => bullet.y < height + 20);
    enemies.forEach((enemy) => {
      bullets.forEach((bullet) => { if (overlaps({ x: bullet.x, y: bullet.y, w: 5, h: 10 }, enemy)) { bullet.y = -40; enemy.y = height + 40; destroyed += 1; } });
    });
    enemies = enemies.filter((enemy) => enemy.y < height + 40);
    if (destroyed >= 5) { upgraded = true; spawnBoss(); }
    if (boss) {
      boss.x += boss.dx;
      if (boss.x < boss.w / 2 || boss.x > width - boss.w / 2) boss.dx *= -1;
      if (now >= boss.shotAt) { enemyBullets.push({ x: boss.x, y: boss.y + 20, w: 8, h: 14, dy: 4.5 }); boss.shotAt = now + 600; }
      bullets.forEach((bullet) => { if (overlaps({ x: bullet.x, y: bullet.y, w: 5, h: 10 }, boss)) { bullet.y = -40; boss.health -= 1; } });
      if (boss.health <= 0) { boss = null; state = 'won'; stopTimer(); }
    }
    updateStatus();
    draw();
  }

  function updateStatus() {
    scoreElement.textContent = String(destroyed);
    healthElement.textContent = '■'.repeat(health) + '□'.repeat(4 - health);
    stateElement.textContent = state.toUpperCase() + (upgraded ? ' / UPGRADED' : '');
    pauseButton.disabled = state !== 'running';
    startButton.disabled = state === 'running';
  }

  function draw() {
    ctx.fillStyle = '#07020a'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 31, 61, 0.08)';
    for (let y = 0; y < height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.fillStyle = '#f8e9eb'; ctx.beginPath(); ctx.moveTo(player.x, player.y - 14); ctx.lineTo(player.x - 14, player.y + 13); ctx.lineTo(player.x, player.y + 7); ctx.lineTo(player.x + 14, player.y + 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff1f3d'; enemies.forEach((enemy) => ctx.fillRect(enemy.x - 9, enemy.y - 9, 18, 18));
    if (boss) { ctx.fillStyle = '#ff6576'; ctx.fillRect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h); ctx.fillStyle = '#050101'; ctx.fillRect(boss.x - 40, boss.y - 28, 80, 5); ctx.fillStyle = '#ff1f3d'; ctx.fillRect(boss.x - 40, boss.y - 28, 80 * boss.health / boss.maxHealth, 5); }
    ctx.fillStyle = '#f8e9eb'; bullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12));
    ctx.fillStyle = '#ff6576'; enemyBullets.forEach((bullet) => ctx.fillRect(bullet.x - 2, bullet.y - 5, 4, 10));
    if (state === 'ready' || state === 'paused' || state === 'over' || state === 'won') { ctx.fillStyle = 'rgba(7, 2, 10, 0.7)'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#f8e9eb'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText(state === 'won' ? 'BOSS DOWN' : state === 'over' ? 'AIRFRAME LOST' : state === 'paused' ? 'PAUSED' : 'PRESS START', width / 2, height / 2); }
  }

  document.addEventListener('keydown', (event) => { if (document.querySelector('#game-state')?.textContent === 'RUNNING') return; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) { event.preventDefault(); keys.add(event.key); } });
  document.addEventListener('keyup', (event) => keys.delete(event.key));
  touchButtons.forEach((button) => button.addEventListener('click', () => { const direction = button.dataset.airplaneDirection; if (direction === 'fire') shoot(performance.now()); else { keys.add({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction]); updatePlayer(); keys.clear(); draw(); } }));
  startButton.addEventListener('click', start); pauseButton.addEventListener('click', pause); restartButton.addEventListener('click', restart);
  reset();
})();
