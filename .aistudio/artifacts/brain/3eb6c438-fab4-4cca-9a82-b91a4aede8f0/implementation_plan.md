# Authentication Choice Hub & Red Light Movement Overhaul

This plan implements a clear 3-way authentication choice architecture (Google Sign-In, Non-Google Email/Password Account Creation, and Frictionless Guest Access), while resolving the Red Light, Green Light player orientation and movement bugs.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The application will provide three explicit, equal-prominence pathways so users are never forced to authenticate:
> 1. **Google Sign-In**: Quick one-click sign in using their Google account.
> 2. **Non-Google Account Creation**: Complete email/password registration with display name, allowing users to create and manage an independent account without any Google dependency.
> 3. **No Sign-In Required (Guest Mode)**: Immediate access to all games, classrooms, and tools without registering or entering any credentials. Local data and progress are automatically saved to browser storage.

In parallel, the plan addresses the Red Light, Green Light game behavior:
- **Player Orientation**: Characters will face strictly towards the doll, never backwards towards the camera.
- **Standby Wandering Fix**: Turn off standby random pacing during Red Light mode so players do not wander back and forth.
- **Stop-and-Go Gameplay**: Players sprint forward during Green Light, freeze immediately on doll turns, and resume moving forward from their exact position until they cross the finish line to safety.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Auth Choice Modal**: Redesigns `GoogleAuthModal.tsx` and the account entry flow into an "Authentication Choice Hub". Users can choose between:
    - `Continue with Google` (Firebase Google OAuth)
    - `Create Account (Email & Password)` / `Sign In (Email & Password)` with tabs for smooth toggling
    - `Continue as Guest` / `Skip Sign-In` button prominently featured at the bottom and top
  - **Red Light Player Direction & Physics**:
    - Disables background standby wandering (`isStandbyActive = false`) during Red Light matches.
    - Orients all character models with `lookAt(char.position.x, 1, -30)` so their faces and bodies face forward towards the giant doll.
    - Ensures running only progresses forward toward the finish line (`z <= -18`), maintaining position across Green/Red Light stop-and-go cycles.

---

## 2. User Experience & Visual Design

### Auth Choice Modal Layout
```
┌────────────────────────────────────────────────────────┐
│  Choose How to Play                  [✕ Close]         │
│  Sign in to sync your progress, or play immediately.  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  [G] Continue with Google                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ─────── OR CREATE AN INDEPENDENT ACCOUNT ───────     │
│                                                        │
│  [ Sign In ]   [ Create Account ] (Tabs)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Name: [ Your Name / Nickname ]                   │  │
│  │ Email: [ username@domain.com ]                   │  │
│  │ Password: [ ••••••••••• ]                        │  │
│  │ [ Create Account / Sign In Button ]              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ─────── NO ACCOUNT NEEDED ───────────────────────     │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ⚡ Continue as Guest (No Sign-In Required)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Red Light, Green Light Movement
- **Start of Round**: All contestants spawn behind the starting line facing the doll (`z = -22`).
- **Green Light**: Players sprint straight forward (`z -= step`).
- **Doll Turning / Red Light**: Players brake to a complete stop and freeze in place. Any caught movers are targeted.
- **Next Green Light**: Players resume sprinting straight forward from their exact frozen positions.
- **Finish Line Crossing**: Once `z <= -18` (crossing the yellow line), the player is marked `✓ SAFE` and celebrates in the safe zone.

---

## 3. Key Technical Decisions & Architecture

1. **Authentication Architecture**:
   - `AuthContext.tsx` already supports `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, and `signInAnonymously`.
   - Update `GoogleAuthModal.tsx` to provide clear, dedicated tabs: "Sign In with Google", "Create Account / Email", and a prominent "Play as Guest (No Sign-In)" action.
   - Non-Google accounts use Firebase Auth's `createUserWithEmailAndPassword` and `updateProfile`, storing user profile documents in Firestore `users/{uid}`.
   - Guest mode creates an anonymous session or directly closes the modal with local storage persistence, ensuring zero friction.
2. **Squid Game Red Light Bug Fixes (`SquidGamePicker.tsx`)**:
   - In `spawnPlayers`: set `char.rotation.y = Math.PI` (or `char.lookAt(char.position.x, 1, -50)`) so the 3D model face correctly looks forward at the doll.
   - In `playRedLightRound`: explicitly call `this.stopStandbyMode()` so `updateStandbyMovement` does not randomly wander players back and forth.
   - Ensure the Green Light loop moves players strictly forward along negative Z towards the yellow line.

---

## 4. Implementation Steps

1. **Authentication Choice Hub**:
   - Update `src/components/GoogleAuthModal.tsx` to present the three choices: Google, Email/Password account creation/login, and Instant Guest access.
   - Add clear tab switching between "Sign In" and "Create Account" for non-Google users.
   - Add a high-visibility "Continue as Guest" card button.
2. **Red Light Direction & Rotation Fix**:
   - In `src/views/SquidGamePicker.tsx`, ensure player character models are rotated to face the doll (`rotation.y = Math.PI` or forward lookAt).
   - In `playRedLightRound`, call `this.stopStandbyMode()` immediately on start so standby wandering is killed.
   - Enforce unidirectional forward movement (`z -= step`) during Green Light intervals.
3. **Verification & Build**:
   - Run `lint_applet` and `compile_applet` to confirm build validity.
   - Verify dev server responsiveness.
