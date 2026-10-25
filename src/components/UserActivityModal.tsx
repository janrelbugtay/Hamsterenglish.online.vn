import React, { useState, useMemo } from 'react';
import {
  X, Gamepad2, Clock, Calendar, CheckCircle2, AlertCircle,
  Play, Eye, EyeOff, Search, Sparkles, ExternalLink, ShieldCheck,
  User, Mail, Copy, Check, ChevronDown, ChevronUp, Layers, HelpCircle
} from 'lucide-react';
import { getGameTypeMeta, formatRelativeTime, UserActivityEvent } from '../utils/activityTracker';

interface UserActivityModalProps {
  user: any;
  games: any[];
  activities: UserActivityEvent[];
  onClose: () => void;
  onLaunchGame?: (game: any) => void;
}

export function UserActivityModal({
  user,
  games,
  activities,
  onClose,
  onLaunchGame
}: UserActivityModalProps) {
  const [activeTab, setActiveTab] = useState<'games' | 'activity'>('games');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGameType, setSelectedGameType] = useState<string>('all');
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Filter games by user
  const userGames = useMemo(() => {
    const uid = user.uid || user.id;
    const email = (user.email || '').toLowerCase().trim();

    return games.filter(g => {
      if (g.userId && (g.userId === uid || g.userId === user.id)) return true;
      if (email && email !== 'user' && g.creatorEmail && g.creatorEmail.toLowerCase().trim() === email) return true;
      return false;
    });
  }, [games, user]);

  // Filtered games based on search and type filter
  const filteredGames = useMemo(() => {
    return userGames.filter(g => {
      if (selectedGameType !== 'all') {
        const meta = getGameTypeMeta(g.gameType);
        if (meta.name.toLowerCase() !== selectedGameType.toLowerCase() && g.gameType !== selectedGameType) {
          return false;
        }
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const title = (g.name || g.title || g.topic || '').toLowerCase();
      const topic = (g.topic || '').toLowerCase();
      const className = (g.className || '').toLowerCase();
      return title.includes(term) || topic.includes(term) || className.includes(term);
    });
  }, [userGames, searchTerm, selectedGameType]);

  // Synthesize complete user activity timeline
  const userActivities = useMemo(() => {
    const uid = user.uid || user.id;
    const email = (user.email || '').toLowerCase().trim();

    // 1. Direct logged activities
    const directEvents = activities.filter(a => {
      if (a.userId && (a.userId === uid || a.userId === user.id)) return true;
      if (email && email !== 'user' && a.userEmail && a.userEmail.toLowerCase().trim() === email) return true;
      return false;
    });

    // 2. Synthesize game creation events from userGames if not already in directEvents
    const gameEvents: UserActivityEvent[] = userGames.map(g => {
      const meta = getGameTypeMeta(g.gameType);
      const qCount = Array.isArray(g.customQuestions) ? g.customQuestions.length : Array.isArray(g.questions) ? g.questions.length : 0;
      return {
        userId: uid,
        userEmail: user.email,
        userName: user.displayName,
        action: 'create_game',
        title: `Created Game: "${g.name || g.title || g.topic || 'Custom Game'}"`,
        gameId: g.id,
        gameTitle: g.name || g.title || g.topic,
        gameType: g.gameType,
        questionCount: qCount,
        details: `Configured ${qCount} question${qCount === 1 ? '' : 's'} in ${meta.name} format. Topic: ${g.topic || 'General'}.`,
        timestamp: g.createdAt || g.updatedAt || user.lastLoginAt || new Date()
      };
    });

    // 3. Synthesize last login event
    const loginEvent: UserActivityEvent | null = user.lastLoginAt ? {
      userId: uid,
      userEmail: user.email,
      userName: user.displayName,
      action: 'login',
      title: 'Active Session / Last Login Recorded',
      details: `User connected from verified session.`,
      timestamp: user.lastLoginAt
    } : null;

    const combined = [...directEvents];

    // Add synthesized game events if not duplicate by gameId
    gameEvents.forEach(ge => {
      const exists = combined.some(c => c.gameId === ge.gameId && c.action === 'create_game');
      if (!exists) {
        combined.push(ge);
      }
    });

    if (loginEvent && !combined.some(c => c.action === 'login')) {
      combined.push(loginEvent);
    }

    // Sort descending by timestamp
    combined.sort((a, b) => {
      const getMs = (val: any) => {
        if (!val) return 0;
        if (val.toMillis) return val.toMillis();
        if (val.seconds) return val.seconds * 1000;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') return new Date(val).getTime();
        if (val instanceof Date) return val.getTime();
        return 0;
      };
      return getMs(b.timestamp) - getMs(a.timestamp);
    });

    return combined;
  }, [activities, user, userGames]);

  // Unique game types created by user for filtering
  const availableGameTypes = useMemo(() => {
    const types = new Set<string>();
    userGames.forEach(g => {
      const meta = getGameTypeMeta(g.gameType);
      types.add(meta.name);
    });
    return Array.from(types);
  }, [userGames]);

  const handleCopyEmail = () => {
    if (user.email) {
      navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const isSuperAdmin = user.email?.toLowerCase().trim() === 'janrelbugtay03@gmail.com';

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Close modal"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pr-10">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=4f46e5&color=fff`}
              alt={user.displayName || 'User'}
              className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-lg object-cover bg-indigo-950 shrink-0"
              onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`; }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold truncate text-white">
                  {user.displayName || 'User'}
                </h2>
                {isSuperAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase bg-amber-400 text-amber-950 shadow-sm flex items-center gap-1">
                    <ShieldCheck size={13} /> Super Admin
                  </span>
                )}
                {user.isAnonymous && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-white/20 text-indigo-100">
                    Guest Account
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/40 border border-indigo-300/30 text-indigo-100 flex items-center gap-1">
                  <Gamepad2 size={13} /> {userGames.length} Game{userGames.length === 1 ? '' : 's'} Created
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-indigo-200 mt-1 font-mono">
                <span className="flex items-center gap-1.5 truncate max-w-xs">
                  <Mail size={14} className="shrink-0 text-indigo-300" />
                  {user.email || 'No email attached'}
                </span>
                {user.email && (
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Copy email"
                  >
                    {copiedEmail ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                  </button>
                )}
                <span className="text-indigo-400 hidden sm:inline">•</span>
                <span className="text-indigo-300 text-xs">
                  UID: <span className="font-mono opacity-80">{user.uid || user.id}</span>
                </span>
              </div>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/10">
            <button
              onClick={() => setActiveTab('games')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'games'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-200 hover:bg-white/10'
              }`}
            >
              <Gamepad2 size={16} />
              <span>Created "My Games" ({userGames.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'activity'
                  ? 'bg-white text-indigo-950 shadow-md'
                  : 'text-indigo-200 hover:bg-white/10'
              }`}
            >
              <Clock size={16} />
              <span>User Activity Timeline ({userActivities.length})</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50 dark:bg-slate-900/60">

          {/* TAB 1: USER'S CREATED GAMES */}
          {activeTab === 'games' && (
            <div className="space-y-4">
              
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search games by title, topic, or class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {availableGameTypes.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      onClick={() => setSelectedGameType('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        selectedGameType === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      All Types ({userGames.length})
                    </button>
                    {availableGameTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedGameType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                          selectedGameType === type
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Games List Grid */}
              {filteredGames.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGames.map((game: any) => {
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
                        className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/70 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Top */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-3xl p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700/60 shrink-0">
                                {meta.icon}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate">
                                  {gameTitle}
                                </h4>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${meta.badgeBg}`}>
                                    {meta.name}
                                  </span>
                                  {game.isPublic ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                      Public
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500">
                                      Private
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Metadata row */}
                          <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 mb-3">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Topic / Objective</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                {game.topic || 'General Vocabulary'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Class / Level</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                                {game.className || 'All Grades'}
                              </span>
                            </div>
                          </div>

                          {/* Created info */}
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                            <span className="flex items-center gap-1">
                              <Calendar size={13} />
                              {game.createdAt ? new Date(game.createdAt).toLocaleDateString() : 'Earlier'}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                              <HelpCircle size={13} />
                              {qCount} question{qCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                          >
                            {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span>{isExpanded ? 'Hide Questions' : `Inspect Questions (${qCount})`}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {onLaunchGame && (
                            <button
                              onClick={() => {
                                onClose();
                                onLaunchGame(game);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                              title="Test and play this game"
                            >
                              <Play size={13} className="fill-current" />
                              <span>Play / Test Game</span>
                            </button>
                          )}
                        </div>

                        {/* QUESTIONS INSPECTION ACCORDION */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5 animate-in fade-in duration-150">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Questions & Answers Configured ({questions.length}):
                            </p>
                            {questions.length > 0 ? (
                              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {questions.map((q: any, idx: number) => {
                                  const qText = q.question || q.text || q.sentence || `Question #${idx + 1}`;
                                  const options = Array.isArray(q.options) ? q.options : [];
                                  const correctAns = q.answer !== undefined ? q.answer : q.correctAnswer;

                                  return (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                                    >
                                      <div className="flex items-start gap-2 mb-1.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                                          {idx + 1}
                                        </span>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{qText}</p>
                                      </div>

                                      {options.length > 0 && (
                                        <div className="grid grid-cols-2 gap-1.5 pl-7 mt-1">
                                          {options.map((opt: string, optIdx: number) => {
                                            const isCorrect = opt === correctAns || optIdx === correctAns;
                                            return (
                                              <span
                                                key={optIdx}
                                                className={`px-2 py-1 rounded-md text-[11px] font-medium truncate ${
                                                  isCorrect
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                                }`}
                                              >
                                                {isCorrect ? '✓ ' : ''}{opt}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No structured questions found in this game data.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Gamepad2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    {searchTerm ? 'No games match your search query.' : 'No Created Games Found'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    {searchTerm
                      ? `Try searching for different keywords or clear the filter.`
                      : `This user hasn't created any custom games in the My Games library yet.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: USER ACTIVITY TIMELINE */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Session & Action History
                  </h4>
                  <p className="text-xs text-slate-400">
                    Logged timestamps for authentication, game creations, and interactions.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  {userActivities.length} Events Recorded
                </span>
              </div>

              {userActivities.length > 0 ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-200 dark:before:bg-indigo-900/60">
                  {userActivities.map((act, idx) => {
                    const isGameCreation = act.action === 'create_game';
                    const isLogin = act.action === 'login';
                    const isPlay = act.action === 'play_game';

                    return (
                      <div key={idx} className="relative group">
                        {/* Timeline node */}
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                          isGameCreation
                            ? 'bg-purple-600 text-white'
                            : isLogin
                            ? 'bg-emerald-600 text-white'
                            : isPlay
                            ? 'bg-blue-600 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}>
                          {isGameCreation ? (
                            <Gamepad2 size={11} />
                          ) : isLogin ? (
                            <CheckCircle2 size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                        </div>

                        {/* Content box */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/70 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                            <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                              {act.title || act.action}
                            </h5>
                            <span className="text-xs font-medium text-slate-400">
                              {formatRelativeTime(act.timestamp)}
                            </span>
                          </div>

                          {act.details && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {act.details}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-mono">
                            <span>
                              {act.timestamp?.toMillis 
                                ? new Date(act.timestamp.toMillis()).toLocaleString()
                                : act.timestamp?.seconds
                                ? new Date(act.timestamp.seconds * 1000).toLocaleString()
                                : typeof act.timestamp === 'string'
                                ? new Date(act.timestamp).toLocaleString()
                                : 'Recorded Time'}
                            </span>
                            {act.gameType && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-sans font-semibold text-[10px]">
                                {getGameTypeMeta(act.gameType).name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <Clock size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    No Activity Recorded
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    No session or creation events have been logged for this account yet.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Admin inspection mode: <span className="font-semibold text-slate-700 dark:text-slate-300">{user.displayName || user.email}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
