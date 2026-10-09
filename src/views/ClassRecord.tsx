import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, Star, X, Check, Search, Trophy, Shuffle, Award, 
  ChevronRight, Trash2, RotateCcw, Download, ArrowLeft, 
  DollarSign, Coins, TrendingUp, Sparkles, UserPlus, Filter,
  CreditCard, Wallet, Edit3, Users, Minus, UserCheck, UserX,
  Cloud, LogIn, CheckCircle2, Bookmark, Gift, UserMinus
} from 'lucide-react';
import { ViewState } from '../types';
import { SquidHamsterSprite } from '../components/SquidHamsterSprite';
import { GOOGLE_DRIVE_STUDENTS, OFFICIAL_CHARACTER_NUMBERS } from '../lib/studentCharacters';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot } from 'firebase/firestore';

// Types
export interface DojoStudent {
  id: string;
  name: string;
  dollars: number;
  number: number; // 1 to 50
}

export interface DeletedStudent extends DojoStudent {
  deletedAt: number;
  classId: string;
  className: string;
}

export interface StudentGroup {
  id: string;
  name: string;
  studentIds: string[];
}

export interface DojoClass {
  id: string;
  name: string;
  icon: string;
  grade: string;
  students: DojoStudent[];
  deletedAt?: number;
  groups?: StudentGroup[];
}

export interface DollarReward {
  id: string;
  label: string;
  amount: number;
  icon: string;
  category?: 'achievement' | 'effort' | 'bonus' | 'penalty' | 'custom';
  isCustom?: boolean;
  userId?: string;
  createdAt?: number;
}

// Preset Dollar Rewards for ESL & Classroom activities
const REWARD_PRESETS: DollarReward[] = [
  { id: 'english', label: 'Speaking English', amount: 2, icon: '🗣️', category: 'achievement' },
  { id: 'on_task', label: 'On Task & Focused', amount: 1, icon: '🎯', category: 'effort' },
  { id: 'homework', label: 'Homework Star', amount: 5, icon: '📚', category: 'achievement' },
  { id: 'participating', label: 'Great Participation', amount: 2, icon: '🤝', category: 'effort' },
  { id: 'creative', label: 'Creative Idea', amount: 3, icon: '💡', category: 'achievement' },
  { id: 'helping', label: 'Helping Others', amount: 2, icon: '🌟', category: 'effort' },
  { id: 'tournament_win', label: 'Game Champion #456', amount: 10, icon: '🏆', category: 'bonus' },
  { id: 'mvp', label: 'Star of the Day', amount: 20, icon: '👑', category: 'bonus' },
];

const PENALTY_PRESETS: DollarReward[] = [
  { id: 'off_task', label: 'Off Task / Distracted', amount: -1, icon: '⚠️', category: 'penalty' },
  { id: 'disrupting', label: 'Talking Out of Turn', amount: -2, icon: '🔇', category: 'penalty' },
  { id: 'unprepared', label: 'Unprepared for Class', amount: -1, icon: '⏰', category: 'penalty' },
];

// Presets for awarding and deducting the entire class
export const WHOLE_CLASS_AWARD_PRESETS = [
  { id: 'english', label: 'Speaking English Only', amount: 2, icon: '🗣️' },
  { id: 'focused', label: '100% Focused & Ready', amount: 2, icon: '🎯' },
  { id: 'teamwork', label: 'Awesome Teamwork', amount: 3, icon: '🤝' },
  { id: 'clean', label: 'Clean Desks & Room', amount: 2, icon: '✨' },
  { id: 'homework', label: 'All Homework Done', amount: 5, icon: '📚' },
  { id: 'champions', label: 'Class Game Champions', amount: 10, icon: '🏆' },
];

export const WHOLE_CLASS_DEDUCTION_PRESETS = [
  { id: 'talking', label: 'Class Talking / Noise', amount: -1, icon: '🔇' },
  { id: 'unfocused', label: 'Distracted / Off Task', amount: -2, icon: '⚠️' },
  { id: 'instructions', label: 'Not Following Directions', amount: -2, icon: '🛑' },
  { id: 'late', label: 'Late Returning to Seats', amount: -1, icon: '⏰' },
  { id: 'messy', label: 'Messy Classroom / Trash', amount: -3, icon: '🧹' },
  { id: 'unfinished', label: 'Incomplete Group Task', amount: -5, icon: '📉' },
];

export const GROUP_AWARD_PRESETS = [
  { id: 'g_teamwork', label: 'Best Collaboration', amount: 3, icon: '🤝' },
  { id: 'g_presentation', label: 'Great Presentation', amount: 5, icon: '🎤' },
  { id: 'g_fast', label: 'First Group Finished', amount: 2, icon: '⚡' },
  { id: 'g_helping', label: 'Helping Each Other', amount: 2, icon: '🌟' },
  { id: 'g_bonus', label: 'Game Winners', amount: 10, icon: '🏆' },
];

export const GROUP_DEDUCT_PRESETS = [
  { id: 'g_talking', label: 'Group Loud / Off Task', amount: -2, icon: '🔇' },
  { id: 'g_dispute', label: 'Not Cooperating', amount: -1, icon: '⚠️' },
  { id: 'g_late', label: 'Group Unprepared', amount: -2, icon: '⏰' },
  { id: 'g_mess', label: 'Messy Table Area', amount: -3, icon: '🧹' },
];

// No preloaded classes or student names - users create and manage their own classes
export const INITIAL_CLASSES: DojoClass[] = [];

export const EMPTY_CLASS: DojoClass = {
  id: '',
  name: 'No Class',
  icon: '🏫',
  grade: 'General',
  students: [],
  groups: []
};

// IDs of legacy preloaded mock classes to strip from storage
export const LEGACY_MOCK_CLASS_IDS = ['class_6a2', 'class_7a1', 'class_8b'];

export const STORAGE_KEY = 'squid_hamster_class_dollars_v13';
export const BIN_STORAGE_KEY = 'squid_hamster_class_bin_v1';
export const BIN_STUDENTS_STORAGE_KEY = 'squid_hamster_student_bin_v1';

export const getSavedClasses = (): DojoClass[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ||
                  localStorage.getItem('squid_hamster_class_dollars_v12') ||
                  localStorage.getItem('squid_hamster_class_dollars_v11') ||
                  localStorage.getItem('squid_hamster_class_dollars_v10') ||
                  localStorage.getItem('squid_hamster_class_dollars_v9') ||
                  localStorage.getItem('squid_hamster_class_dollars_v8');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strip out preloaded mock classes so user only sees their own added classes
        const userClasses = parsed.filter((cls: DojoClass) => !LEGACY_MOCK_CLASS_IDS.includes(cls.id));
        return userClasses;
      }
    }
  } catch (e) {
    console.error('Error loading saved classes', e);
  }
  return [];
};

// Audio Synthesizer for Cash Register / Coin Drop sounds
let sharedAudioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (!sharedAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

const playCashSound = (isPositive = true) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (isPositive) {
      // Energetic Arcade Cha-Ching / Rising Coin Chime
      const notes = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 3 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.3, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.35);
      });
    } else {
      // Descending Penalty / Deduction Buzzer (Two rapid warning thuds)
      [
        { startFreq: 340, endFreq: 140, start: 0, dur: 0.18 },
        { startFreq: 260, endFreq: 90, start: 0.15, dur: 0.25 },
      ].forEach(tone => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(tone.startFreq, now + tone.start);
        osc.frequency.exponentialRampToValueAtTime(tone.endFreq, now + tone.start + tone.dur);
        gain.gain.setValueAtTime(0.28, now + tone.start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + tone.start + tone.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + tone.start);
        osc.stop(now + tone.start + tone.dur);
      });
    }
  } catch (e) {
    // Audio context error ignore
  }
};

export function ClassRecord({ 
  onViewChange, 
  openAuthModal 
}: { 
  onViewChange: (view: ViewState) => void; 
  openAuthModal?: () => void;
}) {
  // User Authentication
  const { user } = useAuth();

  // Custom Rewards State
  const [customRewards, setCustomRewards] = useState<DollarReward[]>(() => {
    try {
      const saved = localStorage.getItem('squid_custom_rewards') || (user?.uid ? localStorage.getItem(`squid_custom_rewards_${user.uid}`) : null);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading custom rewards', e);
    }
    return [];
  });

  const [showManageRewardsModal, setShowManageRewardsModal] = useState(false);
  const [showCreateRewardModal, setShowCreateRewardModal] = useState(false);
  const [showSignInPromptModal, setShowSignInPromptModal] = useState(false);

  // Form states for creating custom reward
  const [rewardFormLabel, setRewardFormLabel] = useState('');
  const [rewardFormAmount, setRewardFormAmount] = useState<number>(5);
  const [rewardFormIcon, setRewardFormIcon] = useState('🌟');
  const [rewardFormType, setRewardFormType] = useState<'award' | 'deduct'>('award');
  const [isSavingReward, setIsSavingReward] = useState(false);

  // Sync custom rewards with Firestore for signed-in user
  useEffect(() => {
    if (!user || user.isAnonymous) {
      try {
        const saved = localStorage.getItem('squid_custom_rewards');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setCustomRewards(parsed);
        }
      } catch (e) {}
      return;
    }

    try {
      const colRef = collection(db, 'users', user.uid, 'customRewards');
      const unsubscribe = onSnapshot(colRef, (snap) => {
        const list: DollarReward[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as any) });
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setCustomRewards(list);
        try {
          localStorage.setItem(`squid_custom_rewards_${user.uid}`, JSON.stringify(list));
        } catch (e) {}
      }, (err) => {
        console.warn('Custom rewards subscription error:', err?.message);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('Error setting up custom rewards listener', err);
    }
  }, [user]);

  // Sync user's classes with Firestore for signed-in user
  useEffect(() => {
    if (!user || user.isAnonymous) return;
    try {
      getDocs(collection(db, 'users', user.uid, 'classes')).then((snap) => {
        if (!snap.empty) {
          const loadedClasses: DojoClass[] = [];
          snap.forEach(d => loadedClasses.push({ id: d.id, ...(d.data() as any) }));
          if (loadedClasses.length > 0) {
            setClasses(loadedClasses);
          }
        }
      }).catch(() => {});
    } catch (e) {}
  }, [user]);

  const handleSaveCustomReward = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rewardFormLabel.trim()) return;

    if (!user || user.isAnonymous) {
      setShowSignInPromptModal(true);
      return;
    }

    setIsSavingReward(true);
    const amountVal = Math.max(1, Math.abs(Number(rewardFormAmount) || 1));
    const finalAmount = rewardFormType === 'deduct' ? -amountVal : amountVal;
    const rewardId = `reward_${Date.now()}`;

    const newReward: DollarReward = {
      id: rewardId,
      label: rewardFormLabel.trim(),
      amount: finalAmount,
      icon: rewardFormIcon || '🌟',
      category: rewardFormType === 'deduct' ? 'penalty' : 'custom',
      isCustom: true,
      userId: user.uid,
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'users', user.uid, 'customRewards', rewardId), newReward);

      const updated = [newReward, ...customRewards.filter(r => r.id !== rewardId)];
      setCustomRewards(updated);
      localStorage.setItem(`squid_custom_rewards_${user.uid}`, JSON.stringify(updated));

      setRecentTransaction({
        text: `Created reward "${newReward.label}" (${newReward.amount > 0 ? '+' : ''}$${newReward.amount})! ✨`,
        amount: newReward.amount,
        time: Date.now()
      });

      setRewardFormLabel('');
      setRewardFormAmount(5);
      setRewardFormIcon('🌟');
      setRewardFormType('award');
      setShowCreateRewardModal(false);
    } catch (err: any) {
      console.error('Error saving custom reward:', err);
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleDeleteCustomReward = async (rewardId: string) => {
    if (!user || user.isAnonymous) {
      const updated = customRewards.filter(r => r.id !== rewardId);
      setCustomRewards(updated);
      localStorage.setItem('squid_custom_rewards', JSON.stringify(updated));
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'customRewards', rewardId));
      const updated = customRewards.filter(r => r.id !== rewardId);
      setCustomRewards(updated);
      localStorage.setItem(`squid_custom_rewards_${user.uid}`, JSON.stringify(updated));
    } catch (err) {
      console.error('Error deleting custom reward:', err);
    }
  };

  // Load saved classes (stripping legacy preloaded mock classes) or fallback to empty
  const [classes, setClasses] = useState<DojoClass[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) ||
                    localStorage.getItem('squid_hamster_class_dollars_v12') ||
                    localStorage.getItem('squid_hamster_class_dollars_v11') ||
                    localStorage.getItem('squid_hamster_class_dollars_v10') ||
                    localStorage.getItem('squid_hamster_class_dollars_v9') ||
                    localStorage.getItem('squid_hamster_class_dollars_v8');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy preloaded mock classes (6A2, 7A1, 8B)
          const userClasses = parsed.filter((cls: DojoClass) => !LEGACY_MOCK_CLASS_IDS.includes(cls.id));
          if (userClasses.length > 0) {
            return userClasses.map((cls: DojoClass) => ({
              ...cls,
              groups: Array.isArray(cls.groups) ? cls.groups : [],
              students: cls.students.map((st: any, idx: number) => ({
                ...st,
                number: st.number && OFFICIAL_CHARACTER_NUMBERS.includes(st.number) 
                  ? st.number 
                  : OFFICIAL_CHARACTER_NUMBERS[idx % OFFICIAL_CHARACTER_NUMBERS.length]
              }))
            }));
          }
        }
      }
    } catch (e) {
      console.error('Error loading classes', e);
    }
    return [];
  });

  const [activeClassId, setActiveClassId] = useState<string>('');
  const [isAllClassesView, setIsAllClassesView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'highest' | 'lowest' | 'name'>('default');

  // Classroom view mode: 'students' (individual characters) or 'groups' (team cards)
  const [classViewMode, setClassViewMode] = useState<'students' | 'groups'>('students');

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<DojoStudent | null>(null);
  
  // Whole Class Award & Deduct modal
  const [isAwardingWholeClass, setIsAwardingWholeClass] = useState(false);
  const [wholeClassMode, setWholeClassMode] = useState<'award' | 'deduct'>('award');
  const [wholeClassAmount, setWholeClassAmount] = useState<number>(2);
  const [wholeClassCustomAmount, setWholeClassCustomAmount] = useState<string>('');
  const [wholeClassReason, setWholeClassReason] = useState<string>('');
  
  const [customDollarAmount, setCustomDollarAmount] = useState<string>('5');
  const [customReason, setCustomReason] = useState<string>('');
  const [showNumberPicker, setShowNumberPicker] = useState(false);

  // Manual Group Modal
  const [showManualGroupModal, setShowManualGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [manualGroupName, setManualGroupName] = useState('');
  const [manualSelectedStudentIds, setManualSelectedStudentIds] = useState<string[]>([]);
  const [manualStudentSearch, setManualStudentSearch] = useState('');

  // Auto / Random Group Modal
  const [showAutoGroupModal, setShowAutoGroupModal] = useState(false);
  const [autoGroupType, setAutoGroupType] = useState<'by_count' | 'by_size'>('by_count');
  const [autoGroupValue, setAutoGroupValue] = useState<number>(3);
  const [autoGroupNaming, setAutoGroupNaming] = useState<'numbers' | 'nato' | 'animals'>('animals');
  const [autoGroupPreview, setAutoGroupPreview] = useState<StudentGroup[] | null>(null);

  // Group Award & Deduct Modal
  const [groupForAward, setGroupForAward] = useState<StudentGroup | null>(null);
  const [groupAwardMode, setGroupAwardMode] = useState<'award' | 'deduct'>('award');
  const [groupAwardAmount, setGroupAwardAmount] = useState<number>(3);
  const [groupAwardCustomAmount, setGroupAwardCustomAmount] = useState<string>('');
  const [groupAwardReason, setGroupAwardReason] = useState<string>('');
  
  // New Class modal
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');
  const [newClassStudentsInput, setNewClassStudentsInput] = useState('');

  // Add Students modal
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [studentNamesInput, setStudentNamesInput] = useState('');

  // Random Student Picker modal
  const [randomStudentModal, setRandomStudentModal] = useState<DojoStudent | null>(null);

  // Recycle Bin states
  const [deletedClasses, setDeletedClasses] = useState<DojoClass[]>(() => {
    try {
      const saved = localStorage.getItem(BIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading deleted classes from bin', e);
    }
    return [];
  });

  const [deletedStudents, setDeletedStudents] = useState<DeletedStudent[]>(() => {
    try {
      const saved = localStorage.getItem(BIN_STUDENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading deleted students from bin', e);
    }
    return [];
  });

  const [binTab, setBinTab] = useState<'classes' | 'students'>('classes');
  const [isBinView, setIsBinView] = useState(false);
  const [classToDelete, setClassToDelete] = useState<DojoClass | null>(null);
  const [permanentDeleteClass, setPermanentDeleteClass] = useState<DojoClass | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<{ student: DojoStudent; classId: string; className: string } | null>(null);
  const [permanentDeleteStudent, setPermanentDeleteStudent] = useState<DeletedStudent | null>(null);
  const [showEmptyBinModal, setShowEmptyBinModal] = useState(false);

  // Remove Students modal states
  const [showRemoveStudentsModal, setShowRemoveStudentsModal] = useState(false);
  const [selectedStudentsToRemove, setSelectedStudentsToRemove] = useState<string[]>([]);
  const [removeStudentSearch, setRemoveStudentSearch] = useState('');

  // Recent dollar transactions toast
  const [recentTransaction, setRecentTransaction] = useState<{
    text: string;
    amount: number;
    time: number;
  } | null>(null);

  // Live effect on character when adding or deducting
  const [liveEffect, setLiveEffect] = useState<{
    studentId: string;
    amount: number;
    key: number;
  } | null>(null);

  // Save changes to localStorage and Firestore
  const saveClasses = (updated: DojoClass[]) => {
    setClasses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (user && !user.isAnonymous) {
        setDoc(doc(db, 'userClassData', user.uid), { classes: updated, updatedAt: Date.now() }, { merge: true }).catch((err) => {
          console.warn('Class sync note:', err?.message);
        });
      }
    } catch (e) {
      console.error('Failed to save classes', e);
    }
  };

  const saveDeletedClasses = (updated: DojoClass[]) => {
    setDeletedClasses(updated);
    try {
      localStorage.setItem(BIN_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save bin to localStorage', e);
    }
  };

  const saveDeletedStudents = (updated: DeletedStudent[]) => {
    setDeletedStudents(updated);
    try {
      localStorage.setItem(BIN_STUDENTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save deleted students to localStorage', e);
    }
  };

  // Move class to Bin
  const handleMoveClassToBin = (cls: DojoClass) => {
    const updatedClasses = classes.filter(c => c.id !== cls.id);
    saveClasses(updatedClasses);

    const updatedBin = [{ ...cls, deletedAt: Date.now() }, ...deletedClasses.filter(c => c.id !== cls.id)];
    saveDeletedClasses(updatedBin);

    if (activeClassId === cls.id) {
      if (updatedClasses.length > 0) {
        setActiveClassId(updatedClasses[0].id);
      } else {
        setIsAllClassesView(true);
      }
    }

    setClassToDelete(null);
    setRecentTransaction({
      text: `Moved "${cls.name}" to Bin 🗑️`,
      amount: 0,
      time: Date.now()
    });
  };

  // Retrieve (Restore) class from Bin
  const handleRetrieveClass = (cls: DojoClass) => {
    const updatedBin = deletedClasses.filter(c => c.id !== cls.id);
    saveDeletedClasses(updatedBin);

    const restored = { ...cls };
    delete restored.deletedAt;

    const exists = classes.some(c => c.id === cls.id);
    const updatedClasses = exists 
      ? classes.map(c => c.id === cls.id ? restored : c)
      : [...classes, restored];

    saveClasses(updatedClasses);
    setActiveClassId(restored.id);
    setIsBinView(false);
    setIsAllClassesView(false);

    setRecentTransaction({
      text: `Retrieved "${cls.name}" from Bin ✨`,
      amount: 0,
      time: Date.now()
    });
  };

  // Permanently delete class from Bin
  const handlePermanentlyDeleteClass = (cls: DojoClass) => {
    const updatedBin = deletedClasses.filter(c => c.id !== cls.id);
    saveDeletedClasses(updatedBin);
    setPermanentDeleteClass(null);

    setRecentTransaction({
      text: `Permanently deleted "${cls.name}"`,
      amount: 0,
      time: Date.now()
    });
  };

  // Move student to Bin (Delete Student Function)
  const handleDeleteStudent = (student: DojoStudent, targetClassId?: string) => {
    const cId = targetClassId || activeClass.id;
    const targetClass = classes.find(c => c.id === cId) || activeClass;

    const updatedClasses = classes.map(c => {
      if (c.id !== cId) return c;
      return {
        ...c,
        students: c.students.filter(s => s.id !== student.id),
        groups: (c.groups || []).map(g => ({
          ...g,
          studentIds: g.studentIds.filter(id => id !== student.id)
        }))
      };
    });
    saveClasses(updatedClasses);

    const newDeletedStudent: DeletedStudent = {
      ...student,
      deletedAt: Date.now(),
      classId: cId,
      className: targetClass.name
    };
    const updatedBin = [newDeletedStudent, ...deletedStudents.filter(s => s.id !== student.id)];
    saveDeletedStudents(updatedBin);

    setStudentToDelete(null);
    if (selectedStudent && selectedStudent.id === student.id) {
      setSelectedStudent(null);
      setShowNumberPicker(false);
    }

    setRecentTransaction({
      text: `Deleted "${student.name}" from ${targetClass.name} 🗑️`,
      amount: 0,
      time: Date.now()
    });
  };

  // Remove multiple selected students to Bin
  const handleRemoveSelectedStudents = () => {
    if (selectedStudentsToRemove.length === 0) return;
    const toRemove = activeClass.students.filter(s => selectedStudentsToRemove.includes(s.id));
    if (toRemove.length === 0) return;

    const cId = activeClass.id;
    const idsSet = new Set(selectedStudentsToRemove);

    const updatedClasses = classes.map(c => {
      if (c.id !== cId) return c;
      return {
        ...c,
        students: c.students.filter(s => !idsSet.has(s.id)),
        groups: (c.groups || []).map(g => ({
          ...g,
          studentIds: g.studentIds.filter(id => !idsSet.has(id))
        }))
      };
    });
    saveClasses(updatedClasses);

    const newBinEntries: DeletedStudent[] = toRemove.map(st => ({
      ...st,
      deletedAt: Date.now(),
      classId: cId,
      className: activeClass.name
    }));
    saveDeletedStudents([...newBinEntries, ...deletedStudents.filter(s => !idsSet.has(s.id))]);

    setSelectedStudentsToRemove([]);
    setShowRemoveStudentsModal(false);
    if (selectedStudent && idsSet.has(selectedStudent.id)) {
      setSelectedStudent(null);
      setShowNumberPicker(false);
    }

    setRecentTransaction({
      text: `Removed ${toRemove.length} student${toRemove.length === 1 ? '' : 's'} from ${activeClass.name} to Bin 🗑️`,
      amount: 0,
      time: Date.now()
    });
  };

  // Retrieve (Restore) student from Bin
  const handleRetrieveStudent = (st: DeletedStudent) => {
    const updatedBin = deletedStudents.filter(s => s.id !== st.id);
    saveDeletedStudents(updatedBin);

    const restoredStudent: DojoStudent = {
      id: st.id,
      name: st.name,
      dollars: st.dollars,
      number: st.number
    };

    const targetClassExists = classes.some(c => c.id === st.classId);
    const destClassId = targetClassExists ? st.classId : (classes[0]?.id || activeClass.id);

    const updatedClasses = classes.map(c => {
      if (c.id !== destClassId) return c;
      const withoutExisting = c.students.filter(s => s.id !== st.id);
      return {
        ...c,
        students: [...withoutExisting, restoredStudent]
      };
    });
    saveClasses(updatedClasses);

    setRecentTransaction({
      text: `Retrieved "${st.name}" back to class ✨`,
      amount: 0,
      time: Date.now()
    });
  };

  // Permanently delete student from Bin
  const handlePermanentlyDeleteStudent = (st: DeletedStudent) => {
    const updatedBin = deletedStudents.filter(s => s.id !== st.id);
    saveDeletedStudents(updatedBin);
    setPermanentDeleteStudent(null);

    setRecentTransaction({
      text: `Permanently deleted "${st.name}"`,
      amount: 0,
      time: Date.now()
    });
  };

  // Empty Entire Bin
  const handleEmptyBin = () => {
    saveDeletedClasses([]);
    saveDeletedStudents([]);
    setShowEmptyBinModal(false);
    setRecentTransaction({
      text: 'Recycle Bin emptied completely',
      amount: 0,
      time: Date.now()
    });
  };

  const activeClass = useMemo(() => {
    return classes.find(c => c.id === activeClassId) || classes[0] || EMPTY_CLASS;
  }, [classes, activeClassId]);

  // Total Class Vault Dollars
  const totalClassDollars = useMemo(() => {
    return (activeClass?.students || []).reduce((sum, s) => sum + s.dollars, 0);
  }, [activeClass]);

  // Filter & sort students
  const displayedStudents = useMemo(() => {
    let list = [...(activeClass?.students || [])];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        String(s.number).includes(q) ||
        `#${s.number}`.includes(q)
      );
    }

    if (sortBy === 'highest') {
      list.sort((a, b) => b.dollars - a.dollars);
    } else if (sortBy === 'lowest') {
      list.sort((a, b) => a.dollars - b.dollars);
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [activeClass, searchQuery, sortBy]);

  // Award Dollars to Single Student
  const handleAwardStudent = (studentId: string, amount: number, reason: string) => {
    playCashSound(amount > 0);

    // Trigger live visual pop-up on character
    setLiveEffect({
      studentId,
      amount,
      key: Date.now()
    });

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        students: c.students.map(s => {
          if (s.id === studentId) {
            const newBal = s.dollars + amount;
            return { ...s, dollars: newBal };
          }
          return s;
        })
      };
    });

    const targetStudent = activeClass.students.find(s => s.id === studentId);
    if (targetStudent) {
      setRecentTransaction({
        text: `${targetStudent.name} (${amount >= 0 ? `+$${amount}` : `-$${Math.abs(amount)}`}) for "${reason}"`,
        amount,
        time: Date.now()
      });
      setTimeout(() => setRecentTransaction(null), 3000);
    }

    saveClasses(updated);

    // Keep modal open and update balance live
    setSelectedStudent(prev => {
      if (!prev || prev.id !== studentId) return prev;
      return { ...prev, dollars: prev.dollars + amount };
    });
  };

  // Change Student Number (1 to 50)
  const handleChangeStudentNumber = (studentId: string, newNumber: number) => {
    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        students: c.students.map(s => {
          if (s.id === studentId) {
            return { ...s, number: newNumber };
          }
          return s;
        })
      };
    });
    saveClasses(updated);
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent({ ...selectedStudent, number: newNumber });
    }
    setShowNumberPicker(false);
  };

  // Award or Deduct Dollars to Entire Class
  const handleAwardClass = (amount: number, reason: string) => {
    playCashSound(amount > 0);

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        students: c.students.map(s => ({
          ...s,
          dollars: s.dollars + amount
        }))
      };
    });

    if (activeClass.students.length > 0) {
      setLiveEffect({
        studentId: activeClass.students[0].id,
        amount,
        key: Date.now()
      });
    }

    setRecentTransaction({
      text: `Entire class ${amount >= 0 ? `awarded +$${amount}` : `deducted -$${Math.abs(amount)}`} each! (${reason})`,
      amount,
      time: Date.now()
    });
    setTimeout(() => setRecentTransaction(null), 3500);

    saveClasses(updated);
    setIsAwardingWholeClass(false);
  };

  // Generate random groups helper
  const generateRandomGroupList = (
    students: DojoStudent[],
    type: 'by_count' | 'by_size',
    val: number,
    naming: 'numbers' | 'nato' | 'animals'
  ): StudentGroup[] => {
    if (students.length === 0) return [];
    const shuffled = [...students];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let numGroups = 1;
    if (type === 'by_count') {
      numGroups = Math.max(1, Math.min(val, students.length));
    } else {
      const size = Math.max(1, val);
      numGroups = Math.max(1, Math.ceil(students.length / size));
    }

    const namePools = {
      numbers: Array.from({ length: 25 }, (_, i) => `Group ${i + 1}`),
      nato: ['Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Delta', 'Team Echo', 'Team Foxtrot', 'Team Golf', 'Team Hotel', 'Team India', 'Team Juliet', 'Team Kilo', 'Team Lima'],
      animals: ['Team Tigers', 'Team Lions', 'Team Eagles', 'Team Dragons', 'Team Falcons', 'Team Wolves', 'Team Bears', 'Team Sharks', 'Team Panthers', 'Team Hawks', 'Team Foxes', 'Team Cobras']
    };
    const pool = namePools[naming] || namePools.animals;

    const grps: StudentGroup[] = Array.from({ length: numGroups }, (_, i) => ({
      id: `grp_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
      name: pool[i] || `Group ${i + 1}`,
      studentIds: []
    }));

    shuffled.forEach((student, index) => {
      const groupIdx = index % numGroups;
      grps[groupIdx].studentIds.push(student.id);
    });

    return grps;
  };

  // Open auto group modal and initialize preview
  const handleOpenAutoGroup = () => {
    const preview = generateRandomGroupList(activeClass.students, autoGroupType, autoGroupValue, autoGroupNaming);
    setAutoGroupPreview(preview);
    setShowAutoGroupModal(true);
  };

  // Re-shuffle preview
  const handleReshufflePreview = (type = autoGroupType, val = autoGroupValue, naming = autoGroupNaming) => {
    const preview = generateRandomGroupList(activeClass.students, type, val, naming);
    setAutoGroupPreview(preview);
  };

  // Apply auto groups
  const handleApplyAutoGroups = () => {
    if (!autoGroupPreview || autoGroupPreview.length === 0) return;
    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        groups: autoGroupPreview
      };
    });
    saveClasses(updated);
    setShowAutoGroupModal(false);
    setClassViewMode('groups');
    playCashSound(true);
    setRecentTransaction({
      text: `Created ${autoGroupPreview.length} random student groups! 🎲`,
      amount: 0,
      time: Date.now()
    });
  };

  // Quick 1-click random grouping right inside the groups view
  const handleQuickRandomGroup = () => {
    if (activeClass.students.length === 0) return;
    const count = Math.max(2, Math.min(4, Math.ceil(activeClass.students.length / 4)));
    const grps = generateRandomGroupList(activeClass.students, 'by_count', count, 'animals');
    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return { ...c, groups: grps };
    });
    saveClasses(updated);
    setClassViewMode('groups');
    playCashSound(true);
    setRecentTransaction({
      text: `Generated ${grps.length} random groups! 🎲`,
      amount: 0,
      time: Date.now()
    });
  };

  // Open manual group modal
  const handleOpenManualGroupModal = (groupToEdit?: StudentGroup) => {
    if (groupToEdit) {
      setEditingGroupId(groupToEdit.id);
      setManualGroupName(groupToEdit.name);
      setManualSelectedStudentIds([...groupToEdit.studentIds]);
    } else {
      setEditingGroupId(null);
      const nextNum = (activeClass.groups?.length || 0) + 1;
      setManualGroupName(`Group ${nextNum}`);
      setManualSelectedStudentIds([]);
    }
    setManualStudentSearch('');
    setShowManualGroupModal(true);
  };

  // Save manual group
  const handleSaveManualGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualGroupName.trim()) return;

    const currentGroups = activeClass.groups || [];
    let updatedGroups: StudentGroup[];

    if (editingGroupId) {
      updatedGroups = currentGroups.map(g => {
        if (g.id === editingGroupId) {
          return {
            ...g,
            name: manualGroupName.trim(),
            studentIds: manualSelectedStudentIds
          };
        }
        return g;
      });
    } else {
      const newGroup: StudentGroup = {
        id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: manualGroupName.trim(),
        studentIds: manualSelectedStudentIds
      };
      updatedGroups = [...currentGroups, newGroup];
    }

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        groups: updatedGroups
      };
    });

    saveClasses(updated);
    setShowManualGroupModal(false);
    setClassViewMode('groups');
    setRecentTransaction({
      text: `Saved group "${manualGroupName.trim()}" (${manualSelectedStudentIds.length} students) ✨`,
      amount: 0,
      time: Date.now()
    });
  };

  // Delete a group
  const handleDeleteGroup = (groupId: string) => {
    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        groups: (c.groups || []).filter(g => g.id !== groupId)
      };
    });
    saveClasses(updated);
    setRecentTransaction({
      text: `Group deleted`,
      amount: 0,
      time: Date.now()
    });
  };

  // Shuffle existing groups members
  const handleShuffleExistingGroups = () => {
    const groups = activeClass.groups || [];
    if (groups.length === 0 || activeClass.students.length === 0) return;

    const shuffledStudents = [...activeClass.students];
    for (let i = shuffledStudents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledStudents[i], shuffledStudents[j]] = [shuffledStudents[j], shuffledStudents[i]];
    }

    const newGroups = groups.map(g => ({ ...g, studentIds: [] as string[] }));
    shuffledStudents.forEach((student, index) => {
      const gIdx = index % newGroups.length;
      newGroups[gIdx].studentIds.push(student.id);
    });

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return { ...c, groups: newGroups };
    });
    saveClasses(updated);
    playCashSound(true);
    setRecentTransaction({
      text: `Shuffled students across all ${newGroups.length} groups! 🎲`,
      amount: 0,
      time: Date.now()
    });
  };

  // Award or Deduct Group
  const handleAwardGroup = (groupId: string, amount: number, reason: string) => {
    const grp = (activeClass.groups || []).find(g => g.id === groupId);
    if (!grp) return;

    playCashSound(amount > 0);

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return {
        ...c,
        students: c.students.map(s => {
          if (grp.studentIds.includes(s.id)) {
            return {
              ...s,
              dollars: s.dollars + amount
            };
          }
          return s;
        })
      };
    });

    saveClasses(updated);

    if (grp.studentIds.length > 0) {
      setLiveEffect({
        studentId: grp.studentIds[0],
        amount,
        key: Date.now()
      });
    }

    setRecentTransaction({
      text: `Team "${grp.name}" (${grp.studentIds.length} students) ${amount >= 0 ? `+$${amount}` : `-$${Math.abs(amount)}`} each! (${reason})`,
      amount,
      time: Date.now()
    });
    setTimeout(() => setRecentTransaction(null), 3500);

    setGroupForAward(null);
  };

  // Create new class
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    // Parse student names if typed or copy-pasted
    const parsedNames = newClassStudentsInput
      .split(/[\n,]/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    let initialStudents: DojoStudent[] = [];
    if (parsedNames.length > 0) {
      initialStudents = parsedNames.map((name, index) => ({
        id: `st_${Date.now()}_${index}`,
        name,
        dollars: 0,
        number: OFFICIAL_CHARACTER_NUMBERS[index % OFFICIAL_CHARACTER_NUMBERS.length]
      }));
    } else {
      initialStudents = [];
    }

    const newId = `class_${Date.now()}`;
    const newClass: DojoClass = {
      id: newId,
      name: newClassName.trim(),
      icon: '🌐',
      grade: newClassGrade.trim() || 'General',
      students: initialStudents
    };

    saveClasses([...classes, newClass]);
    setActiveClassId(newId);
    setShowNewClassModal(false);
    setNewClassName('');
    setNewClassGrade('');
    setNewClassStudentsInput('');
    setIsAllClassesView(false);
    setIsBinView(false);
  };

  // Add students with sequential numbers #1 to #50
  const handleAddStudents = (e: React.FormEvent) => {
    e.preventDefault();
    const names = studentNamesInput
      .split(/[\n,]/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    if (names.length === 0) return;

    // Find used numbers in active class
    const usedNumbers = new Set(activeClass.students.map(s => s.number));

    const newStudents: DojoStudent[] = names.map((name, index) => {
      // Find lowest available number from official characters [1, 2, 3, 4, 5, 6, 7, 8, 10]
      let assignedNum = OFFICIAL_CHARACTER_NUMBERS[0];
      const availableUnused = OFFICIAL_CHARACTER_NUMBERS.find(n => !usedNumbers.has(n));
      if (availableUnused !== undefined) {
        assignedNum = availableUnused;
        usedNumbers.add(assignedNum);
      } else {
        // Wrap around official characters
        assignedNum = OFFICIAL_CHARACTER_NUMBERS[(activeClass.students.length + index) % OFFICIAL_CHARACTER_NUMBERS.length];
      }

      return {
        id: `st_${Date.now()}_${index}`,
        name,
        dollars: 0,
        number: assignedNum
      };
    });

    const updated = classes.map(c => {
      if (c.id !== activeClass.id) return c;
      return { ...c, students: [...c.students, ...newStudents] };
    });

    saveClasses(updated);
    setStudentNamesInput('');
    setShowAddStudentsModal(false);
  };

  // Pick random student
  const handlePickRandomStudent = () => {
    if (activeClass.students.length === 0) return;
    const randomIndex = Math.floor(Math.random() * activeClass.students.length);
    setRandomStudentModal(activeClass.students[randomIndex]);
  };

  // Export Class Roster CSV
  const handleExportCSV = () => {
    const header = 'Number,Name,Dollars,Grade\n';
    const rows = activeClass.students
      .map(s => `"#${s.number}","${s.name}",$${s.dollars},"${activeClass.grade}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeClass.name}_Squid_Dollars_Record.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full w-full bg-[#f8fafc] select-none overflow-hidden font-sans text-slate-900 rounded-3xl border border-slate-200/90 shadow-xl relative">
      {/* ============================================================ */}
      {/* IMMERSIVE SIDEBAR: CLASSES ONLY (CLEAN & MINIMALIST) */}
      {/* ============================================================ */}
      <aside className="w-56 sm:w-60 bg-white border-r border-slate-200/80 h-full flex flex-col shrink-0 select-none">
        
        {/* SIDEBAR HEADER */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setIsAllClassesView(false); setIsBinView(false); }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#04422e] to-[#0d6e4f] text-emerald-300 flex items-center justify-center shadow-md shadow-emerald-950/20 border border-emerald-600/40">
              <DollarSign size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-sm sm:text-base leading-tight tracking-tight">Class Rewards</h1>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Economy & Rewards</span>
            </div>
          </div>
        </div>

        {/* YOUR CLASSES NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          <div className="px-3 py-1 flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Your Classes</span>
          </div>

          {/* ALL CLASSES BUTTON */}
          <button
            onClick={() => { setIsAllClassesView(true); setIsBinView(false); }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              isAllClassesView && !isBinView
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="bg-current rounded-xs"></div>
              <div className="bg-current rounded-xs"></div>
              <div className="bg-current rounded-xs"></div>
              <div className="bg-current rounded-xs"></div>
            </div>
            <span>All classes</span>
          </button>

          {/* NEW CLASS BUTTON */}
          <button
            onClick={() => setShowNewClassModal(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 transition-colors cursor-pointer border border-emerald-200/60"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Plus size={14} className="stroke-[3]" />
            </div>
            <span>New Class</span>
          </button>

          {/* MY CLASS REWARDS BUTTON */}
          <button
            onClick={() => setShowManageRewardsModal(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-purple-700 bg-purple-50 hover:bg-purple-100/80 transition-colors cursor-pointer border border-purple-200/60"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Sparkles size={12} />
              </div>
              <span className="truncate">Class Rewards</span>
            </div>
            {customRewards.length > 0 && (
              <span className="text-[10px] bg-purple-200 text-purple-900 font-black px-1.5 py-0.2 rounded-full">
                {customRewards.length}
              </span>
            )}
          </button>

          {/* LIST OF CLASSES */}
          <div className="pt-2 space-y-1">
            {classes.length === 0 ? (
              <div className="p-3 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                <p className="text-[11px] font-semibold text-slate-400 mb-2">No classes yet</p>
                <button
                  type="button"
                  onClick={() => setShowNewClassModal(true)}
                  className="w-full py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>+ Add Class</span>
                </button>
              </div>
            ) : (
              classes.map(cls => {
              const isSelected = !isAllClassesView && !isBinView && cls.id === activeClass.id;
              const totalClassBal = cls.students.reduce((sum, s) => sum + s.dollars, 0);

              return (
                <div
                  key={cls.id}
                  onClick={() => {
                    setActiveClassId(cls.id);
                    setIsAllClassesView(false);
                    setIsBinView(false);
                  }}
                  className={`group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{cls.icon}</span>
                    <span className="truncate">{cls.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : totalClassBal < 0 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-slate-100 text-emerald-700'
                    }`}>
                      {totalClassBal < 0 ? `-$${Math.abs(totalClassBal)}` : `$${totalClassBal}`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassToDelete(cls);
                      }}
                      className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                        isSelected 
                          ? 'hover:bg-white/20 text-white/90 hover:text-white' 
                          : 'hover:bg-rose-100 text-slate-400 hover:text-rose-600'
                      }`}
                      title={`Move ${cls.name} to Bin`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            }))}
          </div>

          {/* BIN BUTTON (UNDER GFDG / CLASSES LIST) */}
          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsBinView(true);
                setIsAllClassesView(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isBinView 
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20' 
                  : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trash2 size={16} className={isBinView ? 'text-white' : 'text-slate-400'} />
                <span>Bin</span>
              </div>
              {(deletedClasses.length + deletedStudents.length) > 0 && (
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 font-mono ${
                  isBinView ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {deletedClasses.length + deletedStudents.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* BOTTOM: RETURN TO GAMES */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <button 
            onClick={() => onViewChange('home')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft size={16} className="text-slate-400" />
              <span>Back to Games</span>
            </div>
            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-mono">ESC</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN VAULT CLASSROOM VIEW */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-white">
        
        {isBinView ? (
          /* ============================================================ */
          /* BIN / RECYCLE BIN VIEW */
          /* ============================================================ */
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl shadow-xs">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                    <span>Recycle Bin</span>
                    <span className="text-xs font-black px-2.5 py-0.5 bg-rose-100 text-rose-700 rounded-full">
                      {deletedClasses.length} {deletedClasses.length === 1 ? 'class' : 'classes'} • {deletedStudents.length} {deletedStudents.length === 1 ? 'student' : 'students'}
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Classes and students moved to the bin can be retrieved back to your roster or deleted permanently.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {(deletedClasses.length + deletedStudents.length) > 0 && (
                  <button
                    onClick={() => setShowEmptyBinModal(true)}
                    className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Empty Bin</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsBinView(false);
                    if (classes.length === 0) setIsAllClassesView(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>Back to Classes</span>
                </button>
              </div>
            </div>

            {/* BIN TABS: CLASSES vs STUDENTS */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-200/80 pb-3">
              <button
                type="button"
                onClick={() => setBinTab('classes')}
                className={`px-4 py-2 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  binTab === 'classes'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Classes</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  binTab === 'classes' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {deletedClasses.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBinTab('students')}
                className={`px-4 py-2 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  binTab === 'students'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Deleted Students</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  binTab === 'students' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {deletedStudents.length}
                </span>
              </button>
            </div>

            {binTab === 'classes' ? (
              /* DELETED CLASSES TAB */
              deletedClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                  <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4 shadow-inner">
                    <Trash2 size={36} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1">No deleted classes in bin</h3>
                  <p className="text-xs font-medium text-slate-400 mb-6">
                    When you delete a class, it will be placed here so you can safely retrieve it or delete it permanently.
                  </p>
                  <button
                    onClick={() => {
                      setIsBinView(false);
                      if (classes.length === 0) setIsAllClassesView(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Return to Classes
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {deletedClasses.map(c => {
                    const totalDollars = c.students.reduce((sum, s) => sum + s.dollars, 0);
                    const dateStr = c.deletedAt 
                      ? new Date(c.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                      : 'Recently';

                    return (
                      <div
                        key={c.id}
                        className="p-6 rounded-3xl border-2 border-slate-200/80 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        <div>
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-center text-3xl">
                              {c.icon}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 flex items-center gap-1 border border-slate-200">
                                <DollarSign size={13} className="stroke-[3]" />
                                <span>${totalDollars}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {dateStr}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-xl font-black text-slate-900">{c.name}</h3>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            {c.grade} • {c.students.length} Students
                          </p>

                          {/* Student avatar previews */}
                          <div className="mt-4 flex -space-x-2 overflow-hidden">
                            {c.students.slice(0, 5).map(s => (
                              <div key={s.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden flex items-center justify-center">
                                <SquidHamsterSprite number={s.number} size={30} showBadge={false} />
                              </div>
                            ))}
                            {c.students.length > 5 && (
                              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 text-slate-600 text-[10px] font-black flex items-center justify-center">
                                +{c.students.length - 5}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ACTION BUTTONS: RETRIEVE & DELETE PERMANENTLY */}
                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2.5">
                          <button
                            onClick={() => handleRetrieveClass(c)}
                            className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Restore this class to your active classes"
                          >
                            <RotateCcw size={14} />
                            <span>Retrieve</span>
                          </button>
                          <button
                            onClick={() => setPermanentDeleteClass(c)}
                            className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Delete permanently from storage"
                          >
                            <Trash2 size={14} />
                            <span>Delete Permanently</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* DELETED STUDENTS TAB */
              deletedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
                  <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4 shadow-inner">
                    <UserX size={36} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 mb-1">No deleted students in bin</h3>
                  <p className="text-xs font-medium text-slate-400 mb-6">
                    When you delete a student from your class roster, they are safely placed here so you can retrieve them or delete them permanently.
                  </p>
                  <button
                    onClick={() => {
                      setIsBinView(false);
                      if (classes.length === 0) setIsAllClassesView(true);
                    }}
                    className="px-5 py-2.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Return to Classroom
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {deletedStudents.map(st => {
                    const dateStr = st.deletedAt 
                      ? new Date(st.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                      : 'Recently';

                    return (
                      <div
                        key={st.id}
                        className="p-5 rounded-3xl border-2 border-slate-200/80 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                      >
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <SquidHamsterSprite number={st.number} size={54} showBadge={false} />
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                st.dollars < 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              }`}>
                                {st.dollars < 0 ? `-$${Math.abs(st.dollars)}` : `$${st.dollars}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {dateStr}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-base font-black text-slate-900 leading-snug break-words">
                            {st.name}
                          </h3>
                          <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">
                              {st.className || 'Class'}
                            </span>
                            <span>• #{String(st.number).padStart(3, '0')}</span>
                          </p>
                        </div>

                        {/* ACTION BUTTONS: RETRIEVE & DELETE PERMANENTLY */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => handleRetrieveStudent(st)}
                            className="flex-1 py-2 px-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            title="Restore student to class roster"
                          >
                            <RotateCcw size={13} />
                            <span>Retrieve</span>
                          </button>
                          <button
                            onClick={() => setPermanentDeleteStudent(st)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete permanently from storage"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        ) : classes.length === 0 ? (
          /* ============================================================ */
          /* NO CLASSES ONBOARDING VIEW */
          /* ============================================================ */
          <div className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center justify-center">
            <div className="w-full max-w-lg text-center p-8 sm:p-10 bg-slate-50/80 rounded-3xl border-2 border-dashed border-slate-200 shadow-xs">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto mb-5 text-4xl shadow-xs">
                🏫
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">No Classes Added Yet</h3>
              <p className="text-sm font-medium text-slate-500 mb-6 leading-relaxed">
                Add your own classes to begin tracking classroom dollars, awarding points, and launching Squid mini-games with your students.
              </p>
              <button
                type="button"
                onClick={() => setShowNewClassModal(true)}
                className="w-full py-4 px-6 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:scale-102 active:scale-98"
              >
                <Plus size={20} className="stroke-[3]" />
                <span>Add Your First Class</span>
              </button>
            </div>
          </div>
        ) : isAllClassesView ? (
          /* ALL CLASSES GRID VIEW */
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                  <span>Class Vaults</span>
                  <span className="text-xs font-black px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                    {classes.length} Classes
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Select a class to give dollars and manage student accounts.</p>
              </div>
              <button
                onClick={() => setShowNewClassModal(true)}
                className="px-5 py-2.5 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer hover:scale-105 active:scale-95 text-xs sm:text-sm"
              >
                <Plus size={18} />
                <span>New Class</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map(c => {
                const totalDollars = c.students.reduce((sum, s) => sum + s.dollars, 0);
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setActiveClassId(c.id);
                      setIsAllClassesView(false);
                      setIsBinView(false);
                    }}
                    className="p-6 rounded-3xl border-2 border-slate-200/80 hover:border-emerald-500 bg-[#fbfdfc] hover:bg-white transition-all shadow-sm hover:shadow-xl cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-100 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                          {c.icon}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 border ${
                            totalDollars < 0 
                              ? 'bg-rose-100 text-rose-800 border-rose-300' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}>
                            <DollarSign size={14} className="stroke-[3]" />
                            <span>{totalDollars < 0 ? `-$${Math.abs(totalDollars)}` : `$${totalDollars}`}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClassToDelete(c);
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={`Move ${c.name} to Bin`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">{c.name}</h3>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">{c.grade} • {c.students.length} Students</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex -space-x-2 overflow-hidden">
                        {c.students.slice(0, 4).map(s => (
                          <div key={s.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden flex items-center justify-center">
                            <SquidHamsterSprite number={s.number} size={30} showBadge={false} />
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Open Vault <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* IMMERSIVE CLASSROOM VAULT VIEW */
          /* ============================================================ */
          <>
            {/* CLEAN IMMERSIVE HEADER: CLASS NAME + PIGGY VAULT BALANCE + ACTIONS */}
            <header className="border-b border-slate-200/80 px-4 sm:px-6 py-4 shrink-0 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* CLASS NAME & GRADE (REDUNDANT STUDENT COUNT REMOVED) */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-3xl shadow-xs">
                    {activeClass.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {activeClass.name}
                    </h2>
                    <p className="text-xs font-semibold text-slate-400">
                      {activeClass.grade} • Classroom Economy
                    </p>
                  </div>
                </div>

                {/* SQUID GAME CLASS VAULT DISPLAY & CONTROLS - VAULT DESIGNED TOP RIBBON */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  
                  {/* TOP RIBBON VIEW SELECTOR: STUDENTS (CLASS VAULT DESIGN) */}
                  <button
                    type="button"
                    onClick={() => setClassViewMode('students')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all cursor-pointer border ${
                      classViewMode === 'students'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/25 border-emerald-400/40 scale-102'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-xs'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                      classViewMode === 'students' ? 'bg-white/20 text-white' : 'bg-slate-100 text-emerald-600'
                    }`}>
                      <Users size={16} />
                    </div>
                    <div className="text-left">
                      <p className={`text-[10px] font-black uppercase tracking-wider leading-tight ${
                        classViewMode === 'students' ? 'text-emerald-100' : 'text-slate-400'
                      }`}>VIEW</p>
                      <p className="text-xs sm:text-sm font-black tracking-tight leading-tight">Students</p>
                    </div>
                  </button>

                  {/* TOP RIBBON VIEW SELECTOR: GROUPS (CLASS VAULT DESIGN) */}
                  <button
                    type="button"
                    onClick={() => setClassViewMode('groups')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all cursor-pointer border ${
                      classViewMode === 'groups'
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-md shadow-purple-600/25 border-purple-400/40 scale-102'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-xs'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                      classViewMode === 'groups' ? 'bg-white/20 text-amber-300' : 'bg-slate-100 text-purple-600'
                    }`}>
                      <Sparkles size={16} />
                    </div>
                    <div className="text-left">
                      <p className={`text-[10px] font-black uppercase tracking-wider leading-tight ${
                        classViewMode === 'groups' ? 'text-purple-100' : 'text-slate-400'
                      }`}>VIEW</p>
                      <p className="text-xs sm:text-sm font-black tracking-tight leading-tight flex items-center gap-1.5">
                        <span>Groups</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                          classViewMode === 'groups' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {activeClass.groups?.length || 0}
                        </span>
                      </p>
                    </div>
                  </button>

                  {/* Total Class Prize Vault */}
                  <div 
                    onClick={() => {
                      setWholeClassMode('award');
                      setIsAwardingWholeClass(true);
                    }}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-white shadow-md cursor-pointer hover:scale-102 active:scale-98 transition-all ${
                      totalClassDollars < 0 
                        ? 'bg-gradient-to-r from-rose-600 to-pink-700 shadow-rose-600/20' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-600/20'
                    }`}
                    title="Click to award or deduct dollars from the entire class"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black">
                      {totalClassDollars < 0 ? '⚠️' : '💰'}
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-wider leading-tight ${
                        totalClassDollars < 0 ? 'text-rose-100' : 'text-emerald-100'
                      }`}>Class Vault</p>
                      <p className="text-base sm:text-lg font-black tracking-tight leading-tight">
                        {totalClassDollars < 0 ? `-$${Math.abs(totalClassDollars)}` : `$${totalClassDollars}`}
                      </p>
                    </div>
                  </div>

                  {/* Give All Button (Class Vault Design) */}
                  <button
                    onClick={() => {
                      setWholeClassMode('award');
                      setIsAwardingWholeClass(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 hover:scale-102 active:scale-98 transition-all cursor-pointer border border-emerald-400/30"
                    title="Award or deduct dollars from the entire class"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black">
                      <DollarSign size={16} className="stroke-[3]" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100 leading-tight">ACTION</p>
                      <p className="text-xs sm:text-sm font-black tracking-tight leading-tight">Give All</p>
                    </div>
                  </button>

                  {/* Random Student Picker (Class Vault Design) */}
                  <button
                    onClick={handlePickRandomStudent}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/20 hover:scale-102 active:scale-98 transition-all cursor-pointer border border-purple-400/30"
                    title="Select a random student to answer or win"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black">
                      <Shuffle size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider text-purple-100 leading-tight">PICKER</p>
                      <p className="text-xs sm:text-sm font-black tracking-tight leading-tight">Random</p>
                    </div>
                  </button>

                  {/* Add Students Button (MADE BIGGER & VAULT DESIGN!) */}
                  <button
                    onClick={() => setShowAddStudentsModal(true)}
                    className="flex items-center gap-2.5 px-4.5 py-2 sm:px-5 sm:py-2.5 rounded-2xl text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-emerald-300/40"
                    title="Add students to class"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center font-black shadow-inner">
                      <UserPlus size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100 leading-tight">ROSTER</p>
                      <p className="text-sm sm:text-base font-black tracking-tight leading-tight">+ Add Student</p>
                    </div>
                  </button>

                  {/* Remove Students Button (REPLACED CLASS REWARDS) */}
                  <button
                    onClick={() => {
                      setSelectedStudentsToRemove([]);
                      setRemoveStudentSearch('');
                      setShowRemoveStudentsModal(true);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-2xl text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 shadow-md shadow-rose-600/25 hover:scale-102 active:scale-98 transition-all cursor-pointer border border-rose-400/30"
                    title="Remove students from this class"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black">
                      <UserMinus size={16} className="stroke-[2.5]" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider text-rose-100 leading-tight">ROSTER</p>
                      <p className="text-xs sm:text-sm font-black tracking-tight leading-tight">Remove Students</p>
                    </div>
                  </button>

                  {/* Export CSV */}
                  <button
                    onClick={handleExportCSV}
                    className="p-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/60"
                    title="Export Class Dollar Ledger to CSV"
                  >
                    <Download size={16} />
                  </button>

                  {/* Delete Class Button */}
                  <button
                    onClick={() => setClassToDelete(activeClass)}
                    className="p-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer border border-slate-200/60 hover:border-rose-200"
                    title={`Move ${activeClass.name} to Bin`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* SEARCH & SORT FILTER BAR */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or number #1 - 50..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* SORT PILLS */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                    <Filter size={12} /> Sort:
                  </span>
                  <button
                    onClick={() => setSortBy('default')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      sortBy === 'default' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    #1-50
                  </button>
                  <button
                    onClick={() => setSortBy('highest')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                      sortBy === 'highest' ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    <span>Top $</span>
                    <TrendingUp size={12} />
                  </button>
                  <button
                    onClick={() => setSortBy('name')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      sortBy === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    Name
                  </button>
                </div>
              </div>
            </header>

            {/* SQUID GAME HAMSTER CLASSROOM CONTENT: STUDENTS vs GROUPS */}
            {classViewMode === 'groups' ? (
              /* ============================================================ */
              /* STUDENT GROUPS / TEAMS VIEW */
              /* ============================================================ */
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                {/* RECENT TRANSACTION TOAST NOTIFICATION */}
                {recentTransaction && (
                  <div className="mb-6 p-3.5 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-lg shadow-emerald-600/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
                      <Sparkles size={18} className="text-amber-300 animate-spin" />
                      <span>{recentTransaction.text}</span>
                    </div>
                    <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                      {recentTransaction.amount >= 0 ? `+$${recentTransaction.amount}` : `-$${Math.abs(recentTransaction.amount)}`}
                    </span>
                  </div>
                )}

                {/* GROUPS TOOLBAR WITH AUTO GROUP & RANDOM GROUP INSIDE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2.5">
                      <span>Student Groups & Teams</span>
                      <span className="text-xs font-black px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                        {activeClass.groups?.length || 0} Groups
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Award or deduct dollars by group, organize tables, or auto-divide students randomly.
                    </p>
                  </div>

                  {/* AUTO & RANDOM GROUP BUTTONS INSIDE THE GROUP VIEW */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleOpenAutoGroup}
                      className="px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-purple-400/30"
                      title="Open Auto Group builder to set team sizes and names"
                    >
                      <Shuffle size={16} />
                      <span>Auto Group</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickRandomGroup}
                      className="px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-purple-50 hover:bg-purple-100 text-purple-800 border-2 border-purple-200 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                      title="Instantly generate balanced random groups in 1 click"
                    >
                      <Shuffle size={16} />
                      <span>Random Group</span>
                    </button>

                    {(activeClass.groups?.length || 0) > 0 && (
                      <button
                        type="button"
                        onClick={handleShuffleExistingGroups}
                        className="px-3.5 py-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200/80"
                        title="Randomly shuffle students among existing groups"
                      >
                        <RotateCcw size={15} />
                        <span className="hidden sm:inline">Shuffle</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenManualGroupModal()}
                      className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200/80"
                    >
                      <Plus size={16} />
                      <span>+ Manual Group</span>
                    </button>
                  </div>
                </div>

                {/* GROUPS LIST OR EMPTY STATE */}
                {(!activeClass.groups || activeClass.groups.length === 0) ? (
                  <div className="py-20 text-center max-w-lg mx-auto">
                    <div className="w-20 h-20 rounded-3xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mx-auto mb-5 text-3xl shadow-sm">
                      <Users size={40} />
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">No Groups Created Yet</h4>
                    <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                      Create student groups manually by picking members, or auto-generate balanced random teams in one click!
                    </p>
                    <div className="flex items-center justify-center gap-3.5 flex-wrap">
                      <button
                        type="button"
                        onClick={handleOpenAutoGroup}
                        className="px-5 py-3 rounded-2xl font-black text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 flex items-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      >
                        <Shuffle size={18} />
                        <span>Auto Group (Custom Size)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleQuickRandomGroup}
                        className="px-5 py-3 rounded-2xl font-black text-sm bg-purple-50 hover:bg-purple-100 text-purple-800 border-2 border-purple-200 flex items-center gap-2.5 cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      >
                        <Shuffle size={18} />
                        <span>1-Click Random Group</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenManualGroupModal()}
                        className="px-5 py-3 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Plus size={18} />
                        <span>Manually Select Members</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* BIGGER GROUPS GRID DESIGN */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 sm:gap-8">
                    {activeClass.groups.map(group => {
                      const groupStudents = activeClass.students.filter(s => group.studentIds.includes(s.id));
                      const groupTotalDollars = groupStudents.reduce((sum, s) => sum + s.dollars, 0);

                      return (
                        <div
                          key={group.id}
                          className="p-6 sm:p-7 rounded-3xl border-2 border-slate-200/90 bg-white hover:border-emerald-500 transition-all shadow-sm hover:shadow-xl flex flex-col justify-between"
                        >
                          <div>
                            {/* GROUP CARD HEADER (BIGGER) */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xl shadow-xs">
                                  👥
                                </div>
                                <div>
                                  <h4 className="font-black text-xl sm:text-2xl text-slate-900 tracking-tight">{group.name}</h4>
                                  <p className="text-xs sm:text-sm font-semibold text-slate-400">
                                    {groupStudents.length} {groupStudents.length === 1 ? 'student' : 'students'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-black border ${
                                  groupTotalDollars < 0 
                                    ? 'bg-rose-100 text-rose-800 border-rose-300' 
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                  {groupTotalDollars < 0 ? `-$${Math.abs(groupTotalDollars)}` : `$${groupTotalDollars}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenManualGroupModal(group)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Edit Group Members"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGroup(group.id)}
                                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete Group"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* STUDENTS GRID IN GROUP (BIGGER SPRITES & CARDS) */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 my-5 py-4 border-y border-slate-100 min-h-[140px]">
                              {groupStudents.map(student => (
                                <div
                                  key={student.id}
                                  onClick={() => setSelectedStudent(student)}
                                  className="flex flex-col items-center p-3 rounded-2xl hover:bg-emerald-50 hover:scale-105 hover:shadow-sm border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer group text-center bg-slate-50/50"
                                  title={`Click to award or deduct ${student.name}`}
                                >
                                  <div className="relative">
                                    <SquidHamsterSprite 
                                      number={student.number} 
                                      dollars={student.dollars}
                                      size={70} 
                                      showBadge={true} 
                                      liveDelta={liveEffect && liveEffect.studentId === student.id ? liveEffect : null}
                                    />
                                  </div>
                                  <span className="text-xs sm:text-sm font-black text-slate-900 text-center w-full px-1 mt-2 leading-snug break-words min-h-[2.5rem] flex items-center justify-center group-hover:text-emerald-700 transition-colors">
                                    {student.name}
                                  </span>
                                </div>
                              ))}
                              {groupStudents.length === 0 && (
                                <div className="col-span-full py-8 text-center text-xs sm:text-sm text-slate-400 font-medium">
                                  No students in this group yet. Click Edit to add members.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* GROUP ACTION BUTTONS: AWARD & DEDUCT (BIGGER) */}
                          <div className="flex items-center gap-3 pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                setGroupForAward(group);
                                setGroupAwardMode('award');
                              }}
                              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-102 active:scale-98 cursor-pointer"
                            >
                              <DollarSign size={16} className="stroke-[3]" />
                              <span>Award Group</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGroupForAward(group);
                                setGroupAwardMode('deduct');
                              }}
                              className="flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 flex items-center justify-center gap-2 transition-all hover:scale-102 active:scale-98 cursor-pointer"
                            >
                              <Minus size={16} className="stroke-[3]" />
                              <span>Deduct Group</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* SQUID GAME HAMSTER STUDENTS GRID */
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                
                {/* RECENT TRANSACTION TOAST NOTIFICATION */}
                {recentTransaction && (
                  <div className="mb-6 p-3.5 rounded-2xl bg-emerald-600 text-white flex items-center justify-between shadow-lg shadow-emerald-600/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
                      <Sparkles size={18} className="text-amber-300 animate-spin" />
                      <span>{recentTransaction.text}</span>
                    </div>
                    <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                      {recentTransaction.amount >= 0 ? `+$${recentTransaction.amount}` : `-$${Math.abs(recentTransaction.amount)}`}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-y-8 gap-x-4 sm:gap-x-6">
                  
                  {/* WHOLE CLASS VAULT CARD (ALWAYS FIRST) */}
                  {!searchQuery && (
                    <div 
                      onClick={() => {
                        setWholeClassMode('award');
                        setIsAwardingWholeClass(true);
                      }}
                      className="flex flex-col items-center group cursor-pointer"
                    >
                      <div className="flex items-center justify-center relative w-full aspect-square max-w-[150px] transition-transform duration-200 group-hover:scale-108 active:scale-95">
                        {/* Cluster of official hamsters (#1, #2, #4, #5) */}
                        <div className="relative w-28 h-28 flex items-center justify-center">
                          <div className="absolute top-0 left-0">
                            <SquidHamsterSprite number={1} size={54} showBadge={false} />
                          </div>
                          <div className="absolute top-0 right-0">
                            <SquidHamsterSprite number={2} size={54} showBadge={false} />
                          </div>
                          <div className="absolute bottom-0 left-0">
                            <SquidHamsterSprite number={4} size={54} showBadge={false} />
                          </div>
                          <div className="absolute bottom-0 right-0 z-10">
                            <SquidHamsterSprite number={5} size={58} showBadge={false} />
                          </div>
                          <div className={`absolute -top-1 -right-1 min-w-[34px] h-[26px] px-2 rounded-full text-white font-black text-xs flex items-center justify-center shadow-md border-2 border-white z-20 ${
                            totalClassDollars < 0 ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}>
                            {totalClassDollars < 0 ? `-$${Math.abs(totalClassDollars)}` : `$${totalClassDollars}`}
                          </div>
                        </div>
                      </div>
                      <span className="mt-2 font-black text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors text-center tracking-tight">
                        Class Total
                      </span>
                      <span className={`text-[11px] font-bold ${totalClassDollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {totalClassDollars < 0 ? `-$${Math.abs(totalClassDollars)}` : `$${totalClassDollars}`}
                      </span>
                      {/* Quick action buttons for Award & Deduct Entire Class */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWholeClassMode('award');
                            setIsAwardingWholeClass(true);
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                          title="Award dollars to entire class"
                        >
                          + Award
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWholeClassMode('deduct');
                            setIsAwardingWholeClass(true);
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 transition-colors cursor-pointer"
                          title="Deduct dollars from entire class"
                        >
                          - Deduct
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INDIVIDUAL SQUID GAME HAMSTER STUDENT CARDS - BORDERLESS & PROMINENT */}
                  {displayedStudents.map(student => (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className="flex flex-col items-center group cursor-pointer transition-transform duration-200 hover:-translate-y-2 relative"
                    >
                      {/* Quick delete student button on hover */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStudentToDelete({ student, classId: activeClass.id, className: activeClass.name });
                        }}
                        className="absolute -top-1.5 -right-1.5 z-30 w-7 h-7 rounded-full bg-white/95 hover:bg-rose-50 text-slate-400 hover:text-rose-600 shadow-sm border border-slate-200/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer"
                        title={`Delete ${student.name}`}
                      >
                        <Trash2 size={13} />
                      </button>

                      {/* Hamster Character Container - Borderless Floating Character */}
                      <div className="flex items-center justify-center relative w-full aspect-square max-w-[150px] transition-transform duration-200 group-hover:scale-110 active:scale-95">
                        <SquidHamsterSprite
                          number={student.number}
                          dollars={student.dollars}
                          size={128}
                          showBadge={true}
                          liveDelta={liveEffect && liveEffect.studentId === student.id ? liveEffect : null}
                        />
                      </div>
                      
                      {/* Complete Student Name across up to two lines without ellipsis */}
                      <span className="mt-2 font-black text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors text-center w-full max-w-[145px] px-1 leading-snug break-words min-h-[2.5rem] flex items-center justify-center">
                        {student.name}
                      </span>
                    </div>
                  ))}
                </div>

                {displayedStudents.length === 0 && (
                  <div className="py-20 text-center max-w-sm mx-auto">
                    {searchQuery ? (
                      <p className="text-slate-400 font-semibold text-sm">No students found matching "{searchQuery}"</p>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                          <Users size={32} />
                        </div>
                        <h4 className="text-base font-black text-slate-800 mb-1">No Students in this Class</h4>
                        <p className="text-xs text-slate-400 mb-4">Add your students to award Squid dollars and start playing mini-games.</p>
                        <button
                          type="button"
                          onClick={() => setShowAddStudentsModal(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add Students</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* GIVE DOLLARS MODAL (SINGLE STUDENT WITH NUMBER PICKER) */}
      {/* ============================================================ */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 via-white to-slate-50">
              <div className="flex items-center gap-3.5 min-w-0">
                <div 
                  className="relative cursor-pointer hover:scale-105 transition-transform" 
                  onClick={() => setShowNumberPicker(!showNumberPicker)} 
                  title="Click to change character"
                >
                  <SquidHamsterSprite 
                    number={selectedStudent.number} 
                    size={86} 
                    showBadge={false} 
                    liveDelta={liveEffect && liveEffect.studentId === selectedStudent.id ? liveEffect : null}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-xl text-slate-900 break-words leading-tight">
                      {selectedStudent.name}
                    </h3>
                    <button
                      onClick={() => setShowNumberPicker(!showNumberPicker)}
                      className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Select character"
                    >
                      <span>#{String(selectedStudent.number).padStart(3, '0')}</span>
                      <Edit3 size={11} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-slate-500">Current Balance:</span>
                    <span className={`text-xl sm:text-2xl font-black tracking-tight transition-all duration-200 ${
                      selectedStudent.dollars < 0 ? 'text-rose-600 inline-block' : 'text-emerald-600 inline-block'
                    } ${
                      liveEffect && liveEffect.studentId === selectedStudent.id 
                        ? (liveEffect.amount >= 0 ? 'scale-120' : 'scale-120') 
                        : ''
                    }`}>
                      {selectedStudent.dollars < 0 ? `-$${Math.abs(selectedStudent.dollars)}` : `$${selectedStudent.dollars}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setStudentToDelete({ student: selectedStudent, classId: activeClass.id, className: activeClass.name });
                  }}
                  className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title={`Delete ${selectedStudent.name}`}
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => { setSelectedStudent(null); setShowNumberPicker(false); }}
                  className="p-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* CHARACTER NUMBER PICKER (OFFICIAL CHARACTERS FROM EMBEDDED DRIVE PHOTOS) */}
            {showNumberPicker ? (
              <div className="p-5 overflow-y-auto max-h-80 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      Select Character
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Numbered according to character photos (More to be added later)
                    </span>
                  </div>
                  <button 
                    onClick={() => setShowNumberPicker(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Done
                  </button>
                </div>

                {/* OFFICIAL EMBEDDED CHARACTERS */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 mb-2">
                  {GOOGLE_DRIVE_STUDENTS.map(char => (
                    <button
                      key={char.id}
                      onClick={() => handleChangeStudentNumber(selectedStudent.id, char.id)}
                      className={`p-2.5 rounded-2xl flex flex-col items-center border transition-all cursor-pointer ${
                        selectedStudent.number === char.id 
                          ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50'
                      }`}
                    >
                      <SquidHamsterSprite number={char.id} size={62} showBadge={false} />
                      <span className="text-xs font-black text-slate-800 mt-1">#{char.tag}</span>
                      <span className="text-[10px] font-semibold text-slate-500 text-center leading-tight truncate max-w-[90px]">{char.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Modal Body: Dollar Reward Presets */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* MY CUSTOM CLASS REWARDS */}
              <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-purple-50/80 p-4 rounded-2xl border border-purple-200/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-600" />
                    <span className="text-xs font-black text-purple-900 uppercase tracking-wider">
                      My Class Rewards {customRewards.length > 0 && `(${customRewards.length})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateRewardModal(true)}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                  >
                    <Plus size={13} className="stroke-[3]" />
                    <span>Create Reward</span>
                  </button>
                </div>

                {customRewards.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {customRewards.map(reward => {
                      const isPos = reward.amount >= 0;
                      return (
                        <div
                          key={reward.id}
                          className="relative group p-3 rounded-2xl border-2 border-purple-200/90 hover:border-purple-500 bg-white hover:bg-purple-50/60 transition-all flex flex-col items-center text-center cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
                          onClick={() => handleAwardStudent(selectedStudent.id, reward.amount, reward.label)}
                        >
                          <span className="text-2xl mb-1.5">{reward.icon}</span>
                          <span className="font-bold text-[11px] text-slate-800 leading-tight truncate max-w-full px-1">
                            {reward.label}
                          </span>
                          <span className={`mt-1.5 px-3 py-0.5 rounded-full text-xs font-black text-white shadow-2xs tracking-tight ${
                            isPos ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}>
                            {isPos ? `+$${reward.amount}` : `-$${Math.abs(reward.amount)}`}
                          </span>

                          {/* Delete custom reward button on hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomReward(reward.id);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete this custom reward"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white/90 border border-dashed border-purple-300 gap-3">
                    <div>
                      <p className="text-xs font-bold text-purple-900">Create your own class rewards!</p>
                      <p className="text-[11px] text-purple-600">Customize reward amounts, reasons, and fun emojis for your classroom.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateRewardModal(true)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-transform hover:scale-105"
                    >
                      <Plus size={14} className="stroke-[3]" />
                      <span>Create Reward</span>
                    </button>
                  </div>
                )}
              </div>

              {/* POSITIVE DOLLAR REWARDS */}
              <div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  Award Dollars
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {REWARD_PRESETS.map(reward => (
                    <button
                      key={reward.id}
                      onClick={() => handleAwardStudent(selectedStudent.id, reward.amount, reward.label)}
                      className="p-3 rounded-2xl border-2 border-slate-100 hover:border-emerald-400 bg-[#fbfdfc] hover:bg-emerald-50/60 transition-all flex flex-col items-center text-center group cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
                    >
                      <span className="text-2xl mb-1.5">{reward.icon}</span>
                      <span className="font-bold text-[11px] text-slate-800 group-hover:text-emerald-800 leading-tight">
                        {reward.label}
                      </span>
                      <span className="mt-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-emerald-600 text-white shadow-xs tracking-tight">
                        +${reward.amount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CUSTOM DOLLAR AMOUNT INPUT */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-700 block mb-2">Custom Amount</span>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={customDollarAmount}
                      onChange={(e) => setCustomDollarAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const amt = parseInt(customDollarAmount, 10);
                      if (!isNaN(amt) && amt > 0) {
                        handleAwardStudent(selectedStudent.id, amt, 'Custom Award');
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    Give +${customDollarAmount || 0}
                  </button>
                </div>
              </div>

              {/* DEDUCTIONS / FINES */}
              <div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  Penalties & Fines
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {PENALTY_PRESETS.map(pen => (
                    <button
                      key={pen.id}
                      onClick={() => handleAwardStudent(selectedStudent.id, pen.amount, pen.label)}
                      className="p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 bg-rose-50/40 hover:bg-rose-50 transition-all flex flex-col items-center text-center group cursor-pointer"
                    >
                      <span className="text-xl mb-1">{pen.icon}</span>
                      <span className="font-bold text-[11px] text-slate-700 leading-tight">
                        {pen.label}
                      </span>
                      <span className="mt-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-black bg-rose-600 text-white shadow-xs tracking-tight">
                        -${Math.abs(pen.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStudentToDelete({ student: selectedStudent, classId: activeClass.id, className: activeClass.name });
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200/80 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete Student</span>
              </button>
              <button
                onClick={() => { setSelectedStudent(null); setShowNumberPicker(false); }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* AWARD OR DEDUCT ENTIRE CLASS MODAL */}
      {/* ============================================================ */}
      {isAwardingWholeClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black ${
                  wholeClassMode === 'award' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {wholeClassMode === 'award' ? '💰' : '⚠️'}
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900">
                    {wholeClassMode === 'award' ? 'Award Entire Class' : 'Deduct Entire Class'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    All {activeClass.students.length} students in {activeClass.name} will be affected
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAwardingWholeClass(false)} 
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* AWARD vs DEDUCT MODE SWITCHER TABS */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setWholeClassMode('award');
                  setWholeClassAmount(5);
                  setWholeClassReason('');
                }}
                className={`py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  wholeClassMode === 'award'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus size={16} className="stroke-[3]" />
                <span>Award Dollars (+)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWholeClassMode('deduct');
                  setWholeClassAmount(2);
                  setWholeClassReason('');
                }}
                className={`py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  wholeClassMode === 'deduct'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Minus size={16} className="stroke-[3]" />
                <span>Deduct Dollars (-)</span>
              </button>
            </div>

            {wholeClassMode === 'award' ? (
              /* AWARD TAB CONTENT */
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                    Select Award Amount per Student:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 2, 3, 5, 10, 20].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setWholeClassAmount(amt);
                          setWholeClassCustomAmount('');
                        }}
                        className={`py-2.5 rounded-2xl font-black text-sm transition-all flex flex-col items-center cursor-pointer border-2 ${
                          wholeClassAmount === amt && !wholeClassCustomAmount
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400'
                        }`}
                      >
                        <span>+${amt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRESET AWARD REASONS */}
                <div>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                    Quick Award Reasons:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* User's custom rewards if positive */}
                    {customRewards.filter(r => r.amount > 0).map(custom => (
                      <button
                        key={custom.id}
                        type="button"
                        onClick={() => {
                          setWholeClassReason(custom.label);
                          setWholeClassAmount(custom.amount);
                          setWholeClassCustomAmount('');
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                          wholeClassReason === custom.label
                            ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500'
                            : 'bg-white border-purple-200/90 hover:border-purple-300 text-slate-700 hover:bg-purple-50/40'
                        }`}
                      >
                        <span className="text-lg">{custom.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{custom.label}</p>
                          <span className="text-[10px] text-purple-700 font-black">+${custom.amount} (Custom)</span>
                        </div>
                      </button>
                    ))}
                    {WHOLE_CLASS_AWARD_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setWholeClassReason(preset.label);
                          setWholeClassAmount(preset.amount);
                          setWholeClassCustomAmount('');
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                          wholeClassReason === preset.label
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                            : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{preset.label}</p>
                          <span className="text-[10px] text-emerald-600 font-black">+${preset.amount}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CUSTOM REASON & AMOUNT */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Custom Reason (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 100% Focused, Perfect Attendance, Clean Room"
                      value={wholeClassReason}
                      onChange={(e) => setWholeClassReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Or Enter Custom Dollar Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">$</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 15"
                        value={wholeClassCustomAmount}
                        onChange={(e) => {
                          setWholeClassCustomAmount(e.target.value);
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) setWholeClassAmount(val);
                        }}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-black bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* MODAL ACTION BUTTON */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAwardingWholeClass(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const finalAmt = wholeClassCustomAmount ? parseInt(wholeClassCustomAmount, 10) || 5 : wholeClassAmount;
                      handleAwardClass(finalAmt, wholeClassReason || 'Class Teamwork');
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles size={15} className="text-amber-300" />
                    <span>Award +${wholeClassCustomAmount || wholeClassAmount} to All</span>
                  </button>
                </div>
              </div>
            ) : (
              /* DEDUCT TAB CONTENT */
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                    Select Deduction Amount per Student:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[1, 2, 3, 5, 10].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setWholeClassAmount(amt);
                          setWholeClassCustomAmount('');
                        }}
                        className={`py-2.5 rounded-2xl font-black text-sm transition-all flex flex-col items-center cursor-pointer border-2 ${
                          wholeClassAmount === amt && !wholeClassCustomAmount
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm scale-105'
                            : 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-400'
                        }`}
                      >
                        <span>-${amt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRESET DEDUCTION REASONS */}
                <div>
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider block mb-2">
                    Class Penalty Reasons:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {/* User's custom rewards if negative */}
                    {customRewards.filter(r => r.amount < 0).map(custom => (
                      <button
                        key={custom.id}
                        type="button"
                        onClick={() => {
                          setWholeClassReason(custom.label);
                          setWholeClassAmount(Math.abs(custom.amount));
                          setWholeClassCustomAmount('');
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                          wholeClassReason === custom.label
                            ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                            : 'bg-white border-rose-200/90 hover:border-rose-300 text-slate-700 hover:bg-rose-50/40'
                        }`}
                      >
                        <span className="text-lg">{custom.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{custom.label}</p>
                          <span className="text-[10px] text-rose-600 font-black">{custom.amount} (Custom)</span>
                        </div>
                      </button>
                    ))}
                    {WHOLE_CLASS_DEDUCTION_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setWholeClassReason(preset.label);
                          setWholeClassAmount(Math.abs(preset.amount));
                          setWholeClassCustomAmount('');
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer text-xs font-bold ${
                          wholeClassReason === preset.label
                            ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500'
                            : 'bg-white border-slate-200 hover:border-rose-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{preset.label}</p>
                          <span className="text-[10px] text-rose-600 font-black">{preset.amount}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CUSTOM REASON & AMOUNT */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Deduction Reason</label>
                    <input
                      type="text"
                      placeholder="e.g. Talking during silent study, Noise penalty, Late to seats"
                      value={wholeClassReason}
                      onChange={(e) => setWholeClassReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Or Enter Custom Penalty Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">$</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 3"
                        value={wholeClassCustomAmount}
                        onChange={(e) => {
                          setWholeClassCustomAmount(e.target.value);
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) setWholeClassAmount(val);
                        }}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-black bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* MODAL ACTION BUTTON */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAwardingWholeClass(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const finalAmt = wholeClassCustomAmount ? parseInt(wholeClassCustomAmount, 10) || 2 : wholeClassAmount;
                      handleAwardClass(-Math.abs(finalAmt), wholeClassReason || 'Class Penalty');
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Minus size={15} className="stroke-[3]" />
                    <span>Deduct -${wholeClassCustomAmount || wholeClassAmount} from All</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MANUAL GROUP MODAL (TEACHER SELECTS MEMBERS) */}
      {/* ============================================================ */}
      {showManualGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-xl text-slate-900">
                  {editingGroupId ? 'Edit Student Group' : 'Create New Group'}
                </h3>
                <p className="text-xs text-slate-400">
                  Choose group name and manually select students who belong in this group
                </p>
              </div>
              <button 
                onClick={() => setShowManualGroupModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveManualGroup} className="flex-1 flex flex-col min-h-0 space-y-4">
              {/* GROUP NAME */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group / Team Name</label>
                <input
                  type="text"
                  placeholder="e.g. Team Phoenix, Table 1, Red Squad"
                  value={manualGroupName}
                  onChange={(e) => setManualGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>

              {/* SEARCH & SELECTION CONTROLS */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search student to add..."
                    value={manualStudentSearch}
                    onChange={(e) => setManualStudentSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setManualSelectedStudentIds(activeClass.students.map(s => s.id))}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSelectedStudentIds([])}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* STUDENT SELECTION GRID */}
              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl p-3 bg-slate-50 min-h-[220px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeClass.students
                    .filter(s => 
                      !manualStudentSearch || 
                      s.name.toLowerCase().includes(manualStudentSearch.toLowerCase()) ||
                      String(s.number).includes(manualStudentSearch)
                    )
                    .map(student => {
                      const isSelected = manualSelectedStudentIds.includes(student.id);

                      return (
                        <div
                          key={student.id}
                          onClick={() => {
                            if (isSelected) {
                              setManualSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                            } else {
                              setManualSelectedStudentIds(prev => [...prev, student.id]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 shadow-2xs ring-1 ring-emerald-500'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-white ${
                            isSelected ? 'bg-emerald-600' : 'border border-slate-300'
                          }`}>
                            {isSelected && <Check size={13} className="stroke-[3]" />}
                          </div>
                          <SquidHamsterSprite number={student.number} size={38} showBadge={false} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 leading-snug break-words">{student.name}</p>
                            <span className={`text-[10px] font-bold ${student.dollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {student.dollars < 0 ? `-$${Math.abs(student.dollars)}` : `$${student.dollars}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* FOOTER & SAVE */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500">
                  Selected: <span className="text-emerald-600 font-black">{manualSelectedStudentIds.length}</span> of {activeClass.students.length} students
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualGroupModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    Save Group
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* AUTO / RANDOM GROUP MODAL (AUTOMATIC GROUPING FEATURE) */}
      {/* ============================================================ */}
      {showAutoGroupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-xl shadow-xs">
                  🎲
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900">Auto-Group Students</h3>
                  <p className="text-xs text-slate-400">
                    Randomly and evenly distribute all {activeClass.students.length} students into teams
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAutoGroupModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* GROUPING METHOD */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                  Grouping Mode
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoGroupType('by_count');
                      handleReshufflePreview('by_count', autoGroupValue, autoGroupNaming);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      autoGroupType === 'by_count'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Number of Groups
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoGroupType('by_size');
                      handleReshufflePreview('by_size', 4, autoGroupNaming);
                      setAutoGroupValue(4);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      autoGroupType === 'by_size'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Students per Group
                  </button>
                </div>
              </div>

              {/* NUMBER SELECTOR CHIPS */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {autoGroupType === 'by_count' ? 'How many groups to create?' : 'Target students per group:'}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(autoGroupType === 'by_count' ? [2, 3, 4, 5, 6, 8] : [2, 3, 4, 5, 6]).map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setAutoGroupValue(num);
                        handleReshufflePreview(autoGroupType, num, autoGroupNaming);
                      }}
                      className={`w-12 h-10 rounded-xl font-black text-sm border transition-all cursor-pointer ${
                        autoGroupValue === num
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* NAMING CONVENTION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Team Naming Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'animals', label: '🦁 Animals', example: 'Tigers, Lions' },
                    { id: 'nato', label: '🚀 NATO', example: 'Alpha, Bravo' },
                    { id: 'numbers', label: '🔢 Numbers', example: 'Group 1, 2' },
                  ].map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setAutoGroupNaming(n.id as any);
                        handleReshufflePreview(autoGroupType, autoGroupValue, n.id as any);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        autoGroupNaming === n.id
                          ? 'bg-purple-50 border-purple-500 text-purple-900 ring-1 ring-purple-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-black">{n.label}</p>
                      <span className="text-[10px] text-slate-400">{n.example}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* LIVE RANDOM PREVIEW */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    Random Groups Preview ({autoGroupPreview?.length || 0} teams)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReshufflePreview()}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Shuffle size={13} />
                    <span>Shuffle Again</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                  {autoGroupPreview?.map(group => {
                    const groupStudents = activeClass.students.filter(s => group.studentIds.includes(s.id));

                    return (
                      <div key={group.id} className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-xs text-slate-900">{group.name}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {groupStudents.length} members
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {groupStudents.map(student => (
                            <span
                              key={student.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs break-words"
                            >
                              <SquidHamsterSprite number={student.number} size={20} showBadge={false} />
                              <span>{student.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => setShowAutoGroupModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAutoGroups}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={16} className="stroke-[3]" />
                <span>Apply & Save Groups</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* AWARD OR DEDUCT SPECIFIC GROUP MODAL */}
      {/* ============================================================ */}
      {groupForAward && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-black ${
                  groupAwardMode === 'award' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {groupAwardMode === 'award' ? '🏆' : '⚠️'}
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900">{groupForAward.name}</h3>
                  <p className="text-xs text-slate-400">
                    {groupForAward.studentIds.length} students will receive this update
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setGroupForAward(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* AWARD vs DEDUCT TABS */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setGroupAwardMode('award')}
                className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  groupAwardMode === 'award'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus size={14} className="stroke-[3]" />
                <span>Award (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupAwardMode('deduct')}
                className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  groupAwardMode === 'deduct'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Minus size={14} className="stroke-[3]" />
                <span>Deduct (-)</span>
              </button>
            </div>

            {/* GROUP MEMBERS WITH FULL COMPLETE NAMES */}
            <div className="mb-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Group Members ({activeClass.students.filter(s => groupForAward.studentIds.includes(s.id)).length}):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {activeClass.students
                  .filter(s => groupForAward.studentIds.includes(s.id))
                  .map(st => (
                    <span
                      key={st.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-white text-slate-800 border border-slate-200 shadow-2xs break-words"
                    >
                      <SquidHamsterSprite number={st.number} size={22} showBadge={false} />
                      <span>{st.name}</span>
                      <span className={`text-[10px] font-black ${st.dollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ({st.dollars < 0 ? `-$${Math.abs(st.dollars)}` : `$${st.dollars}`})
                      </span>
                    </span>
                  ))}
              </div>
            </div>

            {/* PRESET AMOUNTS */}
            <div className="mb-4">
              <span className="text-xs font-bold text-slate-600 block mb-2">Select Amount per Student:</span>
              <div className="grid grid-cols-5 gap-2">
                {(groupAwardMode === 'award' ? [1, 2, 3, 5, 10] : [1, 2, 3, 5, 10]).map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setGroupAwardAmount(amt);
                      setGroupAwardCustomAmount('');
                    }}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer border ${
                      groupAwardAmount === amt && !groupAwardCustomAmount
                        ? (groupAwardMode === 'award' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600')
                        : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {groupAwardMode === 'award' ? `+$${amt}` : `-$${amt}`}
                  </button>
                ))}
              </div>
            </div>

            {/* PRESET REASONS */}
            <div className="mb-4">
              <span className="text-xs font-bold text-slate-600 block mb-1.5">Quick Reasons:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(groupAwardMode === 'award' ? GROUP_AWARD_PRESETS : GROUP_DEDUCT_PRESETS).map(pr => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => {
                      setGroupAwardReason(pr.label);
                      setGroupAwardAmount(Math.abs(pr.amount));
                      setGroupAwardCustomAmount('');
                    }}
                    className={`p-2 rounded-xl border text-left flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                      groupAwardReason === pr.label
                        ? (groupAwardMode === 'award' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-rose-50 border-rose-500 text-rose-900')
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{pr.icon}</span>
                    <span className="truncate">{pr.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CUSTOM REASON */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-1">Reason / Note</label>
              <input
                type="text"
                placeholder="e.g. Best Group Project, Fast Challenge Winner"
                value={groupAwardReason}
                onChange={(e) => setGroupAwardReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGroupForAward(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalAmt = groupAwardCustomAmount ? parseInt(groupAwardCustomAmount, 10) || 2 : groupAwardAmount;
                  const signedAmt = groupAwardMode === 'award' ? Math.abs(finalAmt) : -Math.abs(finalAmt);
                  handleAwardGroup(groupForAward.id, signedAmt, groupAwardReason || (groupAwardMode === 'award' ? 'Team Award' : 'Team Penalty'));
                }}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white shadow-md cursor-pointer ${
                  groupAwardMode === 'award'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {groupAwardMode === 'award' ? `Award +$${groupAwardAmount} to Group` : `Deduct -$${groupAwardAmount} from Group`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* NEW CLASS MODAL */}
      {/* ============================================================ */}
      {showNewClassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-xl text-slate-900">Create New Class</h3>
              <button onClick={() => setShowNewClassModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Class Name</label>
                <input
                  type="text"
                  placeholder="e.g. 7A3, KET Plus, Grade 8 ESL"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Grade Level</label>
                <input
                  type="text"
                  placeholder="e.g. Grade 6, Year 7, IELTS Foundation"
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-600">Students</label>
                  <span className="text-[11px] font-semibold text-slate-400">Optional</span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Type or copy/paste student names (one per line or separated by commas)&#10;e.g.:&#10;Alex&#10;Jordan&#10;Taylor"
                  value={newClassStudentsInput}
                  onChange={(e) => setNewClassStudentsInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans resize-none placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Type or paste a roster from Excel, Word, or Google Sheets. Each student gets a unique Squid Game character.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewClassModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ADD STUDENTS MODAL (ASSIGNING SEQUENTIAL #1 TO #50) */}
      {/* ============================================================ */}
      {showAddStudentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-xl text-slate-900">Add Students to {activeClass.name}</h3>
                <p className="text-xs text-slate-500">Each student will be assigned an image from hamster #1 to #50!</p>
              </div>
              <button onClick={() => setShowAddStudentsModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStudents} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Names (one per line, or comma-separated)
                </label>
                <textarea
                  rows={5}
                  placeholder={`Quang Huy\nBảo Trâm\nMinh Khôi\nPhương Anh`}
                  value={studentNamesInput}
                  onChange={(e) => setStudentNamesInput(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentsModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                >
                  Add Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* REMOVE STUDENTS MODAL (SELECTION & BATCH REMOVE TO BIN) */}
      {/* ============================================================ */}
      {showRemoveStudentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 max-h-[90vh] flex flex-col">
            
            {/* MODAL HEADER */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
                  <UserMinus size={24} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 tracking-tight">Remove Students</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeClass.name} • Removed students are moved to the Bin and can be restored anytime.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowRemoveStudentsModal(false)} 
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* SEARCH & SELECTION TOOLBAR */}
            <div className="py-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter student name or #number..."
                  value={removeStudentSearch}
                  onChange={(e) => setRemoveStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
                />
                {removeStudentSearch && (
                  <button onClick={() => setRemoveStudentSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filtered = activeClass.students.filter(s => 
                      s.name.toLowerCase().includes(removeStudentSearch.toLowerCase()) || 
                      s.number.toString().includes(removeStudentSearch)
                    );
                    if (selectedStudentsToRemove.length === filtered.length) {
                      setSelectedStudentsToRemove([]);
                    } else {
                      setSelectedStudentsToRemove(filtered.map(s => s.id));
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {selectedStudentsToRemove.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600">
                  {selectedStudentsToRemove.length} selected
                </span>
              </div>
            </div>

            {/* STUDENTS LIST */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {(() => {
                const filtered = activeClass.students.filter(s => 
                  s.name.toLowerCase().includes(removeStudentSearch.toLowerCase()) || 
                  s.number.toString().includes(removeStudentSearch)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs font-medium">
                      {removeStudentSearch ? 'No students found matching your search.' : 'No students in this class.'}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filtered.map(st => {
                      const isSelected = selectedStudentsToRemove.includes(st.id);
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            setSelectedStudentsToRemove(prev => 
                              isSelected ? prev.filter(id => id !== st.id) : [...prev, st.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-rose-50/80 border-rose-500 shadow-xs' 
                              : 'bg-white hover:bg-slate-50 border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                            </div>
                            <div className="shrink-0">
                              <SquidHamsterSprite number={st.number} size={38} showBadge={false} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">
                                #{st.number} {st.name}
                              </p>
                              <p className={`text-[11px] font-bold ${st.dollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {st.dollars < 0 ? `-$${Math.abs(st.dollars)}` : `$${st.dollars}`}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStudent(st);
                            }}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
                            title={`Instantly remove ${st.name} to Bin`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* MODAL FOOTER */}
            <div className="pt-4 mt-3 border-t border-slate-100 shrink-0 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                Students can always be restored from the <span className="font-bold text-slate-600">Bin</span>.
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowRemoveStudentsModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedStudentsToRemove.length === 0}
                  onClick={handleRemoveSelectedStudents}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    selectedStudentsToRemove.length > 0
                      ? 'bg-gradient-to-r from-rose-600 to-pink-700 text-white shadow-md shadow-rose-600/30 hover:scale-102 active:scale-98'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <UserMinus size={15} />
                  <span>
                    {selectedStudentsToRemove.length > 0 
                      ? `Remove ${selectedStudentsToRemove.length} Student${selectedStudentsToRemove.length === 1 ? '' : 's'}` 
                      : 'Select Students to Remove'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RANDOM STUDENT PICKER MODAL */}
      {/* ============================================================ */}
      {randomStudentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-8 text-center flex flex-col items-center">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-4">
              Random Player Picked 🎯
            </span>
            <div className="my-3">
              <SquidHamsterSprite 
                number={randomStudentModal.number} 
                size={150} 
                dollars={randomStudentModal.dollars}
              />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-1">{randomStudentModal.name}</h3>
            <p className="text-xs font-semibold text-slate-400 mb-6">
              Player #{randomStudentModal.number} • Current Balance: <span className={`font-black ${randomStudentModal.dollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {randomStudentModal.dollars < 0 ? `-$${Math.abs(randomStudentModal.dollars)}` : `$${randomStudentModal.dollars}`}
              </span>
            </p>

            <div className="w-full flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedStudent(randomStudentModal);
                  setRandomStudentModal(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Award Dollars
              </button>
              <button
                onClick={handlePickRandomStudent}
                className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Pick Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MOVE CLASS TO BIN CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 text-2xl">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Move to Bin?
            </h3>
            <p className="text-sm font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full mb-3">
              {classToDelete.icon} {classToDelete.name}
            </p>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              This class has <span className="font-bold text-slate-700">{classToDelete.students.length} students</span> with a total of <span className="font-bold text-emerald-600">${classToDelete.students.reduce((sum, s) => sum + s.dollars, 0)}</span>. It will be moved to the Bin, where you can retrieve it at any time or delete it permanently.
            </p>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMoveClassToBin(classToDelete)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Move to Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERMANENTLY DELETE CLASS CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {permanentDeleteClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Delete Permanently?
            </h3>
            <p className="text-sm font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full mb-3">
              {permanentDeleteClass.icon} {permanentDeleteClass.name}
            </p>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              This action <span className="font-bold text-rose-600">cannot be undone</span>. All {permanentDeleteClass.students.length} students, dollar balances, and data will be erased forever.
            </p>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPermanentDeleteClass(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentlyDeleteClass(permanentDeleteClass)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="relative mb-3">
              <SquidHamsterSprite number={studentToDelete.student.number} size={68} showBadge={false} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Delete Student?
            </h3>
            <p className="text-sm font-black text-slate-800 bg-slate-100 px-3.5 py-1 rounded-full mb-2">
              {studentToDelete.student.name}
            </p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-slate-500">
                From {studentToDelete.className}
              </span>
              <span className="text-xs font-black text-slate-400">•</span>
              <span className={`text-xs font-black ${studentToDelete.student.dollars < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                Balance: {studentToDelete.student.dollars < 0 ? `-$${Math.abs(studentToDelete.student.dollars)}` : `$${studentToDelete.student.dollars}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              This student will be removed from <span className="font-bold text-slate-700">{studentToDelete.className}</span> and any assigned groups. They will be placed in the Recycle Bin where you can retrieve them at any time.
            </p>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStudent(studentToDelete.student, studentToDelete.classId)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Delete Student</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PERMANENTLY DELETE STUDENT CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {permanentDeleteStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Delete Permanently?
            </h3>
            <p className="text-sm font-black text-rose-700 bg-rose-50 px-3.5 py-1 rounded-full mb-3">
              {permanentDeleteStudent.name}
            </p>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              This action <span className="font-bold text-rose-600">cannot be undone</span>. This student and all their dollars will be erased forever from the bin.
            </p>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPermanentDeleteStudent(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePermanentlyDeleteStudent(permanentDeleteStudent)}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EMPTY ENTIRE BIN CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {showEmptyBinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
              <Trash2 size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Empty Entire Bin?
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              Are you sure you want to permanently delete all <span className="font-bold text-rose-600">{deletedClasses.length} {deletedClasses.length === 1 ? 'class' : 'classes'}</span> and <span className="font-bold text-rose-600">{deletedStudents.length} {deletedStudents.length === 1 ? 'student' : 'students'}</span> in the bin? This action cannot be reversed.
            </p>
            <div className="w-full flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowEmptyBinModal(false)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyBin}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE CUSTOM CLASS REWARD MODAL */}
      {/* ============================================================ */}
      {showCreateRewardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/25">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900 leading-tight">Create Class Reward</h3>
                  <p className="text-xs text-slate-400 font-medium">Add custom dollars and reason to your classroom</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateRewardModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Auth status indicator */}
            <div className={`p-3 rounded-2xl mb-4 text-xs font-semibold flex items-center gap-2 ${
              user && !user.isAnonymous
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {user && !user.isAnonymous ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="truncate">Signed in as <strong>{user.email || user.displayName}</strong> • Synced to Cloud ☁️</span>
                </>
              ) : (
                <>
                  <Cloud size={16} className="text-amber-600 shrink-0" />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span>Sign in to save rewards across all devices.</span>
                    {openAuthModal && (
                      <button 
                        type="button" 
                        onClick={() => { setShowCreateRewardModal(false); openAuthModal(); }}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold shrink-0 hover:bg-amber-700 cursor-pointer"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSaveCustomReward} className="space-y-4">
              {/* Type Switcher: Award vs Deduction */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRewardFormType('award')}
                  className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    rewardFormType === 'award'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>Award Dollars (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRewardFormType('deduct')}
                  className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    rewardFormType === 'deduct'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Minus size={14} className="stroke-[3]" />
                  <span>Deduct Dollars (-)</span>
                </button>
              </div>

              {/* Reward Name / Label */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Reward Name / Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Homework Superstar, Math Wizard, Clean Desk..."
                  value={rewardFormLabel}
                  onChange={(e) => setRewardFormLabel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Dollar Amount
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[1, 2, 3, 5, 10].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRewardFormAmount(amt)}
                      className={`py-2 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                        rewardFormAmount === amt
                          ? rewardFormType === 'award'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rewardFormType === 'award' ? `+$${amt}` : `-$${amt}`}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={rewardFormAmount}
                    onChange={(e) => setRewardFormAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="Custom amount"
                  />
                </div>
              </div>

              {/* Icon / Emoji Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Icon / Emoji
                </label>
                <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-32 overflow-y-auto custom-scrollbar mb-2">
                  {['🌟', '🏆', '🥇', '🎯', '📚', '💡', '💎', '👑', '🍕', '🚀', '💖', '🤝', '🙋', '🗣️', '⚡', '🎨', '🌈', '💯', '🍩', '🧠', '🎖️', '🔔', '🦄', '🦁', '🔥', '⭐', '🎉', '🎁', '✨', '🏅', '⚠️', '🔇'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setRewardFormIcon(emoji)}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition-transform cursor-pointer ${
                        rewardFormIcon === emoji
                          ? 'bg-purple-600 text-white scale-110 shadow-xs'
                          : 'hover:bg-slate-200/80'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Or type emoji:</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={rewardFormIcon}
                    onChange={(e) => setRewardFormIcon(e.target.value)}
                    className="w-16 text-center py-1 text-lg rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              {/* Live Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-2xl shrink-0">
                  {rewardFormIcon || '🌟'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Preview</p>
                  <h4 className="font-bold text-sm text-slate-900 truncate">{rewardFormLabel || 'Your Reward Name'}</h4>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black text-white shrink-0 ${
                  rewardFormType === 'award' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  {rewardFormType === 'award' ? `+$${rewardFormAmount}` : `-$${rewardFormAmount}`}
                </span>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateRewardModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rewardFormLabel.trim() || isSavingReward}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all cursor-pointer hover:scale-102 active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>{isSavingReward ? 'Saving...' : 'Save Reward'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MANAGE CLASS REWARDS LIBRARY MODAL */}
      {/* ============================================================ */}
      {showManageRewardsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md shadow-purple-600/20">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl text-slate-900">Class Rewards Library</h3>
                  <p className="text-xs text-slate-400 font-medium">Create and customize rewards for your classroom currency</p>
                </div>
              </div>
              <button 
                onClick={() => setShowManageRewardsModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Auth / Cloud status bar */}
            <div className={`p-3.5 rounded-2xl mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              user && !user.isAnonymous 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                : 'bg-amber-50 border border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                {user && !user.isAnonymous ? (
                  <>
                    <Cloud className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Cloud Sync Active</p>
                      <p className="text-[11px] text-emerald-700">Signed in as {user.email || user.displayName}. Your custom rewards are saved to your account.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-bold">Guest Mode</p>
                      <p className="text-[11px] text-amber-700">Sign in to save and sync your custom class rewards across devices.</p>
                    </div>
                  </>
                )}
              </div>
              {(!user || user.isAnonymous) && openAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowManageRewardsModal(false);
                    openAuthModal();
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shrink-0 transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogIn size={13} />
                  <span>Sign In with Google</span>
                </button>
              )}
            </div>

            {/* Top Toolbar in Modal: Create New Reward */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>My Custom Rewards</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-mono">
                  {customRewards.length}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowCreateRewardModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>Create New Reward</span>
              </button>
            </div>

            {/* Custom Rewards List / Grid */}
            <div className="space-y-4 mb-6">
              {customRewards.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {customRewards.map(reward => {
                    const isPos = reward.amount >= 0;
                    return (
                      <div
                        key={reward.id}
                        className="p-3 rounded-2xl border-2 border-purple-100 bg-[#fbfdfc] hover:bg-white hover:border-purple-300 transition-all flex items-center justify-between gap-3 shadow-2xs group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{reward.icon}</span>
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{reward.label}</h5>
                            <span className="text-[10px] text-slate-400 font-semibold">Custom Reward</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black text-white ${
                            isPos ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}>
                            {isPos ? `+$${reward.amount}` : `-$${Math.abs(reward.amount)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomReward(reward.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this reward"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                    <Sparkles size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No custom rewards yet</p>
                  <p className="text-xs text-slate-400 max-w-sm mt-0.5 mb-3">
                    Click the button below to build customized rewards, incentives, and penalty tags for your classroom!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateRewardModal(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Create Your First Reward</span>
                  </button>
                </div>
              )}
            </div>

            {/* System Presets Reference Section */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
                Standard Classroom Presets ({REWARD_PRESETS.length + PENALTY_PRESETS.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[...REWARD_PRESETS, ...PENALTY_PRESETS].map(item => (
                  <div key={item.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-2">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{item.label}</p>
                      <span className={`text-[10px] font-black ${item.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.amount >= 0 ? `+$${item.amount}` : `-$${Math.abs(item.amount)}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-5 mt-5 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageRewardsModal(false)}
                className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SIGN IN PROMPT MODAL */}
      {/* ============================================================ */}
      {showSignInPromptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
              <Sparkles size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">
              Sign In to Save Rewards
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed">
              When signed in, you can create your own custom class rewards and access them across all your classes and devices!
            </p>
            <div className="w-full flex flex-col gap-2.5">
              {openAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSignInPromptModal(false);
                    openAuthModal();
                  }}
                  className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn size={14} />
                  <span>Sign In with Google</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSignInPromptModal(false);
                  const amountVal = Math.max(1, Math.abs(Number(rewardFormAmount) || 1));
                  const finalAmount = rewardFormType === 'deduct' ? -amountVal : amountVal;
                  const rewardId = `reward_${Date.now()}`;
                  const guestReward: DollarReward = {
                    id: rewardId,
                    label: rewardFormLabel.trim() || 'Custom Reward',
                    amount: finalAmount,
                    icon: rewardFormIcon || '🌟',
                    category: rewardFormType === 'deduct' ? 'penalty' : 'custom',
                    createdAt: Date.now()
                  };
                  const updated = [guestReward, ...customRewards];
                  setCustomRewards(updated);
                  localStorage.setItem('squid_custom_rewards', JSON.stringify(updated));
                  setShowCreateRewardModal(false);
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Save on this device only
              </button>
              <button
                type="button"
                onClick={() => setShowSignInPromptModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassRecord;
