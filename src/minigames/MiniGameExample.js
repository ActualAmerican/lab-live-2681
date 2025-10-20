// src/minigames/MiniGameExample.js
class MiniGameExample {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.name = 'MiniGameExample';
    this.startTime = null;
    this.introTimer = 0;
    this.introDuration = 2.5;
    this.complete = false;
  }

  reset() {
    this.startTime = null;
    this.complete = false;
    this.introTimer = 0;
  }

  isReady() {
    return this.introTimer >= this.introDuration;
  }

  update(deltaTime) {
    if (this.introTimer < this.introDuration) {
      this.introTimer += deltaTime / 1000;
      return;
    }

    if (!this.startTime) {
      this.startTime = performance.now();
    }

    const elapsed = (performance.now() - this.startTime) / 1000;
    if (elapsed >= 30) {
      this.complete = true;
    }
  }

  draw(ctx) {
    ctx.fillStyle = 'white';
    ctx.font = '24px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🌀 MiniGame Placeholder 🌀', this.x, this.y);
  }

  handleClick(x, y) {
    return false;
  }

  isSequenceCompleted() {
    return this.complete;
  }
}

export default MiniGameExample;
