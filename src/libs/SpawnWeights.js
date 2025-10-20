// src/libs/SpawnWeights.js
export function computeWeights(registry, profile) {
  const favs = new Set(profile?.favoriteShapes || []);
  const weights = [];
  for (const s of registry) {
    const id = s?.name || s?.id;
    if (!id) continue;
    let w = 1.0;
    if (/shapeless/i.test(id)) w = 0.3;
    if (favs.has(id)) w *= 2.0;
    weights.push({ id, weight: w });
  }
  const total = weights.reduce((a, b) => a + b.weight, 0) || 1;
  for (const w of weights) w.p = w.weight / total;
  return weights;
}

export function pickWeighted(weights, rng = Math.random) {
  let t = rng();
  for (const w of weights) {
    if ((t -= w.p) <= 0) return w.id;
  }
  return weights[weights.length - 1]?.id;
}
