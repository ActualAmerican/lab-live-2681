// FXLibrary.js
// Reusable FX helpers for shine, trails, particles

export const FXLibrary = {

  drawPerimeterGlint(ctx, ball, introTimer, glintTime) {
    const glintDuration = 400;
    const lineWidth = 6;
    const fudge = 1.0;
    const adjustedRadius = Math.max(1, ball.radius - (lineWidth / 2) + fudge);
    const perim = 2 * Math.PI * adjustedRadius;
    const highlightLen = perim * 0.15;
    const glintT = (introTimer - glintTime) / glintDuration;
    const offset = perim * glintT;

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "rgba(255,255,255,0.82)";
    ctx.setLineDash([highlightLen, perim]);
    ctx.lineDashOffset = -offset;
    ctx.beginPath();
    ctx.arc(0, 0, adjustedRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  // Optional: add other FX here for trails, particles
};
