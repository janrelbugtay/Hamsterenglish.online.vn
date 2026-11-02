# Implementation Plan: Homework Creation, Management, and Analytics Proof

Replace the secondary "Play in Mystery Box" option in My Games with a full **Create Homework** flow, build out the **Homework Section** with interactive Teacher/Student modes, and provide verifiable **Completion Analytics** (duration spent, score %, accuracy, and question breakdown).

---

## User Review Required

> [!IMPORTANT]
> - **Game Card Menu**: "Play in Mystery Box (1-30)" in `GamesLibrary.tsx` will be replaced with **"Create Homework"** (with homework assignment icon).
> - **Dual Access**: Students can launch homework directly from the **Homework Tab** or via a **Shareable Code / Direct Link** (`#homework-[pin]`).
> - **Proof of Completion**: Every submission records exact completion timestamps, real time duration spent (minutes and seconds), accuracy percentage, and a question-by-question audit log.

---

## Proposed Architecture & Changes

### 1. My Games Menu: "Create Homework" Modal
- **File**: `src/views/GamesLibrary.tsx`
- In the game card 3-dots dropdown menu, replace `Play in Mystery Box (1-30)` with `Create Homework`.
- When clicked, opens a **Create Homework Assignment Modal** pre-filled with the selected game's title, subject, and questions:
  - **Assignment Title**: Editable title for the homework.
  - **Target Class / Level**: Starters, Movers, Flyers, KET, PET, Grade 1-12.
  - **Assigned Game Mode**: Select which game engine to run the homework in (Bubble Pop, Slap & Chop, Roller Coaster, Yoga Quiz, Mystery Box, Sumo, etc.).
  - **Duration & Time Limit**: 5 min, 10 min, 15 min, 20 min, 30 min, or No Limit.
  - **Due Date & Deadline**: Pick calendar date & time.
  - **Mastery Target / Passing Score**: 60%, 70%, 80%, 90%, 100%.
  - **Attempts Allowed**: 1, 3, or Unlimited.
  - **Unique 6-Digit PIN & Share Link**: Instant share code generated for students.
- Saves the assignment to Firestore (`homework_assignments`) with localStorage fallback.
- Offers instant actions: "Copy Student Link", "View in Homework Dashboard", or "Done".

---

### 2. Homework Hub: Teacher vs. Student Dual Modes
- **File**: `src/views/Homework.tsx`
- Upgrade the current placeholder into a dual-mode homework dashboard:
  - **Top Bar Mode Switcher**:
    - **Teacher View** (Assignments Manager, Class Overview & Analytics)
    - **Student View** (My Assignments, Completed Tasks, and PIN Code Joiner)

#### A. Teacher View
- **KPI Summary Row**:
  - Total Active Assignments
  - Total Submissions Received
  - Average Class Accuracy %
  - Average Time Spent (e.g. `8m 45s`)
- **Tab 1: Active & Past Assignments**:
  - List of created homework assignments with game mode thumbnail, due date, duration limit, and submissions counter.
  - Quick action buttons: **View Analytics**, **Copy PIN/Link**, **Preview Game**, **Close/Delete**.
  - "+ New Assignment" button to create homework from any existing saved game.
- **Tab 2: Analytics & Proof-of-Work Ledger**:
  - Filterable by Assignment and Class.
  - **Submissions Ledger Table**:
    - Student Name & Class
    - Submission Date & Time
    - **Duration Spent**: Exact elapsed time (proves student actually spent 7m 12s on task rather than clicking through).
    - **Score & Accuracy**: e.g., `92% · 23/25 Correct`.
    - **Status**: Verified Passed ✓ / Incomplete.
    - **Audit Action**: "View Verified Proof".
  - **Student Proof Certificate & Audit Modal**:
    - Digital proof badge with submission ID, start timestamp, finish timestamp, and total duration.
    - Question-by-question breakdown showing: Question text, student's selected answer, correct answer, and correctness flag.
    - Export / Print / Copy Proof Summary button.

#### B. Student View
- **Join by PIN Bar**: Quick input to enter a 6-digit code from teacher.
- **Pending Assignments List**:
  - Shows homework card with due date, time limit badge, target score, and questions count.
  - "Start Assignment" button launching the homework gameplay session.
- **Completed Homework History**:
  - Shows completed tasks with score, duration spent, and "View My Proof of Completion" card.

---

### 3. Homework Player Session & Completion Recording
- **Files**: `src/views/Homework.tsx`, `src/App.tsx`
- When starting an assignment, launches the selected game with a **Homework Header**:
  - Student Name badge, live assignment timer, and progress counter.
- On game end:
  - Records student name, duration in seconds, score, accuracy %, and question breakdown.
  - Persists submission to Firestore (`homework_submissions`) + localStorage.
  - Shows immediate student completion celebration with printable Proof Card.

---

### 4. Direct Link & URL Routing Support
- Supports URL hash `#homework-[pin]` or `#homework` so teachers can directly send links to students.

---

## Verification Plan

### Automated Verification
1. **TypeScript Validation**: Run `lint_applet` (`tsc --noEmit`) to verify 0 errors.
2. **Build Verification**: Run `compile_applet` to confirm the production build compiles cleanly.

### Manual Verification
1. Navigate to **My Games** (`#games` / My Games tab).
2. Open the 3-dots menu on any game card -> verify "Play in Mystery Box" is replaced with **"Create Homework"**.
3. Click **"Create Homework"** -> verify modal opens with pre-filled game title, duration picker, passing score, and 6-digit PIN.
4. Save homework -> verify it appears in the **Homework Tab**.
5. Switch to **Teacher View** -> verify assignment shows with 0 submissions and share options.
6. Switch to **Student View** -> click "Start Assignment" (or enter PIN), complete questions.
7. Return to **Teacher Analytics** -> verify new submission appears with student name, exact duration spent, accuracy %, and full question breakdown.
8. Click "View Verified Proof" -> verify detailed audit certificate with timestamp and question breakdown.
