import React, { useState, useMemo } from 'react';
import {
  Gamepad2, Activity, Users, Search, Sparkles, Filter,
  Clock, Calendar, Play, Eye, EyeOff, ShieldCheck, Mail,
  CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Layers,
  ExternalLink, UserCheck, Flame, User, RefreshCw
} from 'lucide-react';
import { getGameTypeMeta, formatRelativeTime, UserActivityEvent } from '../utils/activityTracker';

interface AdminActivityGamesViewProps {
  users: any[];
  games: any[];
  activities: UserActivityEvent[];
  onLaunchGame?: (game: any) => void;
  onRefresh?: () => void;
}

export function AdminActivityGamesView({
  users,
  games,
  activities,
  onLaunchGame,
  onRefresh
}: AdminActivityGamesViewProps) {
  const [viewMode, setViewMode] = useState<'by-user' | 'all-games' | 'live-feed'>('by-user');
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    // Default to first user who has games or first user
    const withGames = users.find(u => {
      const uid = u.uid || u.id;
      const email = (u.email || '').toLowerCase().trim();
      return games.some(g => (g.userId === uid || g.userId === u.id) || (email && email !== 'user' && g.creatorEmail?.toLowerCase().trim() === email));
    });
    return withGames?.uid || withGames?.id || users[0]?.uid || users[0]?.id || '';
  });

  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [gameSearchTerm, setGameSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'creators' | 'registered' | 'guests'>('all');
  const [selectedGameType, setSelectedGameType] = useState<string>('all');
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  // Map each user to their created games
  const userGamesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    users.forEach(u => {
      const uid = u.uid || u.id;
      const email = (u.email || '').toLowerCase().trim();
      const userCreatedGames = games.filter(g => {
        if (g.userId && (g.userId === uid || g.userId === u.id)) return true;
        if (email && email !== 'user' && g.creatorEmail && g.creatorEmail.toLowerCase().trim() === email) return true;
        return false;
      });
      map.set(uid, userCreatedGames);
    });
    return map;
  }, [users, games]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalGames = games.length;
    let creatorsCount = 0;
    userGamesMap.forEach(userGames => {
      if (userGames.length > 0) creatorsCount++;
    });

    // Determine most popular game type
    const typeCounts: Record<string, number> = {};
    games.forEach(g => {
      const meta = getGameTypeMeta(g.gameType);
      typeCounts[meta.name] = (typeCounts[meta.name] || 0) + 1;
    });

    let topType = 'None';
    let topTypeCount = 0;
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > topTypeCount) {
        topType = type;
        topTypeCount = count;
      }
    });

    return {
      totalGames,
      creatorsCount,
      totalActivities: activities.length,
      topType: topType !== 'None' ? `${topType} (${topTypeCount})` : 'Slap & Chop'
    };
  }, [games, userGamesMap, activities]);

  // Filtered users for the left list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const uid = u.uid || u.id;
      const createdCount = (userGamesMap.get(uid) || []).length;

      if (userFilter === 'creators' && createdCount === 0) return false;
      if (userFilter === 'registered' && (u.isAnonymous || u.email === 'User' || !u.email)) return false;
      if (userFilter === 'guests' && !u.isAnonymous && u.email && u.email !== 'User') return false;

      if (!userSearchTerm) return true;
      const term = userSearchTerm.toLowerCase();
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || email.includes(term) || uid.toLowerCase().includes(term);
    });
  }, [users, userGamesMap, userFilter, userSearchTerm]);

  // Selected user object
  const selectedUser = useMemo(() => {
    return users.find(u => (u.uid || u.id) === selectedUserId) || users[0];
  }, [users, selectedUserId]);

  // Games for selected user
  const selectedUserGames = useMemo(() => {
    if (!selectedUser) return [];
    return userGamesMap.get(selectedUser.uid || selectedUser.id) || [];
  }, [selectedUser, userGamesMap]);

  // Activities for selected user
  const selectedUserActivities = useMemo(() => {
    if (!selectedUser) return [];
    const uid = selectedUser.uid || selectedUser.id;
    const email = (selectedUser.email || '').toLowerCase().trim();

    const direct = activities.filter(a => {
      if (a.userId && (a.userId === uid || a.userId === selectedUser.id)) return true;
      if (email && email !== 'user' && a.userEmail && a.userEmail.toLowerCase().trim() === email) return true;
      return false;
    });

    // Synthesize game events
    const gameEvents: UserActivityEvent[] = selectedUserGames.map(g => {
      const meta = getGameTypeMeta(g.gameType);
      const qCount = Array.isArray(g.customQuestions) ? g.customQuestions.length : Array.isArray(g.questions) ? g.questions.length : 0;
      return {
        userId: uid,
        userEmail: selectedUser.email,
        userName: selectedUser.displayName,
        action: 'create_game',
        title: `Created Game: "${g.name || g.title || g.topic || 'Custom Game'}"`,
        gameId: g.id,
        gameTitle: g.name || g.title || g.topic,
        gameType: g.gameType,
        questionCount: qCount,
        details: `Created game with ${qCount} question${qCount === 1 ? '' : 's'} in ${meta.name} mode.`,
        timestamp: g.createdAt || g.updatedAt || selectedUser.lastLoginAt || new Date()
      };
    });

    const combined = [...direct];
    gameEvents.forEach(ge => {
      if (!combined.some(c => c.gameId === ge.gameId && c.action === 'create_game')) {
        combined.push(ge);
      }
    });

    if (selectedUser.lastLoginAt && !combined.some(c => c.action === 'login')) {
      combined.push({
        userId: uid,
        userEmail: selectedUser.email,
        userName: selectedUser.displayName,
        action: 'login',
        title: 'Active Session / Last Login',
        details: 'User authenticated in platform.',
        timestamp: selectedUser.lastLoginAt
      });
    }

    combined.sort((a, b) => {
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

    return combined;
  }, [selectedUser, activities, selectedUserGames]);

  // All games filtered for the "All Games Gallery" tab
  const allFilteredGames = useMemo(() => {
    return games.filter(g => {
      if (selectedGameType !== 'all') {
        const meta = getGameTypeMeta(g.gameType);
        if (meta.name.toLowerCase() !== selectedGameType.toLowerCase() && g.gameType !== selectedGameType) {
          return false;
        }
      }
      if (!gameSearchTerm) return true;
      const term = gameSearchTerm.toLowerCase();
      const title = (g.name || g.title || g.topic || '').toLowerCase();
      const topic = (g.topic || '').toLowerCase();
      const email = (g.creatorEmail || '').toLowerCase();
      return title.includes(term) || topic.includes(term) || email.includes(term);
    });
  }, [games, selectedGameType, gameSearchTerm]);

  // Unique types across all games
  const allGameTypes = useMemo(() => {
    const set = new Set<string>();
    games.forEach(g => {
      const meta = getGameTypeMeta(g.gameType);
      set.add(meta.name);
    });
    return Array.from(set);
  }, [games]);

  return (
    <div className="space-y-6">
      
      {/* TOP HEADER & STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <Gamepad2 size={26} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Total User Games</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalGames}</span>
            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold block">Created in "My Games"</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users size={26} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Active Game Creators</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.creatorsCount}</span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">Teachers & Students</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Activity size={26} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Logged Activities</span>
            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalActivities}</span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold block">Logins & Creations</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
            <Sparkles size={26} />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Top Created Format</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100 truncate block">{stats.topType}</span>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold block">Most Popular Mode</span>
          </div>
        </div>
      </div>

      {/* VIEW SELECTOR BAR */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setViewMode('by-user')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              viewMode === 'by-user'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Users size={16} />
            <span>User Dossier & Created Games</span>
          </button>

          <button
            onClick={() => setViewMode('all-games')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              viewMode === 'all-games'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Gamepad2 size={16} />
            <span>All User Created Games ({games.length})</span>
          </button>

          <button
            onClick={() => setViewMode('live-feed')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              viewMode === 'live-feed'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Clock size={16} />
            <span>Live Activity Stream</span>
          </button>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 self-end sm:self-auto"
          >
            <RefreshCw size={14} />
            <span>Refresh Data</span>
          </button>
        )}
      </div>

      {/* MODE 1: BY-USER EXPLORER (DUAL PANEL) */}
      {viewMode === 'by-user' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT USER DIRECTORY (4 COLS) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[750px]">
            {/* User Search & Filter */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setUserFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    userFilter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setUserFilter('creators')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap flex items-center gap-1 transition-all ${
                    userFilter === 'creators'
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  }`}
                >
                  <Gamepad2 size={12} />
                  Creators ({stats.creatorsCount})
                </button>
                <button
                  onClick={() => setUserFilter('registered')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    userFilter === 'registered'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Members
                </button>
              </div>
            </div>

            {/* User List Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 custom-scrollbar">
              {filteredUsers.map(u => {
                const uid = u.uid || u.id;
                const isSelected = (selectedUser?.uid || selectedUser?.id) === uid;
                const userGames = userGamesMap.get(uid) || [];
                const gamesCount = userGames.length;
                const isSuperAdmin = u.email?.toLowerCase().trim() === 'janrelbugtay03@gmail.com';

                return (
                  <div
                    key={uid}
                    onClick={() => setSelectedUserId(uid)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'User')}`}
                        alt={u.displayName || 'User'}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0"
                        onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'User')}`; }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold text-xs truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                            {u.displayName || 'User'}
                          </p>
                          {isSuperAdmin && (
                            <span className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold px-1 rounded">Admin</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate font-mono">
                          {u.email || 'Guest'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {gamesCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 flex items-center gap-1">
                          <Gamepad2 size={11} />
                          {gamesCount}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">0 games</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No users found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT DOSSIER PANEL (8 COLS) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedUser ? (
              <div className="space-y-6">
                
                {/* Selected User Header Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.displayName || 'User')}`}
                        alt={selectedUser.displayName || 'User'}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-200 dark:border-indigo-900 shadow-md shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {selectedUser.displayName || 'User'}
                          </h3>
                          {selectedUser.email?.toLowerCase().trim() === 'janrelbugtay03@gmail.com' && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-black uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {selectedUser.email || 'No email registered'} • UID: {selectedUser.uid || selectedUser.id}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" />
                          Last login: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatRelativeTime(selectedUser.lastLoginAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 flex items-center gap-1.5">
                        <Gamepad2 size={14} />
                        {selectedUserGames.length} Game{selectedUserGames.length === 1 ? '' : 's'} Created
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedUserActivities.length} total recorded events
                      </span>
                    </div>
                  </div>
                </div>

                {/* USER'S CREATED GAMES SECTION */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Gamepad2 size={18} className="text-purple-600" />
                        <span>"My Games" Created by {selectedUser.displayName || 'this user'} ({selectedUserGames.length})</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Educational games, quizzes, and lessons authored by this user.
                      </p>
                    </div>
                  </div>

                  {selectedUserGames.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedUserGames.map((game: any) => {
                        const meta = getGameTypeMeta(game.gameType);
                        const isExpanded = expandedGameId === game.id;
                        const questions = Array.isArray(game.customQuestions) 
                          ? game.customQuestions 
                          : Array.isArray(game.questions) 
                          ? game.questions 
                          : [];
                        const qCount = questions.length;
                        const gameTitle = game.name || game.title || game.topic || 'Custom Game';

                        return (
                          <div
                            key={game.id}
                            className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm shrink-0">
                                    {meta.icon}
                                  </span>
                                  <div>
                                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                                      {gameTitle}
                                    </h5>
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.badgeBg}`}>
                                      {meta.name}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/50 my-2">
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Topic</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                                    {game.topic || 'General'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Class</span>
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                                    {game.className || 'All Grades'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12} />
                                  {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : 'Earlier'}
                                </span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  {qCount} question{qCount === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                              <button
                                onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                              >
                                {isExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                                <span>{isExpanded ? 'Hide' : `Inspect (${qCount})`}</span>
                              </button>

                              {onLaunchGame && (
                                <button
                                  onClick={() => onLaunchGame(game)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                  title="Play game in player"
                                >
                                  <Play size={12} className="fill-current" />
                                  <span>Play Game</span>
                                </button>
                              )}
                            </div>

                            {/* Questions inspection accordion */}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Questions Configured:
                                </p>
                                <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                  {questions.map((q: any, i: number) => {
                                    const text = q.question || q.text || `Question ${i + 1}`;
                                    const correct = q.answer !== undefined ? q.answer : q.correctAnswer;
                                    return (
                                      <div key={i} className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700">
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{i + 1}. {text}</p>
                                        {Array.isArray(q.options) && (
                                          <div className="flex flex-wrap gap-1 mt-1 pl-3">
                                            {q.options.map((opt: string, oIdx: number) => (
                                              <span
                                                key={oIdx}
                                                className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                  opt === correct || oIdx === correct
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                                }`}
                                              >
                                                {opt}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Gamepad2 size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                        This user hasn't created any custom games yet.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        When this user creates games in Slap & Chop, Mystery Box, or other modes, they will appear here.
                      </p>
                    </div>
                  )}
                </div>

                {/* USER'S ACTIVITY TIMELINE SECTION */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Clock size={18} className="text-indigo-600" />
                        <span>Activity History for {selectedUser.displayName || 'User'}</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Chronological record of logins, game creations, and interactions.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {selectedUserActivities.length} Events
                    </span>
                  </div>

                  {selectedUserActivities.length > 0 ? (
                    <div className="space-y-3">
                      {selectedUserActivities.map((act, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/60"
                        >
                          <div className={`p-2 rounded-xl text-white shrink-0 ${
                            act.action === 'create_game'
                              ? 'bg-purple-600'
                              : act.action === 'login'
                              ? 'bg-emerald-600'
                              : 'bg-indigo-600'
                          }`}>
                            {act.action === 'create_game' ? <Gamepad2 size={14} /> : act.action === 'login' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h6 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                                {act.title || act.action}
                              </h6>
                              <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                {formatRelativeTime(act.timestamp)}
                              </span>
                            </div>
                            {act.details && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {act.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No activity recorded for this user yet.
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
                <User size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <h4 className="text-lg font-bold text-slate-700 dark:text-slate-300">Select a User</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click on any user from the list on the left to inspect their complete activity and all games they created.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODE 2: ALL USER CREATED GAMES GALLERY */}
      {viewMode === 'all-games' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search games by title, topic, or creator email..."
                value={gameSearchTerm}
                onChange={(e) => setGameSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Game Type Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedGameType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedGameType === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                All Modes ({games.length})
              </button>
              {allGameTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedGameType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    selectedGameType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Games Grid */}
          {allFilteredGames.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allFilteredGames.map((game: any) => {
                const meta = getGameTypeMeta(game.gameType);
                const creator = users.find(u => (u.uid || u.id) === game.userId || (game.creatorEmail && u.email?.toLowerCase() === game.creatorEmail.toLowerCase()));
                const creatorName = creator?.displayName || game.creatorEmail || 'User';
                const questions = Array.isArray(game.customQuestions) ? game.customQuestions : Array.isArray(game.questions) ? game.questions : [];
                const isExpanded = expandedGameId === game.id;

                return (
                  <div
                    key={game.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-3xl p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700/60 shrink-0">
                            {meta.icon}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {game.name || game.title || game.topic || 'Custom Game'}
                            </h4>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${meta.badgeBg}`}>
                              {meta.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Creator attribution pill */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 mb-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <User size={13} className="text-indigo-500 shrink-0" />
                          <span className="text-slate-500 text-[11px]">Author:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                            {creatorName}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : 'Earlier'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <span>Topic: <strong className="text-slate-700 dark:text-slate-300">{game.topic || 'General'}</strong></span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{questions.length} Qs</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                        {isExpanded ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                      </button>

                      {onLaunchGame && (
                        <button
                          onClick={() => onLaunchGame(game)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Play size={12} className="fill-current" />
                          <span>Play Game</span>
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {questions.map((q: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{i + 1}. {q.question || q.text || 'Question'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <Gamepad2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-bold text-slate-700 dark:text-slate-300">No Games Found</p>
              <p className="text-xs text-slate-400 mt-1">No custom games match your search query or filter.</p>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: LIVE ACTIVITY STREAM */}
      {viewMode === 'live-feed' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" />
                <span>Platform Live User Activity Stream</span>
              </h4>
              <p className="text-xs text-slate-400">
                Real-time chronological timeline of user actions, sign-ins, and game creations across Hamster English.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Tracking
            </span>
          </div>

          <div className="space-y-3">
            {activities.length > 0 ? (
              activities.map((act, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/60"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`p-2.5 rounded-xl text-white shrink-0 ${
                      act.action === 'create_game'
                        ? 'bg-purple-600'
                        : act.action === 'login'
                        ? 'bg-emerald-600'
                        : 'bg-indigo-600'
                    }`}>
                      {act.action === 'create_game' ? <Gamepad2 size={16} /> : act.action === 'login' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                          {act.userName || act.userEmail || 'User'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                          {act.title || act.action}
                        </span>
                      </div>
                      {act.details && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {act.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {act.timestamp?.seconds 
                        ? new Date(act.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Recorded'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-slate-400 text-xs">
                No activity stream records yet. As users log in and create games, live events will stream here.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
