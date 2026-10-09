import React, { useState, useEffect, useRef, useMemo } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { 
  Users, Play, History, Trash2, Plus, 
  ChevronRight, Trophy, X, Save, Check
} from 'lucide-react';

const GAME_MODES = {
  HOME: 'HOME',
  STUDENTS: 'STUDENTS',
  WHEEL_SETUP: 'WHEEL_SETUP',
  WHEEL: 'WHEEL',
  RACE_SETUP: 'RACE_SETUP',
  RACE_ACTIVE: 'RACE_ACTIVE',
  HISTORY: 'HISTORY',
  SETTINGS: 'SETTINGS',
};

const DEFAULT_STUDENTS = [
  { id: 1, name: 'Anna', active: true },
  { id: 2, name: 'Ben', active: true },
  { id: 3, name: 'Charlie', active: true },
  { id: 4, name: 'David', active: true },
  { id: 5, name: 'Emma', active: true },
  { id: 6, name: 'Jack', active: true },
  { id: 7, name: 'Lily', active: true },
  { id: 8, name: 'Michael', active: true },
];


const AVATAR_COLORS = [
  '#ea580c', '#2563eb', '#16a34a', '#d97706', '#9333ea', 
  '#db2777', '#0891b2', '#dc2626', '#4f46e5', '#0d9488',
  '#ca8a04', '#65a30d', '#2dd4bf', '#0284c7', '#4f46e5'
];


const Gradients = () => (
  <svg width="0" height="0" className="absolute">
    <defs>
      <linearGradient id="volShine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity="0.7"/>
        <stop offset="25%" stopColor="white" stopOpacity="0.2"/>
        <stop offset="75%" stopColor="black" stopOpacity="0.1"/>
        <stop offset="100%" stopColor="black" stopOpacity="0.7"/>
      </linearGradient>
      <linearGradient id="volEdge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="white" stopOpacity="0.4"/>
        <stop offset="100%" stopColor="black" stopOpacity="0.4"/>
      </linearGradient>
      <filter id="drop-shadow-3d">
        <feDropShadow dx="2" dy="4" stdDeviation="2" floodOpacity="0.5" />
      </filter>
    </defs>
  </svg>
);

const HorseAvatar = ({ color }: { color: string }) => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ color }} className="overflow-visible">
    <defs>
      <g id="horse-base">
        <rect x="55" y="60" width="8" height="20" opacity="0.6"/>
        <rect x="15" y="60" width="8" height="20" opacity="0.6"/>
        <rect x="65" y="20" width="15" height="25" opacity="0.85"/>
        <rect x="20" y="35" width="60" height="25" opacity="1"/>
        <rect x="65" y="60" width="8" height="20" opacity="0.9"/>
        <rect x="25" y="60" width="8" height="20" opacity="0.9"/>
        <rect x="75" y="10" width="12" height="15" opacity="0.9"/>
        <rect x="87" y="15" width="10" height="10" opacity="0.8"/>
        <rect x="76" y="5" width="3" height="5" />
        <rect x="82" y="5" width="3" height="5" />
      </g>
      <g id="horse-details">
        <rect x="60" y="15" width="8" height="25" fill="#431407" />
        <rect x="10" y="40" width="10" height="25" fill="#431407" />
        <rect x="54" y="80" width="10" height="15" fill="#f8fafc" opacity="0.9"/>
        <rect x="14" y="80" width="10" height="15" fill="#f8fafc" opacity="0.9"/>
        <rect x="64" y="80" width="10" height="15" fill="#f8fafc" />
        <rect x="24" y="80" width="10" height="15" fill="#f8fafc" />
        <rect x="55" y="95" width="8" height="5" fill="#292524" opacity="0.8"/>
        <rect x="15" y="95" width="8" height="5" fill="#292524" opacity="0.8"/>
        <rect x="65" y="95" width="8" height="5" fill="#292524" />
        <rect x="25" y="95" width="8" height="5" fill="#292524" />
        <rect x="80" y="13" width="2" height="2" fill="#000" />
        <rect x="87" y="20" width="10" height="2" fill="#1c1917" />
        <rect x="85" y="15" width="2" height="10" fill="#1c1917" />
      </g>
    </defs>
    
    <g filter="url(#drop-shadow-3d)">
      <use href="#horse-base" fill="currentColor" />
      <use href="#horse-base" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
      <use href="#horse-base" fill="url(#volEdge)" style={{ mixBlendMode: 'multiply' }} opacity="0.3" />
      <use href="#horse-details" />
      <use href="#horse-details" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
    </g>
  </svg>
);

const RobotAvatar = ({ color }: { color: string }) => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ color }} className="overflow-visible">
    <defs>
      <g id="robot-base">
        <rect x="35" y="15" width="30" height="25" rx="4" />
        <rect x="30" y="45" width="40" height="35" opacity="0.9" rx="6" />
        <rect x="20" y="50" width="10" height="25" opacity="0.7" rx="3" />
        <rect x="70" y="50" width="10" height="25" opacity="0.7" rx="3" />
      </g>
      <g id="robot-details">
        <rect x="42" y="22" width="6" height="6" fill="#fde047" />
        <rect x="52" y="22" width="6" height="6" fill="#fde047" />
        <rect x="48" y="5" width="4" height="10" fill="#94a3b8" />
        <circle cx="50" cy="5" r="3" fill="#ef4444" />
        <rect x="40" y="80" width="20" height="15" fill="#334155" rx="2" />
        <rect x="35" y="50" width="30" height="2" fill="#0f172a" opacity="0.5" />
        <rect x="35" y="55" width="30" height="2" fill="#0f172a" opacity="0.5" />
        <rect x="35" y="60" width="30" height="2" fill="#0f172a" opacity="0.5" />
      </g>
    </defs>
    
    <g filter="url(#drop-shadow-3d)">
      <use href="#robot-base" fill="currentColor" />
      <use href="#robot-base" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
      <use href="#robot-base" fill="url(#volEdge)" style={{ mixBlendMode: 'multiply' }} opacity="0.3" />
      <use href="#robot-details" />
      <use href="#robot-details" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
    </g>
  </svg>
);

const CarAvatar = ({ color }: { color: string }) => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ color }} className="overflow-visible">
    <defs>
      <g id="car-base">
        <rect x="10" y="50" width="80" height="20" rx="4" />
        <rect x="25" y="35" width="40" height="15" opacity="0.8" />
        <rect x="10" y="40" width="10" height="5" />
        <rect x="15" y="45" width="3" height="5" opacity="0.6"/>
      </g>
      <g id="car-details">
        <rect x="30" y="40" width="12" height="10" fill="#e0f2fe" />
        <rect x="45" y="40" width="15" height="10" fill="#e0f2fe" />
        <circle cx="25" cy="70" r="10" fill="#1e293b" />
        <circle cx="25" cy="70" r="4" fill="#cbd5e1" />
        <circle cx="75" cy="70" r="10" fill="#1e293b" />
        <circle cx="75" cy="70" r="4" fill="#cbd5e1" />
        {/* Spoiler <!-- Spoiler & bumper accents --> bumper accents */}
        <rect x="5" y="60" width="5" height="5" fill="#fcd34d" />
        <rect x="85" y="60" width="5" height="5" fill="#ef4444" />
        <rect x="75" y="52" width="10" height="2" fill="#0f172a" opacity="0.4" />
      </g>
    </defs>
    
    <g filter="url(#drop-shadow-3d)">
      <use href="#car-base" fill="currentColor" />
      <use href="#car-base" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
      <use href="#car-base" fill="url(#volEdge)" style={{ mixBlendMode: 'multiply' }} opacity="0.3" />
      <use href="#car-details" />
      <use href="#car-details" fill="url(#volShine)" style={{ mixBlendMode: 'overlay' }} />
    </g>
  </svg>
);

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', 
  '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', 
  '#a855f7', '#ec4899', '#f43f5e'
];

export function StudentRace({ onViewChange }: any) {
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('studentRaceStudents');
    return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
  });
  
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('studentRaceHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('studentRaceSettings');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      musicEnabled: false,
      removeWinner: true,
      fairMode: 'NORMAL',
    };
  });

  const [currentMode, setCurrentMode] = useState(GAME_MODES.HOME);
  const [raceTheme, setRaceTheme] = useState('cars'); // 'cars', 'horses', 'robots'
  const isFullScreenGame = currentMode === GAME_MODES.WHEEL || currentMode === GAME_MODES.RACE_ACTIVE;

  useEffect(() => {
    localStorage.setItem('studentRaceStudents', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('studentRaceHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('studentRaceSettings', JSON.stringify(settings));
  }, [settings]);

  const activeStudents = useMemo(() => students.filter((s: any) => s.active), [students]);

  const recordWin = (student: any, gameType: string) => {
    const newEntry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      studentName: student.name,
      gameType
    };
    setHistory((prev: any) => [newEntry, ...prev].slice(0, 50));
  };

  return (
    <div className={`min-h-[60vh] md:min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-hidden ${isFullScreenGame ? 'fixed inset-0 z-50 rounded-none' : 'rounded-3xl'}`}>
      {/* HEADER */}
      {!isFullScreenGame && (
        <header className="bg-indigo-600 text-white shadow-md z-10 p-4 sticky top-0">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentMode(GAME_MODES.HOME)}>
              <div className="bg-yellow-400 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-indigo-900 fill-current" />
              </div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-1">
                NAME <span className="text-yellow-400">PICKER</span>
              </h1>
            </div>

            <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              <NavButton active={currentMode === GAME_MODES.HOME} onClick={() => setCurrentMode(GAME_MODES.HOME)} icon={<Users className="w-4 h-4" />}>Home</NavButton>
              <NavButton active={currentMode === GAME_MODES.STUDENTS} onClick={() => setCurrentMode(GAME_MODES.STUDENTS)} icon={<Users className="w-4 h-4" />}>Students ({activeStudents.length})</NavButton>
              <NavButton active={currentMode === GAME_MODES.WHEEL} onClick={() => setCurrentMode(GAME_MODES.WHEEL)} icon={<div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />}>Wheel</NavButton>
              <NavButton active={currentMode === GAME_MODES.RACE_SETUP} onClick={() => setCurrentMode(GAME_MODES.RACE_SETUP)} icon={<Trophy className="w-4 h-4" />}>Race</NavButton>
              <NavButton active={currentMode === GAME_MODES.HISTORY} onClick={() => setCurrentMode(GAME_MODES.HISTORY)} icon={<History className="w-4 h-4" />}>History</NavButton>
            </nav>
          </div>
        </header>
      )}

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 ${isFullScreenGame ? 'p-0 max-w-none flex flex-col h-full' : ''}`}>
        
        {currentMode === GAME_MODES.HOME && (
          <Dashboard 
            activeStudentsCount={activeStudents.length} 
            onNavigate={setCurrentMode} 
          />
        )}

        {currentMode === GAME_MODES.STUDENTS && (
          <StudentManager students={students} setStudents={setStudents} />
        )}

        {currentMode === GAME_MODES.WHEEL_SETUP && (
          <div className="animate-in fade-in duration-500">
            <div className="max-w-4xl mx-auto flex justify-between items-center mb-6">
               <h2 className="text-3xl font-black text-indigo-950">Setup Wheel</h2>
               <button 
                 onClick={() => setCurrentMode(GAME_MODES.WHEEL)}
                 disabled={activeStudents.length === 0}
                 className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md ${activeStudents.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105' : 'bg-slate-300 cursor-not-allowed'}`}
               >
                 Start Spinning <ChevronRight className="inline w-5 h-5 ml-1" />
               </button>
            </div>
            <StudentManager students={students} setStudents={setStudents} />
          </div>
        )}

        {currentMode === GAME_MODES.WHEEL && (
          <SpinWheelEngine 
            students={activeStudents} 
            settings={settings} 
            onWin={(winner: any) => recordWin(winner, 'Spin Wheel')}
            onRemove={(student: any) => setStudents(students.map((s: any) => s.id === student.id ? { ...s, active: false } : s))}
            onBack={() => setCurrentMode(GAME_MODES.HOME)}
          />
        )}

        {currentMode === GAME_MODES.RACE_SETUP && (
          <div className="animate-in fade-in duration-500">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
               <h2 className="text-3xl font-black text-indigo-950">Setup Race</h2>
               <div className="flex items-center gap-4">
                 <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                   {['cars', 'horses', 'robots'].map(theme => (
                     <button
                       key={theme}
                       onClick={() => setRaceTheme(theme)}
                       className={`px-4 py-2 rounded-lg font-bold text-sm capitalize transition-colors ${raceTheme === theme ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                     >
                       {theme}
                     </button>
                   ))}
                 </div>
                 <button 
                   onClick={() => setCurrentMode(GAME_MODES.RACE_ACTIVE)}
                   disabled={activeStudents.length === 0}
                   className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md whitespace-nowrap ${activeStudents.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105' : 'bg-slate-300 cursor-not-allowed'}`}
                 >
                   Start Racing <ChevronRight className="inline w-5 h-5 ml-1" />
                 </button>
               </div>
            </div>
            <StudentManager students={students} setStudents={setStudents} />
          </div>
        )}

        {currentMode === GAME_MODES.RACE_ACTIVE && (
          <RaceEngine 
            students={activeStudents}
            theme={raceTheme}
            onWin={(winner: any) => recordWin(winner, 'Race')}
            onRemove={(student: any) => setStudents(students.map((s: any) => s.id === student.id ? { ...s, active: false } : s))}
            onBack={() => setCurrentMode(GAME_MODES.HOME)}
          />
        )}

        {currentMode === GAME_MODES.HISTORY && (
          <HistoryView history={history} clearHistory={() => setHistory([])} />
        )}

      </main>

      {/* GLOBAL CONFETTI (Triggered by events) */}
      <ConfettiContainer />
    </div>
  );
}

const NavButton = ({ children, icon, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap
      ${active ? 'bg-indigo-700 text-white shadow-inner' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'}`}
  >
    {icon}
    {children}
  </button>
);

const Dashboard = ({ activeStudentsCount, onNavigate }: any) => {
  return (
    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12 mt-8">
        <h1 className="text-5xl md:text-7xl font-black text-indigo-950 mb-4 tracking-tight">
          NAME <span className="text-yellow-400 drop-shadow-sm">PICKER</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto">
          Pick a student. Start a race. Make every classroom activity exciting.
        </p>
        <div className="inline-flex items-center gap-2 mt-6 bg-green-100 text-green-700 px-4 py-2 rounded-full font-bold text-sm">
          <Users size={16} />
          {activeStudentsCount} Students Ready
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        <GameCard 
          title="Spin the Wheel" 
          description="The classic random picker. Colorful, exciting, and fast."
          color="bg-indigo-500"
          hoverColor="hover:bg-indigo-600"
          onClick={() => onNavigate(GAME_MODES.WHEEL_SETUP)}
          icon={
            <div className="w-16 h-16 rounded-full shadow-inner mb-6 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0" style={{
                    background: `conic-gradient(
                        ${COLORS[0]} 0deg 60deg, 
                        ${COLORS[1]} 60deg 120deg, 
                        ${COLORS[2]} 120deg 180deg, 
                        ${COLORS[3]} 180deg 240deg, 
                        ${COLORS[4]} 240deg 300deg, 
                        ${COLORS[5]} 300deg 360deg
                    )`
                }}></div>
                <div className="w-4 h-4 bg-white rounded-full absolute z-10 shadow"></div>
            </div>
          }
        />
        <GameCard 
          title="Racing" 
          description="Let your students race to the finish line in various fun themes!"
          color="bg-orange-500"
          hoverColor="hover:bg-orange-600"
          onClick={() => onNavigate(GAME_MODES.RACE_SETUP)}
          icon={
            <div className="bg-white/20 p-4 rounded-2xl mb-6 inline-block">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          }
        />
      </div>
    </div>
  );
};

const GameCard = ({ title, description, color, hoverColor, onClick, icon }: any) => (
  <button 
    onClick={onClick}
    className={`${color} ${hoverColor} text-white p-8 rounded-3xl text-left transition-all hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-xl flex flex-col justify-between min-h-[280px] group w-full`}
  >
    <div>
      {icon}
      <h3 className="text-3xl font-black mb-3">{title}</h3>
      <p className="text-white/80 font-medium leading-relaxed">{description}</p>
    </div>
    <div className="mt-8 flex items-center gap-2 font-bold text-yellow-300 group-hover:text-white transition-colors uppercase tracking-wider text-sm">
      PLAY NOW <ChevronRight size={18} />
    </div>
  </button>
);

const StudentManager = ({ students, setStudents }: any) => {
  const [inputText, setInputText] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleAdd = () => {
    if (!inputText.trim()) return;
    
    // Split by newline, comma, or semicolon
    const names = inputText.split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
    
    // Simple deduplication based on current list (case insensitive)
    const currentNames = new Set(students.map((s: any) => s.name.toLowerCase()));
    const newStudents: any[] = [];
    
    names.forEach(name => {
      if (!currentNames.has(name.toLowerCase())) {
        newStudents.push({
          id: Date.now() + Math.random(),
          name,
          active: true
        });
        currentNames.add(name.toLowerCase());
      }
    });

    if (newStudents.length > 0) {
      setStudents((prev: any) => [...prev, ...newStudents]);
    }
    setInputText('');
  };

  const removeStudent = (id: any) => {
    setStudents((prev: any) => prev.filter((s: any) => s.id !== id));
  };

  const toggleStatus = (id: any) => {
    setStudents((prev: any) => prev.map((s: any) => s.id === id ? { ...s, active: !s.active } : s));
  };

  const activeCount = students.filter((s: any) => s.active).length;

  const handleClearAll = () => {
    if (students.length === 0) return;
    setStudents([]);
  };

  const handleSave = () => {
    localStorage.setItem('studentRaceStudents', JSON.stringify(students));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Input Section ALWAYS VISIBLE */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
        <label className="font-bold text-slate-700 flex items-center gap-2">
           <Plus size={18} className="text-indigo-500" />
           Add Students
        </label>
        <textarea 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste student names here (e.g. Anna, Ben, Charlie...)"
          className="w-full h-32 p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all resize-none text-slate-700 font-medium"
        />
        <div className="flex justify-end gap-3">
           <button 
            onClick={() => setInputText('')} 
            className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Clear Text
          </button>
          <button 
            onClick={handleAdd} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
          >
            Add to List
          </button>
        </div>
      </div>

      {/* Roster Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <Users className="text-indigo-500" /> Classroom Roster
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="text-sm font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full mr-2">
              Total: {students.length} <span className="text-slate-300 mx-2">|</span> Active: {activeCount}
            </div>
            {students.length > 0 && (
              <>
                <button 
                  onClick={handleClearAll}
                  className="flex items-center gap-2 text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
                >
                  <Trash2 size={16} /> Clear All
                </button>
                <button 
                  onClick={handleSave}
                  className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all ${
                    isSaved 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  {isSaved ? <Check size={16} /> : <Save size={16} />}
                  {isSaved ? 'Saved!' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {students.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {students.map((student: any, idx: number) => (
              <div 
                key={student.id} 
                className={`group flex items-center justify-between p-3 rounded-xl border-2 transition-all
                  ${student.active 
                    ? 'border-indigo-100 bg-indigo-50 hover:border-indigo-300' 
                    : 'border-slate-100 bg-slate-50 opacity-60'}`}
              >
                <div 
                  className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  onClick={() => toggleStatus(student.id)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                    ${student.active ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {idx + 1}
                  </div>
                  <span className={`font-bold truncate ${student.active ? 'text-indigo-950' : 'text-slate-500 line-through'}`}>
                    {student.name}
                  </span>
                </div>
                <button 
                  onClick={() => removeStudent(student.id)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex-shrink-0"
                  title="Remove student"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


// --- SPIN WHEEL GAME ---
const SpinWheelEngine = ({ students, settings, onWin, onRemove, onBack }: any) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<any>(null);
  
  const numSegments = students.length;

  // Audio refs
  const tickSound = useRef<any>(null);
  const winSound = useRef<any>(null);

  useEffect(() => {
    // Basic synth sounds for standalone usage
    const createAudio = (type: any) => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return {
          playTick: () => {
             if(!settings.soundEnabled) return;
             const osc = audioCtx.createOscillator();
             const gain = audioCtx.createGain();
             osc.type = 'square';
             osc.frequency.setValueAtTime(400, audioCtx.currentTime);
             osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.03);
             gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);
             osc.connect(gain);
             gain.connect(audioCtx.destination);
             osc.start();
             osc.stop(audioCtx.currentTime + 0.03);
          },
          playWin: () => {
             if(!settings.soundEnabled) return;
             // Play a fanfare arpeggio
             const playNote = (freq: number, startTime: number, duration: number) => {
               const osc = audioCtx.createOscillator();
               const gain = audioCtx.createGain();
               osc.type = 'sine';
               osc.frequency.setValueAtTime(freq, startTime);
               gain.gain.setValueAtTime(0, startTime);
               gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
               gain.gain.linearRampToValueAtTime(0, startTime + duration);
               osc.connect(gain);
               gain.connect(audioCtx.destination);
               osc.start(startTime);
               osc.stop(startTime + duration);
             };
             const now = audioCtx.currentTime;
             playNote(523.25, now, 0.15); // C5
             playNote(659.25, now + 0.15, 0.15); // E5
             playNote(783.99, now + 0.3, 0.15); // G5
             playNote(1046.50, now + 0.45, 0.8); // C6
          }
        };
      } catch (e) {
        return { playTick: ()=>{}, playWin: ()=>{} };
      }
    };
    const sfx = createAudio('type');
    tickSound.current = sfx.playTick;
    winSound.current = sfx.playWin;
  }, [settings.soundEnabled]);

  const handleSpin = () => {
    if (isSpinning || numSegments === 0) return;
    
    setIsSpinning(true);
    setWinner(null);
    
    // Random target index
    const targetIndex = Math.floor(Math.random() * numSegments);
    const sliceAngle = 360 / numSegments;
    
    // Calculate precise angle to land in the MIDDLE of the chosen slice
    const offset = sliceAngle / 2;
    const targetAngle = -(targetIndex * sliceAngle + offset);

    // Add extra spins (5-8 full rotations)
    const extraSpins = (Math.floor(Math.random() * 4) + 5) * 360;
    
    // Final rotation value
    const currentNormalized = rotation % 360;
    const distanceToTarget = (targetAngle - currentNormalized + 3600) % 360; 
    const newRotation = rotation + distanceToTarget + extraSpins;
    
    setRotation(newRotation);

    // Estimate ticks (visual only)
    const tickInterval = setInterval(() => {
        if(tickSound.current) tickSound.current();
    }, 150);

    setTimeout(() => {
      clearInterval(tickInterval);
      setIsSpinning(false);
      const wonStudent = students[targetIndex];
      setWinner(wonStudent);
      if (onWin) onWin(wonStudent);
      if (winSound.current) winSound.current();
      
      // Trigger Confetti Event
      window.dispatchEvent(new CustomEvent('student-race-win'));
      
    }, 5000); 
  };


  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 animate-in zoom-in-95">
        <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
           <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-indigo-500" />
           </div>
           <h3 className="text-2xl font-black text-slate-800 mb-4">No Students Ready</h3>
           <p className="text-slate-500 mb-8 font-medium">Add some students or activate them in the roster to start spinning!</p>
           <button 
             onClick={onBack}
             className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg w-full transition-transform hover:scale-105"
           >
             Go to Students
           </button>
        </div>
      </div>
    );
  }

  // Calculate SVG Conic Segments
  const createWheelSlices = () => {
    let slices = [];
    let currentAngle = 0;
    const sliceAngle = 360 / numSegments;

    for (let i = 0; i < numSegments; i++) {
      const color = COLORS[i % COLORS.length];
      
      const x1 = 50 + 50 * Math.cos(Math.PI * (currentAngle - 90) / 180);
      const y1 = 50 + 50 * Math.sin(Math.PI * (currentAngle - 90) / 180);
      const x2 = 50 + 50 * Math.cos(Math.PI * ((currentAngle + sliceAngle) - 90) / 180);
      const y2 = 50 + 50 * Math.sin(Math.PI * ((currentAngle + sliceAngle) - 90) / 180);
      
      const largeArc = sliceAngle > 180 ? 1 : 0;
      
      const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

      const textAngle = currentAngle + (sliceAngle / 2);
      const textX = 50 + 35 * Math.cos(Math.PI * (textAngle - 90) / 180);
      const textY = 50 + 35 * Math.sin(Math.PI * (textAngle - 90) / 180);
      
      const textRotation = textAngle - 90; 

      slices.push(
        <g key={i}>
          <path d={pathData} fill={color} stroke="#fff" strokeWidth="0.5" />
          <text 
            x={textX} 
            y={textY} 
            fill="white" 
            fontSize={numSegments > 15 ? "3" : "4"} 
            fontWeight="bold" 
            textAnchor="middle" 
            dominantBaseline="middle"
            transform={`rotate(${textRotation}, ${textX}, ${textY})`}
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
          >
            {students[i].name}
          </text>
        </g>
      );
      currentAngle += sliceAngle;
    }
    return slices;
  };

  return (
    <div className="flex flex-col items-center w-full h-full rounded-3xl p-4 md:p-8 relative overflow-hidden bg-gradient-to-b from-indigo-900 to-slate-900 py-8 md:py-16 shadow-inner flex-1 justify-center">
      
      {/* Top Bar for Exit */}
      <div className="absolute top-6 left-6 z-50">
        <button 
          onClick={onBack}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
        >
          <X size={20} /> Exit
        </button>
      </div>

      {/* Decorative background blur for immersion */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[100px]"></div>
      </div>
      
      {/* Container to force a square aspect ratio for the wheel */}
      <div className="relative w-full max-w-[600px] aspect-square flex items-center justify-center p-8 z-10">
        
        {/* 3D Base/Shadow */}
        <div className="absolute inset-4 rounded-full bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.4)] translate-y-6 pointer-events-none"></div>
        <div className="absolute inset-4 rounded-full bg-slate-800 shadow-inner pointer-events-none"></div>

        {/* Pointer (Absolute top center) */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 z-30 -mt-2 drop-shadow-2xl filter origin-top"
          style={{ 
            transform: isSpinning ? 'rotate(10deg)' : 'rotate(0deg)', 
            transition: isSpinning ? 'transform 0.1s infinite alternate' : 'transform 0.3s ease-out' 
          }}
        >
           <svg width="48" height="60" viewBox="0 0 40 50" fill="none">
              <path d="M20 50L0 20C0 8.95431 8.95431 0 20 0C31.0457 0 40 8.95431 40 20L20 50Z" fill="#1e293b"/>
              <path d="M20 45L5 20C5 11.7157 11.7157 5 20 5C28.2843 5 35 11.7157 35 20L20 45Z" fill="#f43f5e"/>
           </svg>
        </div>

        {/* The Wheel */}
        <div 
          className="w-full h-full rounded-full relative overflow-hidden bg-slate-200 border-[12px] border-slate-100 cursor-pointer shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)]"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 5s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none'
          }}
          onClick={handleSpin}
        >
          {numSegments > 0 && (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
              {createWheelSlices()}
            </svg>
          )}
          {/* Inner glossy highlight overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none"></div>
        </div>

        {/* Center Button */}
        {numSegments > 0 && (
          <button 
            onClick={(e) => { e.stopPropagation(); handleSpin(); }}
            disabled={isSpinning}
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30
              w-28 h-28 rounded-full font-black text-3xl shadow-[0_15px_35px_rgba(0,0,0,0.4),inset_0_4px_4px_rgba(255,255,255,0.4)] transition-transform border-4 border-white
              ${isSpinning ? 'bg-slate-300 text-slate-500 cursor-not-allowed scale-95' : 'bg-gradient-to-b from-yellow-300 to-yellow-500 text-yellow-950 hover:scale-110 active:scale-95 hover:from-yellow-200 hover:to-yellow-400'}`}
          >
            SPIN
          </button>
        )}
      </div>

      <WinnerModal 
        isOpen={!!winner && !isSpinning} 
        winner={winner} 
        onClose={() => setWinner(null)} 
        onRemove={() => { 
          if (onRemove && winner) onRemove(winner);
          setWinner(null); 
        }} 
      />
    </div>
  );
};


const RaceEngine = ({ students, theme, onWin, onRemove, onBack }: any) => {
  const [positions, setPositions] = useState<{ [id: number]: number }>({});
  const [isRacing, setIsRacing] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  
  const finishLine = 90; // percentage
  const raceInterval = useRef<any>(null);

  const getAvatar = (index: number) => {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    return (
      <div className="w-16 h-16 relative flex items-center justify-center -ml-4 z-10 transition-transform hover:scale-110 duration-200">
         {theme === 'horses' && <HorseAvatar color={color} />}
         {theme === 'robots' && <RobotAvatar color={color} />}
         {theme === 'cars' && <CarAvatar color={color} />}
      </div>
    );
  };

  const startRace = () => {
    setIsRacing(true);
    setWinner(null);
    setPositions({});
    
    // Initial positions
    const initial: any = {};
    students.forEach((s: any) => initial[s.id] = 0);
    setPositions(initial);

    // Some speed modifiers to make it random but competitive
    const speeds = students.map(() => Math.random() * 0.5 + 0.5);

    raceInterval.current = setInterval(() => {
      setPositions(prev => {
        const next = { ...prev };
        for (let i = 0; i < students.length; i++) {
          const s = students[i];
          // Add random progress between 0.1 and 1.5, scaled by their hidden speed stat
          const progress = (Math.random() * 1.5 + 0.1) * speeds[i];
          next[s.id] = Math.min((next[s.id] || 0) + progress, 100);
        }
        return next;
      });
    }, 50);
  };

  useEffect(() => {
    if (isRacing) {
      let currentWinner = null;
      for (let i = 0; i < students.length; i++) {
        if (positions[students[i].id] >= finishLine) {
          currentWinner = students[i];
          break;
        }
      }
      if (currentWinner) {
        if (raceInterval.current) clearInterval(raceInterval.current);
        setIsRacing(false);
        setWinner(currentWinner);
        if (onWin) onWin(currentWinner);
        window.dispatchEvent(new CustomEvent('student-race-win'));
      }
    }
  }, [positions, isRacing, students, onWin]);

  useEffect(() => {
    return () => {
      if (raceInterval.current) clearInterval(raceInterval.current);
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-full rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-900 to-slate-900 shadow-inner flex-1 p-4 md:p-8">
      {/* Top Bar for Exit */}
      <div className="flex justify-between items-center mb-8 z-10">
        <button 
          onClick={onBack}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 transition-all"
        >
          <X size={20} /> Exit
        </button>
        <button 
          onClick={startRace}
          disabled={isRacing}
          className={`px-8 py-3 rounded-full font-black text-xl shadow-xl transition-transform border-4 border-white
            ${isRacing ? 'bg-slate-500 text-slate-300 border-slate-400 cursor-not-allowed scale-95' : 'bg-gradient-to-b from-yellow-300 to-yellow-500 text-yellow-950 hover:scale-105 active:scale-95'}`}
        >
          {isRacing ? 'RACING...' : 'START RACE'}
        </button>
      </div>

      {/* Racetrack */}
      <div className="flex-1 bg-black/40 rounded-3xl p-4 md:p-8 overflow-y-auto border border-white/10 relative shadow-inner flex flex-col gap-2 relative">
         {/* Finish Line Indicator (Vertical Line) */}
         <div className="absolute top-0 bottom-0 border-l-4 border-dashed border-yellow-400 z-0 opacity-50 pointer-events-none" style={{ left: `${finishLine}%` }}></div>
         
         {students.map((student: any, index: number) => {
           const pos = positions[student.id] || 0;
           return (
             <div key={student.id} className="w-full flex items-center h-16 relative group z-10">
               {/* Track line */}
               <div className="absolute left-0 right-0 h-full border-b border-white/5 top-0 pointer-events-none"></div>
               
               {/* Racer Container */}
               <div 
                 className="absolute left-0 flex flex-col items-center justify-center transition-all duration-75 ease-linear"
                 style={{ left: `calc(${pos}% - ${pos > 0 ? 30 : 0}px)` }} // Adjust slight offset so it doesn't go off screen
               >
                 <div className="text-3xl filter drop-shadow-md">
                   {getAvatar(index)}
                 </div>
                 <div className="text-white font-bold text-xs bg-black/50 px-2 py-0.5 rounded-md whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] mt-1 shadow-sm border border-white/10">
                   {student.name}
                 </div>
               </div>
             </div>
           );
         })}
      </div>

      <WinnerModal 
        isOpen={!!winner && !isRacing} 
        winner={winner} 
        onClose={() => setWinner(null)} 
        onRemove={() => { 
          if (onRemove && winner) onRemove(winner);
          setWinner(null); 
        }} 
      />
    </div>
  );
};

const WinnerModal = ({ isOpen, winner, onClose, onRemove }: any) => {
  if (!isOpen || !winner) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] w-full max-w-lg overflow-hidden flex flex-col items-center p-12 text-center animate-in zoom-in-50 duration-500 border-4 border-yellow-400">
        <div className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_10px_10px_rgba(250,204,21,0.5)]">
           <Trophy size={100} className="fill-current drop-shadow-md" />
        </div>
        <h3 className="text-indigo-400 font-black text-xl uppercase tracking-widest mb-4">WINNER</h3>
        <h2 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-10 break-words w-full px-4 drop-shadow-sm leading-tight">
          {winner.name}
        </h2>
        
        <div className="flex gap-4 w-full mt-4">
          <button 
            onClick={onRemove} 
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl shadow-lg transition-transform hover:scale-105 uppercase tracking-wide border-b-4 border-red-700 active:border-b-0 active:translate-y-1 text-lg"
          >
            REMOVE
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform hover:scale-105 uppercase tracking-wide border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 text-lg"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ history, clearHistory }: any) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-in fade-in">
        <History size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No games played yet today.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 p-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <History className="text-indigo-500" size={32}/> 
          Session History
        </h2>
        <button 
          onClick={clearHistory}
          className="flex items-center gap-2 text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg font-bold transition-colors"
        >
          <Trash2 size={18} /> Clear
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {history.map((entry: any, i: number) => (
          <div key={entry.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center font-black text-lg">
                 #{history.length - i}
               </div>
               <div>
                 <p className="font-black text-xl text-slate-800">{entry.studentName}</p>
                 <p className="text-sm font-bold text-slate-400 flex items-center gap-1">
                   {entry.gameType}
                 </p>
               </div>
            </div>
            <div className="text-slate-400 font-medium text-sm group-hover:text-indigo-500 transition-colors">
              {entry.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const ConfettiContainer = () => {
  const { width, height } = useWindowSize();
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleWin = () => {
      setIsActive(true);
      clearTimeout(timer);
      // Run confetti generation for 4 seconds, then let them fall
      timer = setTimeout(() => setIsActive(false), 8000); 
    };
    
    window.addEventListener('student-race-win', handleWin);
    return () => {
      window.removeEventListener('student-race-win', handleWin);
      clearTimeout(timer);
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      <Confetti
        width={width}
        height={height}
        recycle={false}
        numberOfPieces={800}
        gravity={0.15}
        colors={COLORS}
        initialVelocityY={20}
        initialVelocityX={10}
      />
    </div>
  );
};
