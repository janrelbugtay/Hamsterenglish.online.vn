import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
const Player: any = ReactPlayer;
import {
  Play, Video, Trophy, Settings, BarChart, BookOpen, Flame,
  CheckCircle, XCircle, Star, Sparkles, ChevronRight, Volume2,
  AlertCircle, Users, LayoutDashboard, PlusCircle, Clock, Check,
  Circle, CheckSquare, Loader2, Folder, Tag, MousePointer2,
  Sun, Cloud, ArrowRight, Image as ImageIcon, ArrowLeft
} from 'lucide-react';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800;900&display=swap');

  .font-fredoka { font-family: 'Fredoka', sans-serif; }
  .font-nunito { font-family: 'Nunito', sans-serif; }

  @keyframes popIn {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(5deg); }
  }
  @keyframes slideUpFade {
    0% { transform: translateY(30px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes confettiFall {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .sunny-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 2rem;
    box-shadow: 0 10px 40px rgba(14, 165, 233, 0.15);
    border: 2px solid rgba(255, 255, 255, 1);
  }
  
  .sunny-input {
    background: rgba(240, 249, 255, 0.8);
    border-radius: 1.5rem;
    transition: all 0.2s ease;
    border: 2px solid rgba(186, 230, 253, 0.5);
  }
  .sunny-input:focus {
    border-color: #38bdf8;
    background: #ffffff;
    box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.2);
    outline: none;
  }

  .animate-pop-in { animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
  .animate-float { animation: float 5s ease-in-out infinite; }
  .animate-slide-up { animation: slideUpFade 0.5s ease-out forwards; }
  
  .custom-scrollbar::-webkit-scrollbar { width: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.4); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(56, 189, 248, 0.7); }
`;

const generateDynamicQuestions = (config: any) => {
  const topic = config?.topic || "Nature";
  const level = config?.level || "A2 Movers";
  const types = config?.selectedTypes || ['Multiple Choice'];
  const freq = config?.frequency || 'Every 2 Minutes';

  const activeTypes = types.length > 0 ? types : ['Multiple Choice'];

  let timings = [10, 25, 45, 65, 85];
  if (freq === 'Every 2 Minutes') timings = [15, 75]; 
  if (freq === 'Every 5 Minutes') timings = [50]; 

  return timings.slice(0, 4).map((time, index) => {
    const qType = activeTypes[index % activeTypes.length];
    
    let questionObj: any = {
      id: index + 1,
      timeTrigger: time,
      type: qType,
      xp: 100
    };

    if (qType === 'Multiple Choice') {
      questionObj.question = `Look at the video! What is the main idea about ${topic} here?`;
      questionObj.options = [
        { text: `It explains important things about ${topic.toLowerCase()}.`, isCorrect: true },
        { text: `It is completely unrelated.`, isCorrect: false },
        { text: `The hamsters are sleeping.`, isCorrect: false },
        { text: `We are talking about winter snow.`, isCorrect: false }
      ];
      questionObj.explanation = `The video is clearly demonstrating concepts of ${topic}.`;
      
    } else if (qType === 'Vocabulary Meaning') {
      const words = topic.split(' ').filter((w: string) => w.length > 2);
      const focusWord = words.length > 0 ? words[words.length - 1].toUpperCase() : 'SUNFLOWER';
      questionObj.word = focusWord;
      questionObj.pronunciation = `/${focusWord.toLowerCase().slice(0,4)}/`;
      questionObj.question = `What does '${focusWord}' mean in this video?`;
      questionObj.options = [
        { text: `A key word relating to ${topic}.`, isCorrect: true },
        { text: `A type of cold weather.`, isCorrect: false },
        { text: `Something you drink.`, isCorrect: false },
        { text: `A dark place.`, isCorrect: false }
      ];
      questionObj.explanation = `'${focusWord}' is a key ${level} vocabulary word used in this context.`;
      questionObj.xp = 150;

    } else if (qType === 'Grammar Choice') {
      questionObj.question = `Which sentence is correct for ${level} English?`;
      questionObj.options = [
        { text: `The hamsters are studying ${topic.toLowerCase()}.`, isCorrect: true },
        { text: `The hamsters is studying ${topic.toLowerCase()}.`, isCorrect: false },
        { text: `The hamsters studies ${topic.toLowerCase()}.`, isCorrect: false },
        { text: `The hamsters studying ${topic.toLowerCase()}.`, isCorrect: false }
      ];
      questionObj.explanation = `We use 'are' with plural subjects in the Present Continuous tense.`;

    } else { 
      questionObj.type = 'True or False';
      questionObj.question = `True or False: This part of the video is about ${topic}.`;
      questionObj.options = [
        { text: `True`, isCorrect: true },
        { text: `False`, isCorrect: false }
      ];
      questionObj.explanation = `The context strongly relates to ${topic}.`;
    }
    
    return questionObj;
  });
};

const CEFR_LEVELS = ['Pre-A1', 'A1 Starters', 'A2 Movers', 'A2 Key', 'B1 Preliminary', 'B2 First', 'C1 Advanced'];
const QUESTION_TYPES = ['Multiple Choice', 'True or False', 'Vocabulary Meaning', 'Grammar Choice', 'Listen & Type', 'Put in Order'];

export function HamsterPopQuiz({ onViewChange, initialGame }: { onViewChange: (view: ViewState) => void; initialGame?: any; }) {
  const [currentView, setCurrentView] = useState('home');
  const [questions, setQuestions] = useState<any[]>([]);
  const [lessonConfig, setLessonConfig] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wordsLearned, setWordsLearned] = useState(0);

  const navigateTo = (view: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView(view);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const handleStartLesson = async (config: any) => {
    setLessonConfig(config);
    setIsGenerating(true);
    
    try {
      const res = await fetch('/api/generate-hamster-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topic,
          level: config.level,
          types: config.selectedTypes,
          freq: config.frequency,
          videoUrl: videoUrl
        })
      });
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
      } else {
        setQuestions(generateDynamicQuestions(config));
      }
    } catch (e) {
      console.error(e);
      setQuestions(generateDynamicQuestions(config));
    }
    setIsGenerating(false);
    navigateTo('player');
  };

  const floatingItems = ['☀️', '☁️', '🌻', '🦋', '🐹', '🌼', '☁️', '✨'];

  return (
    <div id="game-container" className="h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 text-slate-800 font-nunito overflow-y-auto overflow-x-hidden bg-gradient-to-br from-sky-300 via-cyan-200 to-yellow-100 relative selection:bg-yellow-400 selection:text-slate-900 rounded-[2rem] border-8 border-white/40 shadow-2xl" style={{ margin: "-1rem", height: "calc(100% + 2rem)" }}>

      <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
        <button 
          onClick={() => onViewChange("games")}
          className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 hover:text-slate-900 bg-white/50 hover:bg-white border-white/50 shadow-sm"
        >
          <ArrowLeft size={24} />
        </button>
        <FullscreenButton targetId="game-container" />
      </div>

      <div className="absolute top-4 right-4 z-[60] flex items-center gap-4">
        <div className="flex items-center gap-2 bg-yellow-400/90 backdrop-blur-md px-4 py-2 rounded-full border-2 border-yellow-300 shadow-md">
          <Star className="text-white" fill="currentColor" size={18} />
          <span className="font-bold text-yellow-900">{xp} XP</span>
        </div>
        <div className="flex items-center gap-2 bg-orange-400/90 backdrop-blur-md px-4 py-2 rounded-full border-2 border-orange-300 shadow-md">
          <Flame className="text-white" fill="currentColor" size={18} />
          <span className="font-bold text-orange-900">{streak}</span>
        </div>
      </div>

      <style>{customStyles}</style>

      {/* Global Sunny Floating Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-60 z-0">
        {[...Array(15)].map((_, i) => (
          <div key={i} 
               className="absolute animate-float text-4xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.1)]"
               style={{
                 left: Math.random() * 100 + 'vw',
                 top: Math.random() * 100 + 'vh',
                 animationDelay: Math.random() * 5 + 's',
                 animationDuration: (Math.random() * 4 + 5) + 's',
                 transform: `scale(${Math.random() * 0.7 + 0.5})`
               }}
          >
            {floatingItems[i % floatingItems.length]}
          </div>
        ))}
      </div>

      

      <main className="container mx-auto px-4 py-8 relative z-10">
        {currentView === 'home' && <HomeView navigateTo={navigateTo} />}
        {currentView === 'create' && <CreateView navigateTo={navigateTo} videoUrl={videoUrl} setVideoUrl={setVideoUrl} />}
        {currentView === 'loading' && <LoadingAnalysisView navigateTo={navigateTo} />}
        {currentView === 'config' && <ConfigView onStartLesson={handleStartLesson} isGenerating={isGenerating} />}
        {currentView === 'player' && (
          <PlayerView 
            config={lessonConfig}
            questions={questions}
            setQuestions={setQuestions}
            xp={xp} setXp={setXp} 
            streak={streak} setStreak={setStreak}
            wordsLearned={wordsLearned} setWordsLearned={setWordsLearned}
            videoUrl={videoUrl}
          />
        )}
      </main>
    </div>
  );
}

function Navbar({ navigateTo, xp, streak, onViewChange }: any) {
  return (
    <nav className="sticky top-0 w-full bg-white/70 backdrop-blur-md z-40 border-b border-sky-100 shadow-sm rounded-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onViewChange("games")} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={24} />
          </button>
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => navigateTo('home')}
          >
            <span className="text-3xl group-hover:scale-110 transition-transform drop-shadow-sm">🐹</span>
            <h1 className="text-2xl font-black font-fredoka bg-gradient-to-r from-sky-400 to-sky-600 bg-clip-text text-transparent">
              Hamster <span className="text-yellow-400">Pop Quiz</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-yellow-100/50 px-4 py-2 rounded-full border border-yellow-200">
            <Star className="text-yellow-500" fill="currentColor" size={18} />
            <span className="font-bold text-yellow-700">{xp} XP</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-100/50 px-4 py-2 rounded-full border border-orange-200">
            <Flame className="text-orange-500" fill="currentColor" size={18} />
            <span className="font-bold text-orange-700">{streak}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

function HomeView({ navigateTo }: any) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-slide-up">
      <div className="bg-white/80 p-6 rounded-full shadow-lg mb-8 animate-float">
        <span className="text-6xl">🌻</span>
      </div>
      <h2 className="text-5xl md:text-7xl font-black font-fredoka text-slate-800 mb-6 drop-shadow-sm">
        Turn Any Video Into A<br/>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-yellow-400">
          Sunny ESL Adventure!
        </span>
      </h2>
      <p className="text-xl text-slate-600 font-medium mb-10 max-w-2xl">
        Paste a video link. Our hamsters will automatically generate interactive questions, vocabulary, and grammar pop quizzes!
      </p>
      <button 
        onClick={() => navigateTo('create')}
        className="bg-sky-400 hover:bg-sky-500 text-white text-xl font-black px-10 py-5 rounded-full shadow-[0_8px_0_#0369a1] hover:shadow-[0_4px_0_#0369a1] hover:translate-y-1 transition-all flex items-center gap-3"
      >
        <Play fill="currentColor" /> Start Exploring Now
      </button>
    </div>
  );
}

function CreateView({ navigateTo, videoUrl, setVideoUrl }: any) {

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (videoUrl) {
      let finalUrl = videoUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }
      if (finalUrl.includes('youtube.com/shorts/')) {
        finalUrl = finalUrl.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
      }
      setVideoUrl(finalUrl);
      navigateTo('loading');
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-20 animate-slide-up">
      <div className="sunny-panel p-10 text-center">
        <h2 className="text-3xl font-black font-fredoka text-sky-500 mb-4 flex items-center justify-center gap-3">
          <Video /> Paste a Video Link
        </h2>
        <p className="text-slate-500 mb-8 font-medium">Ready to start? Drop any learning video URL below.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <input 
            type="text" 
            placeholder="e.g., https://youtube.com/watch?v=..." 
            className="w-full text-lg p-5 rounded-2xl sunny-input font-medium text-slate-700"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
          />
          <button 
            type="submit"
            className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-lg font-black px-8 py-4 rounded-2xl shadow-[0_6px_0_#ca8a04] hover:shadow-[0_3px_0_#ca8a04] hover:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles /> Analyze Video
          </button>
        </form>
      </div>
    </div>
  );
}

function LoadingAnalysisView({ navigateTo }: any) {
  const [step, setStep] = useState(0);
  const steps = [
    { text: "Hamsters are scanning the video...", icon: "🔍" },
    { text: "Sniffing out the context & topics...", icon: "🐹" },
    { text: "Gathering vocabulary seeds...", icon: "🌻" },
    { text: "Running on the grammar wheel...", icon: "⚙️" },
    { text: "Building your sunny adventure!", icon: "☀️" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(timer);
          setTimeout(() => navigateTo('config'), 800);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [navigateTo]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-slide-up">
      <div className="sunny-panel p-12 w-full max-w-xl">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-8 border-sky-100 flex items-center justify-center text-5xl bg-white shadow-inner">
              🐹
            </div>
            <svg className="absolute inset-0 w-full h-full animate-[spinSlow_3s_linear_infinite]" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#38bdf8" strokeWidth="8" strokeDasharray="70 200" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        
        <h2 className="text-2xl font-black font-fredoka text-sky-600 text-center mb-8">Hamster Analysis in Progress</h2>
        
        <div className="space-y-4">
          {steps.map((s, idx) => (
            <div key={idx} className={`flex items-center gap-4 p-3 rounded-2xl transition-all duration-500 ${idx <= step ? 'bg-sky-50 opacity-100' : 'opacity-30'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${idx < step ? 'bg-green-400 text-white' : idx === step ? 'bg-yellow-400 animate-pulse text-white' : 'bg-slate-200'}`}>
                {idx < step ? <Check size={16} strokeWidth={3}/> : <Circle size={10} fill="currentColor"/>}
              </div>
              <span className="text-xl">{s.icon}</span>
              <span className={`font-bold ${idx <= step ? 'text-slate-700' : 'text-slate-400'}`}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfigView({ onStartLesson, isGenerating }: any) {
  const [level, setLevel] = useState('A2 Movers');
  const [selectedTypes, setSelectedTypes] = useState(['Multiple Choice', 'Vocabulary Meaning', 'Grammar Choice']);
  const [frequency, setFrequency] = useState('Smart Hamster Timing ✨');
  
  const [topic, setTopic] = useState('Nature and Animals');
  const [className, setClassName] = useState('Grade 4 Blue');
  const [folder, setFolder] = useState('My ESL Lessons');

  const toggleType = (type: string) => {
    setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  return (
    <div className="max-w-6xl mx-auto animate-slide-up">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-black font-fredoka text-sky-500 flex justify-center items-center gap-3">
          🌻 Quiz Settings
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        {/* Left Column */}
        <div className="space-y-8">
          
          <div className="sunny-panel p-8">
            <h3 className="font-black text-yellow-500 text-xl mb-6 flex items-center gap-2">
              <Trophy size={24} /> English Level Target
            </h3>
            <div className="flex flex-wrap gap-3">
              {CEFR_LEVELS.map(l => (
                <button 
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-5 py-2.5 rounded-full font-bold transition-all border-2 ${level === l ? 'bg-cyan-400 border-cyan-400 text-white shadow-md scale-105' : 'bg-white border-sky-100 text-slate-500 hover:border-cyan-300'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="sunny-panel p-8">
            <h3 className="font-black text-cyan-400 text-xl mb-6 flex items-center gap-2">
              <Clock size={24} /> Quiz Frequency
            </h3>
            <div className="space-y-3">
              {['Smart Hamster Timing ✨', 'Every 2 Minutes', 'Every 5 Minutes'].map(f => (
                <div 
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center gap-4 transition-all ${frequency === f ? 'border-cyan-400 bg-cyan-50' : 'border-sky-100 bg-white hover:border-cyan-200'}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${frequency === f ? 'border-cyan-400' : 'border-slate-300'}`}>
                    {frequency === f && <div className="w-3 h-3 rounded-full bg-cyan-400" />}
                  </div>
                  <span className={`font-bold ${frequency === f ? 'text-cyan-700' : 'text-slate-600'}`}>{f}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          <div className="sunny-panel p-8">
            <h3 className="font-black text-green-400 text-xl mb-6 flex items-center gap-2">
              <CheckSquare size={24} /> Question Types
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {QUESTION_TYPES.map(type => (
                <div 
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer flex flex-col gap-3 transition-all ${selectedTypes.includes(type) ? 'border-cyan-400 bg-cyan-50' : 'border-sky-100 bg-white hover:border-cyan-200'}`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${selectedTypes.includes(type) ? 'bg-cyan-400 text-white' : 'bg-slate-200'}`}>
                    {selectedTypes.includes(type) && <Check size={16} strokeWidth={3} />}
                  </div>
                  <span className="font-bold text-slate-700">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sunny-panel p-8">
            <h3 className="font-black text-sky-400 text-xl mb-6 flex items-center gap-2">
              <Folder size={24} /> Lesson Details
            </h3>
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-bold text-slate-500 mb-2">Video Topic / Subject</label>
                 <input type="text" value={topic} onChange={e=>setTopic(e.target.value)} className="w-full p-4 rounded-xl sunny-input font-bold text-slate-700" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Target Class</label>
                    <input type="text" value={className} onChange={e=>setClassName(e.target.value)} className="w-full p-4 rounded-xl sunny-input font-bold text-slate-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Save to Folder</label>
                    <input type="text" value={folder} onChange={e=>setFolder(e.target.value)} className="w-full p-4 rounded-xl sunny-input font-bold text-slate-700" />
                  </div>
               </div>
            </div>
          </div>

        </div>
      </div>

      <div className="flex justify-center mb-20">
        <button 
          onClick={() => onStartLesson({ level, selectedTypes, frequency, topic, className, folder })}
          disabled={isGenerating}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-yellow-900 text-2xl font-black px-12 py-5 rounded-full shadow-[0_8px_0_#ca8a04] hover:shadow-[0_4px_0_#ca8a04] hover:translate-y-1 transition-all flex items-center gap-3"
        >
          {isGenerating ? (
            <><Loader2 className="animate-spin" size={28} /> GENERATING...</>
          ) : (
            <><Play fill="currentColor" /> START LESSON NOW</>
          )}
        </button>
      </div>
    </div>
  );
}

function PlayerView({ config, questions, setQuestions, xp, setXp, streak, setStreak, wordsLearned, setWordsLearned, videoUrl }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const videoRef = useRef<any>(null);
  const [videoDuration, setVideoDuration] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);

  // Playback is controlled by the playing prop in ReactPlayer

  const handleTimeUpdate = (e: any) => {
    const currentSeconds = e?.currentTarget?.currentTime || e?.target?.currentTime || 0;
    setCurrentTime(currentSeconds);
    const duration = videoDuration || 120;
    
    const currentProgress = (currentSeconds / duration) * 100;
    setProgress(currentProgress);

    const triggeredQuiz = questions.find((q: any) => 
      !quizHistory.includes(q.id) && 
      Math.abs(q.timeTrigger - currentSeconds) < 0.5 
    );

    if (triggeredQuiz && isPlaying && !activeQuiz) {
      setIsPlaying(false); 
      setActiveQuiz(triggeredQuiz);
      if (videoRef.current) {
        if (typeof videoRef.current.seekTo === 'function') {
          videoRef.current.seekTo(triggeredQuiz.timeTrigger, 'seconds');
        } else {
          videoRef.current.currentTime = triggeredQuiz.timeTrigger;
        }
      }
    }
  };

  const handleQuizComplete = (result: any) => {
    if (result.isCorrect) {
      setXp((prev: number) => prev + activeQuiz.xp + (streak * 10)); 
      setStreak((prev: number) => prev + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      if (activeQuiz.type === 'Vocabulary Meaning') setWordsLearned((prev: number) => prev + 1);
    } else {
      setStreak(0);
    }
    
    setQuizHistory([...quizHistory, activeQuiz.id]);
    setActiveQuiz(null);
    setTimeout(() => { setIsPlaying(true); }, 500);
  };

  const togglePlayPause = () => {
    if (!activeQuiz) setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-10">
      
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-400 text-white px-8 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 animate-slide-up border-4 border-white">
          <CheckCircle size={24} /> {toastMessage}
        </div>
      )}

      {showEditModal && (
        <EditQuestionsModal 
          questions={questions} 
          setQuestions={setQuestions} 
          onClose={() => setShowEditModal(false)} 
        />
      )}

      <div className="flex-grow flex flex-col relative rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-white">
        
        <div className="relative flex-grow bg-slate-900 flex items-center justify-center overflow-hidden min-h-[500px]">
          <div className={`absolute inset-0 w-full h-full transition-all duration-700 ${activeQuiz ? 'opacity-30 filter blur-md scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <Player 
              ref={videoRef}
              src={videoUrl || "https://media.w3.org/2010/05/sintel/trailer_hd.mp4"}
              width="100%"
              height="100%"
              playing={isPlaying && !activeQuiz}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              onDurationChange={(e: any) => {
                const duration = e?.currentTarget?.duration || e?.target?.duration || 120;
                setVideoDuration(duration);
              }}
              controls={true}
              style={{ position: 'absolute', top: 0, left: 0 }}
            />
          </div>
          
          {!isPlaying && !activeQuiz && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-sm z-10 cursor-pointer" onClick={togglePlayPause}>
              <button className="bg-yellow-400 border-4 border-white hover:bg-yellow-500 text-yellow-900 p-8 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-110">
                <Play fill="currentColor" size={56} className="ml-2" />
              </button>
            </div>
          )}

          {activeQuiz && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-cyan-900/40 backdrop-blur-md p-6">
              <QuizCard quiz={activeQuiz} onComplete={handleQuizComplete} />
            </div>
          )}

          {showConfetti && <Confetti />}
        </div>

        <div className="h-20 bg-white border-t border-slate-100 flex items-center px-8 gap-6 z-30">
          <button onClick={togglePlayPause} className="text-cyan-500 hover:text-cyan-600 transition-colors w-10 flex justify-center">
            {isPlaying ? <span className="font-black text-2xl leading-none">||</span> : <Play fill="currentColor" size={28} />}
          </button>
          
          <div className="flex-grow h-4 bg-slate-100 rounded-full overflow-hidden relative group cursor-pointer border border-slate-200">
            {questions.map((q: any) => (
              <div 
                key={q.id}
                className={`absolute top-0 bottom-0 w-2 z-10 ${quizHistory.includes(q.id) ? 'bg-green-400 opacity-80' : 'bg-yellow-400 shadow-sm'}`}
                style={{ left: `${(q.timeTrigger / videoDuration) * 100}%` }}
              />
            ))}
            <div 
              className="h-full bg-cyan-400 transition-all duration-300 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-base font-bold tabular-nums text-slate-500 min-w-[90px] text-right">
             {Math.floor(currentTime)}s / {Math.floor(videoDuration)}s
          </span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-[350px] flex flex-col gap-6">
        
        <div className="flex gap-4">
           <button 
             onClick={() => setShowEditModal(true)} 
             className="flex-1 bg-white border-2 border-cyan-200 text-cyan-600 font-bold py-3 rounded-2xl hover:bg-cyan-50 transition-all flex justify-center items-center gap-2 shadow-sm"
           >
             <Settings size={20} /> Edit Quizzes
           </button>
           <button 
             onClick={() => {
               setToastMessage('Quiz Saved to Folder! 🌻');
               setTimeout(() => setToastMessage(''), 3000);
             }} 
             className="flex-1 bg-yellow-400 text-yellow-900 font-bold py-3 rounded-2xl hover:shadow-lg hover:bg-yellow-500 transition-all flex justify-center items-center gap-2 shadow-md border-2 border-white"
           >
             <Folder size={20} /> Save Quiz
           </button>
        </div>

        <div className="sunny-panel p-8 relative overflow-hidden">
          <h3 className="font-black text-cyan-500 text-sm tracking-widest uppercase mb-3">Lesson Progress</h3>
          <div className="flex items-end gap-3 mb-6">
            <span className="text-6xl font-black text-slate-800 drop-shadow-sm">{quizHistory.length}</span>
            <span className="text-slate-500 mb-2 font-bold text-lg">/ {questions.length} Quizzes</span>
          </div>
          
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div 
              className="h-full rounded-full bg-green-400 transition-all duration-700"
              style={{ width: questions.length ? `${(quizHistory.length / questions.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="sunny-panel p-6 flex flex-col items-center justify-center text-center">
            <Star className="text-yellow-400 mb-3" size={36} fill="currentColor" />
            <span className="text-3xl font-black mb-1 text-slate-800">{xp}</span>
            <span className="text-xs text-cyan-600 uppercase font-bold tracking-widest">Total XP</span>
          </div>
          <div className="sunny-panel p-6 flex flex-col items-center justify-center text-center">
            <Flame className={`mb-3 ${streak > 0 ? 'text-orange-500' : 'text-slate-300'}`} size={36} fill={streak > 0 ? "currentColor" : "none"} />
            <span className={`text-3xl font-black mb-1 ${streak > 0 ? 'text-slate-800' : 'text-slate-400'}`}>{streak}</span>
            <span className={`text-xs uppercase font-bold tracking-widest ${streak > 0 ? 'text-cyan-600' : 'text-slate-400'}`}>Streak</span>
          </div>
        </div>

        <div className="sunny-panel p-8 flex-grow flex flex-col max-h-[300px]">
          <h3 className="font-black text-cyan-500 text-sm tracking-widest uppercase mb-6 flex items-center gap-3">
            <BookOpen size={20}/> Words Learned ({wordsLearned})
          </h3>
          <div className="flex-grow space-y-3 overflow-y-auto pr-2 custom-scrollbar">
             {quizHistory.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-4">
                 <div className="text-5xl opacity-50">🐹</div>
                 <p className="text-sm font-medium">Keep watching to discover sunny new vocabulary!</p>
               </div>
             ) : (
               questions.filter((q: any) => q.type === 'Vocabulary Meaning' && quizHistory.includes(q.id)).map((q: any) => (
                 <div key={q.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                   <div>
                     <div className="font-black text-cyan-700 text-lg mb-1">{q.word}</div>
                     <div className="text-sm text-slate-500 font-medium">{q.pronunciation}</div>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizCard({ quiz, onComplete }: any) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleSelect = (idx: number) => {
    if (showExplanation) return;
    setSelected(idx);
    setShowExplanation(true);
  };

  return (
    <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-8 animate-pop-in border-4 border-white relative overflow-hidden">
      
      {/* Decorative top ribbon */}
      <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-cyan-400 to-yellow-400"></div>
      
      <div className="flex justify-between items-center mb-6 mt-2">
        <span className="bg-cyan-100 text-cyan-700 font-black px-4 py-2 rounded-xl text-sm uppercase tracking-widest flex items-center gap-2">
           <Sparkles size={16}/> {quiz.type}
        </span>
        <span className="text-yellow-500 font-black flex items-center gap-1">
          +{quiz.xp} XP <Star fill="currentColor" size={16}/>
        </span>
      </div>

      <h2 className="text-2xl font-black text-slate-800 mb-8 font-fredoka leading-snug">
        {quiz.question}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quiz.options.map((opt: any, idx: number) => {
          let stateClass = "bg-slate-50 border-slate-200 text-slate-700 hover:border-cyan-400 hover:bg-cyan-50";
          if (showExplanation) {
            if (opt.isCorrect) stateClass = "bg-green-100 border-green-400 text-green-800 shadow-md scale-105 z-10";
            else if (selected === idx) stateClass = "bg-red-50 border-red-300 text-red-500 opacity-80";
            else stateClass = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
          }

          return (
            <button 
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={showExplanation}
              className={`p-5 rounded-2xl border-2 font-bold text-left transition-all duration-300 ${stateClass}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className="mt-8 pt-6 border-t border-slate-100 animate-slide-up">
          <div className={`p-5 rounded-2xl flex items-start gap-4 ${quiz.options[selected!].isCorrect ? 'bg-green-50' : 'bg-orange-50'}`}>
            <div className="mt-1">
              {quiz.options[selected!].isCorrect ? 
                <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center text-white"><Check size={20} strokeWidth={3}/></div> : 
                <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center text-white"><XCircle size={20} strokeWidth={3}/></div>
              }
            </div>
            <div>
              <h4 className={`font-black text-lg mb-1 ${quiz.options[selected!].isCorrect ? 'text-green-700' : 'text-orange-700'}`}>
                {quiz.options[selected!].isCorrect ? 'Awesome job! 🌻' : 'Not quite! Let\'s learn. 🐹'}
              </h4>
              <p className="text-slate-600 font-medium leading-relaxed">{quiz.explanation}</p>
            </div>
          </div>
          <button 
            onClick={() => onComplete({ isCorrect: quiz.options[selected!].isCorrect })}
            className="w-full mt-6 bg-cyan-500 hover:bg-cyan-600 text-white font-black py-4 rounded-2xl shadow-[0_6px_0_#0284c7] hover:shadow-[0_3px_0_#0284c7] hover:translate-y-1 transition-all flex justify-center items-center gap-2 text-lg"
          >
            CONTINUE VIDEO <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function EditQuestionsModal({ questions, setQuestions, onClose }: any) {
  const [editedQuestions, setEditedQuestions] = useState([...questions]);

  const handleTextChange = (id: number, newText: string) => {
    setEditedQuestions(editedQuestions.map(q => q.id === id ? { ...q, question: newText } : q));
  };

  const handleSave = () => {
    setQuestions(editedQuestions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-900/60 backdrop-blur-sm animate-pop-in">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border-4 border-white overflow-hidden flex flex-col max-h-[80vh]">
        <div className="bg-cyan-50 p-6 border-b border-cyan-100 flex justify-between items-center">
          <h2 className="text-2xl font-black text-cyan-800 font-fredoka flex items-center gap-3">
            <Settings className="text-cyan-500" /> Edit Quizzes
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-grow space-y-6 custom-scrollbar bg-slate-50">
          {editedQuestions.map((q, index) => (
            <div key={q.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-cyan-600 uppercase text-xs tracking-widest">Question {index + 1} ({q.type})</span>
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">At {q.timeTrigger}s</span>
              </div>
              <textarea 
                value={q.question}
                onChange={(e) => handleTextChange(q.id, e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl p-3 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-100 font-medium text-slate-700 resize-none h-20"
              />
            </div>
          ))}
        </div>
        <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-8 py-3 font-black text-white bg-green-400 hover:bg-green-500 rounded-xl shadow-[0_4px_0_#16a34a] hover:translate-y-1 transition-all flex items-center gap-2">
            <Check size={20} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(60)].map((_, i) => (
        <div key={i} className="absolute w-4 h-4 rounded-full shadow-sm"
             style={{
               left: `${Math.random() * 100}%`,
               top: `-20px`,
               backgroundColor: ['#fde047', '#38bdf8', '#4ade80', '#ffffff', '#fbbf24'][Math.floor(Math.random() * 5)],
               animation: `confettiFall ${Math.random() * 2 + 1.5}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
               animationDelay: `${Math.random() * 0.3}s`
             }}
        />
      ))}
    </div>
  );
}
