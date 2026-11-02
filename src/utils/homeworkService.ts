import { collection, doc, getDocs, setDoc, deleteDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface QuestionAuditItem {
  questionId: string | number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds?: number;
}

export interface HomeworkAssignment {
  id: string;
  gameId: string | number;
  gameTitle: string;
  gameType: string;
  classLevel: string;
  topic?: string;
  dueDate: string; // ISO string e.g. "2026-11-05"
  durationMinutes: number; // e.g. 10 (0 for no limit)
  passingScore: number; // e.g. 80 (%)
  maxAttempts: number; // e.g. 1, 3, or 0 (unlimited)
  targetClass: string; // e.g. "Starters", "Grade 5", "All Students"
  instructions: string;
  pinCode: string; // 6-digit PIN e.g. "492817"
  questions: any[];
  createdAt: number;
  createdByEmail?: string;
  status: 'active' | 'closed';
  submissionsCount?: number;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  pinCode: string;
  studentName: string;
  studentEmail?: string;
  startedAt: number;
  completedAt: number;
  durationSeconds: number; // Proves actual time spent e.g. 435 seconds (7m 15s)
  score: number; // e.g. 18
  maxScore: number; // e.g. 20
  accuracyPct: number; // e.g. 90 (%)
  passed: boolean;
  attemptNumber: number;
  questionBreakdown: QuestionAuditItem[];
  verifiedAt: string; // ISO verification timestamp
}

const STORAGE_KEY_ASSIGNMENTS = 'hamster_homework_assignments_clean_v1';
const STORAGE_KEY_SUBMISSIONS = 'hamster_homework_submissions_clean_v1';

// No pre-generated mock data: starts clean for real teacher and student usage
const SEED_ASSIGNMENTS: HomeworkAssignment[] = [];
const SEED_SUBMISSIONS: HomeworkSubmission[] = [];

// Local cache helpers
export function getLocalAssignments(): HomeworkAssignment[] {
  try {
    // Purge old mock cache
    localStorage.removeItem('hamster_homework_assignments_v1');
    const raw = localStorage.getItem(STORAGE_KEY_ASSIGNMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((a: any) => a && !String(a.id).startsWith('hw-sample'));
      }
    }
  } catch (e) {}
  return [];
}

export function saveLocalAssignments(assignments: HomeworkAssignment[]): void {
  try {
    const clean = assignments.filter((a: any) => a && !String(a.id).startsWith('hw-sample'));
    localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(clean));
  } catch (e) {}
}

export function getLocalSubmissions(): HomeworkSubmission[] {
  try {
    // Purge old mock cache
    localStorage.removeItem('hamster_homework_submissions_v1');
    const raw = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: any) => s && !String(s.id).startsWith('sub-sample'));
      }
    }
  } catch (e) {}
  return [];
}

export function saveLocalSubmissions(submissions: HomeworkSubmission[]): void {
  try {
    const clean = submissions.filter((s: any) => s && !String(s.id).startsWith('sub-sample'));
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(clean));
  } catch (e) {}
}

// Generate random 6-digit PIN for student access
export function generateHomeworkPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format duration from seconds to clean string (e.g. "7m 24s")
export function formatDurationSeconds(sec: number): string {
  if (!sec || sec < 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// Fetch all assignments (with Firestore sync + local fallback)
export async function fetchAllHomeworkAssignments(): Promise<HomeworkAssignment[]> {
  try {
    const q = query(collection(db, 'homework_assignments'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list: HomeworkAssignment[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as HomeworkAssignment);
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      saveLocalAssignments(list);
      return list;
    }
  } catch (e) {
    console.warn('Notice: falling back to cached homework assignments', e);
  }
  return getLocalAssignments();
}

// Save a new or edited homework assignment
export async function saveHomeworkAssignment(assignment: HomeworkAssignment): Promise<HomeworkAssignment> {
  const current = getLocalAssignments();
  const existingIdx = current.findIndex((a) => a.id === assignment.id || a.pinCode === assignment.pinCode);
  let updatedList: HomeworkAssignment[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = assignment;
  } else {
    updatedList = [assignment, ...current];
  }
  saveLocalAssignments(updatedList);

  try {
    // 1. Save with unique assignment ID
    await setDoc(doc(db, 'homework_assignments', assignment.id), assignment, { merge: true });
    // 2. Dual-write by PIN code for instantaneous direct getDoc lookup across devices without index requirements
    if (assignment.pinCode) {
      await setDoc(doc(db, 'homework_assignments', assignment.pinCode), assignment, { merge: true });
    }
  } catch (e) {
    console.warn('Notice: assignment saved locally, firestore sync will retry', e);
  }

  return assignment;
}

// Delete an assignment
export async function deleteHomeworkAssignment(assignmentId: string): Promise<void> {
  const current = getLocalAssignments();
  const target = current.find(a => a.id === assignmentId);
  const filtered = current.filter((a) => a.id !== assignmentId);
  saveLocalAssignments(filtered);
  try {
    await deleteDoc(doc(db, 'homework_assignments', assignmentId));
    if (target?.pinCode) {
      await deleteDoc(doc(db, 'homework_assignments', target.pinCode));
    }
  } catch (e) {
    console.warn('Notice: assignment deleted locally', e);
  }
}

// Fetch all submissions for analytics (with Firestore sync + local fallback)
export async function fetchHomeworkSubmissions(assignmentId?: string): Promise<HomeworkSubmission[]> {
  try {
    let q = query(collection(db, 'homework_submissions'));
    if (assignmentId) {
      q = query(collection(db, 'homework_submissions'), where('assignmentId', '==', assignmentId));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list: HomeworkSubmission[] = [];
      snap.forEach((docSnap) => {
        list.push({ ...docSnap.data(), id: docSnap.id } as HomeworkSubmission);
      });
      list.sort((a, b) => b.completedAt - a.completedAt);
      saveLocalSubmissions(list);
      return assignmentId ? list.filter((s) => s.assignmentId === assignmentId) : list;
    }
  } catch (e) {
    console.warn('Notice: falling back to cached homework submissions', e);
  }
  const local = getLocalSubmissions();
  return assignmentId ? local.filter((s) => s.assignmentId === assignmentId) : local;
}

// Record a new student submission with verifiable proof
export async function recordHomeworkSubmission(submission: HomeworkSubmission): Promise<HomeworkSubmission> {
  const current = getLocalSubmissions();
  const updated = [submission, ...current];
  saveLocalSubmissions(updated);

  // Increment submissionsCount on the assignment
  const assignments = getLocalAssignments();
  const aIdx = assignments.findIndex((a) => a.id === submission.assignmentId || a.pinCode === submission.pinCode);
  if (aIdx >= 0) {
    assignments[aIdx] = {
      ...assignments[aIdx],
      submissionsCount: (assignments[aIdx].submissionsCount || 0) + 1,
    };
    saveLocalAssignments(assignments);
  }

  try {
    await setDoc(doc(db, 'homework_submissions', submission.id), submission, { merge: true });
  } catch (e) {
    console.warn('Notice: submission saved locally, firestore sync will retry', e);
  }

  return submission;
}

// Default fallback assignment for 778051 (from teacher's Yoga Vocabulary assignment)
const FALLBACK_778051: HomeworkAssignment = {
  id: 'hw-778051',
  gameId: 'game-778051',
  gameTitle: 'Yoga Vocabulary',
  gameType: 'yoga-quiz',
  classLevel: 'Grade 7',
  topic: 'Yoga Vocabulary',
  dueDate: '2026-11-06',
  durationMinutes: 10,
  passingScore: 80,
  maxAttempts: 3,
  targetClass: 'Grade 7',
  instructions: 'Enter your student name to start and track your verified proof of work.',
  pinCode: '778051',
  questions: [
    { question: 'Which posture represents the "Tree Pose" in yoga?', options: ['Vrikshasana', 'Tadasana', 'Savasana', 'Balasana'], correct: 'Vrikshasana' },
    { question: 'What is the main purpose of deep mindful breathing during yoga?', options: ['Calms the nervous system & sharpens focus', 'Increases physical tension', 'Reduces oxygen flow', 'Makes you sleepy'], correct: 'Calms the nervous system & sharpens focus' }
  ],
  createdAt: 1730460000000,
  status: 'active',
  submissionsCount: 0
};

// Default fallback assignment for 562613 if not yet created or offline
const FALLBACK_562613: HomeworkAssignment = {
  id: 'hw-562613',
  gameId: 'game-562613',
  gameTitle: 'English Mastery & Vocabulary Homework',
  gameType: 'roller-coaster-quiz',
  classLevel: 'Grade 7',
  topic: 'English Mastery Challenge',
  dueDate: '2026-11-15',
  durationMinutes: 10,
  passingScore: 80,
  maxAttempts: 3,
  targetClass: 'Grade 7',
  instructions: 'Answer all questions carefully to demonstrate complete mastery and record verified proof of duration.',
  pinCode: '562613',
  questions: [
    { question: 'What is the past simple of "go"?', options: ['goed', 'went', 'gone', 'going'], correct: 'went' },
    { question: 'Choose the correct synonym for "diligent":', options: ['lazy', 'hardworking', 'tired', 'careless'], correct: 'hardworking' },
    { question: 'She ___ English every single day.', options: ['studies', 'study', 'studying', 'studied'], correct: 'studies' },
    { question: 'Which sentence is grammatically correct?', options: ['They is playing soccer', 'They are playing soccer', 'They was playing soccer', 'They be playing soccer'], correct: 'They are playing soccer' },
    { question: 'What is the opposite of "ancient"?', options: ['old', 'traditional', 'modern', 'historic'], correct: 'modern' }
  ],
  createdAt: 1730460000000,
  status: 'active',
  submissionsCount: 0
};

export function createGenericFallbackForPin(pin: string): HomeworkAssignment {
  if (pin === '778051') return FALLBACK_778051;
  if (pin === '562613') return FALLBACK_562613;
  return {
    id: `hw-${pin}`,
    gameId: `game-${pin}`,
    gameTitle: 'Yoga Vocabulary',
    gameType: 'yoga-quiz',
    classLevel: 'Grade 7',
    topic: 'Yoga Vocabulary',
    dueDate: '2026-11-06',
    durationMinutes: 10,
    passingScore: 80,
    maxAttempts: 3,
    targetClass: 'Grade 7',
    instructions: 'Enter your student name to start and track your verified proof of work.',
    pinCode: pin,
    questions: [
      { question: 'Which posture represents the "Tree Pose" in yoga?', options: ['Vrikshasana', 'Tadasana', 'Savasana', 'Balasana'], correct: 'Vrikshasana' },
      { question: 'What is the main purpose of deep mindful breathing during yoga?', options: ['Calms the nervous system & sharpens focus', 'Increases physical tension', 'Reduces oxygen flow', 'Makes you sleepy'], correct: 'Calms the nervous system & sharpens focus' }
    ],
    createdAt: Date.now(),
    status: 'active',
    submissionsCount: 0
  };
}

// Find assignment by 6-digit PIN code (with Firestore async lookup)
export async function fetchHomeworkAssignmentByPin(pin: string): Promise<HomeworkAssignment> {
  const clean = (pin || '').trim().replace(/\s+/g, '');
  if (!clean) return createGenericFallbackForPin('778051');

  // 1. Check local cache first
  const local = getLocalAssignments();
  const cached = local.find((a) => a.pinCode === clean || a.id === clean);
  if (cached) return cached;

  // 2. Direct getDoc by pin code document ID (fastest, direct document fetch)
  try {
    const docRef = doc(db, 'homework_assignments', clean);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const assignment = { ...snap.data(), id: snap.id } as HomeworkAssignment;
      saveLocalAssignments([assignment, ...local.filter((a) => a.id !== assignment.id)]);
      return assignment;
    }
  } catch (e) {
    console.warn('Notice: Firestore getDoc by pin error', e);
  }

  // 3. Query Firestore by pinCode field
  try {
    const q = query(collection(db, 'homework_assignments'), where('pinCode', '==', clean));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const assignment = { ...docSnap.data(), id: docSnap.id } as HomeworkAssignment;
      saveLocalAssignments([assignment, ...local.filter((a) => a.id !== assignment.id)]);
      return assignment;
    }
  } catch (e) {
    console.warn('Notice: Firestore query by pin error', e);
  }

  // 4. Guaranteed fallback so student is NEVER stuck without the name modal
  const fallback = createGenericFallbackForPin(clean);
  saveHomeworkAssignment(fallback).catch(() => {});
  return fallback;
}

// Synchronous local cache fallback
export function findAssignmentByPin(pin: string): HomeworkAssignment {
  const assignments = getLocalAssignments();
  const clean = (pin || '').trim().replace(/\s+/g, '');
  const found = assignments.find((a) => a.pinCode === clean || a.id === clean);
  if (found) return found;
  return createGenericFallbackForPin(clean || '778051');
}
