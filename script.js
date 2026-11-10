"use strict";

// ============================================
// 1. CANVAS
// ============================================

const cv = document.getElementById("game");
const ctx = cv.getContext("2d");

const T = 32;
const W = 240;
const H = 80;

let cam = { x: 0, y: 0 };

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);

  cv.width = Math.floor(innerWidth * dpr);
  cv.height = Math.floor(innerHeight * dpr);

  cv.style.width = innerWidth + "px";
  cv.style.height = innerHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

addEventListener("resize", resize);
resize();

// ============================================
// 2. GERADOR ALEATÓRIO
// ============================================

let seed = 1337;

const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// ============================================
// 3. BLOCOS
// ============================================

const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const WOOD = 4;
const LEAVES = 5;
const PLANKS = 6;
const COAL = 7;
const SAND = 8;

const INFO = {
  [GRASS]: { n: "Grama", h: 0.5, drop: DIRT },
  [DIRT]: { n: "Terra", h: 0.5, drop: DIRT },
  [STONE]: { n: "Pedra", h: 1.4, drop: STONE },
  [WOOD]: { n: "Madeira", h: 0.9, drop: WOOD },
  [LEAVES]: { n: "Folhas", h: 0.2, drop: LEAVES },
  [PLANKS]: { n: "Tábua", h: 0.8, drop: PLANKS },
  [COAL]: { n: "Carvão", h: 1.6, drop: COAL },
  [SAND]: { n: "Areia", h: 0.4, drop: SAND }
};

// ============================================
// 4. TEXTURAS
// ============================================

const tex = {};

function makeTex(type) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;

  const g = c.getContext("2d");

  const dot = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };

  const pick = arr =>
    arr[Math.floor(rnd() * arr.length)];

  const fill = cols => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        dot(x, y, pick(cols));
      }
    }
  };

  const dirt = [
    "#8a5a36", "#7a4d2c",
    "#96643d", "#6e4526"
  ];

  const stone = [
    "#8c8c8c", "#7d7d7d",
    "#999999", "#707070"
  ];

  if (type === DIRT) fill(dirt);

  if (type === STONE) fill(stone);

  if (type === SAND) {
    fill(["#e2d38f", "#d8c880", "#ecdf9c"]);
  }

  if (type === GRASS) {
    fill(dirt);

    for (let x = 0; x < 16; x++) {
      const d = 3 + (rnd() < 0.5 ? 1 : 0);

      for (let y = 0; y < d; y++) {
        dot(
          x, y,
          pick(["#5aa83a", "#4b9530", "#6bbd45"])
        );
      }
    }
  }

  if (type === WOOD) {
    for (let x = 0; x < 16; x++) {
      const col =
        x % 4 === 0 ? "#3b2a14" :
        x % 4 === 2 ? "#6b4a26" :
        "#5a3d1f";

      for (let y = 0; y < 16; y++) {
        dot(x, y, rnd() < 0.15 ? "#4a3319" : col);
      }
    }
  }

  if (type === PLANKS) {
    fill(["#b8894f", "#c19458", "#ae8048"]);

    for (let x = 0; x < 16; x++) {
      [3, 7, 11, 15].forEach(y => {
        dot(x, y, "#6d4c26");
      });
    }
  }

  if (type === LEAVES) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (rnd() < 0.12) continue;

        dot(
          x, y,
          pick(["#2f7d22", "#3b9429", "#256a1b", "#47a533"])
        );
      }
    }
  }

  if (type === COAL) {
    fill(stone);

    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(rnd() * 12);
      const y = 1 + Math.floor(rnd() * 12);

      g.fillStyle = "#1c1c1c";
      g.fillRect(x, y, 3, 2);
      g.fillRect(x + 1, y + 2, 2, 1);
    }
  }

  g.fillStyle = "rgba(0,0,0,.18)";
  g.fillRect(0, 15, 16, 1);
  g.fillRect(15, 0, 1, 16);

  g.fillStyle = "rgba(255,255,255,.10)";
  g.fillRect(0, 0, 16, 1);
  g.fillRect(0, 0, 1, 16);

  tex[type] = c;
}

Object.keys(INFO).forEach(t => makeTex(Number(t)));

// ============================================
// 5. MUNDO
// ============================================

const world = new Uint8Array(W * H);

const at = (x, y) => {
  if (x < 0 || x >= W || y < 0 || y >= H) return AIR;
  return world[y * W + x];
};

const set = (x, y, type) => {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    world[y * W + x] = type;
  }
};

const heights = [];

function generateWorld() {
  world.fill(AIR);
  heights.length = 0;
  seed = 1337;

  for (let x = 0; x < W; x++) {
    const h = Math.floor(
      30 +
      6 * Math.sin(x * 0.05) +
      4 * Math.sin(x * 0.13 + 1) +
      2 * Math.sin(x * 0.31)
    );

    heights.push(h);

    for (let y = h; y < H; y++) {
      let type =
        y === h ? GRASS :
        y < h + 4 ? DIRT :
        STONE;

      if (type === STONE) {
        const n =
          Math.sin(x * 0.3) * Math.sin(y * 0.3) +
          Math.sin(x * 0.13 + y * 0.17);

        if (y > h + 6 && n > 1.35) {
          type = AIR;
        } else if (y > h + 8 && rnd() < 0.04) {
          type = COAL;
        }
      }

      set(x, y, type);
    }
  }

  generateTrees();
}

function generateTrees() {
  for (let x = 4; x < W - 4; x += 2) {
    if (rnd() < 0.3) {
      const h = heights[x];
      const treeHeight = 4 + Math.floor(rnd() * 2);

      for (let i = 1; i <= treeHeight; i++) {
        set(x, h - i, WOOD);
      }

      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 0; dy++) {
          if (
            !(Math.abs(dx) === 2 && dy === -2) &&
            at(x + dx, h - treeHeight + dy) === AIR
          ) {
            set(x + dx, h - treeHeight + dy, LEAVES);
          }
        }
      }

      set(x, h - treeHeight - 1, LEAVES);
      x += 3;
    }
  }
}

// ============================================
// 6. JOGADOR
// ============================================

const P = {
  x: Math.floor(W / 2) * T,
  y: 0,
  w: 22,
  h: 52,
  vx: 0,
  vy: 0,
  ground: false,
  face: 1,
  walk: 0
};

P.y = (heights[Math.floor(W / 2)] - 3) * T;

// ============================================
// 7. INVENTÁRIO
// ============================================

const inv = {
  [DIRT]: 10,
  [STONE]: 0,
  [WOOD]: 0,
  [PLANKS]: 10,
  [LEAVES]: 0,
  [COAL]: 0,
  [SAND]: 0
};

const slots = [
  DIRT, STONE, WOOD,
  PLANKS, LEAVES, SAND, COAL
];

let sel = 0;

const hb = document.getElementById("hotbar");

slots.forEach((type, i) => {
  const d = document.createElement("div");

  d.className = "slot";

  const img = document.createElement("i");
  img.style.backgroundImage = `url(${tex[type].toDataURL()})`;

  const number = document.createElement("em");
  number.textContent = i + 1;

  const count = document.createElement("span");

  d.append(number, img, count);

  d.onclick = () => {
    sel = i;
    updateHUD();
  };

  hb.appendChild(d);
});

function updateHUD() {
  [...hb.children].forEach((d, i) => {
    d.classList.toggle("sel", i === sel);

    d.querySelector("span").textContent =
      inv[slots[i]] || "";

    d.title = INFO[slots[i]].n;
  });
}

updateHUD();

// ============================================
// 8. CONTROLES
// ============================================

const keys = {};

let mx = 0;
let my = 0;
let mining = false;

addEventListener("keydown", e => {
  keys[e.code] = true;

  if (e.code >= "Digit1" && e.code <= "Digit7") {
    sel = Number(e.code.slice(5)) - 1;
    updateHUD();
  }

  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) {
    e.preventDefault();
  }
});

addEventListener("keyup", e => {
  keys[e.code] = false;
});

addEventListener("blur", () => {
  Object.keys(keys).forEach(k => keys[k] = false);
  mining = false;
});

cv.addEventListener("mousemove", e => {
  mx = e.clientX;
  my = e.clientY;
});

cv.addEventListener("contextmenu", e => {
  e.preventDefault();
});

cv.addEventListener("mousedown", e => {
  mx = e.clientX;
  my = e.clientY;

  if (e.button === 0) mining = true;

  if (e.button === 2) place();
});

addEventListener("mouseup", e => {
  if (e.button === 0) mining = false;
});

cv.addEventListener("wheel", e => {
  sel = (sel + (e.deltaY > 0 ? 1 : 6)) % 7;
  updateHUD();
  e.preventDefault();
}, { passive: false });

// ============================================
// 9. FÍSICA E COLISÕES
// ============================================

const solid = (tx, ty) => {
  if (tx < 0 || tx >= W || ty >= H) return true;
  if (ty < 0) return false;

  return at(tx, ty) !== AIR;
};

function hit(x, y) {
  for (
    let ty = Math.floor(y / T);
    ty <= Math.floor((y + P.h - 1) / T);
    ty++
  ) {
    for (
      let tx = Math.floor(x / T);
      tx <= Math.floor((x + P.w - 1) / T);
      tx++
    ) {
      if (solid(tx, ty)) return true;
    }
  }

  return false;
}

function physics() {
  const dir =
    (keys.KeyD || keys.ArrowRight ? 1 : 0) -
    (keys.KeyA || keys.ArrowLeft ? 1 : 0);

  P.vx = dir * 4;

  if (dir) P.face = dir;

  if (
    (keys.KeyW || keys.Space || keys.ArrowUp) &&
    P.ground
  ) {
    P.vy = -11.5;
    P.ground = false;
  }

  P.vy = Math.min(P.vy + 0.6, 18);

  const nx = P.x + P.vx;

  if (!hit(nx, P.y)) {
    P.x = nx;
  }

  const ny = P.y + P.vy;

  P.ground = false;

  if (!hit(P.x, ny)) {
    P.y = ny;
  } else {
    if (P.vy > 0) {
      P.y =
        Math.floor((P.y + P.h + P.vy) / T) * T -
        P.h - 0.01;

      P.ground = true;
    }

    P.vy = 0;
  }

  P.walk = dir && P.ground ? P.walk + 0.25 : 0;

  P.x = Math.max(0, Math.min(W * T - P.w, P.x));
}

// ============================================
// 10. CONSTRUIR E MINERAR
// ============================================

let prog = 0;
let last = null;

function target() {
  const tx = Math.floor((mx + cam.x) / T);
  const ty = Math.floor((my + cam.y) / T);

  const dx =
    tx * T + T / 2 - (P.x + P.w / 2);

  const dy =
    ty * T + T / 2 - (P.y + P.h / 2);

  return {
    tx,
    ty,
    ok:
      Math.hypot(dx, dy) <= 5 * T &&
      tx >= 0 && tx < W &&
      ty >= 0 && ty < H
  };
}

function place() {
  const { tx, ty, ok } = target();
  const type = slots[sel];

  if (!ok || at(tx, ty) !== AIR || inv[type] <= 0) return;

  if (
    !solid(tx + 1, ty) &&
    !solid(tx - 1, ty) &&
    !solid(tx, ty + 1) &&
    !solid(tx, ty - 1)
  ) return;

  const overlapsX =
    tx * T < P.x + P.w &&
    tx * T + T > P.x;

  const overlapsY =
    ty * T < P.y + P.h &&
    ty * T + T > P.y;

  if (overlapsX && overlapsY) return;

  set(tx, ty, type);
  inv[type]--;

  updateHUD();
}

function mine(dt) {
  const { tx, ty, ok } = target();

  if (
    !mining ||
    !ok ||
    at(tx, ty) === AIR ||
    ty >= H - 1
  ) {
    prog = 0;
    last = null;
    return;
  }

  const key = tx + "," + ty;

  if (key !== last) {
    last = key;
    prog = 0;
  }

  const block = at(tx, ty);

  prog += dt / INFO[block].h;

  if (prog >= 1) {
    const drop = INFO[block].drop;

    inv[drop] = (inv[drop] || 0) + 1;

    set(tx, ty, AIR);

    prog = 0;
    last = null;

    updateHUD();
  }
}

// ============================================
// 11. CÉU E CICLO DE DIA E NOITE
// ============================================

let time = 0.2;

const mix = (a, b, k) =>
  a.map((v, i) => Math.round(v + (b[i] - v) * k));

function sky() {
  const a = time * Math.PI * 2;
  const s = Math.sin(a);

  const k = Math.max(0, Math.min(1, s * 2 + 0.5));

  const color = mix(
    [6, 10, 32],
    [120, 183, 255],
    k
  );

  ctx.fillStyle = `rgb(${color.join(",")})`;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  if (k < 0.9) {
    ctx.fillStyle = `rgba(255,255,255,${1 - k})`;

    for (let i = 0; i < 60; i++) {
      ctx.fillRect(
        (i * 97.3) % innerWidth,
        (i * 53.7) % (innerHeight * 0.6),
        2, 2
      );
    }
  }

  const hx =
    innerWidth / 2 + Math.cos(a) * innerWidth * 0.42;

  const hy =
    innerHeight * 0.55 - s * innerHeight * 0.45;

  ctx.fillStyle = "#ffe65a";
  ctx.fillRect(hx - 24, hy - 24, 48, 48);

  ctx.fillStyle = "#e8ecf5";

  ctx.fillRect(
    innerWidth - hx - 20,
    innerHeight * 0.55 + s * innerHeight * 0.45 - 20,
    40, 40
  );

  return k;
}

// ============================================
// 12. PERSONAGEM
// ============================================

function drawPlayer() {
  const x = Math.round(P.x - cam.x);
  const y = Math.round(P.y - cam.y);

  const sw = Math.sin(P.walk) * 6;

  const R = (color, dx, dy, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx, y + dy, w, h);
  };

  // Pernas
  R("#2c2c8a", 3 + sw, 34, 8, 18);
  R("#2c2c8a", 11 - sw, 34, 8, 18);

  // Corpo
  R("#2aa6a6", 2, 16, 18, 18);

  // Braço
  R("#c68863", P.face > 0 ? 18 : -2, 18 + Math.abs(sw) / 3, 4, 12);

  // Cabeça
  R("#c68863", 1, 0, 20, 18);

  // Cabelo
  R("#3b2412", 1, 0, 20, 6);

  // Olho
  R("#fff", P.face > 0 ? 12 : 4, 9, 4, 3);
  R("#4a3bb5", P.face > 0 ? 14 : 4, 9, 2, 3);
}

// ============================================
// 13. DESENHO DO MUNDO
// ============================================

function drawWorld() {
  const x0 = Math.floor(cam.x / T);
  const x1 = Math.ceil((cam.x + innerWidth) / T);

  const y0 = Math.floor(cam.y / T);
  const y1 = Math.ceil((cam.y + innerHeight) / T);

  for (
    let ty = Math.max(0, y0);
    ty < Math.min(H, y1);
    ty++
  ) {
    for (
      let tx = Math.max(0, x0);
      tx < Math.min(W, x1);
      tx++
    ) {
      const type = at(tx, ty);

      if (type !== AIR) {
        ctx.drawImage(
          tex[type],
          tx * T - cam.x,
          ty * T - cam.y,
          T, T
        );
      }
    }
  }
}

// ============================================
// 14. ALVO DE MINERAÇÃO
// ============================================

function drawTarget() {
  const tg = target();

  if (tg.ok) {
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 2;

    ctx.strokeRect(
      tg.tx * T - cam.x + 1,
      tg.ty * T - cam.y + 1,
      T - 2,
      T - 2
    );
  }

  if (prog > 0 && last) {
    const [bx, by] = last.split(",").map(Number);

    ctx.fillStyle = `rgba(0,0,0,${Math.min(prog, 1) * 0.55})`;

    ctx.fillRect(
      bx * T - cam.x,
      by * T - cam.y,
      T, T
    );
  }
}

// ============================================
// 15. LOOP PRINCIPAL
// ============================================

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.t || now)) / 1000);

  frame.t = now;

  time = (time + dt / 240) % 1;

  physics();
  mine(dt);

  cam.x = Math.max(
    0,
    Math.min(
      W * T - innerWidth,
      P.x + P.w / 2 - innerWidth / 2
    )
  );

  cam.y = Math.max(
    0,
    Math.min(
      H * T - innerHeight,
      P.y + P.h / 2 - innerHeight / 2
    )
  );

  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);

  const k = sky();

  drawWorld();
  drawPlayer();
  drawTarget();

  ctx.fillStyle = `rgba(0,0,40,${(1 - k) * 0.4})`;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  requestAnimationFrame(frame);
}

// ============================================
// 16. INICIALIZAÇÃO
// ============================================

generateWorld();

P.y = (heights[Math.floor(W / 2)] - 3) * T;

resize();

requestAnimationFrame(frame);