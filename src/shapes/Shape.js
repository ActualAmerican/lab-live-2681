
export class Shape {
  constructor(x, y, size, color, name = "Unnamed") {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.name = name;

    // Intro & lifecycle flags
    this.playIntro = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.introDuration = 2500;
    this.glintDuration = 600;

    // Completion flags
    this.sequenceDone = false;
    this.objectiveCompleted = false;

    // FX slots (optional visuals)
    this.trailEffect = null;
    this.skinEffect = null;
    this.shadingMask = null;
    this.soundEffect = null;
  }

  update(deltaTime, level) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration + this.glintDuration) {
        this.playIntro = false;
        this.isReadyToPlay = true;
      }
      return;
    }
  }

  draw(ctx) {
    this.drawBasePath(ctx);
    if (this.shadingMask) ctx.drawImage(this.shadingMask, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    if (this.skinEffect) ctx.drawImage(this.skinEffect, this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    if (this.trailEffect?.draw) this.trailEffect.draw(ctx, this);
  }

  drawBasePath(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  handleClick() {}

  checkBoundary() { return false; }

  reset() {
    this.playIntro = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
  }

  resetSequence(level) {
    this.reset();
  }

  get behaviorType() {
    return "survival";
  }

  isReady() {
    return !this.playIntro;
  }

  isSequenceCompleted() {
  if (this.behaviorType === "sequence") {
    return this.sequenceDone;
  }
  if (this.behaviorType === "objective") {
    return this.objectiveCompleted;
  }
  return this.sequenceDone; // survival fallback
}


  forceComplete() {
  console.log(`🛠️ Forcing completion of ${this.name} (behavior: ${this.behaviorType})`);
  this.playIntro = false;
  this.isReadyToPlay = true;
  if (this.behaviorType === "sequence") {
    this.sequenceDone = true;
  } else if (this.behaviorType === "objective") {
    this.objectiveCompleted = true;
  } else {
    this.sequenceDone = true; // Survival uses sequenceDone
  }
}
}