const starfieldCanvas = document.getElementById('starfieldCanvas');
const ctxStarfield = starfieldCanvas.getContext('2d');

// Set canvas dimensions
function resizeCanvas() {
  starfieldCanvas.width = window.innerWidth;
  starfieldCanvas.height = window.innerHeight;
}
resizeCanvas();

window.addEventListener('resize', () => {
  resizeCanvas();
  initializeStars();
  initializeComets();
  initializeMilkyWay();
});

// Stars setup
let stars = [];
const numStars = 200;

function initializeStars() {
  stars = [];
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * starfieldCanvas.width,
      y: Math.random() * starfieldCanvas.height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * 0.3 + 0.7,
    });
  }
}
initializeStars();

// Comets setup
let comets = [];
const numComets = 5;
const cometSpawnInterval = 1.5;
let lastCometSpawnTime = 0;

function initializeComets() {
  comets = [];
  for (let i = 0; i < numComets; i++) {
    const spawnDelay = i * cometSpawnInterval;
    const startX = Math.random() * starfieldCanvas.width;
    const startY = Math.random() * starfieldCanvas.height;
    const endX = startX + (Math.random() > 0.5 ? 1 : -1) * starfieldCanvas.width * 1.2;
    const endY = startY + Math.random() * 300 - 150;
    const controlX = (startX + endX) / 2 + Math.random() * 300 - 150;
    const controlY = Math.min(startY, endY) - Math.random() * 200;

    comets.push({
      startX,
      startY,
      endX,
      endY,
      controlX,
      controlY,
      progress: 0,
      speed: Math.random() * 0.0003 + 0.0003,
      trail: [],
      maxTrailLength: 60,
      streaks1: generateStreaks(),
      streaks2: generateStreaks(),
      streaks3: generateStreaks(),
      width: Math.random() * 3 + 1,
      glowSize: Math.random() * 6 + 5,
      opacity: 0,
      opacitySpeed: 0.001,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: Math.random() * 0.0005 + 0.0005,
      rotationSpeedStreaks: 0.00004,
      spawnDelay,
      startTime: performance.now() / 1000 + spawnDelay,
      fadeInDuration: 2,
      fadeStartTime: null,
    });
  }
}
initializeComets();

// Generate random light streaks
function generateStreaks() {
  const streaks = [];
  const numStreaks = Math.floor(Math.random() * 4) + 3;
  for (let i = 0; i < numStreaks; i++) {
    const angle = Math.random() * Math.PI * 2;
    const length = Math.random() * 30 + 15;
    const opacity = Math.random() * 0.3 + 0.4;
    streaks.push({ angle, length, opacity });
  }
  return streaks;
}

// Draw stars
function drawStars() {
  stars.forEach((star) => {
    ctxStarfield.beginPath();
    ctxStarfield.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    const gradient = ctxStarfield.createRadialGradient(
      star.x,
      star.y,
      star.size * 0.3,
      star.x,
      star.y,
      star.size
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${star.twinkle})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctxStarfield.fillStyle = gradient;
    ctxStarfield.fill();

    // Move star
    star.x -= star.speed;
    if (star.x < 0) star.x = starfieldCanvas.width;
  });
}

// Draw comets and trails
function drawComets() {
  const currentTime = performance.now() / 1000;

  comets.forEach((comet) => {
    if (currentTime >= comet.startTime) {
      comet.progress += comet.speed;
      if (comet.fadeStartTime === null) {
        comet.fadeStartTime = currentTime;
      }
    }

    const t = comet.progress;
    const x =
      (1 - t) * (1 - t) * comet.startX + 2 * (1 - t) * t * comet.controlX + t * t * comet.endX;
    const y =
      (1 - t) * (1 - t) * comet.startY + 2 * (1 - t) * t * comet.controlY + t * t * comet.endY;

    comet.trail.unshift({ x, y, alpha: 1.0 });

    if (comet.trail.length > comet.maxTrailLength) {
      comet.trail.pop();
    }

    if (comet.fadeStartTime) {
      const fadeElapsed = currentTime - comet.fadeStartTime;
      comet.opacity = Math.min(1, fadeElapsed / comet.fadeInDuration);
    }

    if (comet.progress > 0) {
      // Draw comet glow
      const glowGradient = ctxStarfield.createRadialGradient(x, y, 0, x, y, comet.glowSize);
      glowGradient.addColorStop(0, `rgba(255, 255, 255, ${comet.opacity})`);
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctxStarfield.fillStyle = glowGradient;
      ctxStarfield.beginPath();
      ctxStarfield.arc(x, y, comet.glowSize, 0, Math.PI * 2);
      ctxStarfield.fill();

      // Draw trail
      for (let i = 0; i < comet.trail.length; i++) {
        const segment = comet.trail[i];
        const alpha = Math.max(0, 1 - i / comet.trail.length);
        const sizeFactor = 1 - i / comet.trail.length;

        ctxStarfield.beginPath();
        ctxStarfield.arc(segment.x, segment.y, comet.width * sizeFactor, 0, Math.PI * 2);
        ctxStarfield.fillStyle = `rgba(255, 255, 255, ${alpha * comet.opacity})`;
        ctxStarfield.fill();
      }

      // Draw streaks
      drawStreaks(ctxStarfield, x, y, comet.streaks1, comet.rotation, true, comet.opacity);
      drawStreaks(ctxStarfield, x, y, comet.streaks2, comet.rotation * 1.5, false, comet.opacity);
      drawStreaks(ctxStarfield, x, y, comet.streaks3, comet.rotation * 2, true, comet.opacity);
    }

    comet.rotation += comet.rotationSpeed;

    if (comet.progress >= 1.2) {
      comet.startTime = performance.now() / 1000 + cometSpawnInterval;
      comet.progress = 0;
      comet.opacity = 0;
      comet.fadeStartTime = null;
    }
  });
}

// Draw streaks
function drawStreaks(ctx, x, y, streaks, rotation, isClockwise, opacity) {
  streaks.forEach((streak) => {
    const rotatedAngle = streak.angle + (isClockwise ? rotation : -rotation);
    const xEnd = x + Math.cos(rotatedAngle) * streak.length;
    const yEnd = y + Math.sin(rotatedAngle) * streak.length;

    const glowGradient = ctx.createRadialGradient(x, y, 0, xEnd, yEnd, streak.length / 3);
    glowGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * streak.opacity})`);
    glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xEnd, yEnd);

    ctx.strokeStyle = glowGradient;
    ctx.lineWidth = streak.length / 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  });
}

// Milky Way setup
let milkyWayParticles = [];
const numParticles = 1000;
let centerX = starfieldCanvas.width / 2;
let centerY = starfieldCanvas.height / 2;

function initializeMilkyWay() {
  milkyWayParticles = [];
  for (let i = 0; i < numParticles; i++) {
    let angle = Math.random() * Math.PI * 2;
    let radius = Math.random() * (starfieldCanvas.width / 2);
    let x = centerX + Math.cos(angle) * radius;
    let y = centerY + Math.sin(angle) * radius;

    milkyWayParticles.push({
      x: x,
      y: y,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.05 + 0.01,
      opacity: Math.random() * 0.5 + 0.3,
      type: Math.random() < 0.7 ? 'dust' : 'gas',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.01,
    });
  }
}
initializeMilkyWay();

// Draw Milky Way
function drawMilkyWay() {
  // Central bright core
  const coreGradient = ctxStarfield.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    starfieldCanvas.width / 6
  );
  coreGradient.addColorStop(0, 'rgba(21, 22, 22, 0.29)');
  coreGradient.addColorStop(1, 'rgba(199, 150, 255, 0)');
  ctxStarfield.fillStyle = coreGradient;
  ctxStarfield.beginPath();
  ctxStarfield.arc(centerX, centerY, starfieldCanvas.width / 6, 0, Math.PI * 2);
  ctxStarfield.fill();

  // Draw particles (dust and gas)
  milkyWayParticles.forEach((particle) => {
    ctxStarfield.save();
    ctxStarfield.translate(particle.x, particle.y);
    ctxStarfield.rotate(particle.rotation);

    if (particle.type === 'dust') {
      ctxStarfield.fillStyle = `rgba(170, 170, 255, ${particle.opacity})`;
      ctxStarfield.beginPath();
      ctxStarfield.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctxStarfield.fill();
    } else {
      ctxStarfield.fillStyle = `rgba(100, 100, 255, ${particle.opacity})`;
      ctxStarfield.beginPath();
      ctxStarfield.ellipse(0, 0, particle.size * 2, particle.size, 0, 0, Math.PI * 2);
      ctxStarfield.fill();
    }

    ctxStarfield.restore();

    // Movement and rotation
    particle.rotation += particle.rotationSpeed;
    let angle = Math.atan2(particle.y - centerY, particle.x - centerX);
    particle.x += Math.cos(angle) * particle.speed;
    particle.y += Math.sin(angle) * particle.speed;

    // Wrap around to maintain the illusion of an infinite galaxy
    if (
      (particle.x - centerX) ** 2 + (particle.y - centerY) ** 2 >
      (starfieldCanvas.width / 2) ** 2
    ) {
      angle = Math.random() * Math.PI * 2;
      let newRadius = Math.random() * (starfieldCanvas.width / 2);
      particle.x = centerX + Math.cos(angle) * newRadius;
      particle.y = centerY + Math.sin(angle) * newRadius;
    }
  });
}

// Main animation loop
function animate() {
  // Only render the starfield during GAME screen
  if (document.body.dataset.screen !== 'game') {
    requestAnimationFrame(animate);
    return;
  }

  ctxStarfield.fillStyle = 'black';
  ctxStarfield.fillRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);

  // Draw Milky Way first
  drawMilkyWay();
  drawStars();
  drawComets();

  requestAnimationFrame(animate);
}

// Start the animation
animate();
