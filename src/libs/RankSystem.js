// src/libs/RankSystem.js
// Converts XP -> { tier, grade, displayName, percent, xpInto, xpForLevel, emblemId }
const TIERS = [
  { id: 'spark', name: 'Spark', grades: 5, mult: 1.0, emblem: 'spark' },
  { id: 'vector', name: 'Vector', grades: 5, mult: 1.25, emblem: 'vector' },
  { id: 'facet', name: 'Facet', grades: 5, mult: 1.5, emblem: 'facet' },
  { id: 'prism', name: 'Prism', grades: 5, mult: 1.8, emblem: 'prism' },
  { id: 'lattice', name: 'Lattice', grades: 5, mult: 2.15, emblem: 'lattice' },
  { id: 'nova', name: 'Nova', grades: 5, mult: 2.6, emblem: 'nova' },
  { id: 'apex', name: 'Apex', grades: 5, mult: 3.2, emblem: 'apex' },
];

const BASE_PER_GRADE = 1000; // early game pace; tune later

function fromXp(xp = 0) {
  xp = Math.max(0, Math.floor(xp));
  let remaining = xp;
  for (let t = 0; t < TIERS.length; t++) {
    const tier = TIERS[t];
    for (let g = 1; g <= tier.grades; g++) {
      const req = Math.round(BASE_PER_GRADE * tier.mult);
      if (remaining < req) {
        const into = remaining,
          pct = (into / req) * 100;
        return {
          tier: tier.name,
          tierId: tier.id,
          grade: g,
          index: t * 5 + g,
          displayName: `${tier.name} ${roman(g)}`,
          xpInto: into,
          xpForLevel: req,
          percent: pct,
          emblemId: tier.emblem,
        };
      }
      remaining -= req;
    }
  }
  // past Apex V = prestige loop (optional). For now, cap at Apex V 100% filled.
  const last = TIERS[TIERS.length - 1];
  return {
    tier: last.name,
    tierId: last.id,
    grade: last.grades,
    index: TIERS.length * 5,
    displayName: `${last.name} ${roman(last.grades)}`,
    xpInto: 1,
    xpForLevel: 1,
    percent: 100,
    emblemId: last.emblem,
  };
}

function roman(n) {
  const map = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ];
  let r = '';
  for (const [m, v] of map) {
    while (n >= v) {
      r += m;
      n -= v;
    }
  }
  return r;
}

export default { fromXp, TIERS };
