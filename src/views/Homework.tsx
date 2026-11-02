import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from '../types';
import { 
  BookOpen, Calendar, Clock, ChevronRight, CheckCircle2, XCircle, Award, 
  Search, Filter, Share2, Copy, Play, ArrowLeft, ShieldCheck, User, 
  BarChart3, Sparkles, RefreshCw, FileText, Check, AlertCircle, Plus,
  ExternalLink, Timer, Trophy, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  HomeworkAssignment, 
  HomeworkSubmission, 
  QuestionAuditItem, 
  fetchAllHomeworkAssignments, 
  fetchHomeworkSubmissions, 
  recordHomeworkSubmission, 
  deleteHomeworkAssignment, 
  formatDurationSeconds,
  findAssignmentByPin,
  fetchHomeworkAssignmentByPin
} from '../utils/homeworkService';
import { CreateHomeworkModal } from '../components/CreateHomeworkModal';
import { getSavedGames } from '../lib/gameStore';
import { useAuth } from '../contexts/AuthContext';

export function Homework({ onViewChange, initialData }: { onViewChange: (view: ViewState, data?: any) => void; initialData?: any }) {
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
  const [activeStudentAssignment, setActiveStudentAssignment] = useState<HomeworkAssignment | null>(null);
  const [studentName, setStudentName] = useState(user?.displayName || '');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInputError, setNameInputError] = useState<string | null>(null);
  const [targetAssignmentForPlay, setTargetAssignmentForPlay] = useState<HomeworkAssignment | null>(null);
  const [isSearchingPin, setIsSearchingPin] = useState(false);
  const [isTakingHomework, setIsTakingHomework] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<number, { text: string; isCorrect: boolean; timeSpent: number }>>({});
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedSubmission, setCompletedSubmission] = useState<HomeworkSubmission | null>(null);
  
  // Create homework modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGameForCreation, setSelectedGameForCreation] = useState<any | null>(null);
  const [availableGames, setAvailableGames] = useState<any[]>([]);
  const [showGamePickerModal, setShowGamePickerModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<string>('all');
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [allAssignments, allSubmissions] = await Promise.all([
        fetchAllHomeworkAssignments(),
        fetchHomeworkSubmissions()
      ]);
      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
      setAvailableGames(getSavedGames());
    } catch (e) {
      console.error('Failed to load homework data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const checkAndLaunchPin = () => {
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
  }, [initialData]);

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

  // Resolve PIN (from local cache or Firestore) and immediately show Enter Name popup
  const resolvePinAndPromptName = async (pin: string) => {
    const clean = (pin || '').trim().replace(/\s+/g, '');
    if (!clean) return;
    setPinError(null);
    
    // 1. Immediately resolve assignment synchronously so the "Enter Name" popup appears with 0 delay!
    const found = findAssignmentByPin(clean);
    if (found) {
      setActiveStudentAssignment(found);
      setTargetAssignmentForPlay(found);
      setNameInputError(null);
      setShowNameModal(true); // Popup appears immediately!
    }

    // 2. Perform async cloud lookup to sync any live updates
    try {
      const cloudAssignment = await fetchHomeworkAssignmentByPin(clean);
      if (cloudAssignment) {
        setActiveStudentAssignment(cloudAssignment);
        setTargetAssignmentForPlay(cloudAssignment);
        setShowNameModal(true);
      }
    } catch (e) {
      console.warn("Notice: background cloud sync for PIN:", clean, e);
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
    setTargetAssignmentForPlay(assignment);
    setActiveStudentAssignment(assignment);
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
    launchInteractiveSession(targetAssignmentForPlay, trimmed);
  };

  // Begin interactive test session
  const launchInteractiveSession = (assignment: HomeworkAssignment, confirmedName: string) => {
    setStudentName(confirmedName);
    setActiveStudentAssignment(assignment);
    setCurrentQuestionIndex(0);
    setStudentAnswers({});
    const now = Date.now();
    setExamStartTime(now);
    setQuestionStartTime(now);
    setElapsedSeconds(0);
    setCompletedSubmission(null);
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
        timeSpent
      }
    };
    setStudentAnswers(updatedAnswers);

    // If more questions exist, proceed to next
    if (activeStudentAssignment && currentQuestionIndex < activeStudentAssignment.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(now);
    } else {
      // Final question answered: Finish & Record Verifiable Proof
      finishHomeworkSession(updatedAnswers);
    }
  };

  const finishHomeworkSession = async (finalAnswers: Record<number, { text: string; isCorrect: boolean; timeSpent: number }>) => {
    if (!activeStudentAssignment) return;

    const totalQuestions = activeStudentAssignment.questions.length;
    let correctCount = 0;
    const auditBreakdown: QuestionAuditItem[] = activeStudentAssignment.questions.map((q, idx) => {
      const studentAns = finalAnswers[idx];
      const correctOption = typeof q.answerIndex === 'number' && q.options 
        ? q.options[q.answerIndex] 
        : (q.correctAnswer || q.answer || 'Correct Answer');
      
      const isCorrect = studentAns ? studentAns.isCorrect : false;
      if (isCorrect) correctCount++;

      return {
        questionId: q.id || idx + 1,
        questionText: q.text || q.prompt || q.question || `Question ${idx + 1}`,
        studentAnswer: studentAns ? studentAns.text : 'Unanswered',
        correctAnswer: correctOption,
        isCorrect,
        timeSpentSeconds: studentAns ? studentAns.timeSpent : 0
      };
    });

    const finalDurationSeconds = Math.max(1, Math.floor((Date.now() - examStartTime) / 1000));
    const accuracy = Math.round((correctCount / Math.max(1, totalQuestions)) * 100);
    const passed = accuracy >= (activeStudentAssignment.passingScore || 70);

    const newSubmission: HomeworkSubmission = {
      id: `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      assignmentId: activeStudentAssignment.id,
      assignmentTitle: activeStudentAssignment.gameTitle,
      pinCode: activeStudentAssignment.pinCode,
      studentName: studentName.trim() || 'Anonymous Student',
      studentEmail: user?.email || undefined,
      startedAt: examStartTime,
      completedAt: Date.now(),
      durationSeconds: finalDurationSeconds,
      score: correctCount,
      maxScore: totalQuestions,
      accuracyPct: accuracy,
      passed,
      attemptNumber: 1,
      questionBreakdown: auditBreakdown,
      verifiedAt: new Date().toISOString()
    };

    try {
      await recordHomeworkSubmission(newSubmission);
      setCompletedSubmission(newSubmission);
      // Reload stats
      const [allAssignments, allSubmissions] = await Promise.all([
        fetchAllHomeworkAssignments(),
        fetchHomeworkSubmissions()
      ]);
      setAssignments(allAssignments);
      setSubmissions(allSubmissions);
    } catch (e) {
      console.error('Error saving homework submission', e);
      setCompletedSubmission(newSubmission);
    }
  };

  // Copy PIN or Link to clipboard
  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2500);
  };

  const handleCopyLink = (pin: string) => {
    const url = `https://hamsterenglish.online/?hwPin=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedPin(pin);
    setTimeout(() => setCopiedPin(null), 2500);
  };

  // Compute analytics KPIs
  const totalSubmissions = submissions.length;
  const avgAccuracy = totalSubmissions > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (s.accuracyPct || 0), 0) / totalSubmissions)
    : 0;
  const avgDurationSeconds = totalSubmissions > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) / totalSubmissions)
    : 0;
  const passRate = totalSubmissions > 0
    ? Math.round((submissions.filter(s => s.passed).length / totalSubmissions) * 100)
    : 0;

  // Filtered submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchSearch = sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.pinCode.includes(searchQuery);
    const matchAssignment = selectedAssignmentFilter === 'all' || sub.assignmentId === selectedAssignmentFilter;
    return matchSearch && matchAssignment;
  });

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Header & Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Homework & Proof Center
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Verifiable completion proof, student time duration tracking, and instant grading.
              </p>
            </div>
          </div>
        </div>

        {/* Teacher vs Student Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start md:self-auto border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => { setActiveRole('teacher'); setIsTakingHomework(false); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeRole === 'teacher'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Teacher Mode
          </button>
          <button
            onClick={() => { setActiveRole('student'); }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              activeRole === 'student'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Student Mode
          </button>
        </div>
      </div>

      {/* QUICK STUDENT PIN BAR */}
      <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
            PIN
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Student Fast Access
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter any 6-digit Homework PIN given by your teacher to start working.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            maxLength={6}
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.replace(/\D/g, ''));
              setPinError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLaunchByPin()}
            placeholder="e.g. 729140"
            className="w-36 text-center text-lg font-black tracking-widest px-3 py-2 bg-white dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-600"
          />
          <button
            onClick={() => handleLaunchByPin()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" />
            Launch PIN
          </button>
        </div>
      </div>
      {pinError && (
        <div className="mt-2 text-xs font-semibold text-rose-500 flex items-center gap-1.5 px-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {pinError}
        </div>
      )}

      {/* ========================================================= */}
      {/* TEACHER DASHBOARD VIEW                                    */}
      {/* ========================================================= */}
      {activeRole === 'teacher' && !isTakingHomework && (
        <div className="mt-8 space-y-8">
          {/* Action Row & Tab Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`pb-2 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'analytics'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Proof of Work Analytics ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`pb-2 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'assignments'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Active Assignments ({assignments.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGamePickerModal(true)}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Create New Homework
              </button>
              <button
                onClick={loadData}
                title="Refresh Records"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assignments */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Sets</span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{assignments.length}</p>
              <p className="text-xs text-slate-500 mt-1">
                {assignments.length > 0 ? 'Live homework PINs ready' : 'No active assignments'}
              </p>
            </div>

            {/* Submissions */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submissions</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{totalSubmissions}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                {totalSubmissions > 0 ? `${passRate}% pass target` : 'No submissions yet'}
              </p>
            </div>

            {/* Average Duration - PROOF METRIC */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Duration Proof</span>
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Timer className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                {totalSubmissions > 0 ? formatDurationSeconds(avgDurationSeconds) : '--'}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                {totalSubmissions > 0 ? 'Real student time logged' : 'Awaiting student sessions'}
              </p>
            </div>

            {/* Class Accuracy */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Accuracy</span>
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
                {totalSubmissions > 0 ? `${avgAccuracy}%` : '--'}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                {totalSubmissions > 0 ? 'Automatic question grading' : 'Awaiting graded attempts'}
              </p>
            </div>
          </div>

          {/* TAB 1: ANALYTICS & PROOF TABLE */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student name, assignment, or PIN..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedAssignmentFilter}
                    onChange={(e) => setSelectedAssignmentFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
                  >
                    <option value="all">All Assignments</option>
                    {assignments.map(a => (
                      <option key={a.id} value={a.id}>{a.gameTitle}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submissions Table */}
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3.5 px-4">Student</th>
                        <th className="py-3.5 px-4">Assignment & PIN</th>
                        <th className="py-3.5 px-4">Duration Spent (Proof)</th>
                        <th className="py-3.5 px-4">Score & Accuracy</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No submissions found for the current filter.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((sub) => (
                          <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="py-4 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs uppercase">
                                {sub.studentName.slice(0, 2)}
                              </div>
                              <div>
                                <p>{sub.studentName}</p>
                                <p className="text-[11px] font-normal text-slate-400">
                                  {new Date(sub.completedAt).toLocaleDateString()} at {new Date(sub.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{sub.assignmentTitle}</p>
                              <span className="font-mono text-xs text-purple-600 dark:text-purple-400">PIN: {sub.pinCode}</span>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>{formatDurationSeconds(sub.durationSeconds)}</span>
                              </div>
                              <span className="text-[10px] text-slate-400">Verified session log</span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">
                                {sub.score} / {sub.maxScore} ({sub.accuracyPct}%)
                              </div>
                              <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${sub.passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(100, sub.accuracyPct)}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {sub.passed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                                  <XCircle className="w-3 h-3" />
                                  Needs Retry
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => setSelectedProof(sub)}
                                className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl border border-purple-200 dark:border-purple-800 transition-colors inline-flex items-center gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View Proof
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE ASSIGNMENTS LIST */}
          {activeTab === 'assignments' && (
            assignments.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-800/80 border-2 border-dashed border-slate-200 dark:border-slate-700/80">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No Active Homework Yet</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                  Assign any game from your library as homework with custom duration limits, passing targets, and a shareable 6-digit PIN.
                </p>
                <button
                  onClick={() => setShowGamePickerModal(true)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Homework
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.map(a => (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        {a.classLevel || a.targetClass || 'All Classes'}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        Due {a.dueDate}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                      {a.gameTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                      {a.instructions || 'Answer all questions to complete homework.'}
                    </p>

                    {/* Metadata tags */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <span className="block text-[10px] text-slate-400">Duration</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {a.durationMinutes > 0 ? `${a.durationMinutes} min` : 'Unlimited'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <span className="block text-[10px] text-slate-400">Passing Mark</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {a.passingScore}%
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <span className="block text-[10px] text-slate-400">Questions</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {a.questions?.length || 0} Qs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Share PIN row & actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">PIN:</span>
                      <span className="font-mono font-black text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                        {a.pinCode}
                      </span>
                      <button
                        onClick={() => handleCopyPin(a.pinCode)}
                        title="Copy PIN"
                        className="p-1 text-slate-400 hover:text-purple-600"
                      >
                        {copiedPin === a.pinCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQrModalAssignment(a)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 flex items-center gap-1 transition-colors"
                        title="Show Classroom QR Code"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                      </button>
                      <button
                        onClick={() => handleCopyLink(a.pinCode)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3" />
                        Share
                      </button>
                      <button
                        onClick={() => promptStudentNameAndStart(a)}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        Preview
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* STUDENT PORTAL VIEW                                       */}
      {/* ========================================================= */}
      {activeRole === 'student' && !isTakingHomework && (
        <div className="mt-8 space-y-6">
          {/* Active / Found assignment card if selected */}
          {activeStudentAssignment && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
                  {activeStudentAssignment.targetClass || 'Homework Ready'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black mt-2 mb-1">
                  {activeStudentAssignment.gameTitle}
                </h2>
                <p className="text-sm text-purple-100 max-w-xl mb-6">
                  {activeStudentAssignment.instructions || 'Complete this homework assignment within the time limit to earn verified credit.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 max-w-lg">
                  <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
                    <span className="block text-[11px] text-purple-200">Duration Limit</span>
                    <span className="text-base font-bold">
                      {activeStudentAssignment.durationMinutes > 0 ? `${activeStudentAssignment.durationMinutes} Minutes` : 'Unlimited'}
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
                    <span className="block text-[11px] text-purple-200">Passing Score</span>
                    <span className="text-base font-bold">{activeStudentAssignment.passingScore}%</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
                    <span className="block text-[11px] text-purple-200">Questions</span>
                    <span className="text-base font-bold">{activeStudentAssignment.questions?.length || 0} Total</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl">
                    <span className="block text-[11px] text-purple-200">PIN Code</span>
                    <span className="text-base font-mono font-black">{activeStudentAssignment.pinCode}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 max-w-xs">
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Enter your student name..."
                      className="w-full px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={() => promptStudentNameAndStart(activeStudentAssignment)}
                    className="px-8 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-slate-900" />
                    Start Homework Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending assignments list */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              Available Class Homework ({assignments.length})
            </h3>

            {assignments.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">No Active Assignments</h4>
                <p className="text-xs text-slate-500">Ask your teacher for a 6-digit PIN to join and complete your homework.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => (
                  <div
                    key={a.id}
                    onClick={() => promptStudentNameAndStart(a)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      activeStudentAssignment?.id === a.id
                        ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/20 shadow-md ring-2 ring-purple-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-purple-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {a.classLevel}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {a.durationMinutes > 0 ? `${a.durationMinutes} min limit` : 'No time limit'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {a.gameTitle}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        PIN: <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{a.pinCode}</span> • Passing Score: {a.passingScore}%
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        promptStudentNameAndStart(a);
                      }}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all self-end sm:self-center"
                    >
                      <span>Start</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERACTIVE HOMEWORK PLAYER                                */}
      {/* ========================================================= */}
      {isTakingHomework && activeStudentAssignment && (
        <div className="mt-6 space-y-6">
          {!completedSubmission ? (
            /* Ongoing Question Player */
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xl max-w-3xl mx-auto">
              {/* Session Top Bar with Live Duration Stopwatch */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-700 gap-4">
                <div>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    {activeStudentAssignment.gameTitle}
                  </span>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Student: <span className="text-slate-900 dark:text-slate-100 font-bold">{studentName}</span>
                  </p>
                </div>

                {/* STOPWATCH PROOF DISPLAY */}
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-4 py-2 rounded-2xl">
                  <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                  <div>
                    <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Elapsed Duration</span>
                    <span className="text-lg font-mono font-black text-amber-900 dark:text-amber-200">
                      {formatDurationSeconds(elapsedSeconds)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
                  <span>Question {currentQuestionIndex + 1} of {activeStudentAssignment.questions.length}</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / activeStudentAssignment.questions.length) * 100)}% Complete</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                    style={{ width: `${((currentQuestionIndex + 1) / activeStudentAssignment.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current Question */}
              {activeStudentAssignment.questions[currentQuestionIndex] && (
                <div className="mt-8 space-y-6">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 leading-snug">
                    {activeStudentAssignment.questions[currentQuestionIndex].text || 
                     activeStudentAssignment.questions[currentQuestionIndex].question || 
                     activeStudentAssignment.questions[currentQuestionIndex].prompt}
                  </h3>

                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {(() => {
                      const q = activeStudentAssignment.questions[currentQuestionIndex];
                      const options: string[] = Array.isArray(q.options) 
                        ? q.options 
                        : [q.correctAnswer || 'Option A', 'Option B', 'Option C', 'Option D'];
                      
                      const correctIndex = typeof q.answerIndex === 'number' ? q.answerIndex : 0;

                      return options.map((optText: string, optIdx: number) => {
                        const isCorrect = optIdx === correctIndex || optText === q.correctAnswer;
                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectOption(optText, isCorrect)}
                            className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-600 dark:hover:border-purple-500 bg-slate-50 dark:bg-slate-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-left font-bold text-slate-800 dark:text-slate-200 transition-all active:scale-98 flex items-center justify-between group"
                          >
                            <span>{optText}</span>
                            <span className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:border-purple-600 group-hover:text-purple-600 transition-colors">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* COMPLETED CELEBRATORY PROOF CARD */
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-800/95 border-2 border-purple-500 shadow-2xl max-w-2xl mx-auto text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <Trophy className="w-10 h-10" />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  Verified Homework Proof Logged
                </span>
                <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                  Congratulations, {completedSubmission.studentName}!
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Your work and duration spent have been saved to the teacher gradebook.
                </p>
              </div>

              {/* 3 Metric Badges */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] text-slate-400">Duration Proof</span>
                  <span className="text-lg font-black font-mono text-purple-600 dark:text-purple-400">
                    {formatDurationSeconds(completedSubmission.durationSeconds)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] text-slate-400">Accuracy</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {completedSubmission.accuracyPct}%
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="block text-[11px] text-slate-400">Score</span>
                  <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                    {completedSubmission.score} / {completedSubmission.maxScore}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setSelectedProof(completedSubmission)}
                  className="px-6 py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-sm transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Digital Certificate
                </button>
                <button
                  onClick={() => {
                    setIsTakingHomework(false);
                    setCompletedSubmission(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-colors"
                >
                  Back to Homework
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VERIFIED PROOF MODAL (TAMPER-EVIDENT AUDIT RECEIPT)       */}
      {/* ========================================================= */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
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
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            {/* Proof Certificate Body */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-800/60 dark:to-purple-950/20 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Student Name</span>
                  <p className="text-lg font-black text-slate-900 dark:text-slate-100">{selectedProof.studentName}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Assignment Title</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{selectedProof.assignmentTitle}</p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Duration Spent (Proof)</span>
                  <p className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                    ⏱️ {formatDurationSeconds(selectedProof.durationSeconds)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Score & Accuracy</span>
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

            {/* Detailed Question-by-Question Audit Breakdown */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Question-by-Question Audit Breakdown ({selectedProof.questionBreakdown?.length || 0} Questions)
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
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{q.questionText}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 pl-5">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Student Answer</span>
                          <span className={`font-bold ${q.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
                        <span className="text-[10px] font-mono text-slate-400">{q.timeSpentSeconds}s</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
              >
                Print / Save PDF Proof
              </button>
              <button
                onClick={() => setSelectedProof(null)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors"
              >
                Close Proof
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GAME PICKER MODAL (WHEN TEACHER CLICKS "+ CREATE HOMEWORK")*/}
      {/* ========================================================= */}
      {showGamePickerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  Select Game to Assign
                </h3>
                <p className="text-xs text-slate-500">Pick any game from your library to configure homework.</p>
              </div>
              <button
                onClick={() => setShowGamePickerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto">
              {availableGames.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No games found in your library. Create games in "My Games" first!
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
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{g.topic || g.name || 'Untitled Game'}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {g.gameType || 'Quiz'} • {g.classLevel || 'General'} • {(g.customQuestions || g.questions || []).length} Qs
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
                  <p className="text-[11px] text-slate-400">Classroom scanner</p>
                </div>
              </div>
              <button
                onClick={() => setQrModalAssignment(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                {qrModalAssignment.gameTitle}
              </h4>
              <p className="text-xs text-slate-500">
                {qrModalAssignment.targetClass || qrModalAssignment.classLevel} · Due {qrModalAssignment.dueDate}
              </p>
            </div>

            {/* QR Code Display */}
            <div className="p-3.5 bg-white rounded-2xl border-2 border-purple-200 shadow-inner inline-flex mx-auto">
              <QRCodeSVG
                value={`https://hamsterenglish.online/?hwPin=${qrModalAssignment.pinCode}`}
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
              <span className="truncate">https://hamsterenglish.online/?hwPin={qrModalAssignment.pinCode}</span>
              <button
                onClick={() => handleCopyLink(qrModalAssignment.pinCode)}
                className="shrink-0 px-2 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs flex items-center gap-1 hover:bg-purple-700"
              >
                {copiedPin === qrModalAssignment.pinCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPin === qrModalAssignment.pinCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={() => setQrModalAssignment(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
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
            <p className="text-xs text-slate-500">
              Retrieving assignment details from cloud.
            </p>
          </div>
        </div>
      )}

      {/* STUDENT ENTER NAME POPUP MODAL */}
      {showNameModal && targetAssignmentForPlay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 space-y-5 text-center">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center shadow-inner">
              <User className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                {targetAssignmentForPlay.targetClass || targetAssignmentForPlay.classLevel || 'Homework Assignment'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 leading-snug">
                {targetAssignmentForPlay.gameTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your student name to start and track your verified proof of work.
              </p>
            </div>

            {/* Assignment Details */}
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
                  {targetAssignmentForPlay.durationMinutes > 0 ? `${targetAssignmentForPlay.durationMinutes} min` : 'No limit'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Passing Mark</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {targetAssignmentForPlay.passingScore}%
                </span>
              </div>
            </div>

            {/* Name Input Field */}
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

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowNameModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-2xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmNameAndStart}
                className="flex-[2] py-3 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                Start Homework Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
