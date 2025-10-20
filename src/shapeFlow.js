// shapeFlow.js — Title screen: optimized flowing swarm (auto uses full registry, excludes Shapeless)
import { shapeRegistry } from './shapes/shapes.js';

const canvas = document.getElementById('titleBgCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

function resize() {
  canvas.width = Math.max(1, innerWidth);
  canvas.height = Math.max(1, innerHeight);
}
resize();
addEventListener('resize', resize);

// Pool = everything except Shapeless (auto-updates when you add shapes)
const SHAPES = (shapeRegistry || []).filter((s) => (s?.name || '').toLowerCase() !== 'shapeless');

// ───────────────── helpers ─────────────────
const PATH_CACHE = new Map(); // key: kind|radiusInt → Path2D
const rgba = (hex, a = 0.9) => {
  if (!hex) return `rgba(255,255,255,${a})`;
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h, 16),
    r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};
function polyPath(n, r, rot = 0) {
  const p = new Path2D();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath();
  return p;
}
function getPath(kind, r) {
  const key = kind + '|' + (r | 0);
  let path = PATH_CACHE.get(key);
  if (path) return path;

  const p = new Path2D();
  const rot = 0;

  switch (kind) {
    case 'circle':
      p.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square':
      p.addPath(polyPath(4, r, Math.PI / 4));
      break; // oriented like gameplay UI
    case 'triangle':
      p.addPath(polyPath(3, r));
      break;
    case 'pentagon':
      p.addPath(polyPath(5, r));
      break;
    case 'octagon':
      p.addPath(polyPath(8, r));
      break;
    case 'ellipse': {
      // ellipse with fixed ratio to avoid “egg” look
      const e = new Path2D();
      e.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
      p.addPath(e);
      break;
    }
    case 'kite':
      p.addPath(polyPath(4, r, 0));
      break;
    case 'arrow': {
      p.moveTo(-r * 0.95, 0);
      p.lineTo(r * 0.3, 0);
      p.lineTo(r * 0.15, -r * 0.45);
      p.lineTo(r, 0);
      p.lineTo(r * 0.15, r * 0.45);
      p.lineTo(r * 0.3, 0);
      p.closePath();
      break;
    }
    case 'heart': {
      const s = r / 1.15;
      p.moveTo(0, s * 0.65);
      p.bezierCurveTo(s, -s * 0.1, s * 0.6, -s, 0, -s * 0.55);
      p.bezierCurveTo(-s * 0.6, -s, -s, -s * 0.1, 0, s * 0.65);
      p.closePath();
      break;
    }
    case 'crescent': {
      const c = new Path2D();
      c.arc(0, 0, r, Math.PI * 0.2, -Math.PI * 0.2, false);
      c.arc(r * 0.45, 0, r, -Math.PI * 0.2, Math.PI * 0.2, true);
      c.closePath();
      p.addPath(c);
      break;
    }
    case 'star': {
      const pnts = 5,
        inner = r * 0.45;
      for (let i = 0; i < pnts * 2; i++) {
        const rr = i % 2 ? inner : r,
          ang = (i / (pnts * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(ang) * rr,
          y = Math.sin(ang) * rr;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
      break;
    }
    case 'snowflake': {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        p.moveTo(Math.cos(ang) * -r, Math.sin(ang) * -r);
        p.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      break;
    }
    case 'hourglass':
      p.moveTo(-r, -r);
      p.lineTo(r, r);
      p.moveTo(-r, r);
      p.lineTo(r, -r);
      break;
    case 'check':
      p.moveTo(-r * 0.8, 0);
      p.lineTo(-r * 0.2, r * 0.55);
      p.lineTo(r * 0.9, -r * 0.45);
      break;
    case 'angel': {
      // star + halo
      p.addPath(getPath('star', r));
      const halo = new Path2D();
      halo.arc(0, -r * 1.3, r * 0.25, 0, Math.PI * 2);
      p.addPath(halo);
      break;
    }
    case 'gear': {
      const teeth = 8,
        r1 = r * 0.75,
        r2 = r * 1.05;
      for (let i = 0; i < teeth * 2; i++) {
        const rr = i % 2 ? r1 : r2,
          ang = (i / (teeth * 2)) * Math.PI * 2;
        const x = Math.cos(ang) * rr,
          y = Math.sin(ang) * rr;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
      p.moveTo(r * 0.35, 0);
      p.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      break;
    }
    case 'icecream': {
      p.moveTo(-r * 0.55, r * 0.2);
      p.lineTo(0, r);
      p.lineTo(r * 0.55, r * 0.2);
      p.closePath();
      const top = new Path2D();
      top.arc(0, -r * 0.3, r * 0.7, 0, Math.PI * 2);
      p.addPath(top);
      break;
    }
    case 'key': {
      p.moveTo(0, 0);
      p.lineTo(r * 0.95, 0);
      p.lineTo(r * 0.7, -r * 0.25);
      p.moveTo(r * 0.7, -r * 0.25);
      p.lineTo(r * 0.55, -r * 0.05);
      const ring = new Path2D();
      ring.arc(-r * 0.4, 0, r * 0.45, 0, Math.PI * 2);
      p.addPath(ring);
      break;
    }
    case 'flower': {
      for (let i = 0; i < 6; i++) {
        const pet = new Path2D();
        pet.ellipse(0, r * 0.55, r * 0.36, r * 0.18, (i * Math.PI) / 3, 0, Math.PI * 2);
        p.addPath(pet);
      }
      break;
    }
    case 'music': {
      p.moveTo(0, -r);
      p.lineTo(0, r * 0.6);
      const head = new Path2D();
      head.arc(0, r * 0.9, r * 0.4, 0, Math.PI * 2);
      p.addPath(head);
      p.moveTo(0, -r);
      p.quadraticCurveTo(r * 0.7, -r * 0.8, r * 0.85, -r * 0.2);
      break;
    }
    case 'puzzle': {
      const rr = r * 0.9;
      p.moveTo(-rr, -rr);
      p.lineTo(-rr * 0.2, -rr);
      p.arc(0, -rr, rr * 0.2, Math.PI, 0);
      p.lineTo(rr, -rr);
      p.lineTo(rr, rr * 0.2);
      p.arc(rr, 0, rr * 0.2, -Math.PI / 2, Math.PI / 2);
      p.lineTo(rr, rr);
      p.lineTo(rr * 0.2, rr);
      p.arc(0, rr, rr * 0.2, 0, Math.PI);
      p.lineTo(-rr, rr);
      p.lineTo(-rr, -rr * 0.2);
      p.arc(-rr, 0, rr * 0.2, Math.PI / 2, -Math.PI / 2);
      p.closePath();
      break;
    }
    case 'sun': {
      const core = new Path2D();
      core.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      p.addPath(core);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2,
          R = r * 1.2;
        p.moveTo(Math.cos(ang) * r * 0.75, Math.sin(ang) * r * 0.75);
        p.lineTo(Math.cos(ang) * R, Math.sin(ang) * R);
      }
      break;
    }
    case 'spiral': {
      let t = 0;
      const turns = 2.2,
        steps = 36;
      for (let i = 0; i <= steps; i++) {
        t = (i / steps) * Math.PI * 2 * turns;
        const rr = r * (i / steps);
        const x = Math.cos(t) * rr,
          y = Math.sin(t) * rr;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      break;
    }
    case 'butterfly': {
      const L = new Path2D();
      L.ellipse(-r * 0.35, 0, r * 0.62, r * 0.38, 0, 0, Math.PI * 2);
      const R = new Path2D();
      R.ellipse(r * 0.35, 0, r * 0.62, r * 0.38, 0, 0, Math.PI * 2);
      p.addPath(L);
      p.addPath(R);
      break;
    }
    default:
      p.arc(0, 0, r, 0, Math.PI * 2);
  }

  PATH_CACHE.set(key, p);
  return p;
}

// Name→kind mapper (fallback = circle; adding new shapes later just works)
const KIND_BY_NAME = (name) => {
  const n = (name || '').toLowerCase();
  if (n === 'square') return 'square';
  if (n === 'kite') return 'kite';
  if (n === 'arrow') return 'arrow';
  if (n === 'circle') return 'circle';
  if (n === 'heart') return 'heart';
  if (n === 'triangle') return 'triangle';
  if (n === 'ellipse') return 'ellipse';
  if (n === 'crescentmoon') return 'crescent';
  if (n === 'pentagon') return 'pentagon';
  if (n === 'octagon') return 'octagon';
  if (n === 'snowflake') return 'snowflake';
  if (n === 'butterfly') return 'butterfly';
  if (n === 'hourglass') return 'hourglass';
  if (n === 'check') return 'check';
  if (n === 'angel') return 'angel';
  if (n === 'gear') return 'gear';
  if (n === 'icecream') return 'icecream';
  if (n === 'key') return 'key';
  if (n === 'flower') return 'flower';
  if (n === 'musicnote') return 'music';
  if (n === 'puzzlepiece') return 'puzzle';
  if (n === 'star') return 'star';
  if (n === 'sun') return 'sun';
  if (n === 'spiral') return 'spiral';
  return 'circle';
};

// Density (reduced) — 1080p ~150 items, fullscreen still smooth
const TARGET = Math.min(240, Math.max(100, Math.floor((innerWidth * innerHeight) / 7000)));
const PARTICLES = new Array(TARGET).fill(0).map(() => {
  const s = SHAPES.length
    ? SHAPES[(Math.random() * SHAPES.length) | 0]
    : { name: 'circle', color: '#9cf' };
  return {
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 6 + Math.random() * 10,
    a: Math.random() * Math.PI * 2,
    vx: 0,
    vy: 0,
    hue: s.color || '#9cf',
    kind: KIND_BY_NAME(s.name),
    speed: 0.35 + Math.random() * 0.55,
  };
});

// Flow + separation
const angleAt = (x, y, t) => Math.sin(x * 0.002 + t * 0.5) + Math.cos(y * 0.0014 - t * 0.28);

// Spatial hash
const CELL = 40;
const SEP_RADIUS = 1.2;
const SEP_FORCE = 0.02;

// ───────────────── loop ─────────────────
let last = performance.now();
let frame = 0;
function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  if (document.body.dataset.screen !== 'title') return;

  const dt = Math.min(40, now - last);
  last = now;
  const t = now / 1000;

  // 1) Move (toward flow)
  for (const p of PARTICLES) {
    const ang = angleAt(p.x, p.y, t);
    const tx = Math.cos(ang) * p.speed;
    const ty = Math.sin(ang) * p.speed;
    p.vx += (tx - p.vx) * 0.06;
    p.vy += (ty - p.vy) * 0.06;
    p.a += 0.0015 * (Math.random() - 0.5);
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;

    // wrap
    if (p.x < -20) p.x = canvas.width + 20;
    if (p.x > canvas.width + 20) p.x = -20;
    if (p.y < -20) p.y = canvas.height + 20;
    if (p.y > canvas.height + 20) p.y = -20;
  }

  // 2) Separation every third frame (big perf win)
  if (frame++ % 3 === 0) {
    // build grid
    const grid = new Map();
    const key = (cx, cy) => cx + '|' + cy;
    for (let i = 0; i < PARTICLES.length; i++) {
      const p = PARTICLES[i];
      const cx = (p.x / CELL) | 0,
        cy = (p.y / CELL) | 0;
      const k = key(cx, cy);
      const arr = grid.get(k);
      arr ? arr.push(i) : grid.set(k, [i]);
    }
    // resolve overlaps
    for (let i = 0; i < PARTICLES.length; i++) {
      const p = PARTICLES[i];
      const cx = (p.x / CELL) | 0,
        cy = (p.y / CELL) | 0;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const cell = grid.get(key(gx, gy));
          if (!cell) continue;
          for (const j of cell) {
            if (j <= i) continue;
            const q = PARTICLES[j];
            let dx = p.x - q.x,
              dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            const min = (p.r + q.r) * SEP_RADIUS;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2),
              nx = dx / d,
              ny = dy / d,
              push = (min - d) * SEP_FORCE;
            p.x += nx * push * 0.5;
            p.y += ny * push * 0.5;
            q.x -= nx * push * 0.5;
            q.y -= ny * push * 0.5;
          }
        }
      }
    }
  }

  // 3) Draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // soft center vignette (cheap)
  const g = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height * 0.45,
    0,
    canvas.width / 2,
    canvas.height * 0.45,
    Math.max(canvas.width, canvas.height) / 1.6
  );
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // no shadowBlur / no 'lighter' blend → crisp and fast
  for (const p of PARTICLES) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(p.hue, 0.85);
    ctx.stroke(getPath(p.kind, p.r));
    ctx.restore();
  }
}
requestAnimationFrame(loop);
