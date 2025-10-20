class Match2 {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.name = 'Match2';
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
    ctx.fillText('🧩 MATCH 2 — COMING SOON 🧩', this.x, this.y);
  }

  handleClick(x, y) {
    return false;
  }

  isSequenceCompleted() {
    return this.complete;
  }
}

export default Match2;
