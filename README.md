/project-root
│
├── README.md                    # Project notes, dev roadmap, GDD link
│
├── /src
│   ├── index.html               # HTML entry point (in /src)
│   ├── styles.css               # Global CSS styling (in /src)
│   ├── main.js                  # Bootstrap, global event hooks, game loop
│   ├── ShapeManager.js          # Controls which shape is active, level rotation, fail conditions
│   ├── starfield.js             # Music-reactive starfield background layer
│
│   ├── /shapes
│   │   ├── Shape.js             # Parent base class for all shapes
│   │   ├── shapes.js            # Shape registry + rotation array logic
│   │   ├── Circle.js
│   │   ├── Square.js
│   │   ├── Kite.js
│   │   ├── Heart.js
│   │   ├── Arrow.js
│   │   ├── Pentagon.js
│   │   ├── Triangle.js
│   │   ├── Trapezoid.js
│   │   ├── CrescentMoon.js
│   │   ├── Octagon.js
│   │   ├── Snowflake.js
│   │   ├── Butterfly.js
│   │   ├── Feather.js
│   │   ├── Hourglass.js
│   │   ├── Angel.js
│   │   ├── Star.js
│   │   ├── Gear.js
│   │   ├── Key.js
│   │   ├── PuzzlePiece.js
│   │   ├── Spiral.js
│   │   ├── Flower.js
│   │   ├── Sun.js
│   │   ├── IceCream.js
│   │   ├── MusicNote.js
│   │   ├── Shapeless.js
│
│   ├── /libs
│   │   ├── ShapeLibrary.js     # Central base colors, speeds, level weights for all shapes
│   │   ├── SkinLibrary.js      # Defines all skin packs, mask overlays, rendering logic
│   │   ├── AudioLibrary.js     # Maps shape names to tap/combo/fail SFX, BGM tracks
│   │   ├── FXLibrary.js        # Shared particles, intro/outro shine, trails — reusable
│   │   ├── PowerUpLibrary.js   # All power-up types, costs, timers, shop logic
│
│   ├── /ui
│   │   ├── MainMenu.js         # Title screen, navigation to modes, shop, profile, settings
│   │   ├── Hotbar.js           # Power-up slots, tap/hold activation, cooldown visuals
│   │   ├── HUD.js              # In-game score, XP, combo counter, revive offer
│   │   ├── Shop.js             # In-game store for skins, trails, power-ups
│   │   ├── Profile.js          # Player mastery progress, badges, high score journal
│   │   ├── GoalTracker.js      # Daily & weekly goal challenges
│   │   ├── Settings.js         # Audio, haptics, language toggle (future-ready)
│   │   ├── RevivePopup.js      # Display revive option on fail
│
│   ├── /assets
│   │   ├── /images/            # Vector shapes, shading overlays, trail sprites, particles
│   │   ├── /audio/             # SFX + BGM tracks
│   │   ├── shop.json           # JSON config for seasonal shop rotations
│   │   ├── ShapeSpecs.md       # Developer doc: per-shape mechanics for all levels
│   │   ├── PlayerProfile.json  # Local save: XP, mastery, high score journal






Blueprint template 
// ============================================================================
// Shape: [Name]  |  src/shapes/[Name].js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions (optional)
//    1. Initialization
//    2. Intro Animation Helpers & State
//    3. Drawing Functions
//    4. Gameplay Logic
//    5. Event Handlers (e.g. clicks)
//    6. Reset Functions
//    7. Structural Requirements (behaviorType, isReady, etc.)
//    8. Scoring & Feedback (optional)
//    9. Skins & Effects (optional)
//   10. Debugging Tools (optional)
// ============================================================================

export class [ShapeName] {
  constructor(x, y, size, color, name = "[ShapeName]") {
    // Position, size, name, color
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color || "#FFFFFF";
    this.name = name;

    // Behavior flags
    this.playIntro = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.introDuration = 2500;
    this.glintDuration = 600;

    // Behavior-type-specific flags
    this.sequenceDone = false;
    this.objectiveCompleted = false;

    // Any visual state
    // (e.g., wave positions, angle, trail, etc.)
  }

  // -------------------------------------------------------------------------
  // Intro Logic
  // -------------------------------------------------------------------------
  update(deltaTime, level) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration + this.glintDuration) {
        this.playIntro = false;
        this.isReadyToPlay = true;
      }
      return; // skip gameplay logic during intro
    }

    // Gameplay logic here
  }

  draw(ctx) {
    // Draw shape visuals here (respect this.playIntro and timers)
  }

  handleClick() {
    // Input interaction
  }

  checkBoundary(x, y, size) {
    // Return true if outside play area
  }

  reset() {
    this.playIntro = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    // Reset position, state, etc.
  }

  resetSequence(level) {
    this.reset();
  }

  // -------------------------------------------------------------------------
  // Structural Requirements for Game Structure
  // -------------------------------------------------------------------------
  get behaviorType() {
    return "survival"; // or "sequence" or "objective"
  }

  isReady() {
    return !this.playIntro;
  }

  isSequenceCompleted() {
    if (this.behaviorType === "sequence") return this.sequenceDone;
    if (this.behaviorType === "objective") return this.objectiveCompleted;
    return true; // survival shapes always return true
  }

  // -------------------------------------------------------------------------
  // Optional: Scoring, Skins, Debug
  // -------------------------------------------------------------------------
}
