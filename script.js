/* ====== EXISTING SCRIPT VARS (unchanged) ====== */
const videoElement = document.querySelector(".input_video");
const canvasElement = document.querySelector(".output_canvas");
const ctx = canvasElement.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const heartsEl = document.getElementById("hearts");
const gameOverEl = document.getElementById("gameOver");
const moneyEl = document.getElementById("money");
const restartBtn = document.getElementById("restartGame");
const toast = document.getElementById("toast");

// Upgrades UI
const upgradesPanel = document.getElementById("upgrades");
const toggleUpgradesBtn = document.getElementById("toggleUpgrades");
const buyBulletSpeedBtn = document.getElementById("buy-bullet-speed");
const buyBurstFireBtn = document.getElementById("buy-burst-fire");
const buyBouncingBulletsBtn = document.getElementById("buy-bouncing-bullets");
const bsLevelEl = document.getElementById("bs-level");
const bfLevelEl = document.getElementById("bf-level");

let bullets = [];
let currentTarget = null;
let bonusTargets = [];
let bombs = [];
let score = 0;
let lives = 3;
let money = 0;
let bonusValue = 50;

// persistent high score
let bestScore = Number(localStorage.getItem("fnfHighScore") || 0);
bestEl.textContent = `Best: ${bestScore}`;

// gameplay vars
let BULLET_SPEED = 35;
let SHOT_COOLDOWN = 1000;
let TARGET_RADIUS = 25;

// upgrade state
let bulletSpeedLevel = 0;
let burstLevel = 0;
let bulletsBounce = false;

// upgrade costs & limits
const MAX_BULLET_SPEED_LEVEL = 3;
const MAX_BURST_LEVEL = 10;
const BULLET_SPEED_BASE_COST = 20;
const BULLET_SPEED_COST_INC = 15;
const BURST_FIRE_BASE_COST = 50;
const BURST_FIRE_COST_INC = 25;
const BOUNCING_BULLETS_COST = 100;

// Boss Fight State
let boss = null;
let bossMinionInterval = null;
let bossesDefeated = 0;

const TARGET_TIMEOUT = 5000;
const BONUS_TIMEOUT = 10000;
let lastShotTimes = { left: 0, right: 0 };

/* ===== NEW: Coin sprites, particles, and audio ===== */
const COIN_TYPES = [
  {
    key: "bronze",
    value: 5,
    colors: ["#b87333", "#8a4f1d"],
    stroke: "#5b3412",
  },
  {
    key: "silver",
    value: 10,
    colors: ["#cfd3d9", "#9aa4ad"],
    stroke: "#6d7680",
  },
  {
    key: "gold",
    value: 20,
    colors: ["#ffd54a", "#ffb300"],
    stroke: "#a66b00",
  },
];
const coinFrames = {};
const COIN_FRAMES = 10;

function makeCoinFrames(key, c1, c2, stroke) {
  const frames = [];
  for (let i = 0; i < COIN_FRAMES; i++) {
    const off = document.createElement("canvas");
    off.width = off.height = TARGET_RADIUS * 2 + 16;
    const g = off.getContext("2d");
    const r = TARGET_RADIUS + 2;
    g.translate(off.width / 2, off.height / 2);
    const grad = g.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.2, 0, 0, r);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = stroke;
    g.beginPath();
    g.arc(0, 0, r - 2, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.rotate((i / COIN_FRAMES) * Math.PI * 2);
    g.globalAlpha = 0.6;
    g.fillStyle = "rgba(255,255,255,.6)";
    g.beginPath();
    g.ellipse(-r * 0.3, -r * 0.3, r * 0.15, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.font = "bold 18px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,.35)";
    g.fillText("₱", 0, 1);
    frames.push(off);
  }
  coinFrames[key] = frames;
}
COIN_TYPES.forEach((t) =>
  makeCoinFrames(t.key, t.colors[0], t.colors[1], t.stroke)
);

// particles
const particles = [];
function spawnBurst(x, y, color, count = 15, speed = 4, life = 300) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2,
      v = (Math.random() * 0.6 + 0.4) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life,
      born: Date.now(),
      color,
    });
  }
}
function drawParticles() {
  const now = Date.now();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    const t = (now - p.born) / p.life;
    if (t >= 1) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// audio
let sfxCtx = null;
function ensureAudio() {
  if (!sfxCtx) {
    sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function blip(freq = 880, dur = 0.08, type = "square", vol = 0.15) {
  ensureAudio();
  const o = sfxCtx.createOscillator(),
    g = sfxCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g).connect(sfxCtx.destination);
  const t = sfxCtx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur);
}
function playCoinSound(kind) {
  const base = kind === "gold" ? 900 : kind === "silver" ? 700 : 520;
  blip(base, 0.06, "triangle", 0.2);
  setTimeout(() => blip(base * 1.25, 0.06, "triangle", 0.15), 50);
}
function playSpark() {
  blip(1200, 0.03, "sawtooth", 0.12);
}
function playExplosion() {
  ensureAudio();
  const b = sfxCtx.createBuffer(1, sfxCtx.sampleRate * 0.4, sfxCtx.sampleRate);
  const data = b.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.9 - t);
  }
  const src = sfxCtx.createBufferSource();
  src.buffer = b;
  const g = sfxCtx.createGain();
  g.gain.value = 0.35;
  src.connect(g).connect(sfxCtx.destination);
  src.start();
}
/* NEW: game over sfx (descending tones) */
function playGameOver() {
  ensureAudio();
  const t0 = sfxCtx.currentTime;
  [660, 440, 330, 220].forEach((f, i) => {
    const o = sfxCtx.createOscillator(),
      g = sfxCtx.createGain();
    o.type = "sawtooth";
    o.frequency.value = f;
    g.gain.value = 0.18;
    o.connect(g).connect(sfxCtx.destination);
    const t = t0 + i * 0.18;
    o.start(t);
    o.stop(t + 0.16);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  });
}

/* ===== EXISTING helpers ===== */
function toCanvas(landmark) {
  return {
    x: landmark.x * canvasElement.width,
    y: landmark.y * canvasElement.height,
  };
}

function shoot(x, y, vx, vy, r = 7) {
  bullets.push({ x, y, vx, vy, r, bounces: 0 });
}

// === MOD: spawnTarget now assigns a coin type/value ===
function spawnTarget() {
  const x = Math.random() * (canvasElement.width - 200) + 100;
  const y = Math.random() * (canvasElement.height - 200) + 100;
  const coin = COIN_TYPES[Math.floor(Math.random() * COIN_TYPES.length)];
  currentTarget = {
    x,
    y,
    r: TARGET_RADIUS,
    createdAt: Date.now(),
    moving: false,
    vx: 0,
    vy: 0,
    coinKey: coin.key,
    coinValue: coin.value,
    frame: Math.floor(Math.random() * COIN_FRAMES),
  };
}

function spawnTargetIfNone() {
  if (boss) return;
  if (!currentTarget && lives > 0) spawnTarget();
}

// keep bonus targets logic
function spawnBonus() {
  if (lives <= 0) return;
  const x = Math.random() * (canvasElement.width - 200) + 100;
  const y = Math.random() * (canvasElement.height - 200) + 100;
  bonusTargets.push({
    x,
    y,
    r: TARGET_RADIUS,
    createdAt: Date.now(),
    value: bonusValue,
  });
  bonusValue += 5;
}
function trySpawnBonus() {
  if (Math.random() < 0.1) spawnBonus();
}

function isGunSign(landmarks) {
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const thumbTip = landmarks[4];
  const wrist = landmarks[0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  return (
    dist(indexTip, wrist) > 0.25 &&
    dist(thumbTip, wrist) > 0.2 &&
    dist(middleTip, wrist) < 0.18 &&
    dist(ringTip, wrist) < 0.18 &&
    dist(pinkyTip, wrist) < 0.18
  );
}

/* ====== EXISTING onResults, with ADDITIONS ====== */
function onResults(results) {
  if (lives <= 0) return;

  ctx.save();
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // draw camera feed
  ctx.save();
  ctx.translate(canvasElement.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  ctx.restore();

  // Flip landmarks x and swap handedness for mirror effect
  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      for (const lm of landmarks) {
        lm.x = 1 - lm.x;
      }
      const label = results.multiHandedness[i].label;
      results.multiHandedness[i].label = label === "Left" ? "Right" : "Left";
    }
  }

  // trigger boss
  if (score >= 20 * (bossesDefeated + 1) && !boss) {
    startBossFight();
  }

  /* --- Boss: MYSTERY BOX (replaces purple circle) --- */
  if (boss) {
    boss.x += boss.vx;
    if (boss.x < boss.r || boss.x > canvasElement.width - boss.r) boss.vx *= -1;

    const flash = boss.lastHit && Date.now() - boss.lastHit < 100;
    const r = boss.r,
      x = boss.x,
      y = boss.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(Date.now() / 300) * 0.03); // little wobble

    // crate body
    const grd = ctx.createLinearGradient(-r, -r, r, r);
    grd.addColorStop(0, flash ? "#fff" : "#443");
    grd.addColorStop(1, flash ? "#fff" : "#221");
    ctx.fillStyle = grd;
    ctx.strokeStyle = flash ? "#fff" : "#ffdd55";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-r, -r, r * 2, r * 2, 14);
    ctx.fill();
    ctx.stroke();

    // metallic corner plates
    ctx.fillStyle = "rgba(255,220,100,.25)";
    const k = 14;
    ctx.fillRect(-r, -r, k, k);
    ctx.fillRect(r - k, -r, k, k);
    ctx.fillRect(-r, r - k, k, k);
    ctx.fillRect(r - k, r - k, k, k);

    // big ?
    ctx.font = `bold ${r * 1.2}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = flash ? "#000" : "#ffde6a";
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 3;
    ctx.strokeText("?", 0, 6);
    ctx.fillText("?", 0, 6);

    ctx.restore();

    // health bar
    const w = 300,
      p = boss.hp / boss.maxHp;
    ctx.fillStyle = "red";
    ctx.fillRect(canvasElement.width / 2 - w / 2, 20, w, 20);
    ctx.fillStyle = "lime";
    ctx.fillRect(canvasElement.width / 2 - w / 2, 20, w * p, 20);
    ctx.strokeStyle = "white";
    ctx.strokeRect(canvasElement.width / 2 - w / 2, 20, w, 20);
  }

  // --- Normal Target (coins) ---
  if (currentTarget) {
    if (score >= 3) {
      if (!currentTarget.moving) {
        const baseSpeed = 4.0 + (score - 3) * 0.4;
        const angle = Math.random() * Math.PI * 2;
        currentTarget.vx = Math.cos(angle) * baseSpeed;
        currentTarget.vy = Math.sin(angle) * baseSpeed;
        currentTarget.moving = true;
      }
      currentTarget.x += currentTarget.vx;
      currentTarget.y += currentTarget.vy;
      if (currentTarget.x < 50 || currentTarget.x > canvasElement.width - 50)
        currentTarget.vx *= -1;
      if (currentTarget.y < 50 || currentTarget.y > canvasElement.height - 50)
        currentTarget.vy *= -1;
    }

    currentTarget.frame = (currentTarget.frame + 1) % COIN_FRAMES;
    const frames = coinFrames[currentTarget.coinKey] || [];
    const img = frames[currentTarget.frame];
    if (img) {
      ctx.drawImage(
        img,
        currentTarget.x - TARGET_RADIUS - 8,
        currentTarget.y - TARGET_RADIUS - 8,
        (TARGET_RADIUS + 8) * 2,
        (TARGET_RADIUS + 8) * 2
      );
    } else {
      ctx.beginPath();
      ctx.arc(
        currentTarget.x,
        currentTarget.y,
        currentTarget.r,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "lime";
      ctx.shadowColor = "lime";
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Bonus targets
  for (const bt of bonusTargets) {
    ctx.beginPath();
    ctx.arc(bt.x, bt.y, bt.r, 0, Math.PI * 2);
    ctx.fillStyle = "#00FFFF";
    ctx.shadowColor = "#00FFFF";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Bombs
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (b.vx) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < b.r || b.x > canvasElement.width - b.r) b.vx *= -1;
      if (b.y < b.r || b.y > canvasElement.height - b.r) b.vy *= -1;
    }
    if (Date.now() - b.createdAt > 8000) {
      bombs.splice(i, 1);
      continue;
    }
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.shadowColor = "red";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("💣", b.x - 12, b.y + 7);
  }

  // Hands + muzzle spark
  if (results.multiHandLandmarks) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness
        ? results.multiHandedness[i].label.toLowerCase()
        : "right";

      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 3,
      });
      drawLandmarks(ctx, landmarks, { color: "#FF0000", lineWidth: 1 });

      if (isGunSign(landmarks)) {
        const tip = landmarks[8],
          pip = landmarks[6];
        const tipPx = toCanvas(tip),
          pipPx = toCanvas(pip);
        let dx = tipPx.x - pipPx.x,
          dy = tipPx.y - pipPx.y;
        let len = Math.hypot(dx, dy) || 1;
        const nx = dx / len,
          ny = dy / len;
        const spawnX = tipPx.x,
          spawnY = tipPx.y;
        const vx = nx * BULLET_SPEED,
          vy = ny * BULLET_SPEED;
        const now = Date.now();
        if (now - (lastShotTimes[handedness] || 0) > SHOT_COOLDOWN) {
          const numBullets = 1 + burstLevel;
          for (let j = 0; j < numBullets; j++) {
            setTimeout(() => shoot(spawnX, spawnY, vx, vy), j * 100);
          }
          lastShotTimes[handedness] = now;
          spawnBurst(spawnX, spawnY, "rgba(255,220,120,.95)", 18, 6, 220); // spark
          playSpark();
        }
        ctx.beginPath();
        ctx.arc(spawnX, spawnY, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,220,100,0.9)";
        ctx.fill();
      }
    }
  }

  // bullets & collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    if (bulletsBounce) {
      if (b.x <= 0 || b.x >= canvasElement.width) {
        b.vx *= -1;
        b.bounces++;
      }
      if (b.y <= 0 || b.y >= canvasElement.height) {
        b.vy *= -1;
        b.bounces++;
      }
      if (b.bounces > 2) {
        bullets.splice(i, 1);
        continue;
      }
    } else if (
      b.x < -50 ||
      b.x > canvasElement.width + 50 ||
      b.y < -50 ||
      b.y > canvasElement.height + 50
    ) {
      bullets.splice(i, 1);
      continue;
    }

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "yellow";
    ctx.shadowColor = "yellow";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Boss hit
    if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < b.r + boss.r) {
      bullets.splice(i, 1);
      boss.hp--;
      boss.lastHit = Date.now();
      if (boss.hp <= 0) {
        endBossFight(true);
      }
      continue;
    }

    // Coin hit
    if (
      currentTarget &&
      Math.hypot(b.x - currentTarget.x, b.y - currentTarget.y) <
        b.r + currentTarget.r
    ) {
      bullets.splice(i, 1);
      const val = currentTarget.coinValue || 10;
      money += val;
      score++;
      updateScoreboard();
      const coinKey = currentTarget.coinKey || "gold";
      const colorMap = {
        gold: "rgba(255,210,80,.95)",
        silver: "rgba(210,220,230,.95)",
        bronze: "rgba(205,135,70,.95)",
      };
      spawnBurst(
        currentTarget.x,
        currentTarget.y,
        colorMap[coinKey],
        22,
        5,
        320
      );
      playCoinSound(coinKey);
      currentTarget = null;
      setTimeout(spawnTargetIfNone, 400);
      continue;
    }

    // Bonus hit
    for (let k = bonusTargets.length - 1; k >= 0; k--) {
      const bo = bonusTargets[k];
      if (Math.hypot(b.x - bo.x, b.y - bo.y) < b.r + bo.r) {
        bullets.splice(i, 1);
        bonusTargets.splice(k, 1);
        money += bo.value;
        updateScoreboard();
        break;
      }
    }

    // Bomb hit
    for (let k = bombs.length - 1; k >= 0; k--) {
      const bo = bombs[k];
      if (Math.hypot(b.x - bo.x, b.y - bo.y) < b.r + bo.r) {
        bullets.splice(i, 1);
        bombs.splice(k, 1);
        lives--;
        spawnBurst(bo.x, bo.y, "rgba(255,80,60,.95)", 40, 7, 420);
        playExplosion();
        updateHearts();
        if (lives <= 0) endGame();
        break;
      }
    }
  }

  // particles last
  drawParticles();

  ctx.restore();
}

function updateHearts() {
  heartsEl.textContent = "❤️".repeat(Math.max(0, lives));
}
function updateScoreboard() {
  scoreEl.textContent = `Score: ${score}`;
  moneyEl.textContent = `₱${money}`;
  if (score > bestScore) {
    bestScore = score;
    bestEl.textContent = `Best: ${bestScore}`;
    localStorage.setItem("fnfHighScore", String(bestScore));
  }
}
function endGame() {
  if (bossMinionInterval) clearInterval(bossMinionInterval);
  lives = 0;
  playGameOver(); // NEW: game over sound
  gameOverEl.style.display = "block";
}

// --- helpers for toast + loot ---
function showToast(text) {
  toast.textContent = text;
  toast.style.display = "block";
  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%, 0)";
  setTimeout(() => {
    toast.style.transition = "opacity .6s ease, transform .6s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -14px)";
    setTimeout(() => {
      toast.style.display = "none";
      toast.style.transition = "";
    }, 650);
  }, 900);
}
function grantLoot(loot) {
  if (loot === "heart") {
    lives = Math.min(5, lives + 1);
    updateHearts();
    showToast("❤️ Extra Life!");
  } else if (loot === "coins") {
    money += 50;
    updateScoreboard();
    showToast("🪙 +₱50 Bonus!");
  } else if (loot === "upgrade") {
    if (burstLevel < MAX_BURST_LEVEL) {
      burstLevel++;
      showToast("🔫 Burst +1 (FREE)");
    } else if (bulletSpeedLevel < MAX_BULLET_SPEED_LEVEL) {
      bulletSpeedLevel++;
      BULLET_SPEED += 10;
      showToast("⚡ Bullet Speed +1 (FREE)");
    } else {
      money += 50;
      showToast("🪙 +₱50 (MAX upgrades)");
    }
    refreshUpgradeButtons();
  }
}

function startBossFight() {
  const loots = ["heart", "coins", "upgrade"];
  const loot = loots[Math.floor(Math.random() * loots.length)];
  boss = {
    x: canvasElement.width / 2,
    y: 120,
    r: 70,
    hp: 50,
    maxHp: 50,
    vx: 2.5,
    lastHit: 0,
    loot,
  };
  bombs = [];
  currentTarget = null;
  bonusTargets = [];
  bossMinionInterval = setInterval(() => {
    if (boss && bombs.length < 3) {
      let spawnX, spawnY;
      do {
        spawnX = Math.random() * (canvasElement.width - 100) + 50;
        spawnY = Math.random() * (canvasElement.height - 100) + 50;
      } while (Math.hypot(spawnX - boss.x, spawnY - boss.y) < boss.r * 2);

      const bomb = {
        x: spawnX,
        y: spawnY,
        r: 20,
        createdAt: Date.now(),
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
      };
      bombs.push(bomb);
    }
  }, 2000);
}

function endBossFight(victory) {
  clearInterval(bossMinionInterval);
  bossMinionInterval = null;
  if (victory && boss) {
    spawnBurst(boss.x, boss.y, "rgba(255,220,120,.95)", 60, 8, 520);
    playExplosion();
    const lootKind = boss.loot;
    setTimeout(() => grantLoot(lootKind), 100);
    money += 200;
    score += 2;
    bossesDefeated++;
    updateScoreboard();
  } else {
    endGame();
  }
  boss = null;
  bombs = [];
  spawnTargetIfNone();
}

// timeouts
setInterval(() => {
  const now = Date.now();
  if (currentTarget && now - currentTarget.createdAt > TARGET_TIMEOUT) {
    currentTarget = null;
    spawnTargetIfNone();
  }
  for (let i = bonusTargets.length - 1; i >= 0; i--) {
    if (now - bonusTargets[i].createdAt > BONUS_TIMEOUT) {
      bonusTargets.splice(i, 1);
    }
  }
}, 300);

// Restart game
restartBtn.addEventListener("click", () => {
  // keep best score in localStorage; reset round
  score = 0;
  lives = 3;
  money = 0;
  bonusValue = 50;
  bulletSpeedLevel = 0;
  burstLevel = 0;
  bulletsBounce = false;
  BULLET_SPEED = 35;
  bossesDefeated = 0;
  boss = null;
  bullets = [];
  bombs = [];
  bonusTargets = [];
  currentTarget = null;
  gameOverEl.style.display = "none";
  updateScoreboard();
  updateHearts();
  refreshUpgradeButtons();
  spawnTargetIfNone();
});

spawnTargetIfNone();

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => await hands.send({ image: videoElement }),
  width: 1280,
  height: 720,
});
camera.start();

// ----- Upgrades UI logic (unchanged) -----
let panelOpen = false;
toggleUpgradesBtn.addEventListener("click", () => {
  panelOpen = !panelOpen;
  upgradesPanel.style.right = panelOpen ? "12px" : "-320px";
  toggleUpgradesBtn.textContent = panelOpen ? "Close" : "Upgrades";
});

function refreshUpgradeButtons() {
  // compute costs
  const bsCost =
    BULLET_SPEED_BASE_COST + bulletSpeedLevel * BULLET_SPEED_COST_INC;
  const bfCost = BURST_FIRE_BASE_COST + burstLevel * BURST_FIRE_COST_INC;

  // --- Bullet Speed ---
  if (bulletSpeedLevel >= MAX_BULLET_SPEED_LEVEL) {
    buyBulletSpeedBtn.disabled = true;
    buyBulletSpeedBtn.textContent = "MAX";
    buyBulletSpeedBtn.title = "Max level reached";
  } else {
    const canBuy = money >= bsCost;
    buyBulletSpeedBtn.disabled = !canBuy; // <- disable if not enough money
    buyBulletSpeedBtn.textContent = `Buy ₱${bsCost}`;
    buyBulletSpeedBtn.title = canBuy ? "Purchase upgrade" : "Not enough money";
  }

  // --- Burst Fire ---
  if (burstLevel >= MAX_BURST_LEVEL) {
    buyBurstFireBtn.disabled = true;
    buyBurstFireBtn.textContent = "MAX";
    buyBurstFireBtn.title = "Max level reached";
  } else {
    const canBuy = money >= bfCost;
    buyBurstFireBtn.disabled = !canBuy; // <- disable if not enough money
    buyBurstFireBtn.textContent = `Buy ₱${bfCost}`;
    buyBurstFireBtn.title = canBuy ? "Purchase upgrade" : "Not enough money";
  }

  // --- Bouncing Bullets (one-time) ---
  if (bulletsBounce) {
    buyBouncingBulletsBtn.disabled = true;
    buyBouncingBulletsBtn.textContent = "Owned";
    buyBouncingBulletsBtn.title = "Already purchased";
  } else {
    const canBuy = money >= BOUNCING_BULLETS_COST;
    buyBouncingBulletsBtn.disabled = !canBuy; // <- disable if not enough money
    buyBouncingBulletsBtn.textContent = `Buy ₱${BOUNCING_BULLETS_COST}`;
    buyBouncingBulletsBtn.title = canBuy
      ? "Purchase upgrade"
      : "Not enough money";
  }

  // reflect current levels in UI labels
  bsLevelEl.textContent = bulletSpeedLevel;
  bfLevelEl.textContent = burstLevel;
}

setInterval(refreshUpgradeButtons, 400);

buyBulletSpeedBtn.addEventListener("click", () => {
  const cost =
    BULLET_SPEED_BASE_COST + bulletSpeedLevel * BULLET_SPEED_COST_INC;
  if (money >= cost && bulletSpeedLevel < MAX_BULLET_SPEED_LEVEL) {
    money -= cost;
    BULLET_SPEED += 10;
    bulletSpeedLevel++;
    updateScoreboard();
    refreshUpgradeButtons();
    trySpawnBonus();
  }
});

buyBurstFireBtn.addEventListener("click", () => {
  const cost = BURST_FIRE_BASE_COST + burstLevel * BURST_FIRE_COST_INC;
  if (money >= cost && burstLevel < MAX_BURST_LEVEL) {
    money -= cost;
    burstLevel++;
    updateScoreboard();
    refreshUpgradeButtons();
    trySpawnBonus();
  }
});

buyBouncingBulletsBtn.addEventListener("click", () => {
  if (money >= BOUNCING_BULLETS_COST && !bulletsBounce) {
    money -= BOUNCING_BULLETS_COST;
    bulletsBounce = true;
    updateScoreboard();
    refreshUpgradeButtons();
    trySpawnBonus();
  }
});

// --- BOMB SPAWNING LOGIC (unchanged) ---
setInterval(() => {
  if (score < 5 || bombs.length >= 1 || boss) return;
  if (Math.random() < 0.1) {
    const x = Math.random() * (canvasElement.width - 100) + 50;
    const y = Math.random() * (canvasElement.height - 100) + 50;
    const newBomb = { x, y, r: 25, createdAt: Date.now() };

    if (score >= 10) {
      const speedMultiplier = Math.floor(Math.max(0, score - 10) / 5);
      const bombSpeed = 1.0 + speedMultiplier * 0.5;
      const angle = Math.random() * Math.PI * 2;
      newBomb.vx = Math.cos(angle) * bombSpeed;
      newBomb.vy = Math.sin(angle) * bombSpeed;
    }
    bombs.push(newBomb);
  }
}, 1000);

/* ====== ADDITIONS: Splash Flow + Music + Helpers ====== */
const splash = document.getElementById("splash");
const developedBy = document.getElementById("developedBy");
const startBtn = document.getElementById("startBtn");
const howBtn = document.getElementById("howBtn");
const creditBtn = document.getElementById("creditBtn");
const worldRoot = document.getElementById("worldRoot");
const muteBtn = document.getElementById("muteBtn");
const helpBtn = document.getElementById("helpBtn");

// WebAudio BGM
let audioCtx,
  bgGain,
  isMuted = false,
  playing = false,
  musicNodes = [];
function makeSynthNote(time, freq, dur = 0.28, type = "triangle", gain = 0.06) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(bgGain);
  osc.start(time);
  osc.stop(time + dur);
  musicNodes.push(osc, g);
}
function loopPattern() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const bpm = 108,
    beat = 60 / bpm;
  const root = 392.0; // G4
  const p = [root, root * 1.25, root * 1.5, root * 2]; // G-B-D-G
  for (let bar = 0; bar < 4; bar++) {
    const t0 = now + bar * 4 * beat;
    for (let i = 0; i < 8; i++) {
      const f = p[i % p.length] * (i % 4 === 3 ? 0.5 : 1);
      makeSynthNote(t0 + i * 0.5 * beat, f);
    }
  }
  setTimeout(loopPattern, 4 * 4 * beat * 1000);
}
function startMusic() {
  if (playing) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  bgGain = audioCtx.createGain();
  bgGain.gain.value = 0.6;
  bgGain.connect(audioCtx.destination);
  playing = true;
  loopPattern();
}
function setMuted(m) {
  isMuted = m;
  if (bgGain) bgGain.gain.value = m ? 0 : 0.6;
  muteBtn.textContent = m ? "🔇 Music" : "🔊 Music";
}

// Splash actions
startBtn.addEventListener("click", async () => {
  try {
    startMusic();
  } catch (e) {}
  setMuted(false);
  worldRoot.classList.add("play");
  splash.style.transition = "opacity .6s ease";
  splash.style.opacity = "0";
  setTimeout(() => {
    splash.style.display = "none";
    showDevelopedBy();
  }, 650);
});

function showDevelopedBy() {
  developedBy.classList.add("show");
  setTimeout(() => developedBy.classList.remove("show"), 1600);
}

howBtn.addEventListener("click", () => {
  alert(
    "How to Play:\n\n1) Make a finger-gun: index extended, thumb up, mid/ring/pinky curled.\n2) Aim at the coin.\n3) Hold pose for ~1s to auto-fire.\n4) Coins: Bronze=₱5, Silver=₱10, Gold=₱20. Avoid bombs!"
  );
});
creditBtn.addEventListener("click", () => {
  alert(
    "Credits:\n• Game: Flick n’ Fire\n• Devs: Butial & Laylo\n• Tech: MediaPipe Hands, Canvas, WebAudio"
  );
});
helpBtn.addEventListener("click", () => howBtn.click());
muteBtn.addEventListener("click", () => setMuted(!isMuted));

worldRoot.classList.remove("play");

setTimeout(() => {
  if (splash.style.display !== "none") startBtn.classList.add("neon");
}, 4000);

/* === Cartoon/Minecraft-ish BG animation on bgCanvas === */
const bg = document.getElementById("bgCanvas");
const bgx = bg.getContext("2d");
let tbg = 0;
function drawBG() {
  const w = bg.width,
    h = bg.height;
  tbg += 0.5;

  const sky = bgx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1b2240");
  sky.addColorStop(1, "#0a0f1e");
  bgx.fillStyle = sky;
  bgx.fillRect(0, 0, w, h);

  for (let i = 0; i < 6; i++) {
    const y = 80 + i * 40 + Math.sin((tbg + i) * 0.02) * 10;
    const x = ((tbg * 0.8 + i * 220) % (w + 240)) - 120;
    bgx.fillStyle = "#e6eef7";
    for (let j = 0; j < 5; j++) {
      bgx.fillRect(x + j * 26, y + (j % 2 ? 8 : 0), 50, 26);
    }
    bgx.globalAlpha = 0.12;
    bgx.fillStyle = "#ffffff";
    bgx.fillRect(x, y, 130, 26);
    bgx.globalAlpha = 1;
  }

  function hill(y, amp, color, speed, block = 16) {
    bgx.fillStyle = color;
    const baseY = h - y;
    for (let x = 0; x < w + block; x += block) {
      const yy = baseY + Math.sin((x + tbg * speed) / 120) * amp;
      bgx.fillRect(x, yy, block, h - yy);
    }
  }
  hill(180, 24, "#0d1b2a", 1.0);
  hill(140, 18, "#132238", 0.7);
  hill(100, 12, "#19324e", 0.5);

  requestAnimationFrame(drawBG);
}
drawBG();
