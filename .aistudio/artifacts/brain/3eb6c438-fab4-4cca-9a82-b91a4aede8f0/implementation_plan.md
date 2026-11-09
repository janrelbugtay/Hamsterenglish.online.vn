# Hamster Paintball: Pro Combat Juice & Post-Match MVP Awards

This plan elevates **Hamster Paintball** with responsive arcade combat feedback—crisp reticle hit-markers, 3D-to-2D projected floating damage numbers, screen-edge paint-splat hit indicators, and multi-kill streak callouts—paired with a **Post-Match MVP Awards** showcase celebrating the classroom's Top Killer, Best Question Accuracy, and Longest Streak on the final results screen.

## User Review & Critical Decisions

> [!IMPORTANT]
> Both feature sets below reflect your confirmed choices from our planning questions:

- **Confirmed Decision 1 (Gameplay & Combat Feel)**: Implement **Reticle Hit Markers**, **Floating Damage Numbers** (`-25` / `-35` projected over hit opponents), **Screen-Edge Paint Splat Indicators** when taking damage, and **Kill-Streak Callouts** (*"DOUBLE SPLAT!"*, *"TRIPLE SPLAT!"*, *"UNSTOPPABLE!"*, *"PAINT GOD!"*).
- **Confirmed Decision 2 (Host & Classroom Review)**: Implement **Post-Match MVP Badges** on the Final Results screen for both Host and Players, highlighting **Top Splat Master** (most kills), **Sharpshooter Scholar** (highest question accuracy), and **Streak Legend** (longest streak).

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Reticle Hit-Marker & Floating Damage Popups**: Whenever a player's paintball hits an opponent, a crisp `✕` hit-marker flashes at the aim cursor/reticle and a floating `-25` damage popup rises above the target's 3D world position.
  2. **Incoming Hit Paint-Splat Vignette**: When a player takes paintball damage, a brief team-colored paint splat vignette flashes along the screen edges so they immediately feel the impact without obstructing their view.
  3. **Arcade Kill-Streak Announcer**: Scoring consecutive kills triggers high-energy callout banners and synthesized fanfare (*2x Double Splat*, *3x Triple Splat*, *4x Mega Splat*, *5x+ Unstoppable*).
  4. **Post-Match MVP Podium Badges**: When a match concludes, the Final Results screen calculates and awards three distinct MVP honors across all participants: **Top Killer**, **Best Question Accuracy**, and **Best Streak**.
- **Target Audience / Persona**: ESL students playing on mobile/tablets or laptops and teachers hosting live classroom matches on an interactive projector/smartboard.
- **Key Value**: Gives every shot and KO tactile, unmistakable arcade feedback while rewarding both arena skill (kills) and academic mastery (question accuracy and streaks) at the end of every game.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Landing a Paintball Hit**:
     - Player fires a paintball that collides with an opponent (`r < 1.85`).
     - A glowing neon hit-marker (`✕`) briefly flashes over the aim point (`180ms`), accompanied by a crisp hit sound and a floating `-25` (or `-35 SHIELD` / `SPLAT KO!`) badge projected from the target's 3D coordinates into 2D screen space.
  2. **Taking Incoming Damage**:
     - When hit by an opponent, a 450ms translucent paint-splat vignette pulses around the outer screen perimeter (`pointer-events-none`) so the player knows they are under fire.
  3. **Scoring Multi-Kills & Streaks**:
     - Achieving 2, 3, 4, or 5+ kills without being splatted displays an animated arcade callout badge below the top HUD with distinct color coding and synthesized audio chord stingers.
  4. **Viewing Post-Match MVP Awards**:
     - When the match ends (`screen === 'results'`), directly beneath the **Match Winner Banner**, a 3-card **MVP Awards Row** highlights:
       - **💥 Top Killer**: Player with the highest kill count (`X Kills`).
       - **🎯 Best Accuracy**: Player with the highest question accuracy (`X% • Y✓`).
       - **🔥 Best Streak**: Player with the highest streak (`Xx Streak`).
     - Individual player rows in the standings also display compact inline MVP ribbons next to winners' names.

- **Visual Identity & Theme**:
  - **Aesthetic Direction**: High-contrast arcade sports HUD (`bg-slate-900/90 backdrop-blur-sm border border-white/15`) layered cleanly over the vibrant 3D stadium park.
  - **Color Palette & Mood**:
    - Red Squad (`#EF4444` / `rose-500`), Blue Squad (`#2563EB` / `sky-500`), Critical KO Gold (`#FACC15` / `amber-400`), Shield Hit Cyan (`#22D3EE` / `cyan-400`), and Accuracy Emerald (`#4ADE80` / `emerald-400`).
  - **Typography & Hierarchy**: Bold geometric sans with `tabular-nums` for all damage numbers, kill counters, and accuracy percentages so rapidly updating metrics never jitter.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: 3D-to-2D Screen Projection for Floating Damage Numbers**
  - *Chosen Approach*: Project the hit opponent's 3D world coordinates (`THREE.Vector3.project(camera)`) into 2D viewport percentages and render lightweight, GPU-accelerated DOM badges (`transform: translate3d(...)`).
  - *Why*: Maintains razor-sharp typography at any resolution on both mobile and desktop without allocating per-hit Three.js canvas textures.
  - *Alternatives Considered*: Creating a `THREE.CanvasTexture` sprite for every hit—passed over to avoid WebGL texture memory churn during rapid paintball exchanges.

- **Decision 2: Deterministic MVP Award Calculation on Final Results**
  - *Chosen Approach*: Compute the three MVP winners (`topKiller`, `bestAccuracy`, `bestStreak`) deterministically from `roomPlayers` via `useMemo` so the Host screen and all connected Student screens display the exact same MVP winners.
  - *Why*: Requires zero extra network round-trips when the match ends and works seamlessly in both Teams and Solo modes.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        HamsterPaintballView                              │
├───────────────────────────────────┬──────────────────────────────────────┤
│     3D WebGL Projectile Loop      │       Real-Time Network Sync         │
│  ┌─────────────────────────────┐  │  ┌────────────────────────────────┐  │
│  │ Hit Detection (r < 1.85)    │  │  │ PlayerNetworkState             │  │
│  │  ├─ spawnFloatingDamage()   │  │  │  ├─ kos (Kills)                │  │
│  │  ├─ triggerHitMarkerFlash() │  │  │  ├─ questionsCorrect / Wrong   │  │
│  │  └─ triggerKillStreakCall() │  │  │  └─ bestStreak                 │  │
│  └─────────────────────────────┘  │  └────────────────────────────────┘  │
├───────────────────────────────────┴──────────────────────────────────────┤
│                    Semantic DOM HUD & Results Overlays                   │
│  ┌──────────────────────┐ ┌─────────────────────┐ ┌───────────────────┐  │
│  │ Floating Damage &    │ │ Screen-Edge Damage  │ │ Post-Match Results│  │
│  │ Reticle Hit-Marker   │ │ Splat Vignette      │ │  ├─ Winner Banner │  │
│  │ Overlay              │ │ + Kill-Streak Toast │ │  └─ 3 MVP Cards   │  │
│  └──────────────────────┘ └─────────────────────┘ └───────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State Additions**:
  - `floatingDamages`: Array of `{ id, xPct, yPct, amount, isKo, isShield, color }` with automatic 850ms cleanup.
  - `hitMarkerActive`: Boolean + screen coordinates `{ x, y, isKo }` lasting 180ms when a shot lands.
  - `damageVignetteColor`: Hex/RGB string triggered for 450ms inside `applyIncomingDamage`.
  - `killStreakCallout`: `{ title, subtitle, count, color }` triggered when `koStreak` reaches `2` (*DOUBLE SPLAT!*), `3` (*TRIPLE SPLAT!*), `4` (*MEGA SPLAT!*), or `5+` (*UNSTOPPABLE!*).
  - `mvpAwards`: Computed memo returning `{ topKiller, bestAccuracy, bestStreak }` from `roomPlayers`.
