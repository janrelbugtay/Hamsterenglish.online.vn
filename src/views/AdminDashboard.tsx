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
import {
  isRegisteredUser,
  mergePlatformUsers,
  mergeAdminGames,
  mergeAdminActivities,
  getCachedPageVisits,
  setCachedPageVisits,
  syncWithServerPlatformCache,
  isGameOwnedByUser,
  getUserCreatedGames,
  markUserDeleted,
} from '../utils/platformCache';

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
const Card = ({ children, className = '', title, subtitle, action }: any) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-200/90 dark:border-slate-700/80 overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-700/70 flex justify-between items-center flex-wrap gap-3 bg-slate-50/50 dark:bg-slate-800/60">
        <div>
          {title && <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, subtitle, trend, icon: Icon, tone = 'blue', highlight, onClick, children }: any) => {
  const toneStyles: Record<string, { iconBox: string; accentBar: string }> = {
    blue: {
      iconBox: 'bg-blue-50 text-blue-600 border border-blue-200/70 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
      accentBar: 'bg-blue-500',
    },
    emerald: {
      iconBox: 'bg-emerald-50 text-emerald-600 border border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
      accentBar: 'bg-emerald-500',
    },
    purple: {
      iconBox: 'bg-purple-50 text-purple-600 border border-purple-200/70 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
      accentBar: 'bg-purple-500',
    },
    rose: {
      iconBox: 'bg-rose-50 text-rose-600 border border-rose-200/70 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
      accentBar: 'bg-rose-500',
    },
  };
  const activeTone = toneStyles[tone] || toneStyles.blue;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-[0_2px_12px_rgba(15,23,42,0.05)] border border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all relative overflow-hidden group h-full flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            {title}
          </p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight flex items-baseline gap-2">
            {value}
            {highlight && <span className="text-xs font-semibold text-slate-400">{highlight}</span>}
          </h2>
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${activeTone.iconBox}`}>
          <Icon size={22} />
        </div>
      </div>
      <div className="mt-auto">
        {subtitle && (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {trend && (
              <span className={`font-bold tabular-nums ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'} flex items-center`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
};

const Avatar = ({ src, alt, size = 'md' }: any) => {
  const sizes: any = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', xl: 'w-24 h-24' };
  return (
    <img 
      src={src} 
      alt={alt} 
      referrerPolicy="no-referrer"
      className={`${sizes[size]} rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover bg-slate-100 dark:bg-slate-700 shrink-0`}
      onError={(e: any) => { e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(alt || 'User'); }}
    />
  );
};

// --- APP GAMES CONFIG (Aligned with Home Studio Categories & 3D Artwork) ---
const APP_GAMES = [
  // Classroom Tools
  { id: "squid-game-picker", title: "Name Picker", category: "Classroom Tools", imageUrl: "/images/name-picker-card-v3.png?v=3", icon: "🎯" },
  { id: "flashcards-match", title: "Flashcard", category: "Classroom Tools", imageUrl: "/images/flashcards-card-v3.jpg?v=3", icon: "🃏" },
  { id: "hamster-pop-quiz", title: "Video Quiz", category: "Classroom Tools", imageUrl: "/images/video-quiz-card-v3.jpg?v=3", icon: "🎬" },
  { id: "phonemic-master", title: "Phonemic Master", category: "Classroom Tools", imageUrl: "/images/phonemic-master-card-v3.jpg?v=3", icon: "🗣️" },
  // AR Camera Games
  { id: "slap-and-chop", title: "Mosquito Slap", category: "AR Camera Games", imageUrl: "/images/mosquito-slap-card.jpg?v=3", icon: "🦟" },
  { id: "bubble-pop", title: "Bubble Pop", category: "AR Camera Games", imageUrl: "/images/bubble-pop-card.jpg?v=3", icon: "🫧" },
  { id: "roller-coaster-quiz", title: "Roller Coaster Quiz", category: "AR Camera Games", imageUrl: "/images/roller-coaster-quiz-card.jpg?v=3", icon: "🎢" },
  { id: "yoga-quiz", title: "Yoga Quiz", category: "AR Camera Games", imageUrl: "/images/yoga-quiz-card.jpg?v=3", icon: "🧘" },
  // Board Trivia & Team Games
  { id: "mystery-box", title: "Mystery Box", category: "Board Trivia & Team Games", imageUrl: "/images/mystery-box-card.jpg?v=3", icon: "🎁" },
  { id: "neon-chain", title: "Neon Chain", category: "Board Trivia & Team Games", imageUrl: "/images/neon-chain-card.jpg?v=3", icon: "⚡" },
  { id: "bubble-sentence-pro", title: "Bubble Island", category: "Board Trivia & Team Games", imageUrl: "/images/bubble-island-card.jpg?v=3", icon: "🏝️" },
  { id: "shark-attack", title: "Shark Attack", category: "Board Trivia & Team Games", imageUrl: "/images/shark-attack-card.jpg?v=3", icon: "🦈" },
  { id: "family-feud", title: "Family Feud", category: "Board Trivia & Team Games", imageUrl: "/images/family-feud-card.jpg?v=3", icon: "👨‍👩‍👧‍👦" },
  { id: "sumo", title: "Sumo Tags", category: "Board Trivia & Team Games", imageUrl: "/images/sumo-tags-card.jpg?v=3", icon: "🤼" },
  // Multiplayer Games
  { id: "hamster-paintball", title: "Hamster Paintball", category: "Multiplayer Games", imageUrl: "/images/hamster-paintball-card.jpg?v=3", icon: "🎯" },
  { id: "tic-tac-toe", title: "Tic Tac Toe Battle", category: "Multiplayer Games", imageUrl: "/images/tic-tac-toe-card.jpg?v=3", icon: "❌" },
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
  const registeredUsersList = users.filter((u: any) => isRegisteredUser(u));
  const registeredUsers = registeredUsersList.length;
  const guestUsersList = users.filter((u: any) => !isRegisteredUser(u));
  const guestUsers = guestUsersList.length;

  const [appCategoryFilter, setAppCategoryFilter] = React.useState<string>('all');
  const [appSearchQuery, setAppSearchQuery] = React.useState<string>('');

  const threatStats = useMemo(() => categorizeThreats(users), [users]);
  const highThreatExample = threatStats.critical[0]?.user;

  const appCategories = [
    'Classroom Tools',
    'AR Camera Games',
    'Board Trivia & Team Games',
    'Multiplayer Games',
  ];

  const filteredAppGames = useMemo(() => {
    return APP_GAMES.filter((g) => {
      if (appCategoryFilter !== 'all' && g.category !== appCategoryFilter) return false;
      if (appSearchQuery.trim()) {
        const q = appSearchQuery.toLowerCase().trim();
        return g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [appCategoryFilter, appSearchQuery]);

  const publishedCount = useMemo(
    () => APP_GAMES.filter((g) => publishedGames[g.id] !== false).length,
    [publishedGames]
  );

  return (
    <div className="space-y-6">
      {/* Security Threat Alert Banner */}
      {threatStats.critical.length > 0 && (
        <div className="bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-600 text-white rounded-xl shadow-sm shrink-0">
                <ShieldAlert size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-rose-900 dark:text-rose-200">
                    Security Warning: {threatStats.critical.length} Potential Email Threat{threatStats.critical.length > 1 ? 's' : ''} Detected
                  </h3>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    · Action Required
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  Automatic analysis flagged suspicious accounts (e.g. institutional domain spoofing, fake school emails like <span className="font-mono font-semibold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/40 px-1.5 py-0.5 rounded">{highThreatExample?.email || 'spoofed@gmail.com'}</span>).
                </p>
              </div>
            </div>
            <button
              onClick={() => onFilterThreats('threats')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 whitespace-nowrap shrink-0 self-stretch md:self-auto justify-center cursor-pointer"
            >
              <span>Examine & Delete Threats</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="Total Visits & Users"
          value={pageVisits.toLocaleString()} 
          subtitle={`${guestUsers} guest session${guestUsers === 1 ? '' : 's'} recorded`}
          icon={Users}
          tone="blue"
          onClick={() => setShowGuestModal(true)}
        >
          <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {users.length} total accounts
            </span>
            <span className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
              Inspect Guests →
            </span>
          </div>
        </StatCard>

        <StatCard 
          title="Registered Teachers"
          value={registeredUsers.toLocaleString()} 
          subtitle="Verified non-guest accounts"
          icon={UserCheck}
          tone="emerald"
          onClick={onViewAll}
        >
          {registeredUsersList.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                {registeredUsersList.slice(0, 2).map((u: any) => u.displayName || u.email).join(' · ')}
              </span>
              {registeredUsersList.length > 2 && (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap shrink-0 tabular-nums">
                  +{registeredUsersList.length - 2} more
                </span>
              )}
            </div>
          )}
        </StatCard>

        <StatCard 
          title="My Games Created"
          value={games.length.toLocaleString()} 
          subtitle="Custom teacher-built games"
          icon={Gamepad2}
          tone="purple"
          onClick={() => onNavigateToRoute && onNavigateToRoute('user-activity')}
        >
          <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {activities.length} recorded events
            </span>
            <span className="font-bold text-purple-600 dark:text-purple-400 hover:underline whitespace-nowrap shrink-0">
              Inspect Games →
            </span>
          </div>
        </StatCard>

        <StatCard 
          title="Email Threats"
          value={threatStats.critical.length.toString()} 
          subtitle={threatStats.critical.length === 0 ? "All scanned emails safe" : "High-risk emails flagged"}
          icon={ShieldAlert}
          tone={threatStats.critical.length > 0 ? "rose" : "emerald"}
          onClick={() => onFilterThreats('threats')}
        >
          <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {threatStats.medium.length} suspicious pattern{threatStats.medium.length === 1 ? '' : 's'}
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0">
              Review Threats →
            </span>
          </div>
        </StatCard>
      </div>
      
      {/* Manage Studio Apps (With 3D Thumbnails, Category Filter Tabs & Search) */}
      <Card
        title="Manage Studio Apps"
        subtitle={`${publishedCount} of ${APP_GAMES.length} games currently visible on the Home Studio`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={appSearchQuery}
                onChange={(e) => setAppSearchQuery(e.target.value)}
                placeholder="Filter apps..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-48"
              />
            </div>
          </div>
        }
      >
        {/* Category Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-4 border-b border-slate-200/70 dark:border-slate-700/60 no-scrollbar">
          <button
            type="button"
            onClick={() => setAppCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              appCategoryFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-700/60 dark:text-slate-300'
            }`}
          >
            All Apps ({APP_GAMES.length})
          </button>
          {appCategories.map((cat) => {
            const count = APP_GAMES.filter((g) => g.category === cat).length;
            const active = appCategoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setAppCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-slate-700/60 dark:text-slate-300'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAppGames.map((game) => {
            const isGamePublished = publishedGames[game.id] !== false;
            return (
              <div
                key={game.id}
                className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                  isGamePublished
                    ? 'bg-white dark:bg-slate-900/70 border-slate-200/90 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                    : 'bg-slate-100/70 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={game.imageUrl}
                    alt={game.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-11 rounded-lg object-cover shadow-xs shrink-0 bg-slate-200 dark:bg-slate-700"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                      {game.title}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {isGamePublished ? 'Published' : 'Hidden'} · {game.category.replace(' & Team Games', '')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleGamePublish(game.id)}
                  role="switch"
                  aria-checked={isGamePublished}
                  className={`w-11 h-6 shrink-0 ${
                    isGamePublished
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                  } rounded-full relative transition-colors duration-200 focus:outline-none cursor-pointer`}
                  title={isGamePublished ? 'Unpublish App' : 'Publish App'}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-xs transition-all duration-200 ${
                      isGamePublished ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </Card>

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
                const userCreatedGames = getUserCreatedGames(user, games, activities);

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
                          {!isRegisteredUser(user) && (
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
const UsersManagement = ({ users, onSync, isSyncing, initialFilter = 'all', games = [], activities = [], onInspectUserActivity }: any) => {
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

  // Analyze all users with the threat engine and memoize their created games once
  const analyzedUsers = useMemo(() => {
    return users.map((u: any) => ({
      ...u,
      _threat: examineUserThreat(u),
      _createdGames: getUserCreatedGames(u, games, activities),
    }));
  }, [users, games, activities]);

  // Threat categorizations
  const threatCategories = useMemo(() => {
    const critical = analyzedUsers.filter((u: any) => u._threat.level === 'critical' || u._threat.level === 'high');
    const suspicious = analyzedUsers.filter((u: any) => u._threat.level === 'medium');
    const safe = analyzedUsers.filter((u: any) => (u._threat.level === 'safe' || u._threat.level === 'low') && isRegisteredUser(u));
    const guests = analyzedUsers.filter((u: any) => !isRegisteredUser(u));
    return { critical, suspicious, safe, guests };
  }, [analyzedUsers]);

  // Filtered users according to search and active tab
  const filteredUsers = useMemo(() => {
    return analyzedUsers.filter((u: any) => {
      // Filter tab
      if (activeFilter === 'threats' && u._threat.level !== 'critical' && u._threat.level !== 'high') return false;
      if (activeFilter === 'suspicious' && u._threat.level !== 'medium') return false;
      if (activeFilter === 'safe' && ((u._threat.level !== 'safe' && u._threat.level !== 'low') || !isRegisteredUser(u))) return false;
      if (activeFilter === 'guests' && isRegisteredUser(u)) return false;

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
      markUserDeleted(uid);
      await deleteDoc(doc(db, 'users', uid)).catch(() => {});
      try {
        const cached = JSON.parse(localStorage.getItem('hamster_cached_admin_users_v2') || '[]');
        localStorage.setItem(
          'hamster_cached_admin_users_v2',
          JSON.stringify(cached.filter((u: any) => (u?.uid || u?.id) !== uid))
        );
      } catch {}
      fetch('/api/platform-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedUserIds: [uid] }),
      }).catch(() => {});
      showToast(`User ${email} deleted successfully.`, 'success');
      setUserToDelete(null);
      setSelectedUserIds(prev => prev.filter(id => id !== uid));
      if (onSync) onSync();
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
    const deletedIds: string[] = [];
    try {
      for (const uid of selectedUserIds) {
        const target = users.find((u: any) => (u.uid || u.id) === uid);
        if (target && target.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          continue; // Protected
        }
        markUserDeleted(uid);
        await deleteDoc(doc(db, 'users', uid)).catch(() => {});
        deletedIds.push(uid);
        deletedCount++;
      }
      if (deletedIds.length > 0) {
        try {
          const delSet = new Set(deletedIds);
          const cached = JSON.parse(localStorage.getItem('hamster_cached_admin_users_v2') || '[]');
          localStorage.setItem(
            'hamster_cached_admin_users_v2',
            JSON.stringify(cached.filter((u: any) => !delSet.has(u?.uid || u?.id)))
          );
        } catch {}
        fetch('/api/platform-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deletedUserIds: deletedIds }),
        }).catch(() => {});
      }
      showToast(`Successfully deleted ${deletedCount} user account(s).`, 'success');
      setSelectedUserIds([]);
      setShowBatchDeleteModal(false);
      if (onSync) onSync();
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
                const userCreatedGames = user._createdGames || [];

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
  const [users, setUsers] = useState<any[]>(() => {
    const initialGames = mergeAdminGames([], currentUser);
    const initialActs = mergeAdminActivities([], initialGames);
    return mergePlatformUsers([], initialGames, initialActs, currentUser);
  });
  const [games, setGames] = useState<any[]>(() => mergeAdminGames([], currentUser));
  const [activities, setActivities] = useState<UserActivityEvent[]>(() => {
    const initialGames = mergeAdminGames([], currentUser);
    return mergeAdminActivities([], initialGames);
  });
  const [inspectingUserActivity, setInspectingUserActivity] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('publishedGamesV2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [pageVisits, setPageVisits] = useState<number>(() => getCachedPageVisits());

  // Keep refs to latest games and activities so real-time onSnapshot listeners never read stale state
  const gamesRef = React.useRef<any[]>(games);
  const activitiesRef = React.useRef<UserActivityEvent[]>(activities);
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

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
            email: currentUser.email || 'Guest',
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
      usersSnap.forEach((docSnap: any) => {
        const data = docSnap.data();
        fetchedUsers.push({
          id: docSnap.id,
          ...data,
          // If serverTimestamp() in memoryLocalCache hasn't resolved yet, preserve current time for currentUser
          lastLoginAt:
            data.lastLoginAt ||
            (currentUser && docSnap.id === currentUser.uid ? Date.now() : null),
        });
      });

      const fetchedGames: any[] = [];
      gamesSnap.forEach((docSnap: any) => {
        fetchedGames.push({ id: docSnap.id, ...docSnap.data() });
      });

      const fetchedActs: any[] = [];
      actSnap.forEach((docSnap: any) => {
        fetchedActs.push({ id: docSnap.id, ...docSnap.data() });
      });

      const hasAuthoritativeGames = fetchedGames.length > 0;
      const mergedGames = mergeAdminGames(fetchedGames, currentUser, {
        replaceCloudCache: hasAuthoritativeGames,
      });
      const mergedActs = mergeAdminActivities(fetchedActs, mergedGames);
      const mergedUsers = mergePlatformUsers(fetchedUsers, mergedGames, mergedActs, currentUser);

      setGames(mergedGames);
      setActivities(mergedActs);
      setUsers(mergedUsers);

      const serverCache = await syncWithServerPlatformCache({
        games: mergedGames,
        users: mergedUsers,
        activities: mergedActs,
        pageVisits,
        replaceGames: hasAuthoritativeGames,
      });

      if (serverCache) {
        const finalGames = hasAuthoritativeGames
          ? mergedGames
          : mergeAdminGames([...mergedGames, ...(serverCache.games || [])], currentUser);
        const finalActs = mergeAdminActivities(
          [...mergedActs, ...(serverCache.activities || [])],
          finalGames
        );
        const finalUsers = mergePlatformUsers(
          [...mergedUsers, ...(serverCache.users || [])],
          finalGames,
          finalActs,
          currentUser
        );
        setGames(finalGames);
        setActivities(finalActs);
        setUsers(finalUsers);
        if (serverCache.pageVisits) {
          setPageVisits(setCachedPageVisits(serverCache.pageVisits));
        }
        const regCount = finalUsers.filter((u: any) => isRegisteredUser(u)).length;
        setSyncMessage(`Synced ${regCount} registered users and ${finalGames.length} games!`);
      } else {
        const regCount = mergedUsers.filter((u: any) => isRegisteredUser(u)).length;
        setSyncMessage(`Synced ${regCount} registered users and ${mergedGames.length} games!`);
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (error: any) {
      console.warn("Notice during sync:", error?.message || error);
      setSyncMessage("Sync updated with latest platform records.");
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch real users from Firestore realtime listener & merge with platform cache
  useEffect(() => {
    const initialGames = mergeAdminGames([], currentUser);
    const initialActs = mergeAdminActivities([], initialGames);
    const initialUsers = mergePlatformUsers([], initialGames, initialActs, currentUser);
    setGames(initialGames);
    setActivities(initialActs);
    setUsers(initialUsers);
    setLoading(false);

    syncWithServerPlatformCache({
      games: initialGames,
      users: initialUsers,
      activities: initialActs,
    }).then((serverData) => {
      if (serverData) {
        const g = mergeAdminGames(serverData.games || [], currentUser, {
          replaceCloudCache: Array.isArray(serverData.games) && serverData.games.length > 0,
        });
        const a = mergeAdminActivities(serverData.activities || [], g);
        const u = mergePlatformUsers(serverData.users || [], g, a, currentUser);
        setGames(g);
        setActivities(a);
        setUsers(u);
        if (serverData.pageVisits) {
          setPageVisits(setCachedPageVisits(serverData.pageVisits));
        }
      }
    });

    if (!currentUser) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersData.push({
          id: docSnap.id,
          ...data,
          lastLoginAt:
            data.lastLoginAt ||
            (currentUser && docSnap.id === currentUser.uid ? Date.now() : null),
        });
      });

      setUsers((prev) =>
        mergePlatformUsers(
          usersData.length > 0 ? usersData : prev,
          gamesRef.current,
          activitiesRef.current,
          currentUser
        )
      );
      setLoading(false);
    }, (error) => {
      console.warn("Notice fetching users: ", error?.message || error);
      setUsers((prev) => mergePlatformUsers(prev, gamesRef.current, activitiesRef.current, currentUser));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch all user-created games from Firestore realtime listener & merge with platform cache
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'mysteryBoxGames'), (snapshot) => {
      const gamesData: any[] = [];
      snapshot.forEach((docSnap) => {
        gamesData.push({ id: docSnap.id, ...docSnap.data() });
      });
      const merged = mergeAdminGames(gamesData, currentUser, {
        replaceCloudCache: gamesData.length > 0,
      });
      gamesRef.current = merged;
      setGames(merged);
      setUsers((prevUsers) =>
        mergePlatformUsers(prevUsers, merged, activitiesRef.current, currentUser)
      );
    }, (error) => {
      console.warn("Notice fetching mysteryBoxGames: ", error?.message || error);
      setGames((prev) => mergeAdminGames(prev, currentUser));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch all user activities from Firestore realtime listener
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'userActivities'), (snapshot) => {
      const actData: any[] = [];
      snapshot.forEach((docSnap) => {
        actData.push({ id: docSnap.id, ...docSnap.data() });
      });

      setActivities((prev) => {
        const merged = mergeAdminActivities([...prev, ...actData], gamesRef.current);
        activitiesRef.current = merged;
        setUsers((prevUsers) =>
          mergePlatformUsers(prevUsers, gamesRef.current, merged, currentUser)
        );
        return merged;
      });
    }, (error) => {
      console.warn("Notice fetching userActivities: ", error?.message || error);
      setActivities((prev) => mergeAdminActivities(prev, gamesRef.current));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch published games setting and page visits
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'general'), 
      (doc) => {
        if (doc.exists()) {
          const pub = doc.data().publishedGamesV2 || {};
          setPublishedGames(pub);
          try {
            localStorage.setItem('publishedGamesV2', JSON.stringify(pub));
            window.dispatchEvent(new CustomEvent('publishedGamesChanged', { detail: pub }));
          } catch (e) {}
          const visits = doc.data().pageVisits || 0;
          setPageVisits(setCachedPageVisits(visits));
        }
      },
      (err) => {
        console.warn("Notice in Admin settings listener:", err?.message || err);
        setPageVisits(getCachedPageVisits());
      }
    );
    return () => unsubscribe();
  }, []);

  const toggleGamePublish = async (gameId: string) => {
    try {
      const isCurrentlyPublished = publishedGames[gameId] !== false;
      const nextState = !isCurrentlyPublished;
      const updated: Record<string, boolean> = {
        ...publishedGames,
        [gameId]: nextState
      };
      if (gameId === 'hamster-paintball') {
        updated['hamsterpaintball'] = nextState;
        updated['paintball'] = nextState;
      } else if (gameId === 'sumo') {
        updated['sumo-tags'] = nextState;
        updated['sumotags'] = nextState;
      } else if (gameId === 'bubble-sentence-pro') {
        updated['bubble-island'] = nextState;
        updated['bubblesentencepro'] = nextState;
      } else if (gameId === 'roller-coaster-quiz') {
        updated['rollercoasterquiz'] = nextState;
      } else if (gameId === 'slap-and-chop') {
        updated['slapandchop'] = nextState;
      }
      setPublishedGames(updated);
      try {
        localStorage.setItem('publishedGamesV2', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('publishedGamesChanged', { detail: updated }));
      } catch (e) {}

      await setDoc(doc(db, 'settings', 'general'), { 
        publishedGamesV2: updated
      }, { merge: true });
    } catch (error) {
      console.error('Error toggling game status', error);
    }
  };

  const handleFilterThreatsFromOverview = (filterType: 'threats' | 'all') => {
    setUsersFilter(filterType);
    setCurrentRoute('users');
  };

  const publishAllGames = async (publishState: boolean) => {
    try {
      const updated: Record<string, boolean> = { ...publishedGames };
      APP_GAMES.forEach((g) => {
        updated[g.id] = publishState;
      });
      updated['hamsterpaintball'] = publishState;
      updated['paintball'] = publishState;
      updated['sumo-tags'] = publishState;
      updated['sumotags'] = publishState;
      updated['bubble-island'] = publishState;
      updated['bubblesentencepro'] = publishState;
      updated['rollercoasterquiz'] = publishState;
      updated['slapandchop'] = publishState;

      setPublishedGames(updated);
      try {
        localStorage.setItem('publishedGamesV2', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('publishedGamesChanged', { detail: updated }));
      } catch (e) {}

      await setDoc(
        doc(db, 'settings', 'general'),
        { publishedGamesV2: updated },
        { merge: true }
      );
      setSyncMessage(publishState ? 'All 16 Studio apps published!' : 'All Studio apps hidden from non-admins.');
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (error) {
      console.error('Error updating bulk game status:', error);
    }
  };

  const sidebarThreatCount = useMemo(() => categorizeThreats(users).critical.length, [users]);

  // Navigation config with dedicated User Activity & Games tab
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: Activity, count: null },
    { id: 'users', label: 'User & Threat Management', icon: Users, count: sidebarThreatCount > 0 ? sidebarThreatCount : users.length, isAlert: sidebarThreatCount > 0 },
    { id: 'user-activity', label: 'User Activity & Games', icon: Gamepad2, count: games.length },
    { id: 'settings', label: 'Platform Settings', icon: Settings, count: null },
  ];

  const handleNavClick = (id: string) => {
    setCurrentRoute(id);
    if (id === 'users') setUsersFilter('all');
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const routeTitles: Record<string, string> = {
    'dashboard': 'Dashboard Overview',
    'users': 'User & Threat Management',
    'user-activity': 'User Activity & Games',
    'settings': 'Platform Settings',
  };

  return (
    <div className="flex h-full w-full bg-slate-100/90 dark:bg-slate-950 font-sans overflow-hidden text-slate-800 dark:text-slate-200">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 text-slate-100 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-20 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity" onClick={() => onViewChange('home')}>
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Shield size={19} />
            </div>
            <div>
              <span className="text-base font-black tracking-tight text-white block leading-none">Admin Console</span>
              <span className="text-[11px] font-medium text-slate-400 block mt-1">Hamster ESL Studio</span>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={22} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Navigation</p>
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                    w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left text-sm transition-all duration-150 cursor-pointer
                    ${isActive 
                      ? 'bg-indigo-600 text-white font-bold shadow-sm' 
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon size={19} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== null && (
                    <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-md shrink-0 ${
                      item.isAlert
                        ? 'bg-rose-500 text-white'
                        : isActive
                        ? 'bg-indigo-700 text-indigo-100'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            onClick={() => onViewChange('home')}
          >
            <LogOut size={19} className="text-slate-400" />
            <span>Back to Home Studio</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100/90 dark:bg-slate-950">
        
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {routeTitles[currentRoute] || 'Dashboard'}
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                Real-time user governance, security threat telemetry, and studio app publishing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Quick Threats Shortcut */}
            {sidebarThreatCount > 0 && (
              <button
                onClick={() => handleFilterThreatsFromOverview('threats')}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 hover:bg-rose-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShieldAlert size={15} className="text-rose-600 dark:text-rose-400" />
                <span className="tabular-nums">{sidebarThreatCount} Threat{sidebarThreatCount === 1 ? '' : 's'}</span>
              </button>
            )}

            {/* Sync Button */}
            <button
              onClick={handleSyncUsers}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              title="Sync user accounts"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Users"}</span>
            </button>

            {/* Admin Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{currentUser?.displayName || "Admin"}</p>
                <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Super Admin</p>
              </div>
              <Avatar src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || "Admin")}`} alt="Admin" />
            </div>
          </div>
        </header>

        {/* Sync Status Banner */}
        {syncMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-200">
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
                  activities={activities}
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
                <div className="max-w-3xl space-y-6">
                  <Card
                    title="Studio App Visibility"
                    subtitle="Control whether all 16 Studio games are visible to teachers and students on the Home Studio"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Bulk App Publishing
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Quickly publish all 16 games or hide them while performing maintenance.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => publishAllGames(true)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          Publish All 16 Apps
                        </button>
                        <button
                          type="button"
                          onClick={() => publishAllGames(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Hide All Apps
                        </button>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="Platform Cache & Synchronization"
                    subtitle="Refresh local admin cache and synchronize user & game records from Firestore"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Force Full Cloud Resync
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Clears cached user/game snapshots in browser storage and pulls fresh records from Firestore.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSyncUsers}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        <span>{isSyncing ? 'Syncing...' : 'Resync Now'}</span>
                      </button>
                    </div>
                  </Card>

                  <Card
                    title="Super Admin Protection"
                    subtitle="Root account access and automated threat scanner status"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                          <Lock size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Protected Root Account: <span className="font-mono text-indigo-600 dark:text-indigo-400">{SUPER_ADMIN_EMAIL}</span>
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Deletion locks and email spoofing heuristics are active across all {users.length} accounts.
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                        Protected
                      </span>
                    </div>
                  </Card>
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
