import React, { useState, useEffect } from 'react';
import { ViewState } from '../types';
import {
  BookOpen,
  Calendar,
  Clock,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Share2,
  Copy,
  Play,
  ShieldCheck,
  User,
  BarChart3,
  RefreshCw,
  FileText,
  Check,
  AlertCircle,
  Plus,
  Timer,
  Trophy,
  QrCode,
  Presentation,
  Trash2,
  Volume2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Gamepad2,
  Users,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  HomeworkAssignment,
  HomeworkSubmission,
  QuestionAuditItem,
  fetchAllHomeworkAssignments,
  fetchHomeworkSubmissions,
  recordHomeworkSubmission,
  deleteHomeworkAssignment,
  deleteHomeworkSubmission,
  formatDurationSeconds,
  findAssignmentByPin,
  fetchHomeworkAssignmentByPin,
  getSavedSlideDecksForHomework,
  getAllUserGamesForHomework,
  convertSlideDeckToHomeworkObject,
  ensureAssignmentHasQuestions,
  fetchHomeworkLeaderboard,
} from '../utils/homeworkService';
import { CreateHomeworkModal, getHomeworkShareUrl } from '../components/CreateHomeworkModal';
import { GameThumbnail } from '../components/GameThumbnail';
import {
  StartersMonsterArtStudio,
  STARTERS_MONSTER_ART_DECK_ID,
} from '../components/StartersMonsterArtStudio';
import { useAuth } from '../contexts/AuthContext';

export function Homework({
  onViewChange,
  initialData,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialData?: any;
}) {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<'teacher' | 'student'>('teacher');
  const [activeTab, setActiveTab] = useState<'analytics' | 'assignments'>('analytics');

  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProof, setSelectedProof] = useState<HomeworkSubmission | null>(null);
  const [qrModalAssignment, setQrModalAssignment] = useState<HomeworkAssignment | null>(null);

  // Student PIN input & runner
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeStudentAssignment, setActiveStudentAssignment] =
    useState<HomeworkAssignment | null>(null);
  const [studentName, setStudentName] = useState(user?.displayName || '');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInputError, setNameInputError] = useState<string | null>(null);
  const [targetAssignmentForPlay, setTargetAssignmentForPlay] =
    useState<HomeworkAssignment | null>(null);
  const [isSearchingPin, setIsSearchingPin] = useState(false);
  const [isTakingHomework, setIsTakingHomework] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<
    Record<number, { text: string; isCorrect: boolean; timeSpent: number }>
  >({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedSubmission, setCompletedSubmission] = useState<HomeworkSubmission | null>(null);
  const [leaderboardEntries, setLeaderboardEntries] = useState<HomeworkSubmission[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [openAnswerInput, setOpenAnswerInput] = useState('');

  // Embedded studio state
  const [showEmbeddedMonsterStudio, setShowEmbeddedMonsterStudio] = useState(false);

  // Create homework modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGameForCreation, setSelectedGameForCreation] = useState<any | null>(null);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [availableSlides, setAvailableSlides] = useState<any[]>([]);
  const [showGamePickerModal, setShowGamePickerModal] = useState(false);
  const [pickerTab, setPickerTab] = useState<'slides' | 'games'>('slides');

  // Filters & Clicked Homework Detail Modal State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<string>('all');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);
  const [selectedHomeworkDetail, setSelectedHomeworkDetail] =
    useState<HomeworkAssignment | null>(null);
  const [detailTab, setDetailTab] = useState<'leaderboard' | 'students' | 'questions'>(
    'leaderboard'
  );
  const [detailLeaderboard, setDetailLeaderboard] = useState<HomeworkSubmission[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailStudentSearch, setDetailStudentSearch] = useState('');

  // Load initial data (strictly scoped to the signed-in user; never shared publicly across users)
  const loadData = async () => {
    setLoading(true);
    try {
      // Sync user's Firestore games into local cache if signed in
      if (user?.uid) {
        try {
          const q = query(collection(db, 'mysteryBoxGames'), where('userId', '==', user.uid));
          const snap = await getDocs(q);
          const cloudGames = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (cloudGames.length > 0 && typeof window !== 'undefined') {
            localStorage.setItem('hamster_cached_user_games', JSON.stringify(cloudGames));
          }
        } catch {
          // ignore offline
        }
      }

      const allAssignments = await fetchAllHomeworkAssignments(user?.uid);
      const userPins = allAssignments.map((a) => a.pinCode).filter(Boolean);
      const allSubmissions = await fetchHomeworkSubmissions(user?.uid, undefined, userPins);
      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
      setAvailableGames(getAllUserGamesForHomework());
      setAvailableSlides(getSavedSlideDecksForHomework());
    } catch (e) {
      console.error('Failed to load homework data', e);
    } finally {
      setLoading(false);
    }
  };

  // Open the Clicked Homework Details modal and load its live leaderboard & student submissions
  const openHomeworkDetailModal = async (assignment: HomeworkAssignment) => {
    const ready = ensureAssignmentHasQuestions(assignment);
    setSelectedHomeworkDetail(ready);
    setDetailTab('leaderboard');
    setDetailStudentSearch('');
    const localSubsForHw = submissions.filter(
      (s) => s.pinCode === ready.pinCode || s.assignmentId === ready.id
    );
    setDetailLeaderboard(
      [...localSubsForHw].sort((a, b) => {
        if ((b.accuracyPct || 0) !== (a.accuracyPct || 0))
          return (b.accuracyPct || 0) - (a.accuracyPct || 0);
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (a.durationSeconds || 999999) - (b.durationSeconds || 999999);
      })
    );
    setIsLoadingDetail(true);
    try {
      const liveBoard = await fetchHomeworkLeaderboard(ready.pinCode);
      const byId = new Map<string, HomeworkSubmission>();
      [...localSubsForHw, ...liveBoard].forEach((s) => {
        if (s?.id) byId.set(s.id, s);
      });
      const merged = Array.from(byId.values()).sort((a, b) => {
        if ((b.accuracyPct || 0) !== (a.accuracyPct || 0))
          return (b.accuracyPct || 0) - (a.accuracyPct || 0);
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return (a.durationSeconds || 999999) - (b.durationSeconds || 999999);
      });
      setDetailLeaderboard(merged);
      // Merge into overall submissions state as well so card counts stay up to date
      setSubmissions((prev) => {
        const map = new Map<string, HomeworkSubmission>();
        [...prev, ...merged].forEach((item) => {
          if (item?.id) map.set(item.id, item);
        });
        return Array.from(map.values()).sort((a, b) => b.completedAt - a.completedAt);
      });
    } catch (e) {
      console.warn('Could not refresh homework detail leaderboard', e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadData();

    const checkAndLaunchPin = () => {
      // Check if teacher navigated here with a slide deck or game to assign
      if (initialData?.assignSlideDeck) {
        const hwObj = convertSlideDeckToHomeworkObject(initialData.assignSlideDeck);
        setSelectedGameForCreation(hwObj);
        setIsCreateModalOpen(true);
        return;
      }

      let pin = initialData?.pinCode;
      if (!pin && typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        pin = params.get('hwPin') || params.get('pin');
        if (!pin && window.location.hash?.startsWith('#homework-')) {
          pin = window.location.hash.replace('#homework-', '');
        }
      }
      if (pin) {
        setPinInput(pin);
        setActiveRole('student');
        resolvePinAndPromptName(pin);
      }
    };

    checkAndLaunchPin();
    window.addEventListener('popstate', checkAndLaunchPin);
    return () => window.removeEventListener('popstate', checkAndLaunchPin);
  }, [initialData, user?.uid]);

  // Live timer for student while taking homework
  useEffect(() => {
    let interval: any = null;
    if (isTakingHomework && examStartTime > 0 && !completedSubmission) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - examStartTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTakingHomework, examStartTime, completedSubmission]);

  // Resolve PIN (from user's local cache or Firestore) and show Enter Name popup
  const resolvePinAndPromptName = async (pin: string) => {
    const clean = (pin || '').trim().replace(/\s+/g, '');
    if (!clean) return;
    setPinError(null);

    // 1. Check current user's local cache first for 0-latency lookup
    const foundLocal = findAssignmentByPin(clean, user?.uid);
    if (foundLocal) {
      const ready = ensureAssignmentHasQuestions(foundLocal);
      setActiveStudentAssignment(ready);
      setTargetAssignmentForPlay(ready);
      setNameInputError(null);
      setShowNameModal(true);
    } else {
      setIsSearchingPin(true);
    }

    // 2. Perform async cloud lookup by PIN to fetch the specific assignment
    try {
      const cloudAssignment = await fetchHomeworkAssignmentByPin(clean, user?.uid);
      setIsSearchingPin(false);
      if (cloudAssignment) {
        const readyCloud = ensureAssignmentHasQuestions(cloudAssignment);
        setActiveStudentAssignment(readyCloud);
        setTargetAssignmentForPlay(readyCloud);
        setNameInputError(null);
        setShowNameModal(true);
      } else if (!foundLocal) {
        setPinError(
          `No active homework found for PIN "${clean}". Please verify the 6-digit PIN with your teacher.`
        );
      }
    } catch (e) {
      setIsSearchingPin(false);
      if (!foundLocal) {
        setPinError(`Could not find homework for PIN "${clean}".`);
      }
      console.warn('Notice: background cloud sync for PIN:', clean, e);
    }
  };

  // Handle student starting homework by PIN input bar
  const handleLaunchByPin = (overridePin?: string) => {
    const targetPin = (overridePin || pinInput).trim();
    if (!targetPin) {
      setPinError('Please enter a 6-digit PIN code.');
      return;
    }
    resolvePinAndPromptName(targetPin);
  };

  // Open Name popup for any assignment
  const promptStudentNameAndStart = (assignment: HomeworkAssignment) => {
    const ready = ensureAssignmentHasQuestions(assignment);
    setTargetAssignmentForPlay(ready);
    setActiveStudentAssignment(ready);
    setNameInputError(null);
    setShowNameModal(true);
  };

  // Confirm Name in popup and launch homework session immediately
  const handleConfirmNameAndStart = () => {
    const trimmed = studentName.trim();
    if (!trimmed) {
      setNameInputError('Please enter your name to proceed.');
      return;
    }
    if (!targetAssignmentForPlay) return;
    setShowNameModal(false);
    launchInteractiveSession(ensureAssignmentHasQuestions(targetAssignmentForPlay), trimmed);
  };

  // Begin interactive test session
  const launchInteractiveSession = (assignment: HomeworkAssignment, confirmedName: string) => {
    const ready = ensureAssignmentHasQuestions(assignment);
    setStudentName(confirmedName);
    setActiveStudentAssignment(ready);
    setCurrentQuestionIndex(0);
    setOpenAnswerInput('');
    setShowEmbeddedMonsterStudio(false);
    setStudentAnswers({});
    const now = Date.now();
    setExamStartTime(now);
    setQuestionStartTime(now);
    setElapsedSeconds(0);
    setCompletedSubmission(null);
    setLeaderboardEntries([]);
    setIsTakingHomework(true);
  };

  // Handle student answering a question
  const handleSelectOption = (optionText: string, isCorrect: boolean) => {
    const now = Date.now();
    const timeSpent = Math.max(1, Math.round((now - questionStartTime) / 1000));

    const updatedAnswers = {
      ...studentAnswers,
      [currentQuestionIndex]: {
        text: optionText,
        isCorrect,
        timeSpent,
      },
    };
    setStudentAnswers(updatedAnswers);
    setOpenAnswerInput('');

    const questionsList = activeStudentAssignment?.questions || [];
    if (activeStudentAssignment && currentQuestionIndex < questionsList.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setQuestionStartTime(now);
    } else {
      finishHomeworkSession(updatedAnswers);
    }
  };

  const finishHomeworkSession = async (
    finalAnswers: Record<number, { text: string; isCorrect: boolean; timeSpent: number }>
  ) => {
    if (!activeStudentAssignment) return;

    const readyAssignment = ensureAssignmentHasQuestions(activeStudentAssignment);
    const questionsList = readyAssignment.questions || [];
    const totalQuestions = Math.max(1, questionsList.length);
    let correctCount = 0;

    const auditBreakdown: QuestionAuditItem[] = questionsList.map((q, idx) => {
      const studentAns = finalAnswers[idx];
      const correctOption =
        typeof q.answerIndex === 'number' && Array.isArray(q.options)
          ? q.options[q.answerIndex]
          : q.correctAnswer || q.correct || q.answer || 'Correct Answer';

      const isCorrect = studentAns ? studentAns.isCorrect : false;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id || idx + 1,
        questionText: q.text || q.prompt || q.question || `Question ${idx + 1}`,
        studentAnswer: studentAns ? studentAns.text : 'Unanswered',
        correctAnswer: String(correctOption),
        isCorrect,
        timeSpentSeconds: studentAns ? studentAns.timeSpent : 0,
      };
    });

    const finalDurationSeconds = Math.max(1, Math.floor((Date.now() - examStartTime) / 1000));
    const accuracy = Math.round((correctCount / totalQuestions) * 100);
    const passed = accuracy >= (readyAssignment.passingScore || 70);

    const ownerTeacherUid = readyAssignment.userId || readyAssignment.createdByUid;
    const newSubmission: HomeworkSubmission = {
      id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      assignmentId: readyAssignment.id,
      assignmentTitle: readyAssignment.gameTitle,
      pinCode: readyAssignment.pinCode,
      ...(ownerTeacherUid ? { teacherUid: ownerTeacherUid } : {}),
      studentName: studentName.trim() || 'Anonymous Student',
      ...(user?.email ? { studentEmail: user.email } : {}),
      startedAt: examStartTime,
      completedAt: Date.now(),
      durationSeconds: finalDurationSeconds,
      score: correctCount,
      maxScore: totalQuestions,
      accuracyPct: accuracy,
      passed,
      attemptNumber: 1,
      questionBreakdown: auditBreakdown,
      verifiedAt: new Date().toISOString(),
    };

    setCompletedSubmission(newSubmission);
    setLeaderboardEntries([newSubmission]);
    setIsLoadingLeaderboard(true);

    try {
      await recordHomeworkSubmission(newSubmission, user?.uid);
      const allAssignments = await fetchAllHomeworkAssignments(user?.uid);
      const userPins = allAssignments.map((a) => a.pinCode).filter(Boolean);
      const [board, allSubmissions] = await Promise.all([
        fetchHomeworkLeaderboard(readyAssignment.pinCode, newSubmission),
        fetchHomeworkSubmissions(user?.uid, undefined, userPins),
      ]);
      setLeaderboardEntries(board.length > 0 ? board : [newSubmission]);
      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
    } catch (e) {
      console.error('Error saving homework submission', e);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Delete an assignment permanently
  const handleDeleteAssignment = async (assignmentId: string, pinCode?: string) => {
    setAssignments((prev) =>
      prev.filter((a) => a.id !== assignmentId && (!pinCode || a.pinCode !== pinCode))
    );
    if (
      selectedHomeworkDetail &&
      (selectedHomeworkDetail.id === assignmentId ||
        (pinCode && selectedHomeworkDetail.pinCode === pinCode))
    ) {
      setSelectedHomeworkDetail(null);
    }
    if (
      activeStudentAssignment &&
      (activeStudentAssignment.id === assignmentId ||
        (pinCode && activeStudentAssignment.pinCode === pinCode))
    ) {
      setActiveStudentAssignment(null);
    }
    if (
      targetAssignmentForPlay &&
      (targetAssignmentForPlay.id === assignmentId ||
        (pinCode && targetAssignmentForPlay.pinCode === pinCode))
    ) {
      setTargetAssignmentForPlay(null);
    }
    if (selectedAssignmentFilter === assignmentId) {
      setSelectedAssignmentFilter('all');
    }
    await deleteHomeworkAssignment(assignmentId, pinCode, user?.uid);
  };

  // Delete a submission record
  const handleDeleteSubmission = async (submissionId: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    setDetailLeaderboard((prev) => prev.filter((s) => s.id !== submissionId));
    if (selectedProof?.id === submissionId) {
      setSelectedProof(null);
    }
    await deleteHomeworkSubmission(submissionId, user?.uid);
  };

  // Speak text helper for vocabulary slides inside homework
  const speakSlideText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    }
  };

  // Copy PIN or Link to clipboard
  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2500);
  };

  const handleCopyLink = (pin: string) => {
    const url = getHomeworkShareUrl(pin);
    navigator.clipboard.writeText(url);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2500);
  };

  // Compute analytics KPIs
  const totalSubmissions = submissions.length;
  const avgAccuracy =
    totalSubmissions > 0
      ? Math.round(submissions.reduce((acc, s) => acc + (s.accuracyPct || 0), 0) / totalSubmissions)
      : 0;
  const avgDurationSeconds =
    totalSubmissions > 0
      ? Math.round(
          submissions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / totalSubmissions
        )
      : 0;
  const passRate =
    totalSubmissions > 0
      ? Math.round((submissions.filter((s) => s.passed).length / totalSubmissions) * 100)
      : 0;

  // Filtered submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchSearch =
      sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.pinCode.includes(searchQuery);
    const matchAssignment =
      selectedAssignmentFilter === 'all' || sub.assignmentId === selectedAssignmentFilter;
    return matchSearch && matchAssignment;
  });

  const isStartersMonsterAssignment =
    activeStudentAssignment?.slideDeckId === STARTERS_MONSTER_ART_DECK_ID ||
    String(activeStudentAssignment?.gameTitle || '')
      .toLowerCase()
      .includes('monster art');

  const assignmentSlides = Array.isArray(activeStudentAssignment?.slides)
    ? activeStudentAssignment!.slides!
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Embedded Monster Art Speaking Studio Modal during Homework */}
      {showEmbeddedMonsterStudio && (
        <StartersMonsterArtStudio
          onClose={() => setShowEmbeddedMonsterStudio(false)}
          onSwitchToStandardSlides={() => setShowEmbeddedMonsterStudio(false)}
        />
      )}

      {/* ========================================================= */}
      {/* MINIMAL COMMUNITY-STYLE HOMEWORK VIEW                     */}
      {/* ========================================================= */}
      {!isTakingHomework && (
        <div className="space-y-8">
          {/* Clean Top Bar: Title + Student 6-Digit PIN Launcher + Create Homework Button */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Homework
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Click any homework icon to inspect accuracy, leaderboard, and students who completed it.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Student Quick PIN Box */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLaunchByPin()}
                  placeholder="Enter 6-digit PIN"
                  className="w-36 text-center text-sm font-mono font-black tracking-widest px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-600"
                />
                <button
                  onClick={() => handleLaunchByPin()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Join PIN
                </button>
              </div>

              {/* Create Homework Button */}
              <button
                onClick={() => {
                  setAvailableSlides(getSavedSlideDecksForHomework());
                  setAvailableGames(getAllUserGamesForHomework());
                  setShowGamePickerModal(true);
                }}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs sm:text-sm rounded-2xl shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Homework
              </button>

              <button
                onClick={loadData}
                title="Refresh Homework"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {pinError && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {pinError}
            </div>
          )}

          {/* COMMUNITY-STYLE ICON CARD GRID */}
          {assignments.length === 0 ? (
            <div className="p-14 text-center rounded-3xl bg-white dark:bg-slate-800/80 border-2 border-dashed border-slate-200 dark:border-slate-700/80">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                No Homework Created Yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                Create a homework from any Slide Deck or Game, or enter a 6-digit Homework PIN above to start answering questions.
              </p>
              <button
                onClick={() => {
                  setAvailableSlides(getSavedSlideDecksForHomework());
                  setAvailableGames(getAllUserGamesForHomework());
                  setShowGamePickerModal(true);
                }}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Your First Homework
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {assignments.map((a) => {
                const hwSubmissions = submissions.filter(
                  (s) => s.pinCode === a.pinCode || s.assignmentId === a.id
                );
                const studentCount = hwSubmissions.length;
                const avgHwAccuracy =
                  studentCount > 0
                    ? Math.round(
                        hwSubmissions.reduce((acc, s) => acc + (s.accuracyPct || 0), 0) /
                          studentCount
                      )
                    : null;

                return (
                  <div
                    key={a.id}
                    onClick={() => openHomeworkDetailModal(a)}
                    className="group bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-slate-100 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 flex flex-col cursor-pointer relative"
                  >
                    {/* Community-Style Icon Thumbnail */}
                    <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden border-b-2 border-slate-100 dark:border-slate-700">
                      <GameThumbnail
                        gameType={
                          a.gameType && a.gameType !== 'study-mode' && a.gameType !== 'slides-homework'
                            ? a.gameType
                            : 'mystery-box'
                        }
                        game={{
                          id: a.id,
                          topic: a.gameTitle,
                          name: a.gameTitle,
                          title: a.gameTitle,
                          questions: a.questions || [],
                          classLevel: a.classLevel || a.targetClass || 'All Classes',
                        }}
                      />

                      {/* Hover Overlay: Click to View Leaderboard & Students */}
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4">
                        <div className="px-4 py-2.5 rounded-2xl bg-white text-slate-900 font-black text-xs shadow-lg flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          View Leaderboard & Details
                        </div>
                      </div>
                    </div>

                    {/* Minimal Community-Style Footer */}
                    <div className="p-4 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-black text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {a.gameTitle}
                        </h3>
                        {(a.classLevel || a.targetClass) && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50">
                            {a.classLevel || a.targetClass}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold pt-1">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-purple-500" />
                          {studentCount} {studentCount === 1 ? 'student' : 'students'}
                        </span>
                        <span>
                          {avgHwAccuracy !== null
                            ? `${avgHwAccuracy}% accuracy`
                            : `PIN: ${a.pinCode}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* FOCUSED HOMEWORK QUESTION PLAYER & POST-ANSWER LEADERBOARD */}
      {/* ========================================================= */}
      {isTakingHomework && activeStudentAssignment && (
        <div className="mt-2 max-w-3xl mx-auto">
          {!completedSubmission ? (
            /* FOCUSED QUESTION-ONLY VIEW */
            <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
              {/* Minimal Top Bar */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-700 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      {activeStudentAssignment.gameTitle}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Student:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {studentName}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Elapsed Timer */}
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 rounded-xl">
                    <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-mono font-black text-amber-900 dark:text-amber-200">
                      {formatDurationSeconds(elapsedSeconds)}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setIsTakingHomework(false);
                      setCompletedSubmission(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Exit
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                  <span>
                    Question {currentQuestionIndex + 1} of{' '}
                    {Math.max(1, activeStudentAssignment.questions.length)}
                  </span>
                  <span>
                    {Math.round(
                      ((currentQuestionIndex + 1) /
                        Math.max(1, activeStudentAssignment.questions.length)) *
                        100
                    )}
                    % Complete
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        ((currentQuestionIndex + 1) /
                          Math.max(1, activeStudentAssignment.questions.length)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Current Question */}
              {activeStudentAssignment.questions[currentQuestionIndex] &&
                (() => {
                  const q = activeStudentAssignment.questions[currentQuestionIndex];
                  const promptText =
                    q.text || q.question || q.prompt || `Question ${currentQuestionIndex + 1}`;
                  const realOptions: string[] = Array.isArray(q.options)
                    ? q.options.filter(
                        (o: any) =>
                          typeof o === 'string' &&
                          o.trim().length > 0 &&
                          !/^(sample\s+)?option\s*[a-f1-6]$/i.test(o.trim())
                      )
                    : [];
                  const hasMultipleChoice = !q.isOpenEnded && realOptions.length >= 2;
                  const isLastQuestion =
                    currentQuestionIndex >= activeStudentAssignment.questions.length - 1;

                  const correctIndex =
                    typeof q.answerIndex === 'number'
                      ? q.answerIndex
                      : typeof q.correct === 'number'
                      ? q.correct
                      : 0;

                  return (
                    <div className="pt-4 space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 leading-snug">
                          {promptText}
                        </h2>
                        <button
                          onClick={() => speakSlideText(promptText)}
                          className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 hover:bg-purple-200 shrink-0 cursor-pointer transition"
                          title="Read question aloud"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>

                      {q.image && (
                        <div className="flex justify-center">
                          <img
                            src={q.image}
                            alt="Question illustration"
                            className="max-h-56 rounded-2xl object-contain border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      )}

                      {hasMultipleChoice ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                          {realOptions.map((optText: string, optIdx: number) => {
                            const isCorrect =
                              optIdx === correctIndex ||
                              optText === q.correctAnswer ||
                              optText === q.correct;
                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectOption(optText, isCorrect)}
                                className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-600 dark:hover:border-purple-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-left font-bold text-base text-slate-800 dark:text-slate-200 transition-all active:scale-98 flex items-center justify-between group cursor-pointer"
                              >
                                <span>{optText}</span>
                                <span className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:border-purple-600 group-hover:text-purple-600 transition-colors shrink-0 ml-3">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Open-Ended / Speaking Question — Show only the question and clean answer submission */
                        <div className="space-y-4 pt-2">
                          <input
                            type="text"
                            value={openAnswerInput}
                            onChange={(e) => setOpenAnswerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSelectOption(
                                  openAnswerInput.trim() || 'Answered',
                                  true
                                );
                              }
                            }}
                            placeholder="Type your answer here (optional for speaking questions)..."
                            className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-purple-600 focus:outline-none text-slate-900 dark:text-slate-100 font-semibold text-base"
                          />

                          <div className="flex items-center justify-between gap-3 pt-2">
                            {currentQuestionIndex > 0 ? (
                              <button
                                onClick={() => {
                                  setCurrentQuestionIndex((i) => Math.max(0, i - 1));
                                  setOpenAnswerInput(
                                    studentAnswers[currentQuestionIndex - 1]?.text === 'Answered'
                                      ? ''
                                      : studentAnswers[currentQuestionIndex - 1]?.text || ''
                                  );
                                }}
                                className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center gap-2 transition cursor-pointer"
                              >
                                <ArrowLeft className="w-4 h-4" />
                                Previous
                              </button>
                            ) : (
                              <div />
                            )}

                            <button
                              onClick={() =>
                                handleSelectOption(
                                  openAnswerInput.trim() || 'Answered',
                                  true
                                )
                              }
                              className="px-7 py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm sm:text-base shadow-lg shadow-purple-500/20 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                            >
                              <span>
                                {isLastQuestion
                                  ? 'Finish & View Leaderboard'
                                  : 'Next Question'}
                              </span>
                              {isLastQuestion ? (
                                <Trophy className="w-4 h-4" />
                              ) : (
                                <ArrowRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          ) : (
            /* ========================================================= */
            /* POST-ANSWER HOMEWORK LEADERBOARD                          */
            /* ========================================================= */
            (() => {
              const board =
                leaderboardEntries.length > 0 ? leaderboardEntries : [completedSubmission];
              const myRankIndex = board.findIndex(
                (entry) =>
                  entry.id === completedSubmission.id ||
                  entry.studentName.trim().toLowerCase() ===
                    completedSubmission.studentName.trim().toLowerCase()
              );
              const myRank = myRankIndex >= 0 ? myRankIndex + 1 : 1;

              return (
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-6">
                  {/* Top Result & Rank Banner */}
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-center sm:text-left">
                      <div className="w-16 h-16 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-black shrink-0 shadow-lg">
                        <Trophy className="w-7 h-7" />
                        <span className="text-[11px] leading-none mt-0.5">#{myRank}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-200">
                          {activeStudentAssignment.gameTitle} · Leaderboard
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                          Great job, {completedSubmission.studentName}!
                        </h2>
                        <p className="text-xs text-purple-100 mt-1">
                          Rank #{myRank} of {board.length} · Score {completedSubmission.score}/
                          {completedSubmission.maxScore} ({completedSubmission.accuracyPct}%) · Time{' '}
                          {formatDurationSeconds(completedSubmission.durationSeconds)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto shrink-0">
                      <div className="px-3.5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm text-center">
                        <span className="block text-[10px] text-purple-200 uppercase font-bold">
                          Rank
                        </span>
                        <span className="text-lg font-black text-amber-300">#{myRank}</span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm text-center">
                        <span className="block text-[10px] text-purple-200 uppercase font-bold">
                          Score
                        </span>
                        <span className="text-lg font-black text-white">
                          {completedSubmission.accuracyPct}%
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm text-center">
                        <span className="block text-[10px] text-purple-200 uppercase font-bold">
                          Time
                        </span>
                        <span className="text-lg font-mono font-black text-emerald-300">
                          {formatDurationSeconds(completedSubmission.durationSeconds)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top 3 Podium */}
                  {board.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {board.slice(0, 3).map((entry, idx) => {
                        const rank = idx + 1;
                        const medal = rank === 1 ? '🥇 1st' : rank === 2 ? '🥈 2nd' : '🥉 3rd';
                        const isMe =
                          entry.id === completedSubmission.id ||
                          entry.studentName.trim().toLowerCase() ===
                            completedSubmission.studentName.trim().toLowerCase();
                        return (
                          <div
                            key={entry.id || idx}
                            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                              rank === 1
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                                : rank === 2
                                ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700'
                                : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                {medal}
                              </span>
                              <p className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                                {entry.studentName} {isMe && '(You)'}
                              </p>
                              <p className="text-xs font-semibold text-slate-500">
                                {entry.score}/{entry.maxScore} ·{' '}
                                {formatDurationSeconds(entry.durationSeconds)}
                              </p>
                            </div>
                            <span className="text-xl font-black text-purple-600 dark:text-purple-400 shrink-0">
                              {entry.accuracyPct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Full Ranked Leaderboard Standings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Class Leaderboard ({board.length})
                      </h3>
                      {isLoadingLeaderboard && (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Syncing live standings...
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/70 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-3 px-4 w-16">Rank</th>
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4 text-center">Score</th>
                            <th className="py-3 px-4 text-center">Accuracy</th>
                            <th className="py-3 px-4 text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                          {board.map((entry, idx) => {
                            const rank = idx + 1;
                            const isMe =
                              entry.id === completedSubmission.id ||
                              entry.studentName.trim().toLowerCase() ===
                                completedSubmission.studentName.trim().toLowerCase();
                            return (
                              <tr
                                key={entry.id || idx}
                                className={
                                  isMe
                                    ? 'bg-purple-50/80 dark:bg-purple-950/30 font-bold'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }
                              >
                                <td className="py-3.5 px-4 font-black text-slate-800 dark:text-slate-200">
                                  {rank === 1
                                    ? '🥇 #1'
                                    : rank === 2
                                    ? '🥈 #2'
                                    : rank === 3
                                    ? '🥉 #3'
                                    : `#${rank}`}
                                </td>
                                <td className="py-3.5 px-4 text-slate-900 dark:text-slate-100">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-black uppercase">
                                      {entry.studentName.slice(0, 2)}
                                    </div>
                                    <span>{entry.studentName}</span>
                                    {isMe && (
                                      <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                                        · YOU
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                                  {entry.score} / {entry.maxScore}
                                </td>
                                <td className="py-3.5 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">
                                  {entry.accuracyPct}%
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-600 dark:text-slate-400">
                                  {formatDurationSeconds(entry.durationSeconds)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setSelectedProof(completedSubmission)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Review Answers
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() =>
                          launchInteractiveSession(activeStudentAssignment, studentName)
                        }
                        className="px-5 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-xs sm:text-sm transition cursor-pointer"
                      >
                        Play Again
                      </button>
                      <button
                        onClick={() => {
                          setIsTakingHomework(false);
                          setCompletedSubmission(null);
                        }}
                        className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VERIFIED PROOF MODAL (TAMPER-EVIDENT AUDIT RECEIPT)       */}
      {/* ========================================================= */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Verified Proof of Completion
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    Receipt ID: {selectedProof.id.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProof(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-800/60 dark:to-purple-950/20 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Student Name
                  </span>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {selectedProof.studentName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Assignment Title
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                    {selectedProof.assignmentTitle}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Duration Spent (Proof)
                  </span>
                  <p className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                    ⏱️ {formatDurationSeconds(selectedProof.durationSeconds)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    Score & Accuracy
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">
                    {selectedProof.score} / {selectedProof.maxScore} ({selectedProof.accuracyPct}%)
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex items-center justify-between">
                <span>Completed: {new Date(selectedProof.completedAt).toLocaleString()}</span>
                <span className="font-mono text-emerald-600 font-bold">✓ Digitally Verified</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Question-by-Question Audit Breakdown ({selectedProof.questionBreakdown?.length || 0}{' '}
                Questions)
              </h4>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {(selectedProof.questionBreakdown || []).map((q, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      q.isCorrect
                        ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-500">Q{idx + 1}.</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {q.questionText}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 pl-5">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Student Answer</span>
                          <span
                            className={`font-bold ${
                              q.isCorrect
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {q.studentAnswer}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Correct Answer</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {q.correctAnswer}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {q.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      {q.timeSpentSeconds !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {q.timeSpentSeconds}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                Print / Save PDF Proof
              </button>
              <button
                onClick={() => setSelectedProof(null)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Proof
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SLIDE DECK & GAME PICKER MODAL ("+ CREATE HOMEWORK")      */}
      {/* ========================================================= */}
      {showGamePickerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  Select Slide Deck or Game to Assign
                </h3>
                <p className="text-xs text-slate-500">
                  Pick any Slide Deck from My Slides or Game from My Games to send as homework.
                </p>
              </div>
              <button
                onClick={() => setShowGamePickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Picker Tabs: My Slides vs My Games */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
              <button
                onClick={() => setPickerTab('slides')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  pickerTab === 'slides'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Presentation className="w-4 h-4" />
                <span>My Slides ({availableSlides.length})</span>
              </button>
              <button
                onClick={() => setPickerTab('games')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  pickerTab === 'games'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>My Games ({availableGames.length})</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {pickerTab === 'slides' ? (
                availableSlides.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    No slide decks found. Visit "My Slides" to create or import slide decks!
                  </div>
                ) : (
                  availableSlides.map((deck) => {
                    const hwObj = convertSlideDeckToHomeworkObject(deck);
                    return (
                      <div
                        key={deck.id}
                        onClick={() => {
                          setSelectedGameForCreation(hwObj);
                          setShowGamePickerModal(false);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-600 dark:hover:border-purple-500 bg-slate-50/50 dark:bg-slate-800/60 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer flex items-center justify-between transition-all gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase">
                              {deck.curriculum || deck.gradeLevel || 'Slide Deck'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {deck.slides?.length || 0} Slides · {hwObj?.questions?.length || 0} Qs
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {deck.title}
                          </h4>
                        </div>
                        <span className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs shrink-0">
                          Assign Slide
                        </span>
                      </div>
                    );
                  })
                )
              ) : availableGames.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No custom games found in your library. You can assign a Slide Deck from the "My Slides" tab above, or create a game in "My Games"!
                </div>
              ) : (
                availableGames.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setSelectedGameForCreation(g);
                      setShowGamePickerModal(false);
                      setIsCreateModalOpen(true);
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-600 dark:hover:border-purple-500 bg-slate-50/50 dark:bg-slate-800/60 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer flex items-center justify-between transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {g.topic || g.name || 'Untitled Game'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {g.gameType || 'Quiz'} • {g.classLevel || 'General'} •{' '}
                        {(g.customQuestions || g.questions || []).length} Qs
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-purple-600 text-white font-bold text-xs">
                      Assign
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE HOMEWORK MODAL */}
      <CreateHomeworkModal
        isOpen={isCreateModalOpen}
        game={selectedGameForCreation}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedGameForCreation(null);
        }}
        onCreated={() => {
          loadData();
        }}
        onNavigateToHomework={() => {
          setIsCreateModalOpen(false);
          setSelectedGameForCreation(null);
          loadData();
          setActiveTab('assignments');
        }}
      />

      {/* QR Code Presentation Modal for Classroom / Projector */}
      {qrModalAssignment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Homework QR Code
                  </h3>
                  <p className="text-[11px] text-slate-400">hamsterenglish.online</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalAssignment(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                {qrModalAssignment.gameTitle}
              </h4>
              <p className="text-xs text-slate-500">
                {qrModalAssignment.targetClass || qrModalAssignment.classLevel} · Due{' '}
                {qrModalAssignment.dueDate}
              </p>
            </div>

            {/* QR Code Display */}
            <div className="p-3.5 bg-white rounded-2xl border-2 border-purple-200 shadow-inner inline-flex mx-auto">
              <QRCodeSVG
                value={getHomeworkShareUrl(qrModalAssignment.pinCode)}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* PIN Code Box */}
            <div className="bg-purple-50 dark:bg-purple-950/40 p-2.5 rounded-2xl border border-purple-200 dark:border-purple-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Student PIN Code
              </span>
              <span className="text-2xl font-mono font-black text-purple-600 dark:text-purple-300 tracking-widest">
                {qrModalAssignment.pinCode}
              </span>
            </div>

            {/* Link Box */}
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl flex items-center justify-between gap-1.5 overflow-hidden">
              <span className="truncate">{getHomeworkShareUrl(qrModalAssignment.pinCode)}</span>
              <button
                onClick={() => handleCopyLink(qrModalAssignment.pinCode)}
                className="shrink-0 px-2 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center gap-1 hover:bg-purple-700 cursor-pointer"
              >
                {copiedPin === qrModalAssignment.pinCode ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedPin === qrModalAssignment.pinCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={() => setQrModalAssignment(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PIN Resolving Loading Indicator */}
      {isSearchingPin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Opening Homework...
            </h3>
            <p className="text-xs text-slate-500">Retrieving assignment details from cloud.</p>
          </div>
        </div>
      )}

      {/* STUDENT ENTER NAME POPUP MODAL */}
      {showNameModal && targetAssignmentForPlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center shadow-inner">
              <User className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                {targetAssignmentForPlay.targetClass ||
                  targetAssignmentForPlay.classLevel ||
                  'Homework Assignment'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 leading-snug">
                {targetAssignmentForPlay.gameTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your student name to start and track your verified proof of work.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400">Questions</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {targetAssignmentForPlay.questions?.length || 0} Qs
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Duration</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {targetAssignmentForPlay.durationMinutes > 0
                    ? `${targetAssignmentForPlay.durationMinutes} min`
                    : 'No limit'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Passing Mark</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {targetAssignmentForPlay.passingScore}%
                </span>
              </div>
            </div>

            <div className="text-left space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Enter Your Full Name *
              </label>
              <input
                type="text"
                autoFocus
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setNameInputError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmNameAndStart();
                }}
                placeholder="e.g. Alex Nguyen or David Tran"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border-2 border-purple-300 dark:border-purple-700 rounded-2xl text-slate-900 dark:text-slate-100 font-bold text-base focus:outline-none focus:border-purple-600 shadow-sm"
              />
              {nameInputError && (
                <p className="text-xs text-rose-500 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {nameInputError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-2xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNameAndStart}
                className="flex-[2] py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Start Homework Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CLICKED HOMEWORK DETAILS MODAL (ACCURACY, LEADERBOARD,    */}
      {/* STUDENTS WHO DID IT & QUESTION INSIGHTS)                  */}
      {/* ========================================================= */}
      {selectedHomeworkDetail && (
        <div
          onClick={() => setSelectedHomeworkDetail(null)}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
          >
            {/* Top Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    {selectedHomeworkDetail.classLevel ||
                      selectedHomeworkDetail.targetClass ||
                      'All Classes'}
                  </span>
                  <button
                    onClick={() => handleCopyPin(selectedHomeworkDetail.pinCode)}
                    className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-white/15 hover:bg-white/25 text-white flex items-center gap-1.5 transition cursor-pointer"
                    title="Copy PIN Code"
                  >
                    <span>PIN: {selectedHomeworkDetail.pinCode}</span>
                    {copiedPin === selectedHomeworkDetail.pinCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-purple-200" />
                    )}
                  </button>
                  <span className="text-xs text-slate-300 font-semibold">
                    {selectedHomeworkDetail.questions?.length || 0} Questions
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {selectedHomeworkDetail.gameTitle}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setQrModalAssignment(selectedHomeworkDetail)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Classroom QR Code"
                >
                  <QrCode className="w-4 h-4" />
                  QR Code
                </button>
                <button
                  onClick={() => handleCopyLink(selectedHomeworkDetail.pinCode)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Copy Share Link (hamsterenglish.online)"
                >
                  <Share2 className="w-4 h-4" />
                  {copiedPin === selectedHomeworkDetail.pinCode ? 'Copied!' : 'Share Link'}
                </button>
                <button
                  onClick={() => {
                    const target = selectedHomeworkDetail;
                    setSelectedHomeworkDetail(null);
                    promptStudentNameAndStart(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-900" />
                  Play Questions
                </button>
                <button
                  onClick={() =>
                    handleDeleteAssignment(
                      selectedHomeworkDetail.id,
                      selectedHomeworkDetail.pinCode
                    )
                  }
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-400/30 transition cursor-pointer"
                  title="Delete Homework"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedHomeworkDetail(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body Content */}
            {(() => {
              const hwSubs = detailLeaderboard;
              const count = hwSubs.length;
              const avgAcc =
                count > 0
                  ? Math.round(hwSubs.reduce((acc, s) => acc + (s.accuracyPct || 0), 0) / count)
                  : 0;
              const passCount = hwSubs.filter((s) => s.passed).length;
              const passPct = count > 0 ? Math.round((passCount / count) * 100) : 0;
              const avgTime =
                count > 0
                  ? Math.round(hwSubs.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / count)
                  : 0;

              const filteredStudents = hwSubs
                .slice()
                .sort((a, b) => b.completedAt - a.completedAt)
                .filter((s) =>
                  s.studentName.toLowerCase().includes(detailStudentSearch.toLowerCase())
                );

              const hwQuestions = selectedHomeworkDetail.questions || [];

              return (
                <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                  {/* 4 Key Accuracy & Student Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Students Who Did It
                      </span>
                      <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                        {count}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {count === 1 ? '1 submission recorded' : `${count} total submissions`}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300 block">
                        Class Accuracy
                      </span>
                      <span className="text-2xl font-black text-purple-700 dark:text-purple-200 mt-0.5 block">
                        {count > 0 ? `${avgAcc}%` : '--'}
                      </span>
                      <span className="text-[11px] text-purple-600/80 dark:text-purple-300/80">
                        Target: {selectedHomeworkDetail.passingScore || 70}%
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 block">
                        Pass Rate
                      </span>
                      <span className="text-2xl font-black text-emerald-700 dark:text-emerald-200 mt-0.5 block">
                        {count > 0 ? `${passPct}%` : '--'}
                      </span>
                      <span className="text-[11px] text-emerald-600/80 dark:text-emerald-300/80">
                        {passCount} of {count} passed
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 block">
                        Avg Completion Time
                      </span>
                      <span className="text-2xl font-black text-amber-700 dark:text-amber-200 mt-0.5 block">
                        {count > 0 ? formatDurationSeconds(avgTime) : '--'}
                      </span>
                      <span className="text-[11px] text-amber-600/80 dark:text-amber-300/80">
                        Verified duration log
                      </span>
                    </div>
                  </div>

                  {/* Navigation Tabs inside Modal */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailTab('leaderboard')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer ${
                          detailTab === 'leaderboard'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <Trophy className="w-4 h-4" />
                        Leaderboard ({count})
                      </button>
                      <button
                        onClick={() => setDetailTab('students')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer ${
                          detailTab === 'students'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        Students Who Did It ({count})
                      </button>
                      <button
                        onClick={() => setDetailTab('questions')}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition cursor-pointer ${
                          detailTab === 'questions'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                        Question Accuracy ({hwQuestions.length})
                      </button>
                    </div>

                    <button
                      onClick={() => openHomeworkDetailModal(selectedHomeworkDetail)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isLoadingDetail ? 'animate-spin' : ''}`}
                      />
                      Refresh
                    </button>
                  </div>

                  {/* TAB 1: LEADERBOARD */}
                  {detailTab === 'leaderboard' && (
                    <div className="space-y-5">
                      {count === 0 ? (
                        <div className="p-10 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700">
                          <Trophy className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            No students have completed this homework yet
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Share PIN <strong className="font-mono">{selectedHomeworkDetail.pinCode}</strong> or the QR code with your students to populate the live leaderboard!
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Top 3 Podium */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {hwSubs.slice(0, 3).map((top, idx) => {
                              const medals = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
                              const styles = [
                                'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700',
                                'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600',
                                'bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
                              ];
                              return (
                                <div
                                  key={top.id}
                                  className={`p-4 rounded-2xl border-2 ${styles[idx]} flex flex-col justify-between`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                      {medals[idx]}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-slate-500">
                                      {formatDurationSeconds(top.durationSeconds)}
                                    </span>
                                  </div>
                                  <p className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
                                    {top.studentName}
                                  </p>
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                    <span className="text-xs font-bold text-slate-500">
                                      {top.score}/{top.maxScore} correct
                                    </span>
                                    <span className="text-sm font-black text-purple-600 dark:text-purple-400">
                                      {top.accuracyPct}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Full Ranked Standings */}
                          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 dark:bg-slate-800/90 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                  <th className="py-3 px-4">Rank</th>
                                  <th className="py-3 px-4">Student</th>
                                  <th className="py-3 px-4">Accuracy</th>
                                  <th className="py-3 px-4">Score</th>
                                  <th className="py-3 px-4 text-right">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {hwSubs.map((entry, idx) => (
                                  <tr
                                    key={entry.id}
                                    onClick={() => setSelectedProof(entry)}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                                  >
                                    <td className="py-3 px-4 font-black text-slate-700 dark:text-slate-200">
                                      {idx === 0
                                        ? '🥇 1'
                                        : idx === 1
                                        ? '🥈 2'
                                        : idx === 2
                                        ? '🥉 3'
                                        : `#${idx + 1}`}
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                                      {entry.studentName}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="font-black text-purple-600 dark:text-purple-400">
                                          {entry.accuracyPct}%
                                        </span>
                                        <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              entry.passed ? 'bg-emerald-500' : 'bg-amber-500'
                                            }`}
                                            style={{
                                              width: `${Math.min(100, entry.accuracyPct || 0)}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                                      {entry.score} / {entry.maxScore}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-xs font-bold text-slate-500">
                                      {formatDurationSeconds(entry.durationSeconds)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 2: STUDENTS WHO DID IT */}
                  {detailTab === 'students' && (
                    <div className="space-y-4">
                      <div className="relative max-w-sm">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={detailStudentSearch}
                          onChange={(e) => setDetailStudentSearch(e.target.value)}
                          placeholder="Search student name..."
                          className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {filteredStudents.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-sm">
                          No student submissions found.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {filteredStudents.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-black text-xs uppercase shrink-0">
                                  {sub.studentName.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-slate-900 dark:text-slate-100">
                                      {sub.studentName}
                                    </p>
                                    {sub.passed ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                        Passed
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                        Needs Retry
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Completed {new Date(sub.completedAt).toLocaleDateString()} at{' '}
                                    {new Date(sub.completedAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}{' '}
                                    · Time: <strong>{formatDurationSeconds(sub.durationSeconds)}</strong>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4">
                                <div className="text-right">
                                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                    {sub.accuracyPct}% ({sub.score}/{sub.maxScore})
                                  </p>
                                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden ml-auto">
                                    <div
                                      className={`h-full rounded-full ${
                                        sub.passed ? 'bg-emerald-500' : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, sub.accuracyPct || 0)}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedProof(sub)}
                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Answers
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubmission(sub.id)}
                                    className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 cursor-pointer"
                                    title="Delete student submission"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PER-QUESTION ACCURACY INSIGHTS */}
                  {detailTab === 'questions' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        See how accurately students answered each question to spot tricky topics for classroom review.
                      </p>
                      {hwQuestions.map((q: any, idx: number) => {
                        const qText = q.text || q.prompt || q.question || `Question ${idx + 1}`;
                        const correctAns =
                          typeof q.answerIndex === 'number' && Array.isArray(q.options)
                            ? q.options[q.answerIndex]
                            : q.correctAnswer || q.correct || q.answer || '';

                        let attempts = 0;
                        let correct = 0;
                        hwSubs.forEach((s) => {
                          const item = s.questionBreakdown?.[idx];
                          if (item) {
                            attempts++;
                            if (item.isCorrect) correct++;
                          }
                        });
                        const qAcc = attempts > 0 ? Math.round((correct / attempts) * 100) : null;

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                  Q{idx + 1}
                                </span>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {qText}
                                </p>
                              </div>
                              {correctAns && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Answer: {String(correctAns)}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              {qAcc !== null ? (
                                <>
                                  <span
                                    className={`text-sm font-black ${
                                      qAcc >= 75
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : qAcc >= 50
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {qAcc}% Accuracy ({correct}/{attempts})
                                  </span>
                                  <div className="w-28 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden ml-auto">
                                    <div
                                      className={`h-full rounded-full ${
                                        qAcc >= 75
                                          ? 'bg-emerald-500'
                                          : qAcc >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${qAcc}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs text-slate-400 font-semibold">
                                  No attempts yet
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
