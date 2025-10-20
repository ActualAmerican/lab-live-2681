class SilhouetteMatch {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.name = 'SilhouetteMatch';
    this.complete = false;
    this.introTimer = 0;
    this.introDuration = 2.5;
  }

  reset() {
    this.complete = false;
    this.introTimer = 0;
  }

  isReady() {
    return this.introTimer >= this.introDuration;
  }

  update(deltaTime) {
    this.introTimer += deltaTime / 1000;
  }

  draw(ctx) {
    ctx.fillStyle = 'white';
    ctx.font = '24px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🔍 SILHOUETTE MATCH — COMING SOON 🔍', this.x, this.y);
  }

  handleClick(x, y) {
    return false;
  }

  isSequenceCompleted() {
    return this.complete;
  }
}

export default SilhouetteMatch;
