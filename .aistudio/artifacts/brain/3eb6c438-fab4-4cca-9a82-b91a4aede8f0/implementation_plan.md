# Hamster Paintball 3D — Multi-Device Multiplayer Fix, Compact Arena & Arcade Redesign

Eliminate multi-device connection errors, cross-domain room isolation, clock-skew timer bugs, and dropped paintball shots while transforming Hamster Paintball into a fast-paced compact 3D speedball arena wrapped in ESL Game Studio's bright, playful arcade UI.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Direction from Your Answers**
> 1. **Dual-Domain Multi-Device Join Routing**: QR codes and join links will support **both the active host URL and `hamsterenglish.online`** via a one-click domain toggle on the Host Lobby and QR Modal, backed by a unified cross-origin API + shared cloud room bridge so students on phones, tablets, and Chromebooks connect reliably regardless of which domain they scan or type.
> 2. **Compact 3D Arena & Larger Characters**: The stadium shrinks from an oversized 136m × 112m field to a **compact 76m × 64m speedball park** with team spawns 48m apart, **1.32× larger 3D hamsters** with floating overhead name/HP/shield plates, and **14 low-profile colorful bunkers** arranged in three clear sightline lanes.
> 3. **Bright Playful Arcade UI**: All dark/heavy overlays across the Host Command Deck, Student Join Lobby, In-Game HUD, Live Quiz Drawer, and Results Podium will be redesigned into **bright sky-and-white playful arcade cards** with tactile 3D bottom-bezel buttons matching ESL Game Studio.

---

## 1. Overview & Core Concept

Hamster Paintball 3D lets teachers host live classroom trivia-and-paintball battles (Team Red vs. Blue or Free-For-All) while students join from phones, tablets, or laptops using a 6-digit room code or QR scan, answer vocabulary/grammar questions to earn paintballs, and battle in real time.

Today, multi-device classroom sessions break due to seven compounding issues:
- **Room Join Permission Error**: Joining via the global room code modal queries an unpermitted database collection, triggering an immediate connection error before entering the lobby.
- **Cross-Domain Room Split**: Hardcoded join links send students to `hamsterenglish.online` even when the host opens the game from a preview/shared URL, isolating in-memory rooms across separate origins.
- **Match-Start Race Condition**: In-flight lobby heartbeats from student phones overwrite the host's match-start reset packet, leaving students stuck in the lobby or frozen at old coordinates.
- **Device Clock Skew**: Comparing raw device timestamps across laptops, iPads, and Android phones causes match timers to jump or prematurely end when a device's clock is off by even 15 seconds.
- **Dropped Rapid Shots & Hits**: Storing only a single `lastShot` / `lastHit` field overwrites rapid fire (185ms fire rate vs. 300ms sync cycle) and drops ~40% of combat events.
- **Listener Reconnection Stalls & Refresh Clones**: Changing UI screens or lobby sliders tears down live room listeners, while refreshing a mobile browser spawns a duplicate frozen hamster.

This update resolves every multi-device failure end-to-end and pairs it with a tighter, action-packed 3D arena and a joyful classroom-ready arcade interface.

---

## 2. User Experience & Visual Design

### Aesthetic Direction & Color System (ESL Game Studio Arcade)
- **Atmosphere**: Bright daylight sky-and-turf arcade presentation (`#E0F2FE` → `#F8FAFC` soft sky backdrop in menus; crisp `#FFFFFF` elevated cards with `#DBEAFE` / `#E2E8F0` borders and tactile bottom-bezel shadows).
- **Primary Accents**:
  - **Arcade Sky / Royal Blue** (`#0284C7` / `#2563EB` with `#1D4ED8` 3D bottom bezel) for primary navigation, Blue Team identity, and active controls.
  - **Coral / Crimson Arcade Red** (`#EF4444` / `#E11D48` with `#BE123C` 3D bottom bezel) for Red Team identity and elimination callouts.
  - **Emerald Action Green** (`#10B981` / `#059669` bezel) for primary **START BATTLE** / **ENTER ARENA** CTAs and correct trivia feedback.
  - **Sunshine Amber** (`#F59E0B` / `#D97706` bezel) for ammo counters, MVP crowns, and countdown warnings.
- **Typography**:
  - **Display & Headings**: `Poppins` (ExtraBold / Black, tight tracking) for arena titles, room codes, team banners, and victory callouts.
  - **Body & Question Prompts**: `Inter` (SemiBold / Bold, generous line height) for fast classroom readability on projectors and small phone screens.
  - **Numeric Readouts**: `tabular-nums` enforced on countdown timers, team scores, ammo counts, HP/shield bars, and leaderboard stats so numbers never jitter.
- **Strict Cleanliness & WebGL Performance Rules**:
  - Zero `backdrop-filter` blur layers over the active 3D WebGL canvas to maintain smooth 60fps frame pacing on student tablets and phones.
  - Zero left-border accent clichés or decorative pulsing status dots.

### Screen-by-Screen Experience
1. **Host Setup & Classroom Lobby (Projector-Ready)**
   - **Giant Scannable Room Header**: High-contrast 6-digit Room Code card, instant **QR Code Popover**, Copy Link button, and a clean **Join Domain Segmented Switch** (`Current Host URL` | `hamsterenglish.online`) so teachers can match whatever URL students are using while both routes bridge to the same live room.
   - **Compact Match Configuration**: Tactile segmented controls for **Battle Mode** (`Red vs Blue` | `Free-For-All`), **Match Timer** (`2m`, `3m`, `5m`, `8m`, `10m`), and **Paintballs per Correct Answer** (`5`, `10`, `15`, `20`), plus quiz badge preview.
   - **Live Roster Showcase**: Two vibrant team columns (or unified FFA grid) showing each connected student's chosen hamster avatar, ready badge, and host kick/team-balance controls, anchored by a bold emerald **START BATTLE** button.
2. **Student Join & Character Customizer (Mobile-First)**
   - **Hero 3D/Illustrated Character Stage**: Enlarged hamster class selector (**Classic**, **Ninja**, **Pirate**, **Astro**, **Wizard**, **Cyber**) with clear role tags, crisp team selector cards (or auto-balance), nickname input, and a single prominent **JOIN LOBBY** button.
   - **Waiting Room**: Live roster count, chosen hamster preview, and smooth automatic transition into the 3D arena the instant the host starts the match—with a manual **Sync Now** fallback button never needed under normal play.
3. **Compact 3D Speedball Arena & Character Layout**
   - **Compact 76m × 64m Stadium (`x: ±38m, z: ±32m`)**: Team spawn pads move to `z = -24m` (Red) and `z = +24m` (Blue)—cutting travel distance nearly in half so hamsters engage within 2–3 seconds of spawning.
   - **Three-Lane Sightline Cover (14 Low-Profile Bunkers)**: Replaces the 35+ tall vision-blocking walls with 14 vibrant inflatable-style speedball bunkers (`1.8m–3.0m` tall: Dorito wedges, X-hub center, cylinders, and low dasher beams) arranged into Left Wing, Center X-Hub, and Right Wing lanes. Players can spot opponents across lanes while still ducking behind cover to answer trivia.
   - **1.32× Hero Hamster Proportions & Overhead Plates**: All hamsters render 32% larger with expressive ears, goggles, and paintball markers, topped by a crisp billboarded **Name + Team + Live HP & Shield Bar** sprite and smooth shortest-angle rotation + velocity dead-reckoning (eliminating 360° spin glitches and choppy steps).
   - **Balanced Pickups**: 10 brightly lit Health (`+HP`) and Shield (`+DEF`) cans placed at readable lanecontested landmarks around the compact field, framed by cheerful park trees and hills outside the arena walls.
4. **Unobstructed In-Game HUD & Live Trivia Drawer**
   - **Top Arcade Scorebar**: Compact centered pill-free arcade scoreboard showing **Red Score**, **Clock-Synced Countdown Timer**, **Blue Score** (or Top 3 in FFA), and a clean **End Flag** button for the host.
   - **Bottom Player Bar & Mobile Touch Controls**: Crisp HP + Shield bars, bold Paintball Ammo badge, prominent **EARN AMMO (QUIZ)** button that pulses gently only when ammo hits `0`, and ergonomic non-overlapping mobile joystick + aim/fire + jump controls.
   - **Fast Trivia Overlay**: Bright white arcade question card with 2×2 color-coded answer buttons (`A`, `B`, `C`, `D`), instant `+Balls` ammo celebration burst, and auto-return to combat.
5. **Celebratory Podium Results**
   - Bright 1st / 2nd / 3rd hamster podium showcase, Winning Team banner, full classroom scoreboard (Score, Hits, KOs, Quiz Accuracy), and one-tap **PLAY AGAIN (SAME ROOM)** or **BACK TO LOBBY** actions.

---

## 3. Key Product Decisions & Trade-Offs

- **Dual-Transport Sync (Cross-Origin Host API + Shared Cloud Room Document)**
  - *Decision*: Every room writes a lightweight shared state + `hostApiOrigin` into the cloud room document while streaming high-frequency movement and combat events through the host's room API (with CORS enabled for cross-domain browsers) and cloud action snapshots in parallel.
  - *Why*: Students scanning a `hamsterenglish.online` QR code while the teacher hosts on a preview URL (or vice versa) immediately discover the room, sync clock offsets, and exchange shots without hitting isolated memory silos.
- **Server-Relative Clock Offset & Match Epoch Versioning**
  - *Decision*: Every room response includes `serverNow` and a monotonic `matchEpoch` (`startedAt`). Clients compute a local `serverTimeOffset` and reject any packet from an older `matchEpoch`.
  - *Why*: Completely cures premature match endings on phones with drifted clocks and prevents late lobby packets from undoing the host's match-start teleport.
- **Ring-Buffer Combat Event Log Instead of Single-Slot Fields**
  - *Decision*: Replace single `lastShot` / `lastHit` fields with a bounded 40-event combat ring buffer (`id`, `type`, `attackerId`, `targetId`, `origin`, `dir`, `damage`, `ts`) deduplicated per client.
  - *Why*: Guarantees 100% delivery of rapid paintball volleys, hit markers, shield breaks, and KOs across multiple devices even on 200–300ms mobile connections.
- **Session-Persisted Player Identity**
  - *Decision*: Store the student's generated `clientId` in `sessionStorage` keyed by room code and send an explicit leave beacon on tab close.
  - *Why*: Refreshing Safari/Chrome on a phone seamlessly reclaims the student's existing hamster and score instead of spawning a duplicate frozen clone, while still allowing multiple tabs in intentional testing if opened separately.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Multi-Device Synchronization Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   HOST DEVICE (Teacher Projector / PC)                  │
│  • Authoritative Match Lifecycle (Lobby -> Live Epoch -> Ended)         │
│  • Dual-Domain QR & Link Switch (Active Origin <-> hamsterenglish.online)│
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │ 150-200ms Sync + Combat Ring    │ Shared Room & Quiz
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│   EXPRESS ROOM ENGINE (/api/paintball)│ │  CLOUD FIRESTORE ROOM BRIDGE  │
│  • CORS enabled across domains        │ │  • Permitted room collection  │
│  • Monotonic matchEpoch guard         │ │  • Stores hostApiOrigin, quiz │
│  • serverNow clock-offset calibration │ │    config, roster & actions   │
│  • 40-event ring buffer (shots/hits)  │ │  • Cross-origin fallback sync │
└───────────────────▲───────────────────┘ └───────────────▲───────────────┘
                    │                                     │
                    └─────────────────┬───────────────────┘
                                      │ Deduplicated Merge + Dead Reckoning
                    ┌─────────────────┴───────────────────┐
                    ▼                                     ▼
     ┌─────────────────────────────┐       ┌─────────────────────────────┐
     │  STUDENT DEVICE A (Phone)   │       │  STUDENT DEVICE B (Tablet)  │
     │  • sessionStorage clientId  │       │  • sessionStorage clientId  │
     │  • Clock-skew compensated   │       │  • Shortest-angle 3D lerp   │
     └─────────────────────────────┘       └─────────────────────────────┘
```

### Core Room & Combat Data Model
- **Room State (`PaintballRoomState`)**:
  - `code`: 6-character uppercase/numeric room code
  - `status`: `'lobby' | 'playing' | 'ended'`
  - `matchEpoch`: authoritative timestamp/version set on `START BATTLE` (blocks stale pre-match packets)
  - `serverNow`: authoritative server clock attached on every read/write for client offset calculation
  - `hostApiOrigin`: active origin URL of the host's backend instance for direct cross-domain API sync
  - `matchMode`: `'teams' | 'ffa'`, `durationSec`: number, `remainingSec`: number, `ballsPerQuestion`: number
  - `players`: map of `PlayerNetState` (`id`, `name`, `team`, `avatar`, `x`, `y`, `z`, `vx`, `vz`, `yaw`, `hp`, `shield`, `score`, `hits`, `kos`, `seq`, `matchEpoch`, `immuneRemainingMs`)
  - `events`: bounded array (max 40, TTL 6s) of `CombatNetEvent` (`eventId`, `kind: 'shot' | 'hit' | 'ko' | 'pickup'`, `actorId`, `targetId?`, `pos`, `dir?`, `dmg?`, `ko?`, `ts`)

### Interactive Component & State Mapping
- **Global Room Code Join Modal**: Queries `/api/paintball/room/:code` and permitted cloud room documents (`pb_room_${code}`) without touching unpermitted collections; routes cleanly into the Student Lobby with room code pre-bound.
- **Stable Room Networking Hook**: Keyed strictly on `[roomCode, role]` so UI screen transitions (`join` → `game` → `results`) and host slider adjustments never tear down active room subscriptions.
- **3D Arena Builder & Interpolator**:
  - Compact bounds constants (`ARENA_HALF_W = 38`, `ARENA_HALF_D = 32`, `SPAWN_Z = 24`) shared identically across spawn logic, movement collision, paintball ray/sphere bounds, pickup placement, and minimap/HUD indicators.
  - Remote character updater applies `shortestAngleDelta(currentYaw, targetYaw)` + velocity extrapolation `(x + vx * dt, z + vz * dt)` clamped against bunker AABBs, updating overhead canvas/sprite health bars only when HP or shield values change.
