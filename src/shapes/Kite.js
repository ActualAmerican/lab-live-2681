// ============================================================================
// Shape: Kite  |  src/shapes/Kite.js
// ----------------------------------------------------------------------------
// 1. Initialization
// 2. Intro Animation
// 3. Drawing Functions
// 4. Gameplay Logic
// 5. Scoring and Feedback (placeholder)
// 6. Skins and Effects (stub)
// 7. Debugging Tools (stub)
// 8. Structural Requirements
// ============================================================================

//--------------------------------------------------
// 1. Initialization
//--------------------------------------------------
export class Kite {
  constructor(x, y, size) {
    // Core geometry & identity
    const scaleFactor = 2.0;
    this.size = size * scaleFactor;
    this.baseSize = this.size;
    this.x = x;
    this.y = y;
    this.initialX = x;
    this.initialY = y;
    this.color = '#2121a7ff';
    this.name = "Kite";
    this.glintDuration = 600;
    this.sequenceDone = false;
    this.objectiveCompleted = false;

    // Physics
    this.vy = 0;
    this.gravity = 0.001;
    this.fallDelay = 500;
    this.fallDelayTimer = 0;

    // Lightning‑storm state
    this.lightningStrikes = [];
    this.lightningTimer = 0;
    this.baseLightningInterval = 3000;
    this.lightningInterval = this.baseLightningInterval;
    this.lightningDuration = 300;
    this.preStrikeDatas = [];
    this.preStrikeClouds = [];

    // Tilt / sway
    this.tiltTime = 0;
    this.rotation = 0;

    //--------------------------------------------------
    // 2a. Intro Animation — state holders (figure‑8 + glint)
    //--------------------------------------------------
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = (window.EDGE_VEIL_MS || 3000); // universal timing
    this.fadeInTime = 1200; // ms, alpha from 0 → 1
    this.glintTime = 1800; 
    this.isReadyToPlay = false;


    // Path + settle helpers
    this._introCenterX = x;
    this._introCenterY = y;
    this._introLastOffset = { x: 0, y: 0, rot: 0 };
    this._introSettle = false;
    this._introSettleStart = 0;
    this._introSettleDuration = 320; // ms
    this._introSettleFrom = { x: 0, y: 0, rot: 0 };
  }

  //--------------------------------------------------
  // 2. Intro Animation (update‑phase logic only)
  //--------------------------------------------------
  _updateIntro(deltaTime) {
    this.introTimer += deltaTime;
    const settleStartTime = this.introDuration - this._introSettleDuration;

    // Phase 1 ▸ figure‑8
    if (!this._introSettle && this.introTimer < settleStartTime) {
      const t = this.introTimer / settleStartTime;
      const ease = t * t * (3 - 2 * t);
      const mainAngle = ease * Math.PI * 2 * 1.15;
      const mag = Math.max(0, Math.sin(Math.PI * t));
      const ampX = this.baseSize * 0.33;
      const ampY = this.baseSize * 0.21;
      this._introLastOffset = {
        x: Math.sin(mainAngle) * ampX * mag,
        y: Math.sin(mainAngle) * Math.cos(mainAngle) * ampY * mag,
        rot: Math.sin(mainAngle) * 0.22 * mag
      };
    }

    // Begin settle
    if (!this._introSettle && this.introTimer >= settleStartTime) {
      this._introSettle = true;
      this._introSettleStart = this.introTimer;
      this._introSettleFrom = { ...this._introLastOffset };
    }

    // Phase 2 ▸ settle
    if (this._introSettle) {
      const elapsed = this.introTimer - this._introSettleStart;
      const t = Math.min(1, elapsed / this._introSettleDuration);
      const ease = 1 - Math.pow(1 - t, 3);
      this._introLastOffset = {
        x: this._introSettleFrom.x * (1 - ease),
        y: this._introSettleFrom.y * (1 - ease),
        rot: this._introSettleFrom.rot * (1 - ease)
      };
    }

    // Exit intro
if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this._introSettle = false;

  // Make sure the veils are fully closed on this exact frame
  const bus = window.bus;
  bus && bus.emit('playArea/finishEdgeMasks');

  this.isReadyToPlay = true;
}

  }

  //--------------------------------------------------
  // 3. Drawing Functions
  //--------------------------------------------------
  draw(ctx) {
    ctx.save();

    // ---------------- Kite Body ----------------
    let drawX = this.x;
    let drawY = this.y;
    let drawRot = this.rotation;

    if (this.playIntro) {
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
      drawX = this._introCenterX + this._introLastOffset.x;
      drawY = this._introCenterY + this._introLastOffset.y;
      drawRot += this._introLastOffset.rot;
    }

    // sway during glint
    let swayX = 0,
      swayY = 0;
    if (
      this.playIntro &&
      this.introTimer >= this.fadeInTime &&
      this.introTimer < this.glintTime
    ) {
      const t =
        (this.introTimer - this.fadeInTime) / (this.glintTime - this.fadeInTime);
      const swayAngle = Math.sin(t * Math.PI * 2);
      swayX = swayAngle * (this.baseSize * 0.1);
      swayY = Math.cos(t * Math.PI * 2) * (this.baseSize * 0.05);
    }

    ctx.translate(drawX + swayX, drawY + swayY);
    ctx.rotate(drawRot);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, this.size * 0.625);
    ctx.lineTo(this.size * 0.425, 0);
    ctx.lineTo(0, -this.size * 0.425);
    ctx.lineTo(-this.size * 0.425, 0);
    ctx.closePath();
    ctx.fill();

    // Glint sweep
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      const t = (this.introTimer - this.glintTime) / 400;
      const glintX = -this.size * 0.425 + this.size * 0.85 * t;
      const glint = ctx.createLinearGradient(glintX - 12, 0, glintX + 12, 0);
      glint.addColorStop(0, "rgba(255,255,255,0)");
      glint.addColorStop(0.5, "rgba(255,255,255,0.65)");
      glint.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glint;
      ctx.fill();
    }

    ctx.restore();

    if (this.playIntro) return;

    // -------------- Storm Visuals --------------
    this._drawLightning(ctx);
    this._drawPreStrikeClouds(ctx);
  }

  _drawLightning(ctx) {
    const paX = window.playAreaX || 100;
    const paY = window.playAreaY || 0;
    const paSize = window.playAreaSize || 600;

    for (const strike of this.lightningStrikes) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(paX, paY, paSize, paSize);
      ctx.clip();

      const progress = 1 - strike.lifetime / strike.maxLifetime;
      const fadeAlpha =
        progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
      ctx.globalAlpha = fadeAlpha;
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 20;

      const numPoints = strike.path.length;
      const lastIndex = Math.floor(progress * (numPoints - 1));
      ctx.beginPath();
      ctx.moveTo(strike.path[0].x, strike.path[0].y);
      for (let i = 1; i <= lastIndex; i++) ctx.lineTo(strike.path[i].x, strike.path[i].y);
      if (lastIndex < numPoints - 1) {
        const segP = progress * (numPoints - 1) - lastIndex;
        const pC = strike.path[lastIndex];
        const pN = strike.path[lastIndex + 1];
        ctx.lineTo(pC.x + segP * (pN.x - pC.x), pC.y + segP * (pN.y - pC.y));
      }
      ctx.stroke();

      // Branches
      for (const branch of strike.branches) {
        ctx.beginPath();
        ctx.moveTo(branch[0].x, branch[0].y);
        const bl = branch.length;
        const bLast = Math.floor(progress * (bl - 1));
        for (let j = 1; j <= bLast; j++) ctx.lineTo(branch[j].x, branch[j].y);
        if (bLast < bl - 1) {
          const segP = progress * (bl - 1) - bLast;
          const pC = branch[bLast];
          const pN = branch[bLast + 1];
          ctx.lineTo(pC.x + segP * (pN.x - pC.x), pC.y + segP * (pN.y - pC.y));
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawPreStrikeClouds(ctx) {
    const currentTime = Date.now() / 1000;
    for (let i = 0; i < this.preStrikeDatas.length; i++) {
      const data = this.preStrikeDatas[i];
      const clouds = this.preStrikeClouds[i];
      const preProg =
        (this.lightningTimer - (this.lightningInterval - 1000)) / 1000;
      const overallAlpha = Math.sin(Math.PI * preProg) * 0.4;

      const paX = window.playAreaX || 100;
      const paY = window.playAreaY || 0;
      const paSize = window.playAreaSize || 600;
      const centerX = data.edge === "left" ? paX : paX + paSize;
      const centerY = data.y;

      ctx.save();
      ctx.beginPath();
      ctx.rect(paX, paY, paSize, paSize);
      ctx.clip();
      ctx.globalAlpha = overallAlpha;

      // first three layers
      for (let layerIndex = 0; layerIndex < 3; layerIndex++) {
        for (const blob of clouds[layerIndex]) {
          const amp = 2;
          const offX =
            amp * Math.sin(2 * Math.PI * blob.speedX * currentTime * 0.5 + blob.phaseX);
          const offY =
            amp * Math.cos(2 * Math.PI * blob.speedY * currentTime * 0.5 + blob.phaseY);
          this._drawIrregularBlob(
            ctx,
            centerX + blob.offsetX + offX,
            centerY + blob.offsetY + offY,
            blob.radius,
            blob.fill
          );
        }
      }

      // Inner glow
      const g = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 80);
      g.addColorStop(0, "rgba(255,255,255,0.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawIrregularBlob(ctx, x, y, radius, fill) {
    const verts = 8 + Math.floor(Math.random() * 4);
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const r = radius * (0.9 + Math.random() * 0.3);
      const vx = x + r * Math.cos(a);
      const vy = y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
  }

//--------------------------------------------------
// 4. Gameplay Logic (update + input)
//--------------------------------------------------
  update(deltaTime, level) {
    if (this.playIntro) {
      this._updateIntro(deltaTime);
      return;
    }

    this.lightningInterval =
      level === 1 ? this.baseLightningInterval : level === 2 ? 2000 : 1500;

    this.tiltTime += deltaTime;
    this.rotation = 0.1 * Math.sin(this.tiltTime / 200);

    if (this.fallDelayTimer < this.fallDelay) this.fallDelayTimer += deltaTime;
    else {
      this.vy += this.gravity * deltaTime;
      this.y += this.vy * deltaTime;
    }

    this.lightningTimer += deltaTime;

    const paY = window.playAreaY || 0;
    const paSize = window.playAreaSize || 600;

    if (
      this.lightningTimer >= this.lightningInterval - 1000 &&
      this.preStrikeDatas.length === 0
    ) {
      const numStrikes = level === 3 ? 2 : 1;
      for (let i = 0; i < numStrikes; i++) {
        this.preStrikeDatas.push({
          edge: Math.random() < 0.5 ? "left" : "right",
          y: paY + Math.random() * paSize
        });
        this.preStrikeClouds.push(this._generatePreStrikeClouds());
      }
    }

    if (this.lightningTimer >= this.lightningInterval) {
      this.lightningTimer = 0;
      for (const d of this.preStrikeDatas) this._spawnLightning(d);
      this.preStrikeDatas = [];
      this.preStrikeClouds = [];
    }

    for (let i = this.lightningStrikes.length - 1; i >= 0; i--) {
      const s = this.lightningStrikes[i];
      s.lifetime -= deltaTime;
      if (s.lifetime <= 0) this.lightningStrikes.splice(i, 1);
    }
  }

  handleClick(x, y) {
    const margin = 10;
    const h = this.size / 2;
    if (
      x >= this.x - h - margin &&
      x <= this.x + h + margin &&
      y >= this.y - h - margin &&
      y <= this.y + h + margin
    ) {
      this.vy = -0.5;
      return true;
    }
    return false;
  }

//--------------------------------------------------
// 4a. Gameplay Helpers (clouds, lightning spawn, collision)
//--------------------------------------------------
  _generatePreStrikeClouds() {
    const layers = [];
    const add = (count, rad, fill) => {
      const arr = [];
      for (let i = 0; i < count; i++)
        arr.push({
          offsetX: (Math.random() - 0.5) * rad,
          offsetY: (Math.random() - 0.5) * rad,
          radius: rad + Math.random() * 10,
          fill,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          speedX: 0.3 + Math.random() * 0.4,
          speedY: 0.3 + Math.random() * 0.4
        });
      layers.push(arr);
    };

    add(4, 35, "rgba(20,20,30,0.7)");
    add(3, 40, "rgba(40,40,50,0.6)");
    add(2, 50, "rgba(80,80,90,0.4)");

    const glow = [];
    for (let i = 0; i < 3; i++)
      glow.push({
        offsetX: (Math.random() - 0.5) * 30,
        offsetY: (Math.random() - 0.5) * 30,
        phase: Math.random() * Math.PI * 2,
        frequency: 5 + Math.random() * 5,
        size: 10 + Math.random() * 10
      });
    layers.push(glow);

    return layers;
  }

  _spawnLightning(pre) {
    const paX = window.playAreaX || 100;
    const paY = window.playAreaY || 0;
    const paSize = window.playAreaSize || 600;

    // Ensure first point starts outside frame horizontally
    const startX = pre.edge === "left" ? paX - 2 : paX + paSize + 2;
    const strikeY = pre.y;
    const step = paSize / 9;

    // Dual‑strike vertical stagger only
    const idx = this.preStrikeDatas.indexOf(pre);
    const offsetY = this.preStrikeDatas.length > 1 ? (idx === 0 ? -50 : 50) : 0;
    const localY = strikeY + offsetY;

    const path = [];
    const numPoints = 10;
    for (let i = 0; i < numPoints; i++) {
      const posX =
        pre.edge === "left" ? startX + i * step : startX - i * step;
      path.push({ x: posX, y: localY + (Math.random() - 0.5) * 20 });
    }

    const strike = {
      path,
      lifetime: this.lightningDuration,
      maxLifetime: this.lightningDuration,
      branches: []
    };

    const numBranches = Math.floor(Math.random() * 2) + 2;
    for (let b = 0; b < numBranches; b++) {
      const baseIdx = Math.floor(Math.random() * (numPoints - 4)) + 2;
      const br = [path[baseIdx]];
      const pts = Math.floor(Math.random() * 2) + 2;
      for (let j = 1; j <= pts; j++) {
        const prev = br[br.length - 1];
        br.push({
          x: prev.x + (Math.random() - 0.5) * 30,
          y: prev.y + (Math.random() - 0.5) * 30
        });
      }
      strike.branches.push(br);
    }

    this.lightningStrikes.push(strike);
  }

  // Collision helpers -------------------------------------------------------
  getKitePolygonPoints() {
    const loc = [
      { x: 0, y: 0.625 * this.size },
      { x: 0.425 * this.size, y: 0 },
      { x: 0, y: -0.425 * this.size },
      { x: -0.425 * this.size, y: 0 }
    ];
    const c = Math.cos(this.rotation);
    const s = Math.sin(this.rotation);
    return loc.map((p) => ({ x: this.x + p.x * c - p.y * s, y: this.y + p.x * s + p.y * c }));
  }

  checkBoundary(playAreaX, playAreaY, playAreaSize) {
    const poly = this.getKitePolygonPoints();
    const allAbove = poly.every((p) => p.y < playAreaY);
    const allBelow = poly.every((p) => p.y > playAreaY + playAreaSize);
    if (allAbove || allBelow) return true;

    for (const strike of this.lightningStrikes) {
      const prog = 1 - strike.lifetime / strike.maxLifetime;
      if (prog < 0.7) continue;
      if (this._polyHitsLightning(poly, strike.path)) return true;
      for (const branch of strike.branches) if (this._polyHitsLightning(poly, branch)) return true;
    }
    return false;
  }

  _polyHitsLightning(poly, path) {
    for (let i = 0; i < path.length - 1; i++) if (this._linesIntersectPoly(path[i], path[i + 1], poly)) return true;
    return false;
  }

  _linesIntersectPoly(p1, p2, poly) {
    for (let i = 0; i < poly.length; i++) if (this._linesIntersect(p1, p2, poly[i], poly[(i + 1) % poly.length])) return true;
    return false;
  }

  _linesIntersect(A, B, C, D) {
    const denom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
    if (denom === 0) return false;
    const ua = ((D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x)) / denom;
    const ub = ((B.x - A.x) * (A.y - C.y) - (B.y - A.y) * (A.x - C.x)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

//--------------------------------------------------
// 5. Scoring and Feedback (placeholder)
//--------------------------------------------------
  // TODO: points, sound cues

//--------------------------------------------------
// 6. Skins and Effects (stub)
//--------------------------------------------------
  // TODO: skin manager integration

//--------------------------------------------------
// 7. Debugging Tools (stub)
//--------------------------------------------------
  // TODO: debug flags

//--------------------------------------------------
// Reset
//--------------------------------------------------
  reset() {
    this.x = this.initialX;
    this.y = this.initialY;
    this.vy = 0;
    this.size = this.baseSize;
    this.lightningStrikes = [];
    this.lightningTimer = 0;
    this.fallDelayTimer = 0;
    this.tiltTime = 0;
    this.rotation = 0;
    this.preStrikeDatas = [];
    this.preStrikeClouds = [];
    this.introTimer = 0;
    this.playIntro = true;
    this._introLastOffset = { x: 0, y: 0, rot: 0 };
    this._introSettle = false;
    this._introSettleStart = 0;
    this._introSettleFrom = { x: 0, y: 0, rot: 0 };
    this.isReadyToPlay = false;

  }
  // --------------------------------------------------
// 8. Structural Requirements
// --------------------------------------------------
get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return true;
}
resetSequence(level) {
  this.reset();
  const bus = window.bus;
  if (bus) {
    // Clean slate, then hide top & bottom edges using universal defaults
    bus.emit('playArea/clearEdgeMasks', { animate: false });
    bus.emit('playArea/hideTopEdge');
    bus.emit('playArea/hideBottomEdge');
  }
}
forceComplete() {
  console.log(`🛠️ Forcing completion of Kite`);
  this.playIntro = false;
  this.isReadyToPlay = true;
  this.sequenceDone = true; // Survival shape fallback
  // Optional: Stop vertical motion or lightning if any
}
}
