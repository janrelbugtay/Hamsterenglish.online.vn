import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ActivityAction = 
  | 'login'
  | 'create_game'
  | 'edit_game'
  | 'delete_game'
  | 'play_game'
  | 'create_class'
  | 'update_profile';

export interface UserActivityEvent {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhoto?: string | null;
  action: ActivityAction;
  title?: string;
  gameId?: string;
  gameTitle?: string;
  gameType?: string;
  questionCount?: number;
  score?: number;
  details?: string;
  timestamp: any;
}

/**
 * Log a user activity to Firestore collection 'userActivities'.
 * Safe execution: errors are caught so application flows are never interrupted.
 */
export async function logUserActivity(event: Omit<UserActivityEvent, 'timestamp'> & { timestamp?: any }) {
  try {
    if (!event.userId) return;
    const col = collection(db, 'userActivities');
    await addDoc(col, {
      ...event,
      timestamp: event.timestamp || serverTimestamp(),
      createdAtIso: new Date().toISOString()
    });
  } catch (err) {
    // Non-blocking warning
    console.warn('Activity logging notice:', err);
  }
}

/**
 * Helper to get a human-readable relative timestamp string
 */
export function formatRelativeTime(val: any): string {
  if (!val) return 'Recently';
  let date: Date;

  try {
    if (val.toMillis) {
      date = new Date(val.toMillis());
    } else if (val.seconds) {
      date = new Date(val.seconds * 1000);
    } else if (typeof val === 'number') {
      date = new Date(val);
    } else if (typeof val === 'string') {
      date = new Date(val);
    } else if (val instanceof Date) {
      date = val;
    } else {
      return 'Recently';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Map gameType to friendly name and icon
 */
export function getGameTypeMeta(gameType: string = ''): { name: string; icon: string; color: string; badgeBg: string } {
  const norm = (gameType || '').toLowerCase().replace(/[-_ ]+/g, '');
  
  if (norm.includes('slap') || norm.includes('chop')) {
    return { name: 'Slap & Chop', icon: '🥊', color: 'text-purple-600', badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
  }
  if (norm.includes('mystery') || norm.includes('box')) {
    return { name: 'Mystery Box', icon: '🎁', color: 'text-orange-600', badgeBg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' };
  }
  if (norm.includes('bubble') && norm.includes('island')) {
    return { name: 'Bubble Island', icon: '🏝️', color: 'text-sky-600', badgeBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' };
  }
  if (norm.includes('bubble')) {
    return { name: 'Bubble Pop', icon: '🫧', color: 'text-blue-600', badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
  }
  if (norm.includes('shark')) {
    return { name: 'Shark Attack', icon: '🦈', color: 'text-cyan-600', badgeBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' };
  }
  if (norm.includes('yoga')) {
    return { name: 'Yoga Quiz', icon: '🧘', color: 'text-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  }
  if (norm.includes('feud') || norm.includes('family')) {
    return { name: 'Family Feud', icon: '👨‍👩‍👧‍👦', color: 'text-yellow-600', badgeBg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' };
  }
  if (norm.includes('sumo')) {
    return { name: 'Sumo Tags', icon: '🤼', color: 'text-red-600', badgeBg: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
  }
  if (norm.includes('hamster') || norm.includes('popquiz')) {
    return { name: 'Hamster Pop Quiz', icon: '🐹', color: 'text-amber-600', badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
  }
  if (norm.includes('flashcard')) {
    return { name: 'Flashcards Match', icon: '🃏', color: 'text-indigo-600', badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' };
  }
  if (norm.includes('letter') || norm.includes('lock')) {
    return { name: 'Letter Lock', icon: '🎯', color: 'text-sky-600', badgeBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' };
  }
  if (norm.includes('tic') || norm.includes('toe')) {
    return { name: 'Tic Tac Toe', icon: '❌', color: 'text-slate-600', badgeBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  }
  if (norm.includes('race') || norm.includes('picker')) {
    return { name: 'Name Picker', icon: '🏎️', color: 'text-rose-600', badgeBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' };
  }
  if (norm.includes('phonemic')) {
    return { name: 'Phonemic Master', icon: '🗣️', color: 'text-teal-600', badgeBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' };
  }

  return { name: gameType || 'Custom Quiz', icon: '🎮', color: 'text-indigo-600', badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' };
}
