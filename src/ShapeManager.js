// ShapeManager.js
import { shapeRegistry } from './shapes/shapes.js';
import ProfileStore from './libs/ProfileStore.js';
import { computeWeights, pickWeighted } from './libs/SpawnWeights.js';
import { Shape } from './shapes/Shape.js'; // fallback used in rare cases (named export)

const LOG_PROGRESS = localStorage.getItem('LOG_PROGRESS') === '1';
function logProgress(message) {
  if (LOG_PROGRESS) console.log(`[PROGRESS] ${message}`);
}
class ShapeManager {
  constructor(x, y, size, color, name) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
    this.name = name;

    this.mode = 'rotation';
    const activeShapes = shapeRegistry.filter((s) => s.active);
    this.isolationShapeName =
      this.mode === 'isolation'
        ? name ||
          (activeShapes.length > 0
            ? activeShapes[Math.floor(Math.random() * activeShapes.length)].name
            : '')
        : '';

    this.level = 1;
    this.remainingShapes = [];
    this.currentShape = null;
    this.currentShapeStarted = false;
    /** @type {string[]} */
    this.completedShapes = [];
    this.inProgressShapes = [];
    this.pickSet = [];
    this.infiniteQueue = [];
    this.infiniteCycleIndex = 0;
    this.currentShapeCompleted = false;
    this._prewarmed = null;
    this.totalShapesCompleted = 0;
  }

  setMode(mode) {
    this.mode = mode;
    this.resetSequence(this.level);
  }

  setIsolationShape(name) {
    this.isolationShapeName = name;
    if (this.mode === 'isolation') {
      this.resetSequence(this.level);
    }
  }

  setLevel(level, fullReset = false) {
    this.level = level;

    if (fullReset) {
      this.resetPickSet(); // full clear + triggers resetSequence
    } else {
      this.completedShapes = [];
      this.pickSet = [];
      this.remainingShapes = [];
      // Do NOT call resetSequence here. Let the game flow control it.
    }
  }

  prewarmNextSet(level) {
    // Build the next set without touching current state
    const pool = this.getRotationPool(level);
    const pick = this.shuffle([...pool]);
    this._prewarmed = {
      level,
      pickSet: [...pick],
      remaining: [...pick],
    };
  }

  // --- FORCE JUMP: build a fresh rotation set for <level> and make <shapeName> the first shape ---
  forceRotation({ level, shapeName }) {
    // 1) Prewarm the exact pick set we want for that level
    this.prewarmNextSet(level);

    // 2) Because resetSequence() pops from the END of remainingShapes,
    //    park the selected shape at the END so it becomes the first to run.
    if (this._prewarmed && this._prewarmed.level === level) {
      const arr = Array.isArray(this._prewarmed.remaining)
        ? this._prewarmed.remaining
        : Array.isArray(this._prewarmed.remainingShapes)
        ? this._prewarmed.remainingShapes
        : null;

      if (arr) {
        const idx = arr.findIndex((s) => s && s.name === shapeName);
        if (idx >= 0) {
          const [sel] = arr.splice(idx, 1);
          arr.push(sel);
        } else {
          // If for some reason it isn't in the pool, synthesize one from registry and append
          const entry = (shapeRegistry || []).find(
            (s) => s.name === shapeName && typeof s.classRef === 'function'
          );
          if (entry) {
            arr.push(new entry.classRef(this.x, this.y, this.size, this.color, entry.name));
          }
        }
        // ensure we write back to the canonical field name used by _consumePrewarmIfMatch()
        this._prewarmed.remaining = arr;
      }
    }

    // 3) Lock mode to rotation and atomically consume the prewarmed set
    this.setMode('rotation');
    this.resetSequence(level); // will consume _prewarmed if level matches
  }

  _consumePrewarmIfMatch(level) {
    if (this._prewarmed && this._prewarmed.level === level) {
      this.completedShapes = [];
      this.inProgressShapes = [];
      this.pickSet = [...this._prewarmed.pickSet];
      this.remainingShapes = [...this._prewarmed.remaining];
      this._prewarmed = null;
      return true;
    }
    return false;
  }

  getLevel() {
    return this.level;
  }

  getInfiniteCycleIndex() {
    return this.infiniteCycleIndex || 0;
  }

  cycleIsolationLevel() {
    if (this.mode === 'isolation') {
      this.level = this.level === 4 ? 1 : this.level + 1;
      this.resetSequence(this.level);
    }
  }

  getShapeNames() {
    return shapeRegistry.map((s) => s.name);
  }

  getCurrentShapeName() {
    return this.currentShape ? this.currentShape.name : '';
  }

  getCurrentShapeType() {
    const shapeInfo = shapeRegistry.find((s) => s.name === this.getCurrentShapeName());
    return shapeInfo?.type || 'survival'; // fallback just in case
  }

  setShape(name) {
    const shapeInfo = shapeRegistry.find((s) => s.name === name);
    if (!shapeInfo || typeof shapeInfo.classRef !== 'function') {
      console.error('Shape not found or invalid classRef:', name);
      return;
    }

    // Fresh shape instance, no impact on rotation sets
    this.currentShape = new shapeInfo.classRef(
      this.x,
      this.y,
      this.size,
      this.color,
      shapeInfo.name
    );
    if (typeof this.currentShape.reset === 'function') this.currentShape.reset();
    if (typeof this.currentShape.setRotation === 'function')
      this.currentShape.setRotation(Math.random() * 360);
    console.log('🧪 Debug shape override:', this.currentShape.name);
  }

  getNextShapeNameAndLevel() {
    if (this.mode === 'isolation') {
      const nextLevel = this.level === 4 ? 1 : this.level + 1;
      return { name: this.isolationShapeName, level: nextLevel };
    }

    // Rotation ∞: same rule as other levels — we consume from the END
    if (this.level === 4 && this.mode === 'rotation') {
      const nextShape = this.remainingShapes[this.remainingShapes.length - 1];
      return { name: nextShape?.name || '', level: this.level };
    }

    if (this.remainingShapes.length > 0) {
      const nextShape = this.remainingShapes[this.remainingShapes.length - 1];
      return { name: nextShape?.name || '', level: this.level };
    }

    return { name: '', level: this.level };
  }

  getRotationPool(level = this.level) {
    //console.log(`🟪 Shape: ${this.getCurrentShapeName()} started`);
    if (this.mode === 'isolation') {
      const shapeInfo = shapeRegistry.find((s) => s.name === this.isolationShapeName);
      if (!shapeInfo || !this.verifyShapeBlueprint(shapeInfo.classRef)) {
        console.error('❌ Invalid isolation shape:', this.isolationShapeName);
        return [];
      }
      return [new shapeInfo.classRef(this.x, this.y, this.size, this.color, shapeInfo.name)];
    }
    const actives = shapeRegistry.filter((s) => s.active);
    const validActives = actives.filter((s) => {
      const isValid = this.verifyShapeBlueprint(s.classRef);
      if (!isValid) {
        console.warn(`❌ ${s.name} failed blueprint check and will be excluded`);
      }
      return isValid;
    });

    if (validActives.length === 0) {
      console.error('❌ No valid active shapes in shapeRegistry');
      return [new Shape(this.x, this.y, this.size, this.color, 'FallbackShape')];
    }

    let poolSize = validActives.length;
    if (level === 1) poolSize = Math.min(5, validActives.length);
    else if (level === 2) poolSize = Math.min(8, validActives.length);
    else if (level === 3) poolSize = Math.min(10, validActives.length);
    else if (level === 4) poolSize = validActives.length;

    // Gate by unlocks for rotation/∞ (Isolation ignores locks)
    const p = ProfileStore.get();
    const ownedSet = new Set((p.unlocks && p.unlocks.shapes) || []);
    const applyGating = this.mode !== 'isolation';
    let available = applyGating
      ? validActives.filter((s) => ownedSet.has(s.name))
      : [...validActives];

    // Safety: if somehow empty (shouldn’t happen because we seed 10), fall back to validActives
    if (applyGating && available.length === 0) {
      available = [...validActives];
    }
    const selected = [];
    while (selected.length < poolSize && available.length > 0) {
      // compute normalized weights with favorites boost, shapeless nerf
      const weights = computeWeights(available, ProfileStore.get());
      const id = pickWeighted(weights);
      // remove chosen entry (sampling without replacement)
      let i = available.findIndex((s) => (s.name || s.id) === id);
      if (i < 0) i = 0; // super-safe fallback
      const chosen = available.splice(i, 1)[0];
      selected.push(chosen);
    }

    const validShapes = selected.map(
      (s) => new s.classRef(this.x, this.y, this.size, this.color, s.name)
    );

    if (validShapes.length === 0) {
      console.warn('⚠️ No valid shapes after filtering. Using fallback shape.');
      return [new Shape(this.x, this.y, this.size, this.color, 'FallbackShape')];
    }

    if (LOG_PROGRESS)
      console.log(
        '✅ Valid Shapes:',
        validShapes.map((s) => s.name)
      );
    return validShapes;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  resetRotation(level = this.level) {
    this.resetSequence(level);
  }

  update(deltaTime, currentLevel) {
    if (this.currentShape && typeof this.currentShape.update === 'function') {
      this.currentShape.update(deltaTime, currentLevel);
    }
  }

  draw(ctx) {
    if (this.currentShape && typeof this.currentShape.draw === 'function') {
      // Shapes sometimes change lineWidth/lineJoin/etc.
      // Guard the global canvas state so our play-area stroke stays identical.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // bulletproof against any leftover transforms
      ctx.lineJoin = 'round';
      ctx.lineCap = 'butt';
      ctx.miterLimit = 2;
      try {
        this.currentShape.draw(ctx);
      } finally {
        ctx.restore();
      }
    } else {
      console.warn('No shape to draw:', { currentShape: this.currentShape });
    }
  }

  handleClick(x, y) {
    if (this.currentShape && typeof this.currentShape.handleClick === 'function') {
      return this.currentShape.handleClick(x, y);
    }
    return false;
  }

  checkBoundary(playAreaX, playAreaY, playAreaSize) {
    if (this.currentShape && typeof this.currentShape.checkBoundary === 'function') {
      return this.currentShape.checkBoundary(playAreaX, playAreaY, playAreaSize);
    }
    return false;
  }

  reset() {
    if (this.currentShape && typeof this.currentShape.reset === 'function') {
      this.currentShape.reset();
    }
  }

  isSequenceCompleted() {
    if (!this.currentShape) {
      return false; // Silently return false
    }
    if (typeof this.currentShape.isSequenceCompleted !== 'function') {
      return true; // Fallback to avoid stalls
    }
    const result = this.currentShape.isSequenceCompleted();
    if (LOG_PROGRESS) {
      if (this._lastSeqResult !== result) {
        logProgress(
          `Checking completion for ${this.getCurrentShapeName()} (behavior: ${
            this.currentShape.behaviorType
          }): ${result}`
        );
        this._lastSeqResult = result;
      }
    }
    return result;
  }

  initPickSet(level = this.level) {
    const pool = this.getRotationPool(level);
    this.pickSet = this.shuffle([...pool]);
    this.remainingShapes = [...this.pickSet];
  }

  resetSequence(currentLevel) {
    try {
      const bus = window.bus;
      // Clear previous scope's veils, then bump scope for the new shape sequence
      bus?.emit('playArea/clearEdgeMasks', { animate: false, __force: true });
      bus?.emit('playArea/edgeScope');
    } catch (_) {}
    this.currentShapeCompleted = false;
    // 🔔 Tell stats/UX which level we’re on (1,2,3,4=∞)
    try {
      const bus = window.bus;
      bus?.emit('level:start', { level: currentLevel });
    } catch (_) {}
    if (currentLevel === 1) {
      this.infiniteCycleIndex = 0; // Reset cycle count if starting fresh
    }
    if (this.mode === 'rotation' && currentLevel === 4) {
      // Treat first entry into ∞ as a new cycle too
      if (this.remainingShapes.length === 0 || this.infiniteCycleIndex === 0) {
        const pool = this.getRotationPool(4);
        if (pool.length === 0) {
          console.error('❌ No valid shapes available for infinite mode');
          this.currentShape = null;
          return;
        }
        this.completedShapes = [];
        this.inProgressShapes = [];
        const fullCycle = this.shuffle([...pool]); // 25 shapes
        this.pickSet = [...fullCycle]; // For debug display
        this.remainingShapes = [...fullCycle]; // Shapes left to play
        this.infiniteCycleIndex++; // Bump cycle count
      }

      const shapeToUse = this.remainingShapes.pop();
      if (shapeToUse) {
        const shapeInfo = shapeRegistry.find((s) => s.name === shapeToUse.name);
        if (shapeInfo && typeof shapeInfo.classRef === 'function') {
          this.currentShape = new shapeInfo.classRef(
            this.x,
            this.y,
            this.size,
            this.color,
            shapeToUse.name
          );

          if (typeof this.currentShape.reset === 'function') this.currentShape.reset();
          if (typeof this.currentShape.resetSequence === 'function')
            this.currentShape.resetSequence(currentLevel);
          if (typeof this.currentShape.setRotation === 'function')
            this.currentShape.setRotation(Math.random() * 360);

          this.inProgressShapes = [shapeToUse.name];
        } else {
          console.warn('Could not instantiate shape:', shapeToUse.name);
          this.currentShape = null;
        }
      } else {
        console.error('No shapes remaining in infinite mode — this should not happen');
        this.currentShape = null;
      }

      console.log('Infinite mode sequence:', {
        currentShape: this.getCurrentShapeName(),
        cycle: this.infiniteCycleIndex,
        remaining: this.remainingShapes.length,
        pickSet: this.pickSet.map((s) => s.name),
      });

      return;
    }

    if (this.mode === 'isolation') {
      this.level = currentLevel;
      const shapeInfo = shapeRegistry.find((s) => s.name === this.isolationShapeName);
      if (shapeInfo && typeof shapeInfo.classRef === 'function') {
        this.currentShape = new shapeInfo.classRef(
          this.x,
          this.y,
          this.size,
          this.color,
          shapeInfo.name
        );
        this.inProgressShapes = [shapeInfo.name];
        this.remainingShapes = [this.currentShape];
        this.pickSet = [this.currentShape];
        if (typeof this.currentShape.resetSequence === 'function') {
          this.currentShape.resetSequence(currentLevel);
        }
        if (typeof this.currentShape.setRotation === 'function') {
          this.currentShape.setRotation(Math.random() * 360);
        }
      } else {
        console.error('Isolation shape not found or invalid:', this.isolationShapeName);
        this.currentShape = null;
      }
      console.log('Sequence reset (isolation):', {
        currentShape: this.getCurrentShapeName(),
        level: this.level,
      });
      return;
    }
    if (currentLevel !== this.level) {
      this.level = currentLevel;
      this.completedShapes = [];
      this.inProgressShapes = [];
      this.pickSet = [];
      this.remainingShapes = [];
    }
    if (this.remainingShapes.length === 0) {
      // Prefer any pre-warmed set; otherwise build fresh
      if (!this._consumePrewarmIfMatch(this.level)) {
        this.inProgressShapes = [];
        const pool = this.getRotationPool(this.level);
        this.pickSet = this.shuffle([...pool]);
        this.remainingShapes = [...this.pickSet];
        this.completedShapes = [];
      }
    }
    const shapeToUse = this.remainingShapes.pop() || null; // Pop to remove shape
    if (shapeToUse) {
      const shapeInfo = shapeRegistry.find((s) => s.name === shapeToUse.name);
      if (shapeInfo && typeof shapeInfo.classRef === 'function') {
        this.currentShape = new shapeInfo.classRef(
          this.x,
          this.y,
          this.size,
          this.color,
          shapeInfo.name
        );
        if (typeof this.currentShape.reset === 'function') this.currentShape.reset();
        if (typeof this.currentShape.resetSequence === 'function')
          this.currentShape.resetSequence(currentLevel);
        if (typeof this.currentShape.setRotation === 'function')
          this.currentShape.setRotation(Math.random() * 360);
        this.inProgressShapes = [shapeInfo.name]; // Reset inProgress
        logProgress(`[LEVEL ${this.level}] Shape: ${shapeToUse.name}`);
      } else {
        console.warn('Could not instantiate shape:', shapeToUse.name);
        this.currentShape = null;
      }
    } else {
      this.currentShape = null;
      console.warn('No shapes available in remainingShapes');
    }
    //console.log(`🟪 Shape: ${this.getCurrentShapeName()} started`);
    console.groupEnd();
  }

  getPickSet() {
    return [...this.pickSet];
  }

  getCompletedShapes() {
    // return a safe shallow copy for UI (DebugMenu, etc.)
    return Array.isArray(this.completedShapes) ? [...this.completedShapes] : [];
  }

  resetPickSet() {
    if (this._consumePrewarmIfMatch(this.level)) {
      this.resetSequence(this.level);
      return;
    }
    this.completedShapes = [];
    this.inProgressShapes = [];
    this.pickSet = [];
    this.remainingShapes = [];
    const pool = this.getRotationPool(this.level);
    if (pool.length === 0) {
      console.warn('⚠️ No valid shapes for pickSet. Using fallback shape.');
      this.pickSet = [new Shape(this.x, this.y, this.size, this.color, 'FallbackShape')];
    } else {
      this.pickSet = this.shuffle([...pool]);
    }
    this.remainingShapes = [...this.pickSet];
    this.resetSequence(this.level);
    //console.log('✅ PickSet reset:', this.pickSet.map(s => s.name));
  }

  isPickSetCompleted() {
    const done = this.remainingShapes.length === 0 && this.currentShapeCompleted;
    if (done) {
      console.log('✅ Pick set completed. Ready for next level or mini-game.');
    }
    return done;
  }

  getInProgressShapes() {
    return [...this.inProgressShapes];
  }

  verifyShapeBlueprint(shapeClass) {
    try {
      const testShape = new shapeClass(
        this.x,
        this.y,
        this.size,
        this.color,
        shapeClass.name || 'UnknownShape'
      );
      const requiredMethods = ['isReady', 'isSequenceCompleted', 'draw', 'update'];
      for (const method of requiredMethods) {
        if (typeof testShape[method] !== 'function') {
          console.warn(`❌ ${testShape.name} missing method: ${method}`);
          return false;
        }
      }

      if (!['survival', 'sequence', 'objective'].includes(testShape.behaviorType)) {
        console.warn(
          `❌ ${testShape.name} has invalid or missing behaviorType:`,
          testShape.behaviorType
        );
        return false;
      }

      if (typeof testShape.forceComplete !== 'function' && testShape.behaviorType !== 'sequence') {
        console.warn(
          `❌ ${testShape.name} missing forceComplete() — required for ${testShape.behaviorType} shapes`
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error(`❌ Exception when validating ${shapeClass.name || 'Unknown'}:`, err);
      return false;
    }
  }

  markCurrentShapeComplete() {
    if (!this.currentShape) {
      console.error('❌ markCurrentShapeComplete called with no currentShape');
      this.currentShapeCompleted = true; // Allow progression
      return;
    }
    this.currentShapeCompleted = true;
    this.totalShapesCompleted++;
    const name = this.currentShape.name;
    if (this.completedShapes.includes(name)) {
      console.warn(`⚠️ Shape "${name}" was already marked complete. Duplicate?`);
    }
    if (this.inProgressShapes.includes(name) && this.remainingShapes.find((s) => s.name === name)) {
      console.warn(
        `⚠️ Shape "${name}" is in both inProgress and remainingShapes — inconsistent state.`
      );
    }
    const inProgIndex = this.inProgressShapes.indexOf(name);
    if (inProgIndex !== -1) {
      this.inProgressShapes.splice(inProgIndex, 1);
    }
    if (!this.completedShapes.includes(name)) {
      this.completedShapes.push(name);
    }
    const index = this.remainingShapes.findIndex((s) => s.name === name);
    if (index !== -1) {
      this.remainingShapes.splice(index, 1);
    }
    if (this.remainingShapes.length === 0) {
      console.log('🎉 All shapes in this level complete.');
    }
    logProgress(`Shape ${name} completed`);
  }

  getTotalShapesCompleted() {
    return this.totalShapesCompleted || 0;
  }
}
export default ShapeManager;
export function validateAllShapes(x, y, size, color) {
  const valid = [];
  const invalid = [];
  const nameCounts = {};
  for (const entry of shapeRegistry) {
    if (!entry.active) continue;
    const name = entry.name;
    if (!nameCounts[name]) nameCounts[name] = 0;
    nameCounts[name]++;
  }
  for (const [name, count] of Object.entries(nameCounts)) {
    if (count > 1)
      console.warn(`⚠️ Duplicate shape name detected: "${name}" appears ${count} times.`);
  }

  for (const entry of shapeRegistry) {
    if (!entry.active) continue;
    try {
      const instance = new entry.classRef(x, y, size, color, entry.name);
      const hasAllMethods = ['isReady', 'isSequenceCompleted', 'draw', 'update'].every(
        (fn) => typeof instance[fn] === 'function'
      );
      if (hasAllMethods) {
        valid.push(entry.name);
      } else {
        console.warn(`❌ ${entry.name} is missing required methods`);
        invalid.push(entry.name);
      }
    } catch (err) {
      console.error(`❌ Failed to load shape: ${entry.name}`, err);
      invalid.push(entry.name);
    }
  }

  if (LOG_PROGRESS) console.log('✅ Valid Shapes:', valid);
  if (invalid.length) {
    console.warn('❌ Invalid Shapes:', invalid);
  }
}
export function debugBlueprintSummary(x, y, size, color) {
  console.log('🧩 Blueprint Check Summary:\n');

  const manager = new ShapeManager(x, y, size, color);
  for (const entry of shapeRegistry) {
    if (!entry.active) continue;
    const result = manager.verifyShapeBlueprint(entry.classRef);
    const note = result ? '✅ Passed' : '❌ Failed — excluded from rotation';
    console.log(`🔹 ${entry.name}: ${note}`);
  }
}
