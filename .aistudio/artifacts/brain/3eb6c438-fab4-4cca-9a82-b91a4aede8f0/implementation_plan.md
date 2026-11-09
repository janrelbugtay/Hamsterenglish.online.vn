# Hamster Paintball — Clean Player HUD, Team Kills Scoring, Winner Reveal & Host Question Accuracy Plan

Streamlines the player screen by removing extra top buttons and badges, shifts Host scoring to kills per team, reveals the winning team or player on both Host and Player end screens, restricts answering questions strictly to active match play, and adds real-time per-player question accuracy (`correct`, `wrong`, and `%`) across the Host interface.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Design & Gameplay Decisions**
> - **Streamlined Player HUD**: Removes the **Scores**, **Character**, **Lobby (`567127`) number badge**, and **Settings** buttons/badges from the Player screen so students have an uncluttered view with their HP/Shield bar, match timer (when active), movement joystick, and shoot/question controls.
> - **Questions Hidden Until Match Starts**: The **Questions** button is completely hidden on the Player screen during the Lobby phase and only appears once the Host clicks **START GAME** (`matchStatus === 'playing'`).
> - **Team Kills Scoring & End-of-Game Winner Banner**: Team standings on the Host screen and end-of-game screen rank teams by **total kills (KOs / Splats) per team** (`Red Squad Kills` vs. `Blue Squad Kills`), and when the match ends, both the Host screen and all Player screens display a prominent **Winner Announcement Banner** (`🏆 RED SQUAD WINS!`, `🏆 BLUE SQUAD WINS!`, `🤝 IT'S A TIE!`, or top Solo winner).
> - **Host Per-Player Question Accuracy (`Correct / Wrong / %`)**: Tracks each student's `questionsCorrect` and `questionsWrong` in real time and displays their accuracy percentage, correct count (`✓`), and wrong count (`✗`) on **Host player cards, the Host Scores popup, and the Final Results screen**.

---

## 1. Overview & Core Concept

This update refines the classroom gameplay flow and teacher visibility in **Hamster Paintball**:
1. **Minimalist Student Screen**: Students no longer see distracting **Settings**, **Scores**, **Character**, or **Lobby (`567127`)** badges or score counters on their personal HUD.
2. **Match-Only Question Answering**: Students cannot open or answer questions while waiting in the Lobby. The **Questions** button appears only after the Host starts the match.
3. **Kills-Per-Team Scoring & Synchronized Winner Screen**: The Host's live scoreboard and end-of-match results use **Team Kills (KOs)** as the primary scoring metric (`Red Team Kills` vs `Blue Team Kills`) and broadcast the final match end state so both Host and Student screens showcase the winning team or champion.
4. **Teacher Question Analytics**: Every student's correct and wrong question attempts (including 15-second question timeouts) are synchronized to the Host, showing live accuracy (`%`), `✓ Correct`, and `✗ Wrong` counts per student.

---

## 2. User Experience & Visual Design

- **Player In-Game HUD (`role === 'player'`)**:
  - **Top Bar**: Retains only `Back` (top-left) and `Full Screen` (top-right). Removes `Settings`, `Scores`, `Character`, the `⭐ score` badge on the player card, and the center `567127 | 🟢 LOBBY (567127)` room code pill.
  - **Center Clock**: Displays the countdown timer cleanly during the active match (`matchStatus === 'playing'`).
  - **Bottom Controls**: Shows `MOVE` joystick on the left, `SHOOT` button on the right, and the `QUESTIONS` button in the center **only** when `matchStatus === 'playing'`.
- **Host Live HUD, Scores Modal & Final Results (`role === 'host'` & `screen === 'results'`)**:
  - **Live Team Kills Scoreboard**: Displays **Red Squad Kills** vs **Blue Squad Kills** right in the Host top bar, Scores modal, and Final Results screen.
  - **Per-Player Question Accuracy Badges**: Each student row/card on the Host view (Lobby list, bottom Player View cards, Scores modal, and Final Results) displays:
    - **Kills**: `💥 X Kills`
    - **Question Accuracy**: `🎯 XX% (C✓ / W✗)` (e.g., `🎯 80% (8✓ / 2✗)`).
  - **Winner Reveal on Host & Player Screens**: When the timer reaches `0:00` or the Host clicks `End`, both Host and Player screens transition to the Final Results overlay featuring a large trophy banner announcing the winning team (`🏆 RED SQUAD WINS!`, `🏆 BLUE SQUAD WINS!`, or `🤝 DRAW MATCH!`) based on total team kills.

---

## 3. Key Product Decisions & Trade-Offs

- **Kills-First Ranking**: Sorting teams and players by total Kills (`kos`)—with Question Accuracy (`questionsCorrect`) as the tie-breaker—aligns the scoreboard directly with paintball eliminations while still rewarding students who answer questions accurately to earn paintballs.
- **Reliable End-of-Match Sync**: When the Host ends the match or the countdown expires, the `'results'` status is pushed via BroadcastChannel, the Express room endpoint, and Firestore so every student's screen immediately displays the Winner Results screen.

---

## 4. Technical Architecture & Data Strategy

```
+-------------------------------------------------------------------------+
|                  STUDENT CLIENT (role === 'player')                     |
|                                                                         |
|  - Top HUD: Back + Full Screen only (No Settings/Scores/Character/Code) |
|  - Bottom Dock: Questions button rendered ONLY when matchStatus ===     |
|    'playing'; answering updates `questionsCorrect` & `questionsWrong`   |
|  - End of Match: Displays Winner Banner (Red Kills vs Blue Kills)       |
+-------------------------------------------------------------------------+
                                    |
        Real-Time Sync (Firestore + Express API + BroadcastChannel)
        Payload: { kos, questionsCorrect, questionsWrong, questionsAnswered }
                                    v
+-------------------------------------------------------------------------+
|                    HOST CLIENT (role === 'host')                        |
|                                                                         |
|  - Top HUD & Scores Popup: Live Red Team Kills vs Blue Team Kills       |
|  - Player Cards / Scores / Results: Shows `Kills` + Accuracy            |
|    `XX% (Correct ✓ / Wrong ✗)` for every student                        |
|  - End Match: Computes Winner by Team Kills & shows on Host + Players   |
+-------------------------------------------------------------------------+
```

### Key Implementation Steps
1. **Extend Player Telemetry (`questionsCorrect` & `questionsWrong`)**:
   - Add `questionsCorrect: number` and `questionsWrong: number` to `PlayerNetworkState` and local student state, resetting them to `0` when a new match starts (`triggerStudentMatchStart` and `handleStartMultiplayerMatch`).
   - Increment `questionsCorrect` on a right answer and `questionsWrong` on a wrong answer or 15-second question timer expiration, and include both fields in the 300ms heartbeat sync.
2. **Streamline Player HUD & Gate Questions by Match Start**:
   - Hide `Settings`, `Scores`, `Character`, the player card `⭐ score` badge, and the `🟢 LOBBY (code)` room code pill when `role === 'player'`.
   - Render the bottom `QUESTIONS` button (and allow `Q` key shortcut) strictly when `role === 'player' && matchStatus === 'playing'`.
3. **Host Kills-Per-Team Scoring, Accuracy Display & Winner Screen**:
   - Update Host HUD, Host Scores popup, and Final Results screen to highlight **Team Kills (`teamTotals.red.kos` vs `teamTotals.blue.kos`)** and sort players by Kills (`kos`).
   - Render per-player accuracy (`accuracy% • ✓ correct / ✗ wrong`) on Host player cards, Scores modal rows, and Final Results rows.
   - Add a prominent **Winner Banner** (`RED SQUAD WINS!`, `BLUE SQUAD WINS!`, `IT'S A TIE!`, or Solo Champion) at the top of the Final Results screen on both Host and Player devices.
