import React, { useState, useEffect } from 'react';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import {
  Plus, Search, Clock, Play, Grid, Edit3, Copy, Trash2, Share2, 
  ChevronLeft, ChevronRight, RotateCcw, Volume2, Star, Sparkles, 
  Settings, CheckCircle2, Image as ImageIcon, Video, Type, GripVertical,
  ArrowRightLeft, FileDown, FileUp, Filter, SortDesc, Heart, Zap
} from 'lucide-react';

// --- Custom Styles for Animations & Layout ---
const customStyles = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  
  .card-inner {
    transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1);
  }

  /* Match Game Card Flip */
  .match-card-inner {
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Animations */
  @keyframes popIn {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

  @keyframes pulse-match {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
    50% { transform: scale(1.05); box-shadow: 0 0 15px 0 rgba(34, 197, 94, 0.8); }
  }
  .animate-match { animation: pulse-match 0.6s ease-in-out; border-color: #22c55e !important; }
  
  @keyframes confetti-fall {
    0% { transform: translateY(-100vh) rotate(0deg); }
    100% { transform: translateY(100vh) rotate(360deg); }
  }

  /* Custom Scrollbar for Editor */
`;

// --- Mock Data ---
const initialActivities = [
  {
    id: 1,
    title: 'Animals (English - Spanish)',
    subject: 'Languages',
    grade: 'Grade 6',
    lastEdited: '2 hours ago',
    author: 'Mr. Davis',
    isFavorite: true,
    thumbnail: '🦁',
    cards: [
      { id: 101, front: 'Dog 🐶', back: 'Perro' },
      { id: 102, front: 'Cat 🐱', back: 'Gato' },
      { id: 103, front: 'Bird 🐦', back: 'Pájaro' },
      { id: 104, front: 'Fish 🐟', back: 'Pez' },
      { id: 105, front: 'Mouse 🐭', back: 'Ratón' },
      { id: 106, front: 'Horse 🐴', back: 'Caballo' },
    ]
  },
  {
    id: 2,
    title: 'Cambridge Movers Unit 3',
    subject: 'ESL',
    grade: 'Primary',
    lastEdited: '1 day ago',
    author: 'Mr. Davis',
    isFavorite: false,
    thumbnail: '📚',
    cards: [
      { id: 201, front: 'To jump high', back: 'Bounce' },
      { id: 202, front: 'A place to read', back: 'Library' },
      { id: 203, front: 'Used to write on', back: 'Paper' },
      { id: 204, front: 'Person who teaches', back: 'Teacher' },
    ]
  },
  {
    id: 3,
    title: 'World Capitals',
    subject: 'Geography',
    grade: 'Grade 8',
    lastEdited: '3 days ago',
    author: 'Mr. Davis',
    isFavorite: true,
    thumbnail: '🌍',
    cards: [
      { id: 301, front: 'France', back: 'Paris' },
      { id: 302, front: 'Japan', back: 'Tokyo' },
      { id: 303, front: 'Italy', back: 'Rome' },
      { id: 304, front: 'Canada', back: 'Ottawa' },
      { id: 305, front: 'Brazil', back: 'Brasília' },
      { id: 306, front: 'Australia', back: 'Canberra' },
    ]
  }
];

export function FlashcardsMatch({ onViewChange }: { onViewChange: (view: ViewState) => void }) {
  const [currentView, setCurrentView] = useState('lobby'); // lobby, editor, flashcards, match
  const [activities, setActivities] = useState(initialActivities);
  const [activeActivity, setActiveActivity] = useState<any>(null);
  const [activityToDelete, setActivityToDelete] = useState<number | null>(null);

  const navigateTo = (view: string, activity: any = null) => {
    setActiveActivity(activity);
    setCurrentView(view);
  };

  const handleSaveActivity = (newActivity: any) => {
    if (newActivity.id) {
      setActivities(activities.map(a => a.id === newActivity.id ? newActivity : a));
    } else {
      setActivities([{ ...newActivity, id: Date.now() }, ...activities]);
    }
    navigateTo('lobby');
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivityToDelete(id);
  }

  const confirmDelete = () => {
    if (activityToDelete !== null) {
      setActivities(activities.filter(a => a.id !== activityToDelete));
      setActivityToDelete(null);
    }
  }

  return (
    <div id="game-container" className="h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden relative selection:bg-cyan-500/30 rounded-xl" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
      <style>{customStyles}</style>
      
      {/* Top Toolbar Navigation */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md cursor-pointer" onClick={() => onViewChange("home")}>
            <ChevronLeft size={18} fill="currentColor" />
          </div>
          <span className="font-black text-xl tracking-tight text-indigo-950 cursor-pointer hidden sm:block" onClick={() => navigateTo('lobby')}>
            FLASH MATCH
          </span>
        </div>

        {currentView === 'lobby' && (
          <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search activities..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-4">
           {currentView !== 'editor' && (
            <button 
              onClick={() => navigateTo('editor', { id: null, title: 'New Activity', cards: [{id: 1, front: '', back: ''}] })}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-md shadow-indigo-200"
            >
              <Plus size={18} /> <span className="hidden sm:inline">New Activity</span>
            </button>
           )}
           <div className="w-9 h-9 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold overflow-hidden cursor-pointer">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=TeacherDave" alt="Profile" />
           </div>
        </div>
      </header>
      
      {/* Delete Confirmation Modal */}
      {activityToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Delete Activity?</h2>
            <p className="text-slate-500 font-medium mb-6">
              Are you sure you want to delete this activity?
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setActivityToDelete(null)}
                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 overflow-hidden flex flex-col">
        {currentView === 'lobby' && <TeacherLobby activities={activities} navigateTo={navigateTo} onDelete={handleDelete} />}
        {currentView === 'editor' && <ActivityEditor activity={activeActivity} onSave={handleSaveActivity} onCancel={() => navigateTo('lobby')} />}
        {currentView === 'flashcards' && <FlashcardMode activity={activeActivity} onBack={() => navigateTo('lobby')} />}
        {currentView === 'match' && <PairMatchingMode activity={activeActivity} onBack={() => navigateTo('lobby')} />}
      </main>
    </div>
  );
}

// --- Components ---

function TeacherLobby({ activities, navigateTo, onDelete }: any) {
  return (
    <div className="h-full flex flex-col animate-pop">
      
      {/* Filters & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 shrink-0">
        <h1 className="text-3xl font-extrabold text-slate-800">My Activities</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm shadow-sm cursor-pointer">
            <Filter size={16} /> Subject
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm shadow-sm cursor-pointer">
            <SortDesc size={16} /> Recent
          </button>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pr-2">
          {activities.map((activity: any) => (
            <div key={activity.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col">
              
              {/* Card Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shadow-sm">
                  {activity.thumbnail}
                </div>
                <div className="flex gap-1">
                  <button className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer">
                    <Heart size={18} fill={activity.isFavorite ? "currentColor" : "none"} className={activity.isFavorite ? "text-amber-500" : ""} />
                  </button>
                  <button onClick={() => navigateTo('editor', activity)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={(e) => onDelete(activity.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {/* Card Info */}
              <div className="mb-4 flex-1">
                <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1">{activity.title}</h3>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-md">{activity.cards.length} Pairs</span>
                  <span>{activity.subject}</span>
                </div>
              </div>

              {/* Play Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <button 
                  onClick={() => navigateTo('flashcards', activity)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all text-sm shadow-md cursor-pointer"
                >
                  <Play size={16} fill="currentColor" /> Flashcards
                </button>
                <button 
                  onClick={() => navigateTo('match', activity)}
                  className="flex items-center justify-center gap-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition-all text-sm border border-indigo-200 cursor-pointer"
                >
                  <Grid size={16} /> Match
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityEditor({ activity, onSave, onCancel }: any) {
  const [title, setTitle] = useState(activity?.title || '');
  const [cards, setCards] = useState<any[]>(activity?.cards || [{ id: Date.now(), front: '', back: '' }]);
  const [isGenerating, setIsGenerating] = useState(false);

  const addRow = () => {
    setCards([...cards, { id: Date.now(), front: '', back: '' }]);
  };

  const updateCard = (id: number, field: string, value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const deleteRow = (id: number) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const swapSides = (id: number) => {
    setCards(cards.map(c => {
      if (c.id === id) return { ...c, front: c.back, back: c.front };
      return c;
    }));
  };

  const generateWithAI = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setTitle(title || 'AI Generated Vocabulary');
      setCards([
        { id: Date.now()+1, front: 'Astounding 🌟', back: 'Very surprising or impressive' },
        { id: Date.now()+2, front: 'Bizarre 👽', back: 'Very strange or unusual' },
        { id: Date.now()+3, front: 'Luminous 💡', back: 'Producing or reflecting bright light' },
        { id: Date.now()+4, front: 'Serene 🍃', back: 'Calm, peaceful, and untroubled' },
      ]);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSave = () => {
    if(!title.trim()) return alert("Please enter a title");
    const validCards = cards.filter(c => c.front.trim() || c.back.trim());
    if(validCards.length === 0) return alert("Please add at least one valid card.");
    
    onSave({
      ...(activity || {}),
      title,
      cards: validCards,
      subject: activity?.subject || 'General',
      grade: activity?.grade || 'All',
      lastEdited: 'Just now',
      thumbnail: activity?.thumbnail || '📝',
      isFavorite: activity?.isFavorite || false
    });
  };

  return (
    <div className="h-full flex flex-col w-full max-w-4xl mx-auto animate-pop bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      
      {/* Editor Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between bg-slate-50 dark:bg-slate-900/50 shrink-0 border-b border-slate-200 dark:border-slate-700">
        <input 
          type="text" 
          placeholder="Activity Title (e.g., Chapter 4 Vocabulary)" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-2xl font-black text-slate-900 dark:text-white bg-transparent border-none outline-none placeholder:text-slate-400 flex-1 min-w-[250px]"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all cursor-pointer">
            Save Activity
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 shrink-0">
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
            <FileDown size={16} /> Import
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
            <Settings size={16} /> Settings
          </button>
        </div>
        <button 
          onClick={generateWithAI}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-all cursor-pointer"
        >
          <Sparkles size={16} className={isGenerating ? "animate-pulse" : ""} /> 
          {isGenerating ? "Generating..." : "Auto-Generate"}
        </button>
      </div>

      {/* Rows Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50">
        <div className="flex font-bold text-slate-500 text-sm mb-2 px-12">
          <div className="flex-1">FRONT SIDE</div>
          <div className="flex-1 ml-4">BACK SIDE (MATCH)</div>
        </div>

        <div className="space-y-3">
          {cards.map((card, index) => (
            <div key={card.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm group">
              
              <div className="text-slate-400 font-bold w-6 text-center cursor-grab hover:text-slate-600">
                {index + 1}
              </div>

              {/* Front Input */}
              <div className="flex-1 relative">
                <textarea 
                  value={card.front}
                  onChange={(e) => updateCard(card.id, 'front', e.target.value)}
                  placeholder="Enter term or text..."
                  className="w-full resize-none bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
                  rows={2}
                />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"><ImageIcon size={14}/></button>
                  <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"><Volume2 size={14}/></button>
                </div>
              </div>

              {/* Swap Button */}
              <button onClick={() => swapSides(card.id)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-all cursor-pointer">
                <ArrowRightLeft size={16} />
              </button>

              {/* Back Input */}
              <div className="flex-1 relative">
                <textarea 
                  value={card.back}
                  onChange={(e) => updateCard(card.id, 'back', e.target.value)}
                  placeholder="Enter definition or answer..."
                  className="w-full resize-none bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
                  rows={2}
                />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"><ImageIcon size={14}/></button>
                  <button className="p-1.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"><Volume2 size={14}/></button>
                </div>
              </div>

              {/* Row Actions */}
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => deleteRow(card.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Card Button */}
        <button 
          onClick={addRow}
          className="w-full mt-6 py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={20} /> Add Card
        </button>
      </div>
    </div>
  );
}

// --- Flashcard Mode ---
function FlashcardMode({ activity, onBack }: any) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cards = activity.cards;
  const progress = ((currentIndex + 1) / cards.length) * 100;

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < cards.length - 1) setCurrentIndex(prev => prev + 1);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    }, 150);
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto w-full animate-pop relative">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 cursor-pointer">
          <ChevronLeft size={20} /> Back
        </button>
        <div className="font-extrabold text-lg text-slate-800">{activity.title}</div>
        <div className="font-bold text-slate-400">{currentIndex + 1} / {cards.length}</div>
      </div>

      {/* Progress */}
      <div className="w-full h-2 bg-slate-200 rounded-full mb-8 overflow-hidden shrink-0">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Flashcard */}
      <div className="flex-1 relative perspective-1000 mb-8 cursor-pointer select-none mx-2 min-h-0" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`w-full h-full relative transform-style-3d card-inner ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg border border-slate-200 overflow-hidden">
             <h2 className="text-4xl md:text-6xl font-black text-slate-800 text-center leading-tight">
               {cards[currentIndex].front}
             </h2>
             <div className="absolute bottom-6 text-slate-400 font-bold text-sm bg-slate-100 px-4 py-2 rounded-full animate-pulse">Tap to flip</div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-50 rounded-3xl p-8 flex flex-col items-center justify-center shadow-lg border border-indigo-100 overflow-hidden">
             <h3 className="text-3xl md:text-5xl font-extrabold text-indigo-700 text-center leading-tight">
               {cards[currentIndex].back}
             </h3>
          </div>

        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-6 pb-6 shrink-0">
        <button onClick={prevCard} disabled={currentIndex === 0} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer ${currentIndex === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800 hover:bg-slate-100'}`}>
          <ChevronLeft size={24} />
        </button>
        <button onClick={nextCard} disabled={currentIndex === cards.length - 1} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer ${currentIndex === cards.length - 1 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800 hover:bg-slate-100'}`}>
          <ChevronRight size={24} />
        </button>
      </div>

    </div>
  );
}

// --- Pair Matching Mode ---
function PairMatchingMode({ activity, onBack }: any) {
  const [board, setBoard] = useState<any[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [timer, setTimer] = useState(0);

  // Initialize Board
  useEffect(() => {
    initializeGame();
  }, [activity]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (board.length > 0 && !isWon) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [board, isWon]);

  const initializeGame = () => {
    // Take max 8 pairs to keep board manageable for prototype
    const gameCards = activity.cards.slice(0, 8); 
    let items: any[] = [];
    gameCards.forEach((card: any) => {
      items.push({ uniqueId: `${card.id}-f`, pairId: card.id, content: card.front, type: 'front' });
      items.push({ uniqueId: `${card.id}-b`, pairId: card.id, content: card.back, type: 'back' });
    });
    // Shuffle
    items.sort(() => Math.random() - 0.5);
    setBoard(items);
    setFlippedIndices([]);
    setMatchedIds([]);
    setMoves(0);
    setTimer(0);
    setIsWon(false);
  };

  const handleCardClick = (index: number) => {
    if (flippedIndices.length === 2) return; // Prevent clicking more than 2
    if (flippedIndices.includes(index)) return; // Prevent double clicking same card
    if (matchedIds.includes(board[index].pairId)) return; // Already matched

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const card1 = board[newFlipped[0]];
      const card2 = board[newFlipped[1]];

      if (card1.pairId === card2.pairId) {
        // Match!
        setTimeout(() => {
          setMatchedIds(prev => {
            const newMatched = [...prev, card1.pairId];
            if (newMatched.length === board.length / 2) {
              setIsWon(true);
            }
            return newMatched;
          });
          setFlippedIndices([]);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isWon) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-pop relative overflow-hidden text-center">
        {/* Simple Confetti Effect using CSS */}
        <div className="absolute inset-0 pointer-events-none flex justify-center gap-10 overflow-hidden opacity-50">
           {[...Array(10)].map((_, i) => (
             <div key={i} className="w-3 h-8 bg-indigo-500 rounded-full" style={{
                animation: `confetti-fall ${Math.random() * 2 + 2}s linear infinite`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'][Math.floor(Math.random()*4)]
             }} />
           ))}
        </div>
        
        <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl relative z-10">
           <Star size={50} fill="currentColor" />
        </div>
        <h2 className="text-4xl font-black text-slate-800 mb-2 relative z-10">Incredible!</h2>
        <p className="text-lg text-slate-500 font-medium mb-8 relative z-10">You matched everything in {formatTime(timer)} with {moves} moves.</p>
        
        <div className="flex gap-4 relative z-10">
          <button onClick={initializeGame} className="px-8 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
            Play Again
          </button>
          <button onClick={onBack} className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md cursor-pointer">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col w-full max-w-5xl mx-auto animate-pop">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-6 px-2 shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 cursor-pointer">
          <ChevronLeft size={20} /> Exit
        </button>
        
        <div className="flex gap-6 font-bold text-slate-600">
           <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex gap-2 items-center">
             <Clock size={18} className="text-indigo-500" /> {formatTime(timer)}
           </div>
           <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex gap-2 items-center">
             <ArrowRightLeft size={18} className="text-amber-500" /> Moves: {moves}
           </div>
        </div>
      </div>

      {/* Responsive Grid based on card count */}
      <div className={`flex-1 overflow-y-auto grid gap-3 sm:gap-4 pb-8 ${board.length > 12 ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-4'}`}>
        {board.map((item, index) => {
          const isFlipped = flippedIndices.includes(index);
          const isMatched = matchedIds.includes(item.pairId);
          
          return (
            <div 
              key={index} 
              className={`perspective-1000 cursor-pointer select-none ${isMatched ? 'opacity-0 pointer-events-none' : ''}`}
              onClick={() => handleCardClick(index)}
              style={{ transition: 'opacity 0.4s ease-out' }}
            >
              <div className={`w-full h-full min-h-[100px] sm:min-h-[120px] relative transform-style-3d match-card-inner ${(isFlipped || isMatched) ? 'rotate-y-180' : ''}`}>
                
                {/* Back of Card (Hidden side) */}
                <div className="absolute inset-0 backface-hidden bg-slate-200 hover:bg-slate-300 rounded-xl shadow-sm border-2 border-slate-300 flex items-center justify-center transition-colors">
                  <Grid size={32} className="text-slate-400 opacity-50" />
                </div>
                
                {/* Front of Card (Revealed side) */}
                <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-xl shadow-md border-2 p-2 sm:p-4 flex items-center justify-center text-center overflow-hidden break-words
                  ${isFlipped ? 'animate-match bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200'}
                `}>
                  <span className={`font-bold ${item.content.length > 15 ? 'text-xs sm:text-sm' : 'text-sm sm:text-base md:text-lg'} text-slate-800`}>
                    {item.content}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
