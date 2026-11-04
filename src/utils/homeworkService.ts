import { collection, doc, getDocs, setDoc, deleteDoc, query, where, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { STARTERS_MONSTER_ART_DECK, STARTERS_MONSTER_ART_DECK_ID } from '../components/StartersMonsterArtStudio';

export const PRODUCTION_BASE_URL = 'https://hamsterenglish.online';

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
  userId?: string;
  createdByUid?: string;
  createdByEmail?: string;
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
  slideDeckId?: string;
  slides?: any[];
  createdAt: number;
  status: 'active' | 'closed';
  submissionsCount?: number;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  pinCode: string;
  teacherUid?: string;
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

const STORAGE_KEY_ASSIGNMENTS_PREFIX = 'hamster_hw_assignments_u_';
const STORAGE_KEY_SUBMISSIONS_PREFIX = 'hamster_hw_submissions_u_';
const STORAGE_KEY_DELETED_HW = 'hamster_deleted_homework_ids_v1';

function getAssignmentsStorageKey(userId?: string): string | null {
  if (!userId) return null;
  return `${STORAGE_KEY_ASSIGNMENTS_PREFIX}${userId}`;
}

function getSubmissionsStorageKey(userId?: string): string | null {
  if (!userId) return null;
  return `${STORAGE_KEY_SUBMISSIONS_PREFIX}${userId}`;
}

function purgeLegacyPublicHomeworkKeys(): void {
  try {
    localStorage.removeItem('hamster_homework_assignments_v1');
    localStorage.removeItem('hamster_homework_assignments_clean_v1');
    localStorage.removeItem('hamster_homework_assignments_clean_v2');
    localStorage.removeItem('hamster_homework_submissions_v1');
    localStorage.removeItem('hamster_homework_submissions_clean_v1');
    localStorage.removeItem('hamster_homework_submissions_clean_v2');
  } catch (e) {}
}

// Track deleted assignment IDs and PINs so deleted homework never reappears from cloud sync
export function getDeletedHomeworkKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_HW);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch (e) {}
  return [];
}

export function addDeletedHomeworkKeys(keys: string[]): void {
  try {
    const current = new Set(getDeletedHomeworkKeys());
    keys.forEach((k) => {
      if (k) current.add(String(k));
    });
    localStorage.setItem(STORAGE_KEY_DELETED_HW, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

// Detect old hardcoded fake Yoga fallback assignments ("Tree Pose" / "Vrikshasana") so they are purged
export function isFakeYogaPresetAssignment(a: any): boolean {
  if (!a) return false;
  const q0 = a.questions?.[0];
  const firstText = String(q0?.question || q0?.text || '').toLowerCase();
  if (firstText.includes('tree pose') || firstText.includes('vrikshasana')) {
    return true;
  }
  return false;
}

// Default 5 Question Tags questions (used to repair PIN 436439 or fallback if a Question Tags game had unparsed questions)
export const QUESTION_TAGS_DEFAULT_QUESTIONS = [
  {
    id: 'qt-1',
    text: "You can swim well, ____?",
    question: "You can swim well, ____?",
    options: ["can't you?", "can you?", "don't you?", "aren't you?"],
    answerIndex: 0,
    correctAnswer: "can't you?",
  },
  {
    id: 'qt-2',
    text: "He is happy today, ____?",
    question: "He is happy today, ____?",
    options: ["isn't he?", "is he?", "aren't they?", "doesn't he?"],
    answerIndex: 0,
    correctAnswer: "isn't he?",
  },
  {
    id: 'qt-3',
    text: "They are playing football, ____?",
    question: "They are playing football, ____?",
    options: ["aren't they?", "are they?", "isn't he?", "don't they?"],
    answerIndex: 0,
    correctAnswer: "aren't they?",
  },
  {
    id: 'qt-4',
    text: "Tom likes chocolate, ____?",
    question: "Tom likes chocolate, ____?",
    options: ["doesn't he?", "does he?", "isn't he?", "don't he?"],
    answerIndex: 0,
    correctAnswer: "doesn't he?",
  },
  {
    id: 'qt-5',
    text: "We have finished our homework, ____?",
    question: "We have finished our homework, ____?",
    options: ["haven't we?", "have we?", "don't we?", "aren't we?"],
    answerIndex: 0,
    correctAnswer: "haven't we?",
  },
];

// Recursively strip undefined fields so Firestore setDoc never throws an unsupported undefined value error
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    Object.entries(obj as Record<string, any>).forEach(([key, val]) => {
      if (val !== undefined) {
        cleaned[key] = sanitizeForFirestore(val);
      }
    });
    return cleaned as T;
  }
  return obj;
}

function isPlaceholderOptionText(s: string): boolean {
  const clean = (s || '').trim();
  if (!clean) return true;
  if (/^(sample\s+)?option\s*[a-f1-6]$/i.test(clean)) return true;
  return false;
}

// Normalize questions from any game type (Mystery Box, Yoga Quiz, Bubble Pop, Sumo, Family Feud, Flashcards, etc.)
export function normalizeGameQuestionsForHomework(rawQuestions: any[], gameTitle = ''): any[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return [];

  // Collect all single-answer strings in case we need distractors for fill-in-the-blank questions
  const allSingleAnswers = rawQuestions
    .map((q) => q?.answer || q?.correctAnswer || q?.back || '')
    .filter((s) => typeof s === 'string' && !isPlaceholderOptionText(s));

  return rawQuestions
    .map((q: any, idx: number) => {
      if (!q) return null;

      const questionText =
        q.text ||
        q.question ||
        q.prompt ||
        q.questionText ||
        q.front ||
        q.sentence ||
        `Question ${idx + 1}`;

      // 1. Extract real (non-placeholder) options from standard MCQ or Family Feud answers
      let options: string[] = [];
      if (Array.isArray(q.options) && q.options.length > 0) {
        options = q.options
          .map((o: any) => (typeof o === 'string' ? o : o?.text || String(o || '')))
          .filter((s: string) => !isPlaceholderOptionText(s));
      } else if (Array.isArray(q.answers) && q.answers.length > 0) {
        options = q.answers
          .map((a: any) => (typeof a === 'string' ? a : a?.text || String(a || '')))
          .filter((s: string) => !isPlaceholderOptionText(s));
      }

      // 2. Determine correct answer index or string
      let answerIndex = 0;
      let correctAnswer = '';
      let isOpenEnded = Boolean(q.isOpenEnded);

      if (options.length >= 2) {
        if (typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex < options.length) {
          answerIndex = q.answerIndex;
        } else if (
          typeof q.correctOptionIndex === 'number' &&
          q.correctOptionIndex >= 0 &&
          q.correctOptionIndex < options.length
        ) {
          answerIndex = q.correctOptionIndex;
        } else if (
          typeof q.correctIndex === 'number' &&
          q.correctIndex >= 0 &&
          q.correctIndex < options.length
        ) {
          answerIndex = q.correctIndex;
        } else if (typeof q.correct === 'number' && q.correct >= 0 && q.correct < options.length) {
          answerIndex = q.correct;
        } else if (typeof q.correct === 'string' && q.correct.trim()) {
          const foundIdx = options.findIndex(
            (o) => o.trim().toLowerCase() === q.correct.trim().toLowerCase()
          );
          if (foundIdx >= 0) answerIndex = foundIdx;
        } else if (typeof q.correctAnswer === 'string' && q.correctAnswer.trim()) {
          const foundIdx = options.findIndex(
            (o) => o.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
          );
          if (foundIdx >= 0) answerIndex = foundIdx;
        } else if (typeof q.answer === 'string' && q.answer.trim()) {
          const foundIdx = options.findIndex(
            (o) => o.trim().toLowerCase() === q.answer.trim().toLowerCase()
          );
          if (foundIdx >= 0) answerIndex = foundIdx;
        } else if (Array.isArray(q.options) && typeof q.options[0] === 'object') {
          const foundIdx = q.options.findIndex((o: any) => o?.isCorrect === true);
          if (foundIdx >= 0) answerIndex = foundIdx;
        }
        correctAnswer = options[answerIndex] || options[0];
      } else {
        // Fill-in-the-blank or open-ended question (e.g. Mystery Box FIB or Speaking Prompt)
        const rawCandidate = String(
          q.answer || q.correctAnswer || q.correct || q.back || options[0] || ''
        ).trim();
        const targetAns = isPlaceholderOptionText(rawCandidate) ? '' : rawCandidate;

        if (targetAns) {
          const otherAnswers = allSingleAnswers.filter(
            (a) => a.toLowerCase() !== targetAns.toLowerCase()
          );
          const isTag =
            targetAns.endsWith('?') ||
            gameTitle.toLowerCase().includes('tag') ||
            questionText.includes('____?');
          const fallbackDistractors = isTag
            ? ["isn't it?", "don't they?", "can't she?", "wasn't he?"]
            : ['None of these', 'Not applicable', 'Another answer'];
          const distractors = Array.from(new Set([...otherAnswers, ...fallbackDistractors]))
            .filter((d) => d.toLowerCase() !== targetAns.toLowerCase())
            .slice(0, 3);
          const rawOpts = [targetAns, ...distractors];
          const rot = idx % rawOpts.length;
          options = [...rawOpts.slice(rot), ...rawOpts.slice(0, rot)];
          answerIndex = options.indexOf(targetAns);
          if (answerIndex < 0) answerIndex = 0;
          correctAnswer = targetAns;
        } else {
          // Open-ended / speaking question with no fixed option list (e.g. "Do you have a pet?", "What makes you happy?")
          options = [];
          answerIndex = 0;
          correctAnswer = 'Answered';
          isOpenEnded = true;
        }
      }

      return {
        id: q.id || `q-${idx + 1}`,
        text: questionText,
        question: questionText,
        options,
        answerIndex,
        correctAnswer,
        ...(isOpenEnded ? { isOpenEnded: true } : {}),
        ...(q.explanation ? { explanation: q.explanation } : {}),
        ...(q.image || q.imageUrl ? { image: q.image || q.imageUrl } : {}),
      };
    })
    .filter(Boolean);
}

// Convert any SlideDeck into a Homework-ready object with extracted/generated questions + slides
export function convertSlideDeckToHomeworkObject(deck: any): any {
  if (!deck) return null;

  const isStartersMonsterDeck =
    deck.id === STARTERS_MONSTER_ART_DECK_ID ||
    String(deck.title || '').toLowerCase().includes('monster art');

  const extractedQuestions: any[] = [];
  const rawSlides = Array.isArray(deck.slides) ? deck.slides : [];

  // 1. Extract explicit question slides
  rawSlides.forEach((s: any, idx: number) => {
    if (s.type === 'question' && s.questionText) {
      const opts =
        Array.isArray(s.options) && s.options.length >= 2
          ? s.options
          : ['Option A', 'Option B', 'Option C', 'Option D'];
      const ansIdx =
        typeof s.correctOptionIndex === 'number'
          ? s.correctOptionIndex
          : typeof s.answerIndex === 'number'
          ? s.answerIndex
          : 0;
      extractedQuestions.push({
        id: s.id || `slide-q-${idx + 1}`,
        text: s.questionText,
        question: s.questionText,
        options: opts,
        answerIndex: ansIdx,
        correctAnswer: opts[ansIdx] || opts[0],
        explanation: s.explanation || '',
      });
    }
  });

  // 2. Extract vocabulary slides into interactive review questions
  const vocabSlides = rawSlides.filter((s: any) => s.type === 'vocab' && s.word);
  vocabSlides.forEach((s: any, idx: number) => {
    const correctDef =
      s.definition || s.exampleSentence || `Target vocabulary word: ${s.word}`;
    const otherDefs = vocabSlides
      .filter((other: any) => other.word !== s.word && (other.definition || other.exampleSentence))
      .map((other: any) => other.definition || other.exampleSentence);

    const fallbackDistractors = [
      'A place where people wait for the bus or train.',
      'To move very quickly on foot in a race.',
      'Something you use to write notes in class.',
    ];
    const distractors = [...otherDefs, ...fallbackDistractors].slice(0, 3);
    const options = [correctDef, ...distractors];
    const rot = idx % options.length;
    const rotatedOptions = [...options.slice(rot), ...options.slice(0, rot)];
    const answerIndex = rotatedOptions.indexOf(correctDef);

    extractedQuestions.push({
      id: s.id || `slide-vocab-${idx + 1}`,
      text: s.exampleSentence
        ? `Vocabulary Check — "${s.word}": What does "${s.word}" mean? (Example: "${s.exampleSentence}")`
        : `Vocabulary Check: What is the meaning of "${s.word}"?`,
      question: `What is the meaning of "${s.word}"?`,
      options: rotatedOptions,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
      correctAnswer: correctDef,
    });
  });

  // 3. If this is the Cambridge Starters Monster Art Class Studio deck, include the official Part 1A/1B/2/3 questions
  if (isStartersMonsterDeck) {
    const startersQuestions = [
      {
        id: 'starters-hw-1',
        text: 'Part 1A (Q5): Look at the Monster Art Classroom. Where is the clock?',
        question: 'Where is the clock?',
        options: [
          'The clock is on the wall.',
          'The clock is under the brown table.',
          'The clock is in the toy box.',
          'The clock is on the red chair.',
        ],
        answerIndex: 0,
        correctAnswer: 'The clock is on the wall.',
      },
      {
        id: 'starters-hw-2',
        text: 'Part 1A (Q6): Where is the board?',
        question: 'Where is the board?',
        options: [
          'The board is under the chair.',
          'The board is between the pictures.',
          'The board is in the toy box.',
          'The board is behind the door.',
        ],
        answerIndex: 1,
        correctAnswer: 'The board is between the pictures.',
      },
      {
        id: 'starters-hw-3',
        text: 'Part 1A (Q7): Where are the toys?',
        question: 'Where are the toys?',
        options: [
          'The toys are on the wall.',
          'The toys are under the table.',
          'The toys are in the toy box.',
          'The toys are on the green monster.',
        ],
        answerIndex: 2,
        correctAnswer: 'The toys are in the toy box.',
      },
      {
        id: 'starters-hw-4',
        text: 'Part 1A (Q8): Where is the brown hat?',
        question: 'Where is the brown hat?',
        options: [
          "The brown hat is on the green monster's head.",
          'The brown hat is under the red chair.',
          'The brown hat is in the fish drawing.',
          'The brown hat is on the brown table.',
        ],
        answerIndex: 0,
        correctAnswer: "The brown hat is on the green monster's head.",
      },
      {
        id: 'starters-hw-5',
        text: 'Part 1B (Place Cards): "Which is the book? ... Put the book under the table." Where do you put the brown book card?',
        question: 'Where do you put the brown book card?',
        options: [
          'Under the brown table (next to the grey cat).',
          'On the wall above the whiteboard.',
          'Inside the open window.',
          'On top of the door.',
        ],
        answerIndex: 0,
        correctAnswer: 'Under the brown table (next to the grey cat).',
      },
      {
        id: 'starters-hw-6',
        text: 'Part 2 (Scene Q&A): Look at the object on the brown table. What is this?',
        question: 'Look at the object on the brown table. What is this?',
        options: [
          'It is a computer / laptop.',
          'It is a red lorry.',
          'It is a green frog.',
          'It is a football.',
        ],
        answerIndex: 0,
        correctAnswer: 'It is a computer / laptop.',
      },
      {
        id: 'starters-hw-7',
        text: 'Part 2 (Scene Q&A): Look at the two blue monsters in front of the easel. What are they doing?',
        question: 'What are the blue monsters doing?',
        options: [
          'They are painting a picture.',
          'They are sleeping under the table.',
          'They are riding a train.',
          'They are eating lunch.',
        ],
        answerIndex: 0,
        correctAnswer: 'They are painting a picture.',
      },
      {
        id: 'starters-hw-8',
        text: 'Part 3 (Object Cards): Which of these is one of the 8 Test 1 Object Cards?',
        question: 'Which of these is one of the 8 Test 1 Object Cards?',
        options: [
          'A green frog, a brown book, a red lorry, and an orange fish',
          'A helicopter, a giraffe, a watermelon, and a guitar',
          'A snowman, a skateboard, a kangaroo, and a lamp',
          'A pineapple, a motorbike, a whale, and a drum',
        ],
        answerIndex: 0,
        correctAnswer: 'A green frog, a brown book, a red lorry, and an orange fish',
      },
    ];

    return {
      id: deck.id || STARTERS_MONSTER_ART_DECK_ID,
      name: deck.title || 'Cambridge Pre-A1 Starters Speaking — Monster Art Class',
      title: deck.title || 'Cambridge Pre-A1 Starters Speaking — Monster Art Class',
      topic: deck.title || 'Cambridge Pre-A1 Starters Speaking — Monster Art Class',
      gameType: 'study-mode',
      classLevel: deck.cambridgeLevel || deck.gradeLevel || 'Starters',
      isSlideDeck: true,
      slideDeckId: deck.id || STARTERS_MONSTER_ART_DECK_ID,
      slides: rawSlides,
      questions: startersQuestions,
      customQuestions: startersQuestions,
    };
  }

  // 4. Fallback if a custom deck only has grammar/discussion/title slides
  if (extractedQuestions.length === 0) {
    rawSlides.forEach((s: any, idx: number) => {
      if (s.type === 'grammar' && (s.grammarRule || s.formula)) {
        const correctAns = s.formula || s.grammarRule;
        extractedQuestions.push({
          id: `slide-gram-${idx + 1}`,
          text: `Grammar Check (${s.title || 'Rule'}): Which formula or rule matches this lesson slide?`,
          question: `Which formula or rule matches ${s.title || 'this grammar slide'}?`,
          options: [
            correctAns,
            'Subject + was/were + Verb-ing (Past Continuous)',
            'Will + Subject + Verb (Future Question)',
            'There is / There are + Noun',
          ],
          answerIndex: 0,
          correctAnswer: correctAns,
        });
      } else if (s.type === 'discussion' && s.discussionPrompt) {
        extractedQuestions.push({
          id: `slide-disc-${idx + 1}`,
          text: `Speaking & Discussion Check: "${s.discussionPrompt}" — Did you practice speaking this prompt aloud?`,
          question: `Speaking Check: "${s.discussionPrompt}"`,
          options: [
            'Yes, I practiced speaking the full answer aloud!',
            'I need more practice',
            'Not yet',
            'Skip',
          ],
          answerIndex: 0,
          correctAnswer: 'Yes, I practiced speaking the full answer aloud!',
        });
      }
    });
  }

  return {
    id: deck.id || `deck-${Date.now()}`,
    name: deck.title || 'Classroom Slide Deck',
    title: deck.title || 'Classroom Slide Deck',
    topic: deck.title || 'Classroom Slide Deck',
    gameType: 'study-mode',
    classLevel: deck.curriculum || deck.cambridgeLevel || deck.schoolGrade || deck.gradeLevel || 'General',
    isSlideDeck: true,
    slideDeckId: deck.id,
    slides: rawSlides,
    questions: extractedQuestions,
    customQuestions: extractedQuestions,
  };
}

// Retrieve all saved Slide Decks so teachers can assign them from Homework view too
export function getSavedSlideDecksForHomework(): any[] {
  let deletedIds: string[] = [];
  try {
    const rawDel = localStorage.getItem('hamster_deleted_slide_ids');
    if (rawDel) {
      const parsed = JSON.parse(rawDel);
      if (Array.isArray(parsed)) deletedIds = parsed;
    }
  } catch (e) {}

  try {
    const raw = localStorage.getItem('hamster_my_slides');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((d: any) => d && d.id && !deletedIds.includes(d.id));
        const hasStarters = valid.some((d: any) => d.id === STARTERS_MONSTER_ART_DECK_ID);
        if (!hasStarters && !deletedIds.includes(STARTERS_MONSTER_ART_DECK_ID)) {
          return [STARTERS_MONSTER_ART_DECK, ...valid];
        }
        return valid;
      }
    }
  } catch (e) {}

  return deletedIds.includes(STARTERS_MONSTER_ART_DECK_ID) ? [] : [STARTERS_MONSTER_ART_DECK];
}

// Retrieve all user games from both hamster_cached_user_games (Firestore cache) and hamster_esl_saved_games_v1
export function getAllUserGamesForHomework(): any[] {
  const map = new Map<string, any>();
  try {
    const cachedUserGames = localStorage.getItem('hamster_cached_user_games');
    if (cachedUserGames) {
      const parsed = JSON.parse(cachedUserGames);
      if (Array.isArray(parsed)) {
        parsed.forEach((g) => {
          if (g && g.id) map.set(String(g.id), g);
        });
      }
    }
  } catch (e) {}

  try {
    const saved = localStorage.getItem('hamster_esl_saved_games_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((g) => {
          if (g && g.id && !map.has(String(g.id))) map.set(String(g.id), g);
        });
      }
    }
  } catch (e) {}

  return Array.from(map.values());
}

// Ensure an assignment always has valid normalized questions (and never fake Yoga questions)
export function ensureAssignmentHasQuestions(assignment: HomeworkAssignment): HomeworkAssignment {
  if (!assignment) return assignment;

  // If this assignment was poisoned by the old Yoga fallback or is PIN 436439 ("Question Tags"), repair it!
  if (isFakeYogaPresetAssignment(assignment) || assignment.pinCode === '436439') {
    const userGames = getAllUserGamesForHomework();
    const questionTagsGame = userGames.find((g) =>
      String(g.topic || g.name || g.title || '')
        .toLowerCase()
        .includes('question tag')
    );
    const repairedQuestions =
      questionTagsGame &&
      Array.isArray(questionTagsGame.customQuestions || questionTagsGame.questions) &&
      (questionTagsGame.customQuestions || questionTagsGame.questions).length > 0
        ? normalizeGameQuestionsForHomework(
            questionTagsGame.customQuestions || questionTagsGame.questions,
            'Question Tags'
          )
        : QUESTION_TAGS_DEFAULT_QUESTIONS;

    return {
      ...assignment,
      gameTitle:
        assignment.gameTitle && assignment.gameTitle !== 'Yoga Vocabulary'
          ? assignment.gameTitle
          : 'Question Tags',
      topic:
        assignment.topic && assignment.topic !== 'Yoga Vocabulary'
          ? assignment.topic
          : 'Question Tags',
      gameType:
        assignment.gameType === 'yoga-quiz' || assignment.gameType === 'interactive-slides'
          ? 'study-mode'
          : assignment.gameType || 'study-mode',
      classLevel: assignment.classLevel || 'Starters',
      targetClass: assignment.targetClass || 'Starters',
      questions: repairedQuestions,
    };
  }

  if (Array.isArray(assignment.questions) && assignment.questions.length > 0) {
    return {
      ...assignment,
      questions: normalizeGameQuestionsForHomework(assignment.questions, assignment.gameTitle),
    };
  }

  // Try matching by gameId or gameTitle in user's games
  const userGames = getAllUserGamesForHomework();
  const matchedGame = userGames.find(
    (g) =>
      String(g.id) === String(assignment.gameId) ||
      String(g.topic || g.name || g.title || '').toLowerCase() ===
        String(assignment.gameTitle || '').toLowerCase()
  );
  if (matchedGame) {
    const rawQ = matchedGame.customQuestions || matchedGame.questions || [];
    if (Array.isArray(rawQ) && rawQ.length > 0) {
      return {
        ...assignment,
        questions: normalizeGameQuestionsForHomework(rawQ, assignment.gameTitle),
      };
    }
  }

  if (
    assignment.slideDeckId === STARTERS_MONSTER_ART_DECK_ID ||
    String(assignment.gameTitle || '').toLowerCase().includes('monster art')
  ) {
    const converted = convertSlideDeckToHomeworkObject(STARTERS_MONSTER_ART_DECK);
    return {
      ...assignment,
      slideDeckId: STARTERS_MONSTER_ART_DECK_ID,
      slides: assignment.slides || STARTERS_MONSTER_ART_DECK.slides,
      questions: converted.questions,
    };
  }

  if (Array.isArray(assignment.slides) && assignment.slides.length > 0) {
    const converted = convertSlideDeckToHomeworkObject({
      id: assignment.slideDeckId || assignment.gameId,
      title: assignment.gameTitle,
      slides: assignment.slides,
    });
    return {
      ...assignment,
      questions: converted.questions,
    };
  }

  if (String(assignment.gameTitle || '').toLowerCase().includes('tag')) {
    return {
      ...assignment,
      questions: QUESTION_TAGS_DEFAULT_QUESTIONS,
    };
  }

  return {
    ...assignment,
    questions: QUESTION_TAGS_DEFAULT_QUESTIONS,
  };
}

// Deduplicate assignments by pinCode, filter out deleted ones and fake Yoga presets
function deduplicateAssignments(list: HomeworkAssignment[]): HomeworkAssignment[] {
  const deletedKeys = new Set(getDeletedHomeworkKeys());
  const byPin = new Map<string, HomeworkAssignment>();

  for (const item of list) {
    if (!item || String(item.id).startsWith('hw-sample')) continue;
    if (deletedKeys.has(String(item.id)) || (item.pinCode && deletedKeys.has(String(item.pinCode)))) {
      continue;
    }
    // Purge any fake Yoga Vocabulary fallback (unless it's PIN 436439 which we repair to Question Tags)
    if (isFakeYogaPresetAssignment(item) && item.pinCode !== '436439') {
      continue;
    }

    const normalized = ensureAssignmentHasQuestions(item);
    const key = normalized.pinCode || String(normalized.id);
    const existing = byPin.get(key);
    if (!existing) {
      byPin.set(key, normalized);
    } else {
      const existingIsCanonical = String(existing.id).startsWith('hw-');
      const currentIsCanonical = String(normalized.id).startsWith('hw-');
      if (currentIsCanonical && !existingIsCanonical) {
        byPin.set(key, {
          ...normalized,
          submissionsCount: Math.max(
            normalized.submissionsCount || 0,
            existing.submissionsCount || 0
          ),
        });
      } else if ((normalized.createdAt || 0) > (existing.createdAt || 0)) {
        byPin.set(key, {
          ...normalized,
          id: existingIsCanonical ? existing.id : normalized.id,
        });
      }
    }
  }
  return Array.from(byPin.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// Local cache helpers strictly scoped to the signed-in user (never shared publicly across users)
export function getLocalAssignments(userId?: string): HomeworkAssignment[] {
  purgeLegacyPublicHomeworkKeys();
  const key = getAssignmentsStorageKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return deduplicateAssignments(
          parsed.filter(
            (a: any) =>
              a &&
              (!a.userId || a.userId === userId) &&
              (!a.createdByUid || a.createdByUid === userId)
          )
        );
      }
    }
  } catch (e) {}
  return [];
}

export function saveLocalAssignments(assignments: HomeworkAssignment[], userId?: string): void {
  purgeLegacyPublicHomeworkKeys();
  const key = getAssignmentsStorageKey(userId);
  if (!key) return;
  try {
    const clean = deduplicateAssignments(assignments);
    localStorage.setItem(key, JSON.stringify(clean));
  } catch (e) {}
}

export function getLocalSubmissions(userId?: string): HomeworkSubmission[] {
  purgeLegacyPublicHomeworkKeys();
  const key = getSubmissionsStorageKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s: any) =>
            s &&
            !String(s.id).startsWith('sub-sample') &&
            (!s.teacherUid || s.teacherUid === userId) &&
            !(
              s.assignmentTitle === 'Yoga Vocabulary' &&
              s.questionBreakdown?.[0]?.questionText?.includes('Tree Pose')
            )
        );
      }
    }
  } catch (e) {}
  return [];
}

export function saveLocalSubmissions(submissions: HomeworkSubmission[], userId?: string): void {
  purgeLegacyPublicHomeworkKeys();
  const key = getSubmissionsStorageKey(userId);
  if (!key) return;
  try {
    const clean = submissions.filter((s: any) => s && !String(s.id).startsWith('sub-sample'));
    localStorage.setItem(key, JSON.stringify(clean));
  } catch (e) {}
}

// Delete a submission record
export async function deleteHomeworkSubmission(
  submissionId: string,
  userId?: string
): Promise<void> {
  if (userId) {
    const current = getLocalSubmissions(userId).filter((s) => s.id !== submissionId);
    saveLocalSubmissions(current, userId);
  }
  try {
    await deleteDoc(doc(db, 'homework_submissions', submissionId));
  } catch (e) {
    console.warn('Notice: submission deleted locally', e);
  }
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

// Fetch assignments owned ONLY by the given userId (never returns a public homework list)
export async function fetchAllHomeworkAssignments(
  userId?: string
): Promise<HomeworkAssignment[]> {
  purgeLegacyPublicHomeworkKeys();
  if (!userId) return [];

  const deletedKeys = new Set(getDeletedHomeworkKeys());
  const local = getLocalAssignments(userId);

  try {
    const q = query(collection(db, 'homework_assignments'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const cloudPins = new Set<string>();
    const rawList: HomeworkAssignment[] = [...local];

    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const data = docSnap.data() as HomeworkAssignment;
        if (!data) return;
        const ownerUid = data.userId || data.createdByUid;
        if (ownerUid && ownerUid !== userId) return;

        const canonicalId = data.id && String(data.id).startsWith('hw-') ? data.id : docSnap.id;
        if (
          deletedKeys.has(String(canonicalId)) ||
          deletedKeys.has(String(docSnap.id)) ||
          (data.pinCode && deletedKeys.has(String(data.pinCode)))
        ) {
          return;
        }
        if (isFakeYogaPresetAssignment(data)) {
          deleteDoc(doc(db, 'homework_assignments', docSnap.id)).catch(() => {});
          return;
        }
        if (data.pinCode) cloudPins.add(String(data.pinCode));
        rawList.push({
          ...data,
          id: canonicalId,
          userId: data.userId || userId,
          createdByUid: data.createdByUid || userId,
        });
      });
    }

    // Push any local assignments owned by this user that aren't in Firestore yet so hamsterenglish.online/?hwPin=... works immediately
    for (const loc of local) {
      if (loc.pinCode && !cloudPins.has(String(loc.pinCode)) && !deletedKeys.has(String(loc.pinCode))) {
        const cleanLoc = sanitizeForFirestore(
          ensureAssignmentHasQuestions({
            ...loc,
            userId: loc.userId || userId,
            createdByUid: loc.createdByUid || userId,
          })
        );
        setDoc(doc(db, 'homework_assignments', cleanLoc.id), cleanLoc, { merge: true }).catch(() => {});
        setDoc(doc(db, 'homework_assignments', cleanLoc.pinCode), cleanLoc, { merge: true }).catch(() => {});
        setDoc(doc(db, 'homework_assignments', `hw_${cleanLoc.pinCode}`), cleanLoc, { merge: true }).catch(() => {});
      }
    }

    const deduped = deduplicateAssignments(rawList);
    saveLocalAssignments(deduped, userId);
    return deduped;
  } catch (e) {
    console.warn('Notice: falling back to user-scoped cached homework assignments', e);
  }
  return local;
}

// Save a new or edited homework assignment (strictly tied to the owning user)
export async function saveHomeworkAssignment(
  assignment: HomeworkAssignment,
  userId?: string
): Promise<HomeworkAssignment> {
  const effectiveUserId = userId || assignment.userId || assignment.createdByUid;
  const readyAssignment = sanitizeForFirestore(
    ensureAssignmentHasQuestions({
      ...assignment,
      ...(effectiveUserId ? { userId: effectiveUserId, createdByUid: effectiveUserId } : {}),
    })
  );

  if (effectiveUserId) {
    const current = getLocalAssignments(effectiveUserId);
    const existingIdx = current.findIndex(
      (a) => a.id === readyAssignment.id || a.pinCode === readyAssignment.pinCode
    );
    let updatedList: HomeworkAssignment[];
    if (existingIdx >= 0) {
      updatedList = [...current];
      updatedList[existingIdx] = readyAssignment;
    } else {
      updatedList = [readyAssignment, ...current];
    }
    saveLocalAssignments(updatedList, effectiveUserId);
  }

  try {
    // 1. Save with unique assignment ID
    await setDoc(doc(db, 'homework_assignments', readyAssignment.id), readyAssignment, {
      merge: true,
    });
    // 2. Write by PIN code and hw_<PIN> for instantaneous direct getDoc lookup across devices
    if (readyAssignment.pinCode) {
      await setDoc(doc(db, 'homework_assignments', readyAssignment.pinCode), readyAssignment, {
        merge: true,
      });
      await setDoc(
        doc(db, 'homework_assignments', `hw_${readyAssignment.pinCode}`),
        readyAssignment,
        { merge: true }
      );
    }
  } catch (e) {
    console.warn('Notice: assignment saved locally, firestore sync will retry', e);
  }

  return readyAssignment;
}

// Delete an assignment permanently from local cache and Firestore
export async function deleteHomeworkAssignment(
  assignmentId: string,
  pinCode?: string,
  userId?: string
): Promise<void> {
  const current = userId ? getLocalAssignments(userId) : [];
  const target = current.find(
    (a) => a.id === assignmentId || a.pinCode === assignmentId || (pinCode && a.pinCode === pinCode)
  );
  const targetId = target?.id || assignmentId;
  const targetPin = pinCode || target?.pinCode || '';

  // Record in deleted keys so cloud sync never restores it
  addDeletedHomeworkKeys(
    [assignmentId, targetId, targetPin, targetPin ? `hw_${targetPin}` : ''].filter(Boolean)
  );

  if (userId) {
    const filtered = current.filter(
      (a) =>
        a.id !== assignmentId &&
        a.id !== targetId &&
        a.pinCode !== assignmentId &&
        (!targetPin || a.pinCode !== targetPin)
    );
    saveLocalAssignments(filtered, userId);
  }

  try {
    const deletePromises: Promise<void>[] = [
      deleteDoc(doc(db, 'homework_assignments', assignmentId)),
    ];
    if (targetId && targetId !== assignmentId) {
      deletePromises.push(deleteDoc(doc(db, 'homework_assignments', targetId)));
    }
    if (targetPin) {
      deletePromises.push(deleteDoc(doc(db, 'homework_assignments', targetPin)));
      deletePromises.push(deleteDoc(doc(db, 'homework_assignments', `hw_${targetPin}`)));
      deletePromises.push(deleteDoc(doc(db, 'homework_assignments', `hw-${targetPin}`)));
    }
    await Promise.allSettled(deletePromises);
  } catch (e) {
    console.warn('Notice: assignment deleted locally', e);
  }
}

// Fetch submissions for the signed-in teacher's homework only
export async function fetchHomeworkSubmissions(
  userId?: string,
  assignmentId?: string,
  userPins?: string[]
): Promise<HomeworkSubmission[]> {
  purgeLegacyPublicHomeworkKeys();
  if (!userId) return [];

  try {
    const byId = new Map<string, HomeworkSubmission>();

    const collectSnap = (snap: any) => {
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as HomeworkSubmission;
        if (!data) return;
        if (
          data.assignmentTitle === 'Yoga Vocabulary' &&
          data.questionBreakdown?.[0]?.questionText?.includes('Tree Pose')
        ) {
          deleteDoc(doc(db, 'homework_submissions', docSnap.id)).catch(() => {});
          return;
        }
        byId.set(docSnap.id, { ...data, id: docSnap.id });
      });
    };

    const qTeacher = query(
      collection(db, 'homework_submissions'),
      where('teacherUid', '==', userId)
    );
    const snapTeacher = await getDocs(qTeacher);
    collectSnap(snapTeacher);

    const validPins = (userPins || []).filter(Boolean).slice(0, 30);
    if (validPins.length > 0) {
      const qPins = query(
        collection(db, 'homework_submissions'),
        where('pinCode', 'in', validPins)
      );
      const snapPins = await getDocs(qPins);
      collectSnap(snapPins);
    }

    if (byId.size > 0) {
      const list = Array.from(byId.values()).sort((a, b) => b.completedAt - a.completedAt);
      saveLocalSubmissions(list, userId);
      return assignmentId ? list.filter((s) => s.assignmentId === assignmentId) : list;
    }
  } catch (e) {
    console.warn('Notice: falling back to user-scoped cached homework submissions', e);
  }
  const local = getLocalSubmissions(userId);
  return assignmentId ? local.filter((s) => s.assignmentId === assignmentId) : local;
}

// Record a new student submission with verifiable proof (sent privately to the homework's teacher)
export async function recordHomeworkSubmission(
  submission: HomeworkSubmission,
  userId?: string
): Promise<HomeworkSubmission> {
  const cleanSubmission = sanitizeForFirestore(submission);
  const ownerUid = cleanSubmission.teacherUid || userId;
  if (ownerUid) {
    const current = getLocalSubmissions(ownerUid);
    const updated = [cleanSubmission, ...current];
    saveLocalSubmissions(updated, ownerUid);

    const assignments = getLocalAssignments(ownerUid);
    const aIdx = assignments.findIndex(
      (a) => a.id === cleanSubmission.assignmentId || a.pinCode === cleanSubmission.pinCode
    );
    if (aIdx >= 0) {
      assignments[aIdx] = {
        ...assignments[aIdx],
        submissionsCount: (assignments[aIdx].submissionsCount || 0) + 1,
      };
      saveLocalAssignments(assignments, ownerUid);
    }
  }

  try {
    await setDoc(doc(db, 'homework_submissions', cleanSubmission.id), cleanSubmission, {
      merge: true,
    });
  } catch (e) {
    console.warn('Notice: submission saved locally, firestore sync will retry', e);
  }

  return cleanSubmission;
}

// Fetch and rank leaderboard entries for a specific homework PIN code
export async function fetchHomeworkLeaderboard(
  pinCode: string,
  currentSubmission?: HomeworkSubmission | null
): Promise<HomeworkSubmission[]> {
  const cleanPin = (pinCode || '').trim().replace(/\s+/g, '').replace(/^hw[_-]/i, '');
  const byStudent = new Map<string, HomeworkSubmission>();

  const considerEntry = (entry: HomeworkSubmission) => {
    if (!entry || !entry.studentName) return;
    const key = entry.studentName.trim().toLowerCase();
    const existing = byStudent.get(key);
    if (!existing) {
      byStudent.set(key, entry);
      return;
    }
    // Keep the better attempt (higher accuracy/score, or faster duration on tie)
    const entryPct = entry.accuracyPct ?? 0;
    const existingPct = existing.accuracyPct ?? 0;
    if (
      entryPct > existingPct ||
      (entryPct === existingPct && (entry.score ?? 0) > (existing.score ?? 0)) ||
      (entryPct === existingPct &&
        (entry.score ?? 0) === (existing.score ?? 0) &&
        (entry.durationSeconds || 999999) < (existing.durationSeconds || 999999))
    ) {
      byStudent.set(key, entry);
    }
  };

  if (currentSubmission) {
    considerEntry(currentSubmission);
  }

  if (cleanPin) {
    try {
      const q = query(collection(db, 'homework_submissions'), where('pinCode', '==', cleanPin));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as HomeworkSubmission;
        if (data) considerEntry({ ...data, id: docSnap.id });
      });
    } catch (e) {
      console.warn('Notice: could not query leaderboard from Firestore', e);
    }
  }

  return Array.from(byStudent.values()).sort((a, b) => {
    if ((b.accuracyPct ?? 0) !== (a.accuracyPct ?? 0)) {
      return (b.accuracyPct ?? 0) - (a.accuracyPct ?? 0);
    }
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return (a.durationSeconds || 999999) - (b.durationSeconds || 999999);
  });
}

// Synchronous local cache lookup (only checks the current user's own local assignments if userId provided)
export function findAssignmentByPin(pin: string, userId?: string): HomeworkAssignment | null {
  if (!userId) return null;
  const assignments = getLocalAssignments(userId);
  const clean = (pin || '').trim().replace(/\s+/g, '').replace(/^hw[_-]/i, '');
  if (!clean) return null;
  const found = assignments.find((a) => a.pinCode === clean || a.id === clean);
  if (found) return ensureAssignmentHasQuestions(found);
  return null;
}

// Find a single assignment by its 6-digit PIN code from Firestore (does NOT expose or save any public list)
export async function fetchHomeworkAssignmentByPin(
  pin: string,
  userId?: string
): Promise<HomeworkAssignment | null> {
  const clean = (pin || '').trim().replace(/\s+/g, '').replace(/^hw[_-]/i, '');
  if (!clean) return null;

  const candidateDocIds = [clean, `hw_${clean}`, `hw-${clean}`];

  for (const docId of candidateDocIds) {
    try {
      const docRef = doc(db, 'homework_assignments', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as HomeworkAssignment;
        if (isFakeYogaPresetAssignment(data)) continue;
        return ensureAssignmentHasQuestions({
          ...data,
          id: data.id && String(data.id).startsWith('hw-') ? data.id : snap.id,
        });
      }
    } catch (e) {
      console.warn('Notice: Firestore getDoc by pin error', e);
    }
  }

  // Fallback to current user's own local cache if offline
  if (userId) {
    const local = getLocalAssignments(userId);
    const cached = local.find((a) => a.pinCode === clean || a.id === clean);
    if (cached && !isFakeYogaPresetAssignment(cached)) {
      const ready = ensureAssignmentHasQuestions(cached);
      saveHomeworkAssignment(ready, userId).catch(() => {});
      return ready;
    }
  }

  return null;
}
