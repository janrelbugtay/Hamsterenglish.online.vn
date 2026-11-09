# Mosquito Slap 3D: Full-Hand Glove Scaling & Visual Overlap Clap Trigger

This update scales the 3D 5-finger slap gloves to cover the player's entire real hand from wrist to fingertips (`1.25x` landmark span) and tightens the two-glove slap trigger so a mosquito slap only fires when the two rendered 3D gloves visually touch or overlap on screen.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and gameplay decisions have been confirmed from your answers and the live camera screenshot:

- **Confirmed Decision 1 (Full-Hand 1.25x Landmark Span Sizing)**: Remove the `172px` cap on glove size and compute the rendered 3D glove height directly from the player's live 21-point MediaPipe hand bounding box and wrist-to-fingertip span (`1.25x` real hand span, scaling up to `380px` when the player's hand is close to the webcam) so the Blue and Red 3D gloves completely cover the real palm and fingers.
- **Confirmed Decision 2 (Strict Visual Glove Overlap Trigger)**: Eliminate premature slap triggers when hands are separated by removing the wide `fastClosingClap` velocity trigger (`sepDist <= 0.28`), removing the `+0.065` normalized bounding-box expansion, and requiring the two rendered 3D gloves' actual pixel radii to physically touch or overlap (`centerDistPx <= leftGloveRadiusPx + rightGloveRadiusPx`) before triggering a slap.

## 1. Overview & Core Concept

- **What It Does**: Dynamically sizes each player's 3D 5-finger cartoon glove to match and cover their real hand on the webcam feed from wrist to fingertips, and ensures slaps only trigger when the Left and Right 3D gloves visually meet on screen.
- **Target Audience / Persona**: Classroom students and teachers playing 1-Player or 2-Player split-court Mosquito Slap 3D on an interactive display or laptop webcam.
- **Key Value**: Prevents false-positive slaps when a player's two hands are raised apart in the air, while making the Blue (Player 1) and Red (Player 2) 3D gloves properly cover the player's real hands at any camera distance.

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Raising Hands on Camera**: Each detected hand renders a 3D 5-finger cartoon glove (Blue for Player 1, Red for Player 2) anchored over the palm and fingers, scaled to `1.25x` the real hand's wrist-to-fingertip and landmark bounding-box span so the real fingers and palm are covered.
  2. **Moving Hands Apart**: When both hands are raised in the air with visible space between the two 3D gloves, no clap ring appears and mosquitoes flying between the two separated hands are never accidentally slapped.
  3. **Clapping Both Gloves Together**: As soon as the Left and Right 3D gloves visually touch or overlap over a flying mosquito, the golden `CLAP!` shockwave ring and `+5 PTS` / `-5 PTS & FROZEN` hit feedback trigger immediately.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Vibrant 3D arcade classroom game with high-contrast Blue (`#2563eb`) and Red (`#ef4444`) team gloves over a live AR webcam canvas.
  - *Color Palette & Mood*: Sky-blue and crisp white HUD surfaces (`60%` arena canvas, `30%` structural HUD cards, `10%` Blue/Red team and emerald/amber state accents).
  - *Typography & Hierarchy*: Bold `Fredoka` display numerals (`tabular-nums`) for live scores and timers, paired with high-contrast question banners.
- **Interactive Feedback & Motion**:
  - Smooth `60 FPS` hand-tracking interpolation (`0.92` position response, `0.75` scale response) with a `1.16x` slap impact bounce when both gloves touch.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pixel-Accurate Glove Radius Touch Detection vs. Normalized Velocity Heuristics**
  - *Chosen Approach*: Calculate each glove's actual rendered pixel radius (`gloveRadiusPx = 62 * finalScale`) and trigger a clap only when both hands are actively tracked and `centerDistPx <= (leftRadiusPx + rightRadiusPx) * 0.92`, or when two hands that were already nearly touching (`lastTwoHandSepDist <= 0.14`) merge into a single occluded MediaPipe skeleton on impact.
  - *Why*: In the screenshot, the player's two hands were ~280px apart (`sepDist ~ 0.20`), which triggered the old `fastClosingClap` (`sepDist <= 0.28`) and padded bounding-box checks. Tying the trigger directly to the visual glove radius guarantees the player sees the two gloves touch when a slap fires.
  - *Alternatives Considered*: Fixed normalized screen distance thresholds, which fail when players stand closer to or farther from the camera.
- **Decision 2: Uncapped 1.25x Real-Hand Span Scaling**
  - *Chosen Approach*: Measure the pixel span of all 21 hand landmarks on the canvas (`max(wristToTipPx, bboxHeightPx, palmLenPx * 1.95, palmWidthPx * 2.15)`) and set `targetGlovePx = anatomicalHandPx * 1.25` (supporting `120px` to `390px` glove heights, corresponding to `finalScale` up to `3.0`).
  - *Why*: When a player stands close to the webcam, their real hand is `260px–340px` tall on a `1280x720` canvas. The previous `172px` cap forced the glove to stay half the size of the real hand.

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MediaPipe 21-Landmark Hand Stream                    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             Hand Geometry & 1.25x Real-Hand Scale Analyzer              │
│  • Computes canvas-projected 21-landmark bounding box & wrist-to-tip px │
│  • Scales glove 1.25x real hand span (120px..390px, scale 0.95..3.00)   │
└─────────────────┬─────────────────────────────────────┬─────────────────┘
                  │                                     │
                  ▼                                     ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│   Visual Glove Overlap Detector   │ │  3D 5-Finger Glove Canvas Render  │
│  • Checks L/R rendered glove      │ │  • Anchors over palm + fingers    │
│    radii overlap on screen        │ │  • P1 Blue (#2563eb) / P2 Red     │
│  • Bridges 1-frame occlusion only │ │    (#ef4444)                      │
│    when prior sepDist <= 0.14     │ └───────────────────────────────────┘
└─────────────────┬─────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Mosquito Target Collision & Scoring Engine                 │
│  • Evaluates slap hit only when visual glove overlap is active          │
│  • Awards +5 pts (Correct) or -5 pts + 3D Ice Freeze (Wrong)            │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `leftHand.scale` / `rightHand.scale`: Updated in `analyzeHandGeometry` and `drawSingleCartoonGlove` to reflect the `1.25x` real-hand coverage factor (`0.95` to `3.00`).
  - `leftHand.radiusPx` / `rightHand.radiusPx`: Stored on each hand state from the rendered glove dimensions (`58 * computedScale`) so collision detection uses the exact visual glove boundary.
- **Interactive Component & State Mapping**:
  - `analyzeHandGeometry`: Maps the 21 MediaPipe landmarks to a `0.95..2.85` scale multiplier based on `1.25x` the real hand's normalized span.
  - `onHandsResults`: Sets `player.isClapping = true` only when the two hands' visual glove radii touch/overlap (`sepDist <= visualTouchDist` or unpadded `bboxOverlap`), and restricts single-hand occlusion bridging to hands that were already within `lastTwoHandSepDist <= 0.14` (`< 220ms` ago) and moving toward each other.
  - `checkHandWeaponCollision`: Verifies `gloveCenterDistPx <= leftRadiusPx + rightRadiusPx` before testing distance to any mosquito option card, preventing mid-air false slaps between separated hands.
  - `drawSingleCartoonGlove`: Anchors the glove center at the midpoint of the full hand bounding box (`wrist` through `fingertips`) and scales `targetGlovePx = anatomicalHandPx * 1.25` up to `390px`.
