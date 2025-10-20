// menuBackground.js — soft neon blobs + subtle grid behind menus
const canvas = document.getElementById('menuBgCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

function resize() {
  canvas.width = Math.max(1, innerWidth);
  canvas.height = Math.max(1, innerHeight);
}
resize();
addEventListener('resize', resize);

const blobs = Array.from({ length: 6 }, () => ({
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
  r: 180 + Math.random() * 240,
  vx: (Math.random() * 2 - 1) * 0.05,
  vy: (Math.random() * 2 - 1) * 0.05,
  hue: Math.random() * 360,
}));

function drawGrid(alpha = 0.05) {
  const step = 72;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < canvas.width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
  ctx.restore();
}

let last = performance.now();
function loop(now = performance.now()) {
  requestAnimationFrame(loop);
  if (document.body.dataset.screen !== 'main') return;

  const dt = Math.min(40, now - last);
  last = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // blobs
  ctx.globalCompositeOperation = 'lighter';
  for (const b of blobs) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -b.r) b.x = canvas.width + b.r;
    if (b.x > canvas.width + b.r) b.x = -b.r;
    if (b.y < -b.r) b.y = canvas.height + b.r;
    if (b.y > canvas.height + b.r) b.y = -b.r;

    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, `hsla(${b.hue},100%,65%,.18)`);
    g.addColorStop(1, `hsla(${b.hue},100%,65%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    b.hue = (b.hue + 0.02 * dt) % 360;
  }
  ctx.globalCompositeOperation = 'source-over';

  // soft vignette + grid
  const v = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height * 0.62,
    0,
    canvas.width / 2,
    canvas.height * 0.62,
    Math.max(canvas.width, canvas.height) / 1.3
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(0.05);
}
requestAnimationFrame(loop);
