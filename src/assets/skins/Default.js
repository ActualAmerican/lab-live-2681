export function applyDefaultSkin(shape) {
  shape.trailEffect = {
    draw(ctx, shapeInstance) {
      // No outline drawing to avoid conflict with drawGlowingOutline
      // Optional: Add a subtle non-outline effect if desired (e.g., faint glow)
      ctx.save();
      ctx.translate(shapeInstance.x, shapeInstance.y);
      ctx.fillStyle = `${shapeInstance.color}22`; // 13% opacity for subtle effect
      ctx.beginPath();
      ctx.arc(0, 0, shapeInstance.size + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
}