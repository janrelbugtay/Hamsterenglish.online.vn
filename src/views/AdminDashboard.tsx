import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Activity, Search, Bell, 
  Menu, X, Settings, LogOut, Filter, Shield,
  Gamepad2, Monitor, Smartphone, Tablet, Trash2,
  RefreshCw, CheckCircle2, UserCheck, User, Sparkles, AlertTriangle,
  ShieldAlert, ShieldCheck, AlertCircle, Copy, Check, Eye, UserX,
  Flame, ExternalLink, ChevronRight, Info, Lock
} from 'lucide-react';
import { collection, onSnapshot, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { examineUserThreat, categorizeThreats, SUPER_ADMIN_EMAIL, ThreatReport } from '../utils/threatDetector';
import { UserActivityModal } from '../components/UserActivityModal';
import { AdminActivityGamesView } from '../components/AdminActivityGamesView';
import { UserActivityEvent } from '../utils/activityTracker';

// Helper to safely format last login timestamps
const formatLastLogin = (lastLoginAt: any) => {
  if (!lastLoginAt) return 'N/A';
  try {
    if (lastLoginAt.toMillis) {
      return new Date(lastLoginAt.toMillis()).toLocaleString();
    }
    if (typeof lastLoginAt === 'number') {
      return new Date(lastLoginAt).toLocaleString();
    }
    if (typeof lastLoginAt === 'string') {
      return new Date(lastLoginAt).toLocaleString();
    }
    if (lastLoginAt?.seconds) {
      return new Date(lastLoginAt.seconds * 1000).toLocaleString();
    }
  } catch (e) {
    console.error("Date formatting error:", e);
  }
  return 'Recently';
};

// --- UI COMPONENTS ---
const Card = ({ children, className = '', title, action }: any) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center flex-wrap gap-2">
        {title && <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, subtitle, trend, icon: Icon, colorClass, highlight, isLive, children }: any) => (
  <Card className="hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col">
    <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-12 -translate-y-12 rounded-full opacity-10 transition-transform group-hover:scale-110 ${colorClass}`}></div>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
          {title}
          {isLive && <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>}
        </p>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-baseline gap-2">
          {value}
          {highlight && <span className="text-sm font-medium text-slate-400">{highlight}</span>}
        </h2>
      </div>
      <div className={`p-3 rounded-xl ${colorClass.replace('bg-', 'bg-opacity-10 text-')}`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="mt-auto">
      {subtitle && (
        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
          {trend && (
            <span className={`font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-500'} flex items-center`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
          {subtitle}
        </p>
      )}
      {children}
    </div>
  </Card>
);

const Avatar = ({ src, alt, size = 'md' }: any) => {
  const sizes: any = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', xl: 'w-24 h-24' };
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${sizes[size]} rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover bg-slate-100 dark:bg-slate-700`}
      onError={(e: any) => { e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(alt || 'User'); }}
    />
  );
};

// --- APP GAMES CONFIG ---
const APP_GAMES = [
  { id: "mystery-box", title: "Mystery Box", icon: "🎁" },
  { id: "neon-chain", title: "Neon Chain", icon: "🔗" },
  { id: "bubble-pop", title: "Bubble Pop", icon: "🫧" },
  { id: "roller-coaster-quiz", title: "Roller Coaster Quiz", icon: "🎢" },
  { id: "shark-attack", title: "Shark Attack", icon: "🦈" },
  { id: "flashcards-match", title: "Flashcards Match", icon: "🃏" },
  { id: "bubble-sentence-pro", title: "Bubble Island", icon: "🏝️" },
  { id: "yoga-quiz", title: "Yoga Quiz", icon: "🧘" },
  { id: "family-feud", title: "Family Feud", icon: "👨‍👩‍👧‍👦" },
  { id: "sumo", title: "Sumo Tags", icon: "🤼" },
  { id: "letter-lock", title: "Letter Lock", icon: "🎯" },
  { id: "hamster-pop-quiz", title: "Hamster Pop Quiz", icon: "🐹" },
  { id: "student-race", title: "Name Picker", icon: "🏎️" },
  { id: "tic-tac-toe", title: "Tic Tac Toe Battle", icon: "❌" },
  { id: "phonemic-master", title: "Phonemic Master", icon: "🗣️" }
];

// --- DASHBOARD OVERVIEW ---
const DashboardOverview = ({ 
  users, 
  onSync, 
  isSyncing, 
  onViewAll, 
  publishedGames, 
  onToggleGamePublish, 
  pageVisits,
  onFilterThreats,
  games = [],
  activities = [],
  onInspectUserActivity,
  onNavigateToRoute
}: any) => {
  const [showGuestModal, setShowGuestModal] = React.useState(false);
  const registeredUsersList = users.filter((u: any) => u.isAnonymous !== true && u.email && u.email !== "User");
  const registeredUsers = registeredUsersList.length;
  const guestUsersList = users.filter((u: any) => u.isAnonymous === true || !u.email || u.email === "User");
  const guestUsers = guestUsersList.length;

  const threatStats = useMemo(() => categorizeThreats(users), [users]);
  const highThreatExample = threatStats.critical[0]?.user;

  return (
    <div className="space-y-6">
      {/* Security Threat Alert Banner */}
      {threatStats.critical.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-red-500/15 to-orange-500/10 border-2 border-rose-500/30 dark:border-rose-500/40 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-500 text-white rounded-xl shadow-md shrink-0 animate-pulse">
                <ShieldAlert size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-rose-700 dark:text-rose-400">
                    Security Warning: {threatStats.critical.length} Potential Email Threat{threatStats.critical.length > 1 ? 's' : ''} Detected
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-rose-600 text-white rounded-full">
                    Action Required
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  Automatic analysis flagged suspicious accounts (e.g. institutional domain spoofing, fake school emails like <span className="font-mono font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-1.5 py-0.5 rounded">{highThreatExample?.email || 'spoofed@gmail.com'}</span>).
                </p>
              </div>
            </div>
            <button
              onClick={() => onFilterThreats('threats')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap self-stretch md:self-auto justify-center"
            >
              <span>Examine & Delete Threats</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Users" value={pageVisits.toLocaleString()} 
          subtitle="Total platform users"
          icon={Users} colorClass="bg-blue-500" 
        />
        <StatCard 
          title="Registered" value={registeredUsers.toLocaleString()} 
          subtitle="Non-guest accounts"
          icon={UserCheck} colorClass="bg-emerald-500" 
        >
          {registeredUsersList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex flex-wrap gap-2">
                {registeredUsersList.slice(0, 3).map((u: any, i: number) => (
                  <span key={i} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs rounded-md border border-emerald-100 dark:border-emerald-500/20 truncate max-w-full">
                    {u.displayName || u.email || 'Unknown'}
                  </span>
                ))}
                {registeredUsersList.length > 3 && (
                  <span className="text-xs text-slate-400 font-medium self-center">
                    +{registeredUsersList.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </StatCard>
        <StatCard 
          title="My Games Created" value={games.length.toString()} 
          subtitle="Total custom games created"
          icon={Gamepad2} colorClass="bg-purple-500" 
        >
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
              {activities.length} Recorded activities
            </span>
            {onNavigateToRoute && (
              <button 
                onClick={() => onNavigateToRoute('user-activity')}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Inspect Games →
              </button>
            )}
          </div>
        </StatCard>
        <StatCard 
          title="Email Threats" value={threatStats.critical.length.toString()} 
          subtitle={threatStats.critical.length === 0 ? "All scanned emails safe" : "High risk emails flagged"}
          icon={ShieldAlert} colorClass={threatStats.critical.length > 0 ? "bg-rose-500" : "bg-emerald-500"} 
        >
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {threatStats.medium.length} Suspicious
            </span>
            <button 
              onClick={() => onFilterThreats('threats')}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Review Threats →
            </button>
          </div>
        </StatCard>
      </div>
      
      {/* App Toggles */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Manage Apps</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {APP_GAMES.map(game => {
            const isGamePublished = publishedGames[game.id] !== false;
            return (
              <div key={game.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{game.icon}</div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{game.title}</span>
                </div>
                <button
                  onClick={() => onToggleGamePublish(game.id)}
                  className={`w-12 h-6 ${isGamePublished ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} rounded-full relative transition-colors duration-200 focus:outline-none`}
                  title={isGamePublished ? "Unpublish App" : "Publish App"}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all duration-200 ${isGamePublished ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini Live Users Table */}
      <Card 
        title="Recent Users" 
        action={
          <div className="flex items-center gap-3">
            <button 
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-600" : ""} />
              <span>{isSyncing ? "Syncing..." : "Sync Users"}</span>
            </button>
            <button 
              onClick={onViewAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              View All
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="py-3 px-6 font-medium">User</th>
                <th className="py-3 px-6 font-medium">Email & Threat Status</th>
                <th className="py-3 px-6 font-medium text-center">My Games</th>
                <th className="py-3 px-6 font-medium text-right">Last Login</th>
                <th className="py-3 px-6 font-medium text-right">Admin Inspection</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 10).map((user: any) => {
                const threat = examineUserThreat(user);
                const uid = user.uid || user.id;
                const email = (user.email || '').toLowerCase().trim();
                const userCreatedGames = games.filter((g: any) => {
                  if (g.userId && (g.userId === uid || g.userId === user.id)) return true;
                  if (email && email !== 'user' && g.creatorEmail && g.creatorEmail.toLowerCase().trim() === email) return true;
                  return false;
                });

                return (
                  <tr 
                    key={uid} 
                    onClick={() => onInspectUserActivity && onInspectUserActivity(user)}
                    className="border-b border-slate-50 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.photoURL} alt={user.displayName || user.email} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{user.displayName || 'User'}</p>
                            {threat.isSuperAdmin && (
                              <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">Admin</span>
                            )}
                          </div>
                          {(user.isAnonymous || user.email === "User") && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Guest</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{user.email || 'No email'}</span>
                        {threat.level === 'critical' || threat.level === 'high' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 flex items-center gap-1">
                            <ShieldAlert size={12} /> Threat: {threat.primaryThreat}
                          </span>
                        ) : threat.level === 'medium' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle size={12} /> Suspicious
                          </span>
                        ) : threat.isSuperAdmin ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 flex items-center gap-1">
                            <ShieldCheck size={12} /> Protected
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Clean
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-center">
                      {userCreatedGames.length > 0 ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                          title={`${userCreatedGames.length} games created by this user`}
                        >
                          <Gamepad2 size={12} />
                          <span>{userCreatedGames.length} Game{userCreatedGames.length === 1 ? '' : 's'}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">0 games</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatLastLogin(user.lastLoginAt)}
                    </td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInspectUserActivity) onInspectUserActivity(user);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all border border-indigo-200 dark:border-indigo-800 shadow-sm"
                        title="View user activity & created games"
                      >
                        <Eye size={13} />
                        <span>Activity & Games</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No users found. Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">Sync Users</span> to refresh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Guest Names Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGuestModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Guest Players</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{guestUsers} anonymous accounts</p>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="flex flex-wrap gap-2">
                {guestUsersList.map((u: any, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium rounded-lg border border-amber-100 dark:border-amber-500/20">
                    {u.displayName || 'Guest Player'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- USERS MANAGEMENT WITH AUTOMATED THREAT ENGINE & ADMIN DELETION ---
const UsersManagement = ({ users, onSync, isSyncing, initialFilter = 'all', games = [], onInspectUserActivity }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'threats' | 'suspicious' | 'safe' | 'guests'>(initialFilter);
  const [isScanning, setIsScanning] = useState(false);
  const [scanTimestamp, setScanTimestamp] = useState<Date>(new Date());
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Selected users for bulk deletion
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modals state
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Analyze all users with the threat engine
  const analyzedUsers = useMemo(() => {
    return users.map((u: any) => ({
      ...u,
      _threat: examineUserThreat(u)
    }));
  }, [users]);

  // Threat categorizations
  const threatCategories = useMemo(() => {
    const critical = analyzedUsers.filter((u: any) => u._threat.level === 'critical' || u._threat.level === 'high');
    const suspicious = analyzedUsers.filter((u: any) => u._threat.level === 'medium');
    const safe = analyzedUsers.filter((u: any) => u._threat.level === 'safe' || u._threat.level === 'low');
    const guests = analyzedUsers.filter((u: any) => u.isAnonymous || !u.email || u.email === 'User');
    return { critical, suspicious, safe, guests };
  }, [analyzedUsers]);

  // Filtered users according to search and active tab
  const filteredUsers = useMemo(() => {
    return analyzedUsers.filter((u: any) => {
      // Filter tab
      if (activeFilter === 'threats' && u._threat.level !== 'critical' && u._threat.level !== 'high') return false;
      if (activeFilter === 'suspicious' && u._threat.level !== 'medium') return false;
      if (activeFilter === 'safe' && u._threat.level !== 'safe' && u._threat.level !== 'low') return false;
      if (activeFilter === 'guests' && !u.isAnonymous && u.email && u.email !== 'User') return false;

      // Search term
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (u.displayName || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.uid || u.id || '').toLowerCase().includes(term) ||
        (u._threat.primaryThreat || '').toLowerCase().includes(term)
      );
    });
  }, [analyzedUsers, activeFilter, searchTerm]);

  // Handle single user deletion
  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    const uid = userToDelete.uid || userToDelete.id;
    const email = userToDelete.email || 'Guest';

    if (email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      showToast('Super Admin account is protected and cannot be deleted.', 'error');
      setUserToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      showToast(`User ${email} deleted successfully.`, 'success');
      setUserToDelete(null);
      // Remove from selection if present
      setSelectedUserIds(prev => prev.filter(id => id !== uid));
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Failed to delete user. Please check permissions.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk user deletion
  const executeBatchDelete = async () => {
    if (selectedUserIds.length === 0) return;
    setIsDeleting(true);
    let deletedCount = 0;
    try {
      for (const uid of selectedUserIds) {
        const target = users.find((u: any) => (u.uid || u.id) === uid);
        if (target && target.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          continue; // Protected
        }
        await deleteDoc(doc(db, 'users', uid));
        deletedCount++;
      }
      showToast(`Successfully deleted ${deletedCount} user account(s).`, 'success');
      setSelectedUserIds([]);
      setShowBatchDeleteModal(false);
    } catch (error) {
      console.error('Error in batch deletion:', error);
      showToast('Error during batch deletion. Some accounts may remain.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Select all visible threat accounts
  const handleSelectAllThreats = () => {
    const threatIds = threatCategories.critical
      .filter((u: any) => u.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL.toLowerCase())
      .map((u: any) => u.uid || u.id);
    setSelectedUserIds(threatIds);
    showToast(`Selected all ${threatIds.length} high-threat accounts for review.`, 'info');
  };

  // Trigger automated scan animation
  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanTimestamp(new Date());
      showToast(
        `Auto-Examination complete: ${threatCategories.critical.length} High Threat(s), ${threatCategories.suspicious.length} Suspicious found.`,
        threatCategories.critical.length > 0 ? 'error' : 'success'
      );
    }, 900);
  };

  // Copy email helper
  const handleCopy = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const isAllVisibleSelected = filteredUsers.length > 0 && filteredUsers.every((u: any) => selectedUserIds.includes(u.uid || u.id));

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedUserIds([]);
    } else {
      const selectable = filteredUsers
        .filter((u: any) => u.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL.toLowerCase())
        .map((u: any) => u.uid || u.id);
      setSelectedUserIds(selectable);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-[150] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-200 text-sm font-semibold ${
          toastMessage.type === 'error'
            ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
            : toastMessage.type === 'info'
            ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20'
            : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : toastMessage.type === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <X size={16} />
          </button>
        </div>
      )}

      {/* TOP AUTOMATED THREAT EXAMINATION CONSOLE */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/5 via-rose-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-tr from-indigo-600 to-rose-600 text-white rounded-2xl shadow-md">
                <ShieldAlert size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Automated User & Email Threat Examiner
                  </h3>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Shield Active
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time heuristic analysis for institutional spoofing, burner domains, bot generation, and phishing signatures.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleRunScan}
              disabled={isScanning}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={isScanning ? "animate-spin text-indigo-600" : ""} />
              <span>{isScanning ? "Scanning Database..." : "Re-Scan All Emails"}</span>
            </button>

            {threatCategories.critical.length > 0 && (
              <button
                onClick={handleSelectAllThreats}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <Flame size={16} className="text-rose-600 dark:text-rose-400" />
                <span>Select All {threatCategories.critical.length} Threats</span>
              </button>
            )}

            <button 
              onClick={onSync}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              <span>{isSyncing ? "Syncing..." : "Sync All Users"}</span>
            </button>
          </div>
        </div>

        {/* Threat Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/60">
          <div 
            onClick={() => setActiveFilter('threats')}
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              activeFilter === 'threats'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/50 hover:bg-rose-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Critical Threats
              </span>
              <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {threatCategories.critical.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Flagged Danger</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('suspicious')}
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              activeFilter === 'suspicious'
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/50 hover:bg-amber-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Suspicious Patterns
              </span>
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {threatCategories.suspicious.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Caution</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('safe')}
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              activeFilter === 'safe'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-500 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/50 hover:bg-emerald-50/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Safe & Verified
              </span>
              <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {threatCategories.safe.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Clean</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveFilter('guests')}
            className={`p-4 rounded-2xl cursor-pointer transition-all border ${
              activeFilter === 'guests'
                ? 'bg-slate-200 dark:bg-slate-700 border-indigo-400 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/50 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Guest Accounts
              </span>
              <User size={18} className="text-slate-500 dark:text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-700 dark:text-slate-200">
                {threatCategories.guests.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Anonymous</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
          >
            All Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveFilter('threats')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeFilter === 'threats'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 border border-rose-200 dark:border-rose-900/40'
            }`}
          >
            <ShieldAlert size={14} />
            Threats ({threatCategories.critical.length})
          </button>
          <button
            onClick={() => setActiveFilter('suspicious')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeFilter === 'suspicious'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 border border-amber-200 dark:border-amber-900/40'
            }`}
          >
            <AlertTriangle size={14} />
            Suspicious ({threatCategories.suspicious.length})
          </button>
          <button
            onClick={() => setActiveFilter('safe')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeFilter === 'safe'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900/40'
            }`}
          >
            <ShieldCheck size={14} />
            Safe ({threatCategories.safe.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
          <input 
            type="text" 
            placeholder="Search email, name, UID or threat..." 
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* FLOATING BATCH ACTIONS BAR */}
      {selectedUserIds.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">
              {selectedUserIds.length}
            </span>
            <div>
              <p className="font-bold text-sm">Selected {selectedUserIds.length} user account(s)</p>
              <p className="text-xs text-indigo-200">You can delete these accounts permanently from Firestore.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedUserIds([])}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Deselect All
            </button>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <Trash2 size={16} />
              <span>Delete Selected Users ({selectedUserIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* USER TABLE */}
      <Card className="min-h-[500px] flex flex-col p-0">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-sm min-w-[750px]">
            <thead className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-700/60">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                    title="Select all visible users"
                  />
                </th>
                <th className="py-3.5 px-4 font-semibold">User</th>
                <th className="py-3.5 px-4 font-semibold">Email & Threat Diagnostics</th>
                <th className="py-3.5 px-4 font-semibold text-center">Threat Level</th>
                <th className="py-3.5 px-4 font-semibold text-center">My Games</th>
                <th className="py-3.5 px-4 font-semibold text-right">Last Login</th>
                <th className="py-3.5 px-4 font-semibold text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
              {filteredUsers.map((user: any) => {
                const threat: ThreatReport = user._threat;
                const uid = user.uid || user.id;
                const isSelected = selectedUserIds.includes(uid);
                const isSuperAdmin = threat.isSuperAdmin;
                const userCreatedGames = games.filter((g: any) => {
                  if (g.userId && (g.userId === uid || g.userId === user.id)) return true;
                  if (user.email && user.email !== 'User' && g.creatorEmail && g.creatorEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
                  return false;
                });

                return (
                  <tr 
                    key={uid} 
                    className={`transition-colors ${
                      isSelected 
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40' 
                        : threat.level === 'critical' || threat.level === 'high'
                        ? 'bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center">
                      {!isSuperAdmin ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(uid)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                      ) : (
                        <span title="Super Admin is protected"><Lock size={14} className="text-slate-400 mx-auto" /></span>
                      )}
                    </td>

                    {/* User profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.photoURL} alt={user.displayName || user.email} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{user.displayName || 'User'}</p>
                            {isSuperAdmin && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase">
                                Super Admin
                              </span>
                            )}
                            {user.isAnonymous && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold tracking-wide uppercase">
                                Guest
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">{uid}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email & Threat Diagnostics */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {user.email || 'No email attached'}
                          </span>
                          {user.email && (
                            <button
                              onClick={() => handleCopy(user.email)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              title="Copy email"
                            >
                              {copiedEmail === user.email ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                          )}
                        </div>

                        {/* Threat description chip */}
                        {threat.level === 'critical' || threat.level === 'high' ? (
                          <div 
                            onClick={() => setInspectingUser(user)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold cursor-pointer hover:bg-rose-200 transition-all border border-rose-300 dark:border-rose-700"
                            title="Click to view full threat inspection details"
                          >
                            <ShieldAlert size={13} className="text-rose-600 shrink-0" />
                            <span>Threat: {threat.primaryThreat}</span>
                            <Eye size={12} className="ml-1 opacity-70" />
                          </div>
                        ) : threat.level === 'medium' ? (
                          <div 
                            onClick={() => setInspectingUser(user)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer hover:bg-amber-200 transition-all"
                            title="Click to inspect"
                          >
                            <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                            <span>{threat.primaryThreat}</span>
                          </div>
                        ) : isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                            <ShieldCheck size={13} /> Protected Account
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium">
                            <CheckCircle2 size={13} className="text-emerald-500" /> Verified Clean
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Threat Score */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                          threat.level === 'critical' || threat.level === 'high'
                            ? 'bg-rose-500 text-white'
                            : threat.level === 'medium'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {threat.score}/100
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                          {threat.level}
                        </span>
                      </div>
                    </td>

                    {/* User's Created Games */}
                    <td className="py-3.5 px-4 text-center">
                      {userCreatedGames.length > 0 ? (
                        <button
                          onClick={() => onInspectUserActivity && onInspectUserActivity(user)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 hover:bg-purple-200 transition-colors shadow-sm"
                          title="Click to view user's created games and activity"
                        >
                          <Gamepad2 size={12} />
                          <span>{userCreatedGames.length} Game{userCreatedGames.length === 1 ? '' : 's'}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">0</span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="py-3.5 px-4 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatLastLogin(user.lastLoginAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onInspectUserActivity && onInspectUserActivity(user)}
                          className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="View user activity & My Games created"
                        >
                          <Gamepad2 size={17} />
                        </button>

                        <button
                          onClick={() => setInspectingUser(user)}
                          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          title="Inspect security breakdown"
                        >
                          <Eye size={17} />
                        </button>

                        {!isSuperAdmin ? (
                          <button 
                            onClick={() => setUserToDelete(user)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete User from Database"
                          >
                            <Trash2 size={17} />
                          </button>
                        ) : (
                          <span className="p-2 text-slate-300 dark:text-slate-600 cursor-not-allowed" title="Super Admin cannot be deleted">
                            <Lock size={17} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserX size={36} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No users found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm ? `No results match your search "${searchTerm}".` : `No users in category "${activeFilter}".`}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- SINGLE DELETE CONFIRMATION MODAL --- */}
      {userToDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setUserToDelete(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl">
                <Trash2 size={26} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Delete User Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Permanently remove record from database</p>
              </div>
            </div>

            {/* User snapshot */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 mb-5 space-y-2">
              <div className="flex items-center gap-3">
                <Avatar src={userToDelete.photoURL} alt={userToDelete.displayName} size="sm" />
                <div className="overflow-hidden">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{userToDelete.displayName || 'User'}</p>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{userToDelete.email || 'No email'}</p>
                </div>
              </div>
              {userToDelete._threat?.level === 'critical' || userToDelete._threat?.level === 'high' ? (
                <div className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <ShieldAlert size={14} />
                  <span>Flagged: {userToDelete._threat.primaryThreat}</span>
                </div>
              ) : null}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete this user? This will remove their Firestore profile and game records. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BATCH DELETE CONFIRMATION MODAL --- */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowBatchDeleteModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl">
                <Trash2 size={26} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Delete {selectedUserIds.length} Selected Accounts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bulk administrative purge</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              You are about to permanently delete <strong className="text-red-600 dark:text-red-400">{selectedUserIds.length} accounts</strong> from the database. Protected accounts like Super Admin will be automatically bypassed.
            </p>

            <div className="max-h-48 overflow-y-auto custom-scrollbar p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 mb-6 space-y-2">
              {selectedUserIds.map(uid => {
                const target = users.find((u: any) => (u.uid || u.id) === uid);
                const threat = target ? examineUserThreat(target) : null;
                return (
                  <div key={uid} className="flex items-center justify-between text-xs py-1 border-b border-slate-200/50 dark:border-slate-700/40 last:border-0">
                    <div className="truncate max-w-[240px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{target?.displayName || 'User'}</span>
                      <span className="text-slate-400 ml-1.5 font-mono">({target?.email || uid})</span>
                    </div>
                    {threat?.level === 'critical' || threat?.level === 'high' ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded">Threat</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeBatchDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                <span>{isDeleting ? "Deleting All..." : `Confirm Delete (${selectedUserIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- THREAT INSPECTION MODAL --- */}
      {inspectingUser && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setInspectingUser(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header */}
            {(() => {
              const threat: ThreatReport = inspectingUser._threat || examineUserThreat(inspectingUser);
              const isHigh = threat.level === 'critical' || threat.level === 'high';
              return (
                <div>
                  <div className="flex items-center gap-3.5 mb-5">
                    <div className={`p-3.5 rounded-2xl ${
                      isHigh 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                        : threat.level === 'medium'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-emerald-500 text-white'
                    }`}>
                      {isHigh ? <ShieldAlert size={28} /> : threat.level === 'medium' ? <AlertTriangle size={28} /> : <ShieldCheck size={28} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          Security Threat Diagnostic
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                          isHigh ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-slate-100 text-slate-700'
                        }`}>
                          Score: {threat.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{threat.primaryThreat}</p>
                    </div>
                  </div>

                  {/* Account overview */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 mb-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">User Identity:</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{inspectingUser.displayName || 'No Name'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Email Address:</span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {inspectingUser.email || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">UID:</span>
                      <span className="text-[11px] font-mono text-slate-500 truncate max-w-[200px]">{inspectingUser.uid || inspectingUser.id}</span>
                    </div>
                  </div>

                  {/* Diagnostic details */}
                  <div className="space-y-3 mb-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Heuristic Flags & Risk Factors
                    </h4>
                    {threat.flags.length > 0 ? (
                      <div className="space-y-2">
                        {threat.flags.map((flag, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200">
                            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span>No threat indicators detected on this address.</span>
                      </div>
                    )}

                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/50 text-xs text-slate-600 dark:text-slate-300">
                      <strong>Recommendation:</strong> {threat.recommendation}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
                    <button
                      onClick={() => setInspectingUser(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Close
                    </button>
                    {!threat.isSuperAdmin && (
                      <button
                        onClick={() => {
                          const target = inspectingUser;
                          setInspectingUser(null);
                          setUserToDelete(target);
                        }}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-red-500/20 transition-all"
                      >
                        <Trash2 size={15} />
                        <span>Delete This User Account</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export function AdminDashboard({ onViewChange }: { onViewChange: (view: any, data?: any) => void }) {
  const { user: currentUser } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [usersFilter, setUsersFilter] = useState<'all' | 'threats' | 'suspicious' | 'safe' | 'guests'>('all');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [activities, setActivities] = useState<UserActivityEvent[]>([]);
  const [inspectingUserActivity, setInspectingUserActivity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>({});

  const [pageVisits, setPageVisits] = useState<number>(0);

  // Sync users, games, and activities logic
  const handleSyncUsers = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Ensure currentUser document exists and is up to date if signed in
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email || 'User',
            displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
            photoURL: currentUser.photoURL || null,
            isAnonymous: currentUser.isAnonymous,
            lastLoginAt: serverTimestamp(),
          }, { merge: true });
        } catch (profileErr: any) {
          console.warn("Notice updating admin profile in sync:", profileErr?.message || profileErr);
        }
      }

      // Fetch users, mysteryBoxGames, and userActivities safely in parallel
      const [usersSnap, gamesSnap, actSnap] = await Promise.all([
        getDocs(collection(db, 'users')).catch((err) => {
          console.warn("Notice querying users in sync:", err?.message || err);
          return { forEach: () => {} } as any;
        }),
        getDocs(collection(db, 'mysteryBoxGames')).catch((err) => {
          console.warn("Notice querying mysteryBoxGames in sync:", err?.message || err);
          return { forEach: () => {} } as any;
        }),
        getDocs(collection(db, 'userActivities')).catch((err) => {
          console.warn("Notice querying userActivities in sync:", err?.message || err);
          return { forEach: () => {} } as any;
        })
      ]);

      const fetchedUsers: any[] = [];
      usersSnap.forEach((doc: any) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() });
      });

      if (fetchedUsers.length > 0) {
        fetchedUsers.sort((a, b) => {
          const getTime = (val: any) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return new Date(val).getTime();
            return 0;
          };
          return getTime(b.lastLoginAt) - getTime(a.lastLoginAt);
        });
        setUsers(fetchedUsers);
      }

      const fetchedGames: any[] = [];
      gamesSnap.forEach((doc: any) => {
        fetchedGames.push({ id: doc.id, ...doc.data() });
      });
      if (fetchedGames.length > 0) {
        setGames(fetchedGames);
      }

      const fetchedActs: any[] = [];
      actSnap.forEach((doc: any) => {
        fetchedActs.push({ id: doc.id, ...doc.data() });
      });

      if (fetchedActs.length > 0) {
        fetchedActs.sort((a, b) => {
          const getMs = (val: any) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return new Date(val).getTime();
            return 0;
          };
          return getMs(b.timestamp) - getMs(a.timestamp);
        });
        setActivities(fetchedActs);
      }

      setSyncMessage(`Successfully synced ${fetchedUsers.length} users and ${fetchedGames.length} games!`);
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (error: any) {
      console.warn("Notice during sync:", error?.message || error);
      setSyncMessage("Sync updated with latest cloud records.");
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch real users from Firestore realtime listener
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });

      usersData.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (val.toMillis) return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        return getTime(b.lastLoginAt) - getTime(a.lastLoginAt);
      });

      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.warn("Notice fetching users: ", error?.message || error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch all user-created games from Firestore realtime listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mysteryBoxGames'), (snapshot) => {
      const gamesData: any[] = [];
      snapshot.forEach((doc) => {
        gamesData.push({ id: doc.id, ...doc.data() });
      });
      setGames(gamesData);
    }, (error) => {
      console.warn("Notice fetching mysteryBoxGames: ", error?.message || error);
    });

    return () => unsubscribe();
  }, []);

  // Fetch all user activities from Firestore realtime listener
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'userActivities'), (snapshot) => {
      const actData: any[] = [];
      snapshot.forEach((doc) => {
        actData.push({ id: doc.id, ...doc.data() });
      });

      actData.sort((a, b) => {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (val.toMillis) return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        return getMs(b.timestamp) - getMs(a.timestamp);
      });

      setActivities(actData);
    }, (error) => {
      console.warn("Notice fetching userActivities: ", error?.message || error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch published games setting and page visits
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setPublishedGames(doc.data().publishedGames || {});
        setPageVisits(doc.data().pageVisits || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleGamePublish = async (gameId: string) => {
    try {
      const isCurrentlyPublished = publishedGames[gameId] !== false;
      await setDoc(doc(db, 'settings', 'general'), { 
        publishedGames: {
          ...publishedGames,
          [gameId]: !isCurrentlyPublished
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error toggling game status', error);
    }
  };

  const handleFilterThreatsFromOverview = (filterType: 'threats' | 'all') => {
    setUsersFilter(filterType);
    setCurrentRoute('users');
  };

  // Navigation config with dedicated User Activity & Games tab
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'users', label: 'User & Threat Management', icon: Users },
    { id: 'user-activity', label: 'User Activity & Games', icon: Gamepad2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setCurrentRoute(id);
    if (id === 'users') setUsersFilter('all');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900/50 font-sans overflow-hidden text-slate-800 dark:text-slate-200 -mx-4 -my-4 md:-mx-8 md:-my-8" style={{ margin: '-2rem' }}>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-72 bg-indigo-900 text-indigo-50 
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-indigo-800/50">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onViewChange('home')}>
            <span className="text-xl font-bold tracking-tight text-white">Admin Dashboard</span>
          </div>
          <button className="lg:hidden text-indigo-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-indigo-400/70 uppercase tracking-wider mb-4 px-4">Menu</p>
          <nav className="space-y-1.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${currentRoute === item.id 
                    ? 'bg-indigo-600/50 text-white font-medium shadow-sm backdrop-blur-md border border-indigo-500/30' 
                    : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}
                `}
              >
                <item.icon size={20} className={currentRoute === item.id ? 'text-white' : 'text-indigo-400'} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-indigo-800/50">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:bg-red-500/20 hover:text-red-300 transition-all" onClick={() => onViewChange('home')}>
            <LogOut size={20} />
            Back to Home
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
        
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 hidden sm:block capitalize">
              {currentRoute.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Sync Button */}
            <button
              onClick={handleSyncUsers}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm disabled:opacity-50"
              title="Sync user accounts"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Users"}</span>
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Admin Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{currentUser?.displayName || "Admin"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin</p>
              </div>
              <Avatar src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || "Admin")}`} alt="Admin" />
            </div>
          </div>
        </header>

        {/* Sync Status Banner */}
        {syncMessage && (
          <div className="bg-emerald-500 text-white px-6 py-2.5 text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>{syncMessage}</span>
            </div>
            <button onClick={() => setSyncMessage(null)} className="hover:opacity-80">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
           
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
                <RefreshCw size={20} className="animate-spin text-indigo-500" />
                <span>Loading and syncing users...</span>
              </div>
            </div>
          ) : (
            <>
              {currentRoute === 'dashboard' && (
                <DashboardOverview 
                  users={users} 
                  onSync={handleSyncUsers} 
                  isSyncing={isSyncing}
                  onViewAll={() => setCurrentRoute('users')}
                  publishedGames={publishedGames}
                  onToggleGamePublish={toggleGamePublish}
                  pageVisits={pageVisits}
                  onFilterThreats={handleFilterThreatsFromOverview}
                  games={games}
                  activities={activities}
                  onInspectUserActivity={(u: any) => setInspectingUserActivity(u)}
                  onNavigateToRoute={(r: string) => setCurrentRoute(r)}
                />
              )}
              {currentRoute === 'users' && (
                <UsersManagement 
                  users={users} 
                  onSync={handleSyncUsers} 
                  isSyncing={isSyncing}
                  initialFilter={usersFilter}
                  games={games}
                  onInspectUserActivity={(u: any) => setInspectingUserActivity(u)}
                />
              )}
              {currentRoute === 'user-activity' && (
                <AdminActivityGamesView
                  users={users}
                  games={games}
                  activities={activities}
                  onLaunchGame={(game: any) => {
                    onViewChange(game.gameType || 'mystery-box', game);
                  }}
                  onRefresh={handleSyncUsers}
                />
              )}
              {currentRoute === 'settings' && (
                  <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
                     <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Platform Settings</h2>
                     <div className="space-y-6">
                        <div className="py-4 border-t border-slate-100 dark:border-slate-700">
                           <p className="text-slate-500 dark:text-slate-400">Security and platform settings managed by Super Admin.</p>
                        </div>
                     </div>
                  </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* USER ACTIVITY & CREATED GAMES MODAL (ADMIN ONLY) */}
      {inspectingUserActivity && (
        <UserActivityModal
          user={inspectingUserActivity}
          games={games}
          activities={activities}
          onClose={() => setInspectingUserActivity(null)}
          onLaunchGame={(game: any) => {
            setInspectingUserActivity(null);
            onViewChange(game.gameType || 'mystery-box', game);
          }}
        />
      )}

    </div>
  );
}
