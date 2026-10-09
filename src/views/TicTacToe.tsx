import React, { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import { Settings, Play, Plus, Trash2, Edit2, Volume2, VolumeX, AlertCircle, CheckCircle2, XCircle, RotateCcw, Trophy, Users, MonitorUp, Smartphone, QrCode, LogOut, Crown, Zap, Clock, ArrowLeft } from 'lucide-react';
import { ViewState } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, query, orderBy, deleteDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';


/**
 * ============================================================================
 * FIREBASE MULTIPLAYER INTEGRATION GUIDE
 * ============================================================================
 * This application currently uses a `BroadcastChannel` simulated network layer 
 * so you can test Host and Player modes immediately in multiple browser tabs 
 * without needing API keys.
 * 
 * To switch to REAL FIREBASE for production, replace the `NetworkManager` 
 * below with the following standard Firebase implementation:
 * 
 * 1. Install Firebase: `npm install firebase`
 * 2. Setup Firebase Config:
 * 
 *    import { initializeApp } from 'firebase/app';
 *    import { getDatabase, ref, onValue, set, update, push, onDisconnect } from 'firebase/database';
 *    import { getAuth, signInAnonymously } from 'firebase/auth';
 * 
 *    const firebaseConfig = {
 *      apiKey: "YOUR_API_KEY",
 *      authDomain: "YOUR_PROJECT.firebaseapp.com",
 *      databaseURL: "https://YOUR_PROJECT.firebaseio.com",
 *      projectId: "YOUR_PROJECT_ID",
 *    };
 *    const app = initializeApp(firebaseConfig);
 *    const db = getDatabase(app);
 *    const auth = getAuth(app);
 * 
 * 3. Database Structure:
 *    /rooms/{roomId}
 *       /gameState       -> (The entire host state object)
 *       /actions/{id}    -> (Actions pushed by players: join, answer)
 * 
 * 4. Security Rules (Realtime Database):
 *    {
 *      "rules": {
 *        "rooms": {
 *          "$roomId": {
 *            "gameState": { ".read": true, ".write": "auth != null && data.child('hostId').val() == auth.uid" },
 *            "actions": { ".write": "auth != null", ".read": "auth != null && root.child('rooms/'+$roomId+'/gameState/hostId').val() == auth.uid" }
 *          }
 *        }
 *      }
 *    }
 * ============================================================================
 */

// --- Network Simulator (Replaces Firebase for local multi-tab testing) ---
const NetworkManager = {
    isHost: false,
    roomId: null as string | null,
    playerId: null as string | null,
    unsubscribeState: null as any,
    unsubscribeActions: null as any,
    messageCallback: null as any,
    broadcastTimeout: null as any,
    pendingState: null as any,
    lastBroadcastTime: 0,
    init: (room: string, isHostRole: boolean, id: string) => {
        NetworkManager.roomId = room;
        NetworkManager.isHost = isHostRole;
        NetworkManager.playerId = id;
        NetworkManager.cleanup();

        if (isHostRole) {
            const actionsRef = collection(db, 'ttt_rooms', room, 'actions');
            const q = query(actionsRef, orderBy('timestamp', 'asc'));
            
            NetworkManager.unsubscribeActions = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (NetworkManager.messageCallback) {
                            NetworkManager.messageCallback({ type: 'PLAYER_ACTION', action: data.action });
                        }
                        deleteDoc(change.doc.ref).catch(() => {});
                    }
                });
            });
        } else {
            const roomRef = doc(db, 'ttt_rooms', room);
            NetworkManager.unsubscribeState = onSnapshot(roomRef, (docSnap) => {
                if (docSnap.exists() && NetworkManager.messageCallback) {
                    NetworkManager.messageCallback({ type: 'STATE_UPDATE', state: docSnap.data().state });
                }
            });
        }
    },
    // Host broadcasts state to all players
    broadcastState: (state: any) => {
        if (!NetworkManager.isHost || !NetworkManager.roomId) return;
        
        const now = Date.now();
        const timeSinceLast = now - (NetworkManager.lastBroadcastTime || 0);
        const THROTTLE_MS = 200; // max 5 updates per second

        if (timeSinceLast >= THROTTLE_MS) {
            NetworkManager.lastBroadcastTime = now;
            const roomRef = doc(db, 'ttt_rooms', NetworkManager.roomId);
            setDoc(roomRef, { state, updatedAt: now }).catch(() => {});
        } else {
            NetworkManager.pendingState = state;
            if (!NetworkManager.broadcastTimeout) {
                NetworkManager.broadcastTimeout = setTimeout(() => {
                    NetworkManager.lastBroadcastTime = Date.now();
                    const roomRef = doc(db, 'ttt_rooms', NetworkManager.roomId!);
                    setDoc(roomRef, { state: NetworkManager.pendingState, updatedAt: Date.now() }).catch(() => {});
                    NetworkManager.broadcastTimeout = null;
                }, THROTTLE_MS - timeSinceLast);
            }
        }
    },
    // Player sends action to host
    sendActionToHost: (action: any) => {
        if (NetworkManager.isHost || !NetworkManager.roomId) return;
        const actionsRef = collection(db, 'ttt_rooms', NetworkManager.roomId, 'actions');
        addDoc(actionsRef, { action, timestamp: Date.now() }).catch(() => {});
    },
    // Listeners
    onMessage: (callback: (data: any) => void) => {
        NetworkManager.messageCallback = callback;
    },
    cleanup: () => {
        if (NetworkManager.broadcastTimeout) {
            clearTimeout(NetworkManager.broadcastTimeout);
            NetworkManager.broadcastTimeout = null;
        }
        if (NetworkManager.unsubscribeState) {
            NetworkManager.unsubscribeState();
            NetworkManager.unsubscribeState = null;
        }
        if (NetworkManager.unsubscribeActions) {
            NetworkManager.unsubscribeActions();
            NetworkManager.unsubscribeActions = null;
        }
        // messageCallback is purposefully NOT nullified here 
        // to prevent `init` from destroying the host's callback.
    }
};

// --- Audio System ---
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
};

const sounds = {
    start: () => { playTone(440, 'sine', 0.1); setTimeout(() => playTone(880, 'sine', 0.2), 100); },
    tick: () => playTone(1000, 'square', 0.05, 0.02),
    correct: () => { playTone(523.25, 'sine', 0.1); setTimeout(() => playTone(659.25, 'sine', 0.1), 100); setTimeout(() => playTone(783.99, 'sine', 0.2), 200); },
    wrong: () => { playTone(150, 'sawtooth', 0.2, 0.2); setTimeout(() => playTone(100, 'sawtooth', 0.3, 0.2), 150); },
    steal: () => { playTone(800, 'triangle', 0.1); setTimeout(() => playTone(600, 'triangle', 0.2), 100); },
    moveCursor: () => playTone(300, 'square', 0.05, 0.01),
    placePiece: () => playTone(200, 'square', 0.1, 0.05),
    win: () => {
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.1, 0.1), i * 150));
        setTimeout(() => playTone(1046.50, 'square', 0.4, 0.1), 600);
    }
};

const defaultQuestions = [
    { id: 1, text: "What is the past tense of 'go'?", options: ["Goed", "Went", "Goes", "Going"], correct: 1 },
    { id: 2, text: "Which planet is known as the Red Planet?", options: ["Earth", "Jupiter", "Mars", "Venus"], correct: 2 },
    { id: 3, text: "What is 15 x 3?", options: ["35", "40", "45", "50"], correct: 2 },
    { id: 4, text: "Who wrote 'Romeo and Juliet'?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correct: 1 },
    { id: 5, text: "What is the largest ocean on Earth?", options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"], correct: 3 },
    { id: 6, text: "Which element has the chemical symbol 'O'?", options: ["Gold", "Oxygen", "Osmium", "Oganesson"], correct: 1 }
];

const WINNING_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const generatePlayerId = () => 'p_' + Math.random().toString(36).substring(2, 10);

const initialState = {
    roomId: null,
    status: 'SETUP', // SETUP, LOBBY, INTRO, QUESTION, EVALUATING, STEAL_PHASE, BOARD_ACTION, WINNER, DRAW, SUMMARY
    settings: {
        title: "TIC-TAC-TOE BATTLE",
        sound: true,
        timePerQuestion: 15,
        randomize: true
    },
    teams: {
        X: { id: 'X', name: 'TEAM X', color: 'bg-blue-500', textColor: 'text-blue-400', shadow: 'shadow-blue-500/50', score: 0 },
        O: { id: 'O', name: 'TEAM O', color: 'bg-red-500', textColor: 'text-red-400', shadow: 'shadow-red-500/50', score: 0 }
    },
    players: {} as Record<string, any>, // { id: { nickname, team, score, fastBonuses, answers: {} } }
    questions: [...defaultQuestions],
    questionQueue: [] as any[],
    currentQuestionIndex: 0,
    board: Array(9).fill(null),
    
    // Turn state
    activeTeam: null as string | null,
    firstResponder: null as { teamId: string, playerId: string } | null, // { teamId, playerId }
    selectedAnswer: null as number | null, 
    stealAvailable: false,
    timer: 0,
    lockedOutTeams: [] as string[], // Teams that answered wrong this turn
    
    // Board state
    boardPhase: null as string | null,
    cursorPos: 4,
    selectedPieceIndex: null as number | null,
    
    winningLine: null as number[] | null,
    winner: null as string | null,
    history: { X: { correct: 0, squares: 0 }, O: { correct: 0, squares: 0 } }
};

function gameReducer(state: typeof initialState, action: any): typeof initialState {
    switch (action.type) {
        case 'CREATE_ROOM':
            return { ...state, roomId: action.payload, status: 'LOBBY' };
            
        case 'PLAYER_JOINED': {
            if (state.status !== 'LOBBY') return state;
            const { playerId, nickname } = action.payload;
            
            // Auto-balance teams
            const xCount = Object.values(state.players).filter((p: any) => p.team === 'X').length;
            const oCount = Object.values(state.players).filter((p: any) => p.team === 'O').length;
            const assignedTeam = xCount <= oCount ? 'X' : 'O';
            
            return {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: { id: playerId, nickname, team: assignedTeam, score: 0, fastBonuses: 0, answers: {} }
                }
            };
        }
            
        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload } };
        case 'UPDATE_TEAM':
            return { ...state, teams: { ...state.teams, [action.team]: { ...state.teams[action.team as keyof typeof state.teams], ...action.payload } } };
        case 'UPDATE_QUESTIONS':
            return { ...state, questions: action.payload };
        
        case 'START_GAME': {
            let qQueue = [...state.questions];
            if (state.settings.randomize) qQueue.sort(() => Math.random() - 0.5);
            return {
                ...state,
                status: 'INTRO',
                questionQueue: qQueue,
                currentQuestionIndex: 0,
                board: Array(9).fill(null),
                teams: {
                    X: { ...state.teams.X, score: 0 },
                    O: { ...state.teams.O, score: 0 }
                },
                history: { X: { correct: 0, squares: 0 }, O: { correct: 0, squares: 0 } },
                winner: null,
                winningLine: null,
                // Reset player scores
                players: Object.fromEntries(Object.entries(state.players).map(([id, p]: [string, any]) => [id, { ...p, score: 0, fastBonuses: 0, answers: {} }]))
            };
        }

        case 'PROCEED_TO_QUESTION':
            if (state.currentQuestionIndex >= state.questionQueue.length) return { ...state, status: 'DRAW' };
            return {
                ...state,
                status: 'QUESTION',
                timer: state.settings.timePerQuestion,
                firstResponder: null,
                selectedAnswer: null,
                stealAvailable: true,
                activeTeam: null,
                boardPhase: null,
                lockedOutTeams: []
            };

        case 'TICK_TIMER':
            if (state.timer > 0) return { ...state, timer: state.timer - 1 };
            if (state.timer === 0 && state.status === 'QUESTION') {
                return { ...state, status: 'EVALUATING', stealAvailable: false }; 
            }
            if (state.timer === 0 && state.status === 'STEAL_PHASE') {
                return { ...state, status: 'INTRO', currentQuestionIndex: state.currentQuestionIndex + 1 }; 
            }
            return state;

        case 'ANSWER_SUBMITTED': {
            if (state.status !== 'QUESTION' && state.status !== 'STEAL_PHASE') return state;
            const { playerId: pId, answerIndex } = action.payload;
            const player = state.players[pId];
            if (!player) return state;

            // Prevent answering if team is locked out (they got it wrong first)
            if (state.lockedOutTeams.includes(player.team)) return state;

            // In multiplayer, the FIRST valid answer submitted by a team determines their fate for this round.
            // If it's a steal phase, only the non-locked team can answer.
            if (state.firstResponder) return state; // Already have a first responder being evaluated
            
            // Record answer for the player (for end game stats)
            const updatedPlayers = { ...state.players, [pId]: { ...player, answers: { ...player.answers, [state.currentQuestionIndex]: answerIndex } } };

            return {
                ...state,
                players: updatedPlayers,
                status: 'EVALUATING',
                firstResponder: { teamId: player.team, playerId: pId },
                selectedAnswer: answerIndex,
                timer: 0 // Stop timer to process
            };
        }

        case 'EVALUATION_RESULT': {
            const { isCorrect } = action.payload;
            const { teamId: evalTeam, playerId: evalPlayerId } = state.firstResponder || {};
            if (!evalTeam) return state;

            const historyObj = { ...state.history };
            const playersObj = { ...state.players };
            
            if (isCorrect) {
                // Team wins the turn
                historyObj[evalTeam as 'X'|'O'].correct += 1;
                const baseScore = state.status === 'STEAL_PHASE' ? 150 : 100;
                const newTeamScore = state.teams[evalTeam as 'X'|'O'].score + baseScore;
                
                // Player gets points for leaderboard
                if (evalPlayerId && playersObj[evalPlayerId]) {
                    playersObj[evalPlayerId].score += baseScore + 50; // +50 speed bonus
                    playersObj[evalPlayerId].fastBonuses += 1;
                }
                
                const pieceCount = state.board.filter(c => c === evalTeam).length;
                const nextPhase = pieceCount >= 3 ? 'SELECT_PIECE' : 'SELECT_DEST';
                
                return {
                    ...state,
                    status: 'BOARD_ACTION',
                    activeTeam: evalTeam,
                    boardPhase: nextPhase,
                    cursorPos: 4, 
                    selectedPieceIndex: null,
                    teams: { ...state.teams, [evalTeam]: { ...state.teams[evalTeam as 'X'|'O'], score: newTeamScore } },
                    players: playersObj,
                    history: historyObj
                };
            } else {
                // Team answered wrong, lock them out
                const newLocked = [...state.lockedOutTeams, evalTeam];
                
                if (state.stealAvailable && state.status !== 'STEAL_PHASE' && newLocked.length < 2) {
                    return {
                        ...state,
                        status: 'STEAL_PHASE',
                        timer: 8, // 8 seconds to steal
                        firstResponder: null,
                        selectedAnswer: null,
                        lockedOutTeams: newLocked,
                        players: playersObj
                    };
                } else {
                    return {
                        ...state,
                        status: 'INTRO',
                        currentQuestionIndex: state.currentQuestionIndex + 1,
                        players: playersObj
                    };
                }
            }
        }

        // --- Board Controls (Controlled by Host during BOARD_ACTION) ---
        case 'BOARD_MOVE_CURSOR': {
            if (state.status !== 'BOARD_ACTION') return state;
            let newPos = state.cursorPos;
            const { direction } = action.payload;
            if (direction === 'UP' && newPos >= 3) newPos -= 3;
            if (direction === 'DOWN' && newPos <= 5) newPos += 3;
            if (direction === 'LEFT' && newPos % 3 !== 0) newPos -= 1;
            if (direction === 'RIGHT' && newPos % 3 !== 2) newPos += 1;
            
            if (state.settings.sound) sounds.moveCursor();
            return { ...state, cursorPos: newPos };
        }

        case 'BOARD_SELECT': {
            if (state.status !== 'BOARD_ACTION') return state;
            const { activeTeam, boardPhase, cursorPos, selectedPieceIndex, board } = state;
            
            if (boardPhase === 'SELECT_PIECE') {
                if (board[cursorPos] === activeTeam) {
                    if (state.settings.sound) sounds.placePiece();
                    return { ...state, boardPhase: 'SELECT_DEST', selectedPieceIndex: cursorPos };
                }
                return state;
            }
            
            if (boardPhase === 'SELECT_DEST') {
                if (board[cursorPos] === null) {
                    if (state.settings.sound) sounds.placePiece();
                    let newBoard = [...board];
                    if (selectedPieceIndex !== null) newBoard[selectedPieceIndex] = null;
                    newBoard[cursorPos] = activeTeam;
                    
                    const newHistory = { ...state.history };
                    if (activeTeam) {
                        newHistory[activeTeam as 'X'|'O'].squares += 1;
                    }
                    
                    return { ...state, board: newBoard, status: 'WIN_CHECK', history: newHistory };
                }
            }
            return state;
        }
            
        case 'BOARD_DESELECT':
             if (state.status === 'BOARD_ACTION' && state.boardPhase === 'SELECT_DEST' && state.selectedPieceIndex !== null) {
                 return { ...state, boardPhase: 'SELECT_PIECE', selectedPieceIndex: null };
             }
             return state;

        case 'SET_WINNER': {
            if (state.settings.sound) sounds.win();
            const winScore = state.teams[action.payload.winner as 'X'|'O'].score + 500;
            return {
                ...state,
                status: 'WINNER',
                winner: action.payload.winner,
                winningLine: action.payload.line,
                teams: { ...state.teams, [action.payload.winner]: { ...state.teams[action.payload.winner as 'X'|'O'], score: winScore } }
            };
        }

        case 'NEXT_TURN':
            return { ...state, status: 'INTRO', currentQuestionIndex: state.currentQuestionIndex + 1 };
            
        case 'END_GAME':
             return { ...state, status: 'SUMMARY' };
             
        case 'RETURN_TO_SETUP':
            return { ...initialState, roomId: state.roomId, questions: state.questions, settings: state.settings, teams: state.teams };
            
        default:
            return state;
    }
}

const ModeSelection = ({ onSelectMode, onViewChange }: { onSelectMode: (mode: string) => void, onViewChange: (view: ViewState) => void }) => (
    <div className="min-h-screen bg-emerald-100 flex items-center justify-center p-6 text-gray-900 font-sans relative">
        <div className="absolute top-4 left-4 z-[60]">
            <button 
                onClick={() => onViewChange("games")}
                className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border border-gray-800 text-gray-400 hover:text-white bg-gray-900/50 hover:bg-gray-800 shadow-sm"
            >
                <ArrowLeft size={24} />
            </button>
        </div>

        <div className="max-w-4xl w-full">
            <h1 className="text-6xl md:text-7xl font-black text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">TIC-TAC-TOE BATTLE</h1>
            <p className="text-xl text-center text-gray-400 mb-16 uppercase tracking-widest font-bold">Classroom Multiplayer Edition</p>
            
            <div className="grid md:grid-cols-3 gap-8">
                <button onClick={() => onSelectMode('LOCAL')} className="bg-gray-900 border border-gray-800 p-8 rounded-3xl hover:border-gray-600 transition-all hover:scale-105 group text-left">
                    <MonitorUp size={48} className="text-gray-500 mb-6 group-hover:text-white transition-colors" />
                    <h2 className="text-2xl font-black mb-2">Local Mode</h2>
                    <p className="text-gray-500 font-medium">Play on a single device with a shared keyboard.</p>
                </button>
                
                <button onClick={() => onSelectMode('HOST')} className="bg-gray-900 border-2 border-blue-900/50 p-8 rounded-3xl hover:border-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all hover:scale-105 group text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
                    <Crown size={48} className="text-blue-500 mb-6" />
                    <h2 className="text-2xl font-black mb-2 text-white">Host a Game</h2>
                    <p className="text-gray-400 font-medium">Create a room for your class. Display on the projector.</p>
                </button>
                
                <button onClick={() => onSelectMode('JOIN')} className="bg-blue-600 border border-blue-500 p-8 rounded-3xl hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all hover:scale-105 group text-left">
                    <Smartphone size={48} className="text-white mb-6 animate-pulse" />
                    <h2 className="text-2xl font-black mb-2 text-white">Join a Game</h2>
                    <p className="text-blue-100 font-medium">Enter a room code on your phone to play.</p>
                </button>
            </div>
        </div>
    </div>
);

const JoinScreen = ({ onJoin, onBack }: { onJoin: (code: string, name: string) => void, onBack: () => void }) => {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');

    const handleJoin = (e: any) => {
        e.preventDefault();
        if (code.trim().length === 6 && name.trim().length > 0) {
            onJoin(code.toUpperCase(), name.trim());
        }
    };

    return (
        <div className="min-h-screen bg-emerald-100 flex items-center justify-center p-6 text-gray-900 font-sans relative">
             <div className="absolute top-4 left-4 z-[60]">
                 <button 
                     onClick={onBack}
                     className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border border-gray-800 text-gray-400 hover:text-white bg-gray-900/50 hover:bg-gray-800 shadow-sm"
                 >
                     <ArrowLeft size={24} />
                 </button>
             </div>
             <div className="max-w-md w-full bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl">
                <div className="flex justify-center mb-8"><Smartphone size={64} className="text-blue-500"/></div>
                <h2 className="text-3xl font-black text-center mb-8">Join the Battle</h2>
                <form onSubmit={handleJoin} className="space-y-6">
                    <div>
                        <label className="block text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">Game Code</label>
                        <input type="text" maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                            className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-4 text-center text-3xl font-black text-white focus:border-blue-500 focus:outline-none uppercase tracking-[0.2em]"
                            placeholder="A7K92P" required />
                    </div>
                    <div>
                        <label className="block text-gray-500 font-bold uppercase tracking-widest text-sm mb-2">Nickname</label>
                        <input type="text" maxLength={15} value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl p-4 text-xl font-bold text-white focus:border-blue-500 focus:outline-none"
                            placeholder="Enter your name" required />
                    </div>
                    <button type="submit" disabled={code.length < 6 || !name} 
                        className="w-full bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 hover:bg-blue-500 text-white font-black text-xl py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:shadow-none">
                        JOIN GAME
                    </button>
                </form>
             </div>
        </div>
    );
};

const HostSetupScreen = ({ state, dispatch, isMultiplayer }: { state: any, dispatch: any, isMultiplayer: boolean }) => {
    // Reusing setup components for brevity, adding Room generation
    const startMultiplayerRoom = () => {
        const code = generateRoomCode();
        dispatch({ type: 'CREATE_ROOM', payload: code });
        NetworkManager.init(code, true, 'HOST');
    };

    return (
        <div className="min-h-screen bg-emerald-100 text-gray-900 p-8 font-sans overflow-y-auto pt-24">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-between items-center bg-gray-900 p-6 rounded-3xl shadow-xl border border-gray-800">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400 tracking-tight">TIC-TAC-TOE BATTLE</h1>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mt-1">{isMultiplayer ? 'Multiplayer Host Setup' : 'Local Setup'}</p>
                    </div>
                    <button 
                        onClick={() => {
                            if (state.questions.length === 0) return alert("Add a question first.");
                            isMultiplayer ? startMultiplayerRoom() : dispatch({ type: 'START_GAME' });
                        }}
                        className="bg-white text-gray-950 hover:scale-105 font-black py-4 px-10 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex items-center gap-3 text-xl"
                    >
                        <Play size={24} /> {isMultiplayer ? 'CREATE ROOM' : 'START LOCAL'}
                    </button>
                </div>
                {/* Simplified Question Bank Display for Space */}
                <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800">
                    <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                        <span>Question Bank ({state.questions.length})</span>
                        <span className="text-sm font-medium text-gray-500 bg-gray-800 px-3 py-1 rounded-full">Default Questions Loaded for Preview</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {state.questions.slice(0, 4).map((q: any, i: number) => (
                            <div key={i} className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
                                <p className="font-medium text-gray-300 line-clamp-2">{q.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HostLobby = ({ state, dispatch }: { state: any, dispatch: any }) => {
    const players = Object.values(state.players);
    const teamX = players.filter((p: any) => p.team === 'X');
    const teamO = players.filter((p: any) => p.team === 'O');
    
    // Construct the join URL
    const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}?joinCode=${state.roomId}` : '';

    return (
        <div className="min-h-screen bg-emerald-100 text-gray-900 flex flex-col font-sans p-8">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                <div className="text-center mb-12 flex flex-col items-center">
                    <h2 className="text-gray-900 font-bold uppercase tracking-[0.2em] mb-2 text-2xl">Scan to Join or Enter Code</h2>
                    <div className="flex gap-8 items-center bg-gray-900 p-8 rounded-3xl shadow-2xl border-4 border-gray-800">
                        <div className="bg-white p-4 rounded-xl">
                            <QRCodeSVG value={joinUrl} size={150} />
                        </div>
                        <div className="flex flex-col items-start text-left">
                            <p className="text-gray-400 font-medium mb-1 uppercase tracking-widest text-sm">Join at <span className="text-white font-bold">hamsterenglish.online/play</span> or use Code</p>
                            <span className="text-7xl font-black tracking-[0.2em] text-white leading-none">{state.roomId}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-12">
                    {/* Team X Roster */}
                    <div className="bg-gray-900/50 border-2 border-blue-900/50 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl font-black text-blue-500">X</div>
                        <h3 className="text-2xl font-black text-blue-400 mb-6 flex items-center justify-between">
                            TEAM X <span className="bg-blue-900/50 text-blue-300 text-sm px-3 py-1 rounded-full">{teamX.length} Players</span>
                        </h3>
                        <div className="flex flex-wrap gap-3 relative z-10">
                            {teamX.map((p: any) => (
                                <div key={p.id} className="bg-gray-950 border border-blue-900/50 px-4 py-2 rounded-xl font-bold text-white animate-in zoom-in">{p.nickname}</div>
                            ))}
                        </div>
                    </div>

                    {/* Team O Roster */}
                    <div className="bg-gray-900/50 border-2 border-red-900/50 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl font-black text-red-500">O</div>
                        <h3 className="text-2xl font-black text-red-400 mb-6 flex items-center justify-between">
                            TEAM O <span className="bg-red-900/50 text-red-300 text-sm px-3 py-1 rounded-full">{teamO.length} Players</span>
                        </h3>
                        <div className="flex flex-wrap gap-3 relative z-10">
                            {teamO.map((p: any) => (
                                <div key={p.id} className="bg-gray-950 border border-red-900/50 px-4 py-2 rounded-xl font-bold text-white animate-in zoom-in">{p.nickname}</div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex justify-center">
                    <button 
                        onClick={() => dispatch({ type: 'START_GAME' })}
                        disabled={players.length === 0}
                        className="bg-white text-gray-950 disabled:opacity-50 disabled:hover:scale-100 hover:scale-105 font-black py-5 px-16 rounded-2xl text-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all flex items-center gap-4"
                    >
                        <Play size={28}/> START BATTLE
                    </button>
                </div>
            </div>
        </div>
    );
};


const PlayerApp = ({ roomId, initialNickname }: { roomId: string, initialNickname: string }) => {
    const [clientState, setClientState] = useState<any>(null);
    const [playerId] = useState(() => {
        const stored = localStorage.getItem('ttt_player_id');
        if (stored) return stored;
        const newId = generatePlayerId();
        localStorage.setItem('ttt_player_id', newId);
        return newId;
    });

    useEffect(() => {
        NetworkManager.init(roomId, false, playerId);
        
        // Join Request
        NetworkManager.sendActionToHost({ 
            type: 'PLAYER_JOINED', 
            payload: { playerId, nickname: initialNickname } 
        });

        NetworkManager.onMessage((msg: any) => {
            if (msg.type === 'STATE_UPDATE') {
                setClientState(msg.state);
            }
        });

        return () => {
            NetworkManager.cleanup();
            NetworkManager.messageCallback = null;
        };
    }, [roomId, playerId, initialNickname]);

    if (!clientState) return <div className="min-h-screen bg-emerald-100 flex items-center justify-center text-gray-900"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

    const me = clientState.players[playerId];
    if (!me) {
        if (clientState.status !== 'LOBBY') {
            return <div className="min-h-screen bg-emerald-100 flex items-center justify-center text-gray-900 font-bold">Game already in progress! You cannot join right now.</div>;
        }
        return <div className="min-h-screen bg-emerald-100 flex items-center justify-center text-gray-900 font-bold flex-col gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
            Connecting to host...
        </div>;
    }

    const teamColor = me.team === 'X' ? 'bg-blue-600' : 'bg-red-600';
    const currentQ = clientState.questionQueue[clientState.currentQuestionIndex];
    
    // Status Logic mapping for Player UI
    const isLockedOut = clientState.lockedOutTeams?.includes(me.team);
    const hasAnswered = currentQ && me.answers[clientState.currentQuestionIndex] !== undefined;

    const handleAnswer = (idx: number) => {
        if (hasAnswered || isLockedOut || (clientState.status !== 'QUESTION' && clientState.status !== 'STEAL_PHASE')) return;
        NetworkManager.sendActionToHost({
            type: 'ANSWER_SUBMITTED',
            payload: { playerId, answerIndex: idx }
        });
    };

    return (
        <div className="min-h-screen bg-emerald-100 text-gray-900 font-sans flex flex-col relative select-none touch-manipulation">
            {/* Header */}
            <div className={`${teamColor} p-4 shadow-lg flex justify-between items-center z-10`}>
                <div className="font-black text-xl">{me.nickname}</div>
                <div className="flex gap-4 items-center">
                    <div className="font-bold text-sm bg-black/20 px-3 py-1 rounded-full">TEAM {me.team}</div>
                    <div className="font-black text-xl flex items-center gap-1"><Zap size={18}/> {me.score}</div>
                </div>
            </div>

            {/* Main Content Area - Changes based on Host State */}
            <div className="flex-1 flex flex-col justify-center p-4">
                
                {clientState.status === 'LOBBY' && (
                    <div className="text-center text-gray-900 animate-in zoom-in">
                        <div className="text-8xl font-black mb-4 opacity-20">{me.team}</div>
                        <h2 className="text-3xl font-black mb-2">You're in!</h2>
                        <p className="text-gray-400">Waiting for teacher to start...</p>
                    </div>
                )}

                {clientState.status === 'INTRO' && (
                    <div className="text-center text-gray-900 animate-in zoom-in">
                        <h2 className="text-3xl text-gray-400 font-bold uppercase tracking-[0.3em] mb-4">Get Ready</h2>
                        <h1 className="text-7xl font-black">Q{clientState.currentQuestionIndex + 1}</h1>
                    </div>
                )}

                {(clientState.status === 'QUESTION' || clientState.status === 'STEAL_PHASE') && currentQ && (
                    <div className="w-full h-full flex flex-col justify-end pb-8">
                        {isLockedOut ? (
                            <div className="text-center bg-red-900/50 p-8 rounded-3xl border border-red-500 mb-8 animate-in slide-in-from-bottom">
                                <XCircle size={64} className="mx-auto text-red-500 mb-4"/>
                                <h2 className="text-2xl font-black text-white">Your team missed!</h2>
                                <p className="text-gray-400 mt-2">Opponents are stealing...</p>
                            </div>
                        ) : hasAnswered ? (
                            <div className="text-center bg-gray-900 p-8 rounded-3xl border border-gray-700 mb-8 text-white animate-in zoom-in">
                                <Clock size={64} className="mx-auto text-gray-500 mb-4 animate-pulse"/>
                                <h2 className="text-2xl font-black text-white">Answer locked!</h2>
                                <p className="text-gray-400 mt-2">Waiting for results...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 h-[60vh]">
                                {['A', 'B', 'C', 'D'].map((lbl, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleAnswer(idx)}
                                        className="bg-gray-900 active:bg-gray-800 border-2 border-gray-700 rounded-2xl flex items-center justify-center text-4xl font-black shadow-lg transition-transform active:scale-95"
                                    >
                                        <span className={`w-16 h-16 rounded-xl flex items-center justify-center mr-4 bg-gray-800 text-gray-400 text-2xl`}>{lbl}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {clientState.status === 'EVALUATING' && (
                    <div className="text-center text-gray-900 animate-in zoom-in">
                        {clientState.firstResponder?.playerId === playerId ? (
                            <div>
                                <Crown size={80} className="mx-auto text-yellow-500 mb-6 animate-bounce"/>
                                <h2 className="text-4xl font-black text-white mb-2">You got it!</h2>
                                <p className="text-xl text-gray-400">Evaluating your answer...</p>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-3xl font-black text-white mb-2">{clientState.players[clientState.firstResponder?.playerId]?.nickname}</h2>
                                <p className="text-xl text-gray-400">from Team {clientState.firstResponder?.teamId} answered first!</p>
                            </div>
                        )}
                    </div>
                )}

                {clientState.status === 'BOARD_ACTION' && (
                    <div className="text-center bg-gray-900 p-8 rounded-3xl border border-gray-800">
                        <MonitorUp size={64} className="mx-auto text-gray-500 mb-6 animate-pulse"/>
                        <h2 className="text-3xl font-black text-white mb-2">Look at the Projector!</h2>
                        <p className="text-gray-400">Team {clientState.activeTeam} is taking control of the board.</p>
                    </div>
                )}

                {clientState.status === 'SUMMARY' && (
                    <div className="text-center">
                        <div className="text-6xl mb-4">{me.team === clientState.winner ? '🏆' : '👏'}</div>
                        <h2 className="text-4xl font-black mb-2">Game Over!</h2>
                        <p className="text-xl text-gray-400 mb-8">You scored {me.score} points</p>
                        <button onClick={() => window.location.reload()} className="bg-gray-800 py-4 px-8 rounded-xl font-bold text-white w-full">Leave Game</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const HostGameScreen = ({ state, dispatch, isMultiplayer }: { state: any, dispatch: any, isMultiplayer: boolean }) => {
    
    // Host Keyboard Engine for Board Control (Kept centralized for smooth projector experience)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
            
            // Allow local answering if NOT multiplayer
            if (!isMultiplayer && (state.status === 'QUESTION' || state.status === 'STEAL_PHASE')) {
                const keyMap: Record<string, any> = {
                    'w': { team: 'X', ans: 0 }, 'a': { team: 'X', ans: 1 }, 's': { team: 'X', ans: 2 }, 'd': { team: 'X', ans: 3 },
                    'ArrowUp': { team: 'O', ans: 0 }, 'ArrowLeft': { team: 'O', ans: 1 }, 'ArrowDown': { team: 'O', ans: 2 }, 'ArrowRight': { team: 'O', ans: 3 }
                };
                const mapped = keyMap[e.key.length === 1 ? e.key.toLowerCase() : e.key];
                if (mapped) dispatch({ type: 'ANSWER_SUBMITTED', payload: { playerId: mapped.team + '_local', answerIndex: mapped.ans } });
            }

            if (state.status === 'BOARD_ACTION') {
                const xControls: Record<string, string> = { 'w': 'UP', 'a': 'LEFT', 's': 'DOWN', 'd': 'RIGHT' };
                const oControls: Record<string, string> = { 'ArrowUp': 'UP', 'ArrowLeft': 'LEFT', 'ArrowDown': 'DOWN', 'ArrowRight': 'RIGHT' };
                const controls = state.activeTeam === 'X' ? xControls : oControls;
                
                const lowerKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;
                if (controls[lowerKey] || controls[e.key]) {
                    dispatch({ type: 'BOARD_MOVE_CURSOR', payload: { direction: controls[lowerKey] || controls[e.key] } });
                }
                if (e.key === 'Enter') dispatch({ type: 'BOARD_SELECT' });
                if ((e.key === 'Escape' || e.key === 'Backspace') && state.boardPhase === 'SELECT_DEST') dispatch({ type: 'BOARD_DESELECT' });
            }
        };

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state.status, state.activeTeam, state.boardPhase, state.selectedPieceIndex, isMultiplayer]);

    // Game Loop Timers
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if ((state.status === 'QUESTION' || state.status === 'STEAL_PHASE') && state.timer > 0) {
            timerId = setTimeout(() => dispatch({ type: 'TICK_TIMER' }), 1000);
        }
        return () => clearTimeout(timerId);
    }, [state.status, state.timer]);

    useEffect(() => {
        if (state.status === 'INTRO') {
            const t = setTimeout(() => dispatch({ type: 'PROCEED_TO_QUESTION' }), 2500);
            return () => clearTimeout(t);
        }
        if (state.status === 'EVALUATING') {
            const q = state.questionQueue[state.currentQuestionIndex];
            const isCorrect = state.selectedAnswer === q.correct;
            if (state.settings.sound) isCorrect ? sounds.correct() : sounds.wrong();
            const t = setTimeout(() => dispatch({ type: 'EVALUATION_RESULT', payload: { isCorrect } }), 2000); 
            return () => clearTimeout(t);
        }
        if (state.status === 'WIN_CHECK') {
            const b = state.board;
            let foundWin = false;
            for (let combo of WINNING_COMBOS) {
                const [x, y, z] = combo;
                if (b[x] && b[x] === b[y] && b[x] === b[z]) {
                    dispatch({ type: 'SET_WINNER', payload: { winner: b[x], line: combo } });
                    foundWin = true; break;
                }
            }
            if (!foundWin) {
                 const t = setTimeout(() => dispatch({ type: 'NEXT_TURN' }), 1500);
                 return () => clearTimeout(t);
            }
        }
    }, [state.status, state.board, state.questionQueue, state.currentQuestionIndex, state.selectedAnswer, state.settings.sound]);

    const currentQ = state.questionQueue[state.currentQuestionIndex];
    const getTeamConfig = (id: string) => state.teams[id as keyof typeof state.teams];

    const TeamPanel = ({ id }: { id: string }) => {
        const team = getTeamConfig(id);
        const piecesOnBoard = state.board.filter((c: any) => c === id).length;
        const isActive = state.status === 'BOARD_ACTION' && state.activeTeam === id;
        const playerCount = Object.values(state.players).filter((p: any) => p.team === id).length;
        
        return (
            <div className={`flex flex-col w-72 h-full p-8 transition-all duration-500 rounded-3xl ${isActive ? 'bg-gray-800 border-2 shadow-2xl scale-105 z-10' : 'bg-gray-900/50 border border-gray-800'} ${team.color.replace('bg-', 'border-')}`}>
                <div className={`text-center font-black text-4xl mb-2 ${team.textColor} uppercase tracking-wider`}>{team.name}</div>
                <div className={`text-center text-8xl font-black mb-6 ${team.textColor}`}>{id}</div>
                {isMultiplayer && <div className="text-center text-gray-500 font-bold mb-8 uppercase text-sm">{playerCount} Players</div>}
                
                <div className="flex-1">
                    <div className="text-gray-500 font-bold mb-2 uppercase text-sm tracking-widest text-center">Score</div>
                    <div className="text-center text-6xl font-black text-white mb-10">{team.score}</div>
                    
                    <div className="text-gray-500 font-bold mb-4 uppercase text-sm tracking-widest text-center">Pieces ({piecesOnBoard}/3)</div>
                    <div className="flex justify-center gap-4 mb-8">
                        {[0,1,2].map(i => (
                            <div key={i} className={`w-10 h-10 rounded-full ${i < piecesOnBoard ? team.color + ' ' + team.shadow : 'bg-gray-800 border-2 border-gray-700'}`} />
                        ))}
                    </div>
                </div>
                
                <div className="mt-auto bg-gray-950 p-4 rounded-xl border border-gray-800 text-center">
                    <div className="text-gray-500 text-xs font-bold mb-2 uppercase">Host Controls</div>
                    <div className="text-white font-mono tracking-widest text-lg">{id === 'X' ? 'W A S D' : 'Arrows'}</div>
                </div>
            </div>
        );
    };

    const BoardCell = ({ index }: { index: number }) => {
        const value = state.board[index];
        const isCursor = state.status === 'BOARD_ACTION' && state.cursorPos === index;
        const isWinningCell = state.winningLine?.includes(index);
        const isSelectedToMove = state.selectedPieceIndex === index;
        const teamColor = value ? getTeamConfig(value).color : '';
        const teamTextColor = value ? getTeamConfig(value).textColor : '';
        
        let cellClasses = "w-full h-full rounded-2xl flex items-center justify-center text-8xl font-black transition-all duration-200 relative ";
        if (value) cellClasses += ` ${teamTextColor} bg-gray-900 shadow-inner`;
        else cellClasses += ` bg-gray-800`;

        if (isCursor && state.activeTeam) {
            const activeColor = getTeamConfig(state.activeTeam).color;
            cellClasses += ` ring-4 ring-offset-4 ring-offset-gray-900 ${activeColor.replace('bg-', 'ring-')} transform scale-105 z-10`;
        }
        if (isSelectedToMove) cellClasses += ` opacity-50 ring-4 ring-yellow-400 animate-pulse`;
        if (isWinningCell) cellClasses += ` ${teamColor} text-white animate-bounce shadow-[0_0_40px_rgba(255,255,255,0.5)] z-20`;

        return (
            <div className="w-[150px] h-[150px] sm:w-[180px] sm:h-[180px] p-2">
                <div className={cellClasses}>
                    {value}
                    {value && !isWinningCell && <div className={`absolute inset-0 rounded-2xl opacity-20 ${teamColor}`}></div>}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-emerald-100 text-gray-900 overflow-hidden flex flex-col font-sans relative selection:bg-transparent">
            {/* Header / Info Bar */}
            <div className="absolute top-6 left-0 right-0 flex justify-between px-12 z-50 pointer-events-none mt-16">
                 <div className="flex gap-4">
                     <div className="text-gray-500 font-bold bg-gray-900/80 px-6 py-3 rounded-full backdrop-blur-sm border border-gray-800 text-xl">
                         Q {state.currentQuestionIndex + 1} / {state.questionQueue.length}
                     </div>
                     {isMultiplayer && (
                         <div className="text-gray-400 font-bold bg-gray-900/80 px-6 py-3 rounded-full backdrop-blur-sm border border-gray-800 text-xl flex items-center gap-2">
                            ROOM <span className="text-white font-black">{state.roomId}</span>
                         </div>
                     )}
                 </div>
                 
                 {state.timer > 0 && (state.status === 'QUESTION' || state.status === 'STEAL_PHASE') && (
                     <div className={`text-4xl font-black px-8 py-3 rounded-full backdrop-blur-sm border border-gray-800 ${state.timer <= 5 ? 'bg-red-900/80 text-red-400 animate-pulse' : 'bg-gray-900/80 text-white'}`}>
                        {state.timer}s
                     </div>
                 )}
            </div>

            <div className="flex-1 flex items-center justify-between px-8 lg:px-16 max-w-[2400px] mx-auto w-full pt-16">
                <div className="hidden lg:block h-[80vh]"><TeamPanel id="X" /></div>

                {/* Center Stage */}
                <div className="flex-1 flex flex-col items-center justify-center relative px-12 max-w-6xl mx-auto h-full mt-10">
                    
                    {state.status === 'INTRO' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gray-950/90 backdrop-blur-md rounded-3xl animate-in fade-in zoom-in duration-300">
                            <h2 className="text-5xl text-gray-400 font-bold mb-6 uppercase tracking-[0.5em]">Get Ready</h2>
                            <h1 className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">Question {state.currentQuestionIndex + 1}</h1>
                        </div>
                    )}

                    {(state.status === 'QUESTION' || state.status === 'EVALUATING' || state.status === 'STEAL_PHASE') && currentQ && (
                        <div className="w-full flex flex-col h-full justify-center max-h-[85vh]">
                             {state.status === 'STEAL_PHASE' && (
                                <div className="text-center mb-6">
                                     <span className="inline-block bg-yellow-500 text-black font-black text-3xl px-8 py-3 rounded-full animate-bounce shadow-[0_0_40px_rgba(234,179,8,0.5)]">STEAL OPPORTUNITY!</span>
                                </div>
                             )}
                             
                            <div className="bg-gray-800 border-2 border-gray-700 p-10 rounded-3xl shadow-2xl mb-10 w-full text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500"></div>
                                <h2 className="text-5xl font-bold leading-tight text-white mb-2">{currentQ.text}</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-8 w-full">
                                {currentQ.options.map((opt: string, idx: number) => {
                                    const labels = ['A', 'B', 'C', 'D'];
                                    let btnStyle = "bg-gray-900 border-2 border-gray-700 text-white";
                                    let icon = null;

                                    if (state.status === 'EVALUATING') {
                                        const isSelected = state.selectedAnswer === idx;
                                        const isCorrect = currentQ.correct === idx;
                                        
                                        if (isCorrect) {
                                            btnStyle = "bg-green-600 border-green-400 text-white shadow-[0_0_40px_rgba(74,222,128,0.4)] scale-105 z-10";
                                            icon = <CheckCircle2 size={40} className="text-white"/>;
                                        } else if (isSelected) {
                                            btnStyle = "bg-red-900 border-red-500 text-gray-300 opacity-50";
                                            icon = <XCircle size={40} className="text-red-400"/>;
                                        } else {
                                            btnStyle = "bg-gray-900 border-gray-800 text-gray-600 opacity-30";
                                        }
                                    }

                                    return (
                                        <div key={idx} className={`relative p-8 rounded-3xl flex items-center gap-6 transition-all duration-300 ${btnStyle}`}>
                                            <div className="flex items-center justify-center opacity-50">
                                               <span className="text-3xl font-black text-gray-500">{labels[idx]}</span>
                                            </div>
                                            <span className="text-4xl font-bold flex-1">{opt}</span>
                                            {icon}
                                            
                                            {state.status === 'EVALUATING' && state.selectedAnswer === idx && state.firstResponder && (
                                                <div className={`absolute -top-6 -right-6 px-6 py-2 rounded-full flex items-center justify-center text-xl font-black border-4 border-gray-900 ${getTeamConfig(state.firstResponder.teamId).color} text-white shadow-xl`}>
                                                    {isMultiplayer ? state.players[state.firstResponder.playerId]?.nickname : `Team ${state.firstResponder.teamId}`}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {(state.status === 'BOARD_ACTION' || state.status === 'WIN_CHECK') && state.activeTeam && (
                        <div className="flex flex-col items-center justify-center h-full w-full animate-in zoom-in-95 duration-500">
                             <div className="mb-10 text-center bg-gray-900/80 backdrop-blur-md px-10 py-6 rounded-3xl border border-gray-800 shadow-2xl">
                                <h3 className={`text-5xl font-black mb-3 ${getTeamConfig(state.activeTeam).textColor}`}>
                                    {getTeamConfig(state.activeTeam).name} IN CONTROL
                                </h3>
                                <p className="text-2xl text-gray-400 font-bold uppercase tracking-widest">
                                    {state.boardPhase === 'SELECT_PIECE' ? "Select a piece to move" : "Select an empty square"}
                                </p>
                             </div>

                             <div className="bg-gray-900 p-6 rounded-[3rem] shadow-2xl border border-gray-800">
                                <div className="grid grid-cols-3 gap-3 sm:gap-5 p-3 sm:p-5 bg-gray-950 rounded-[2.5rem]">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <BoardCell key={i} index={i} />)}
                                </div>
                             </div>
                        </div>
                    )}
                    
                    {state.status === 'WINNER' && state.winner && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-gray-950/95 backdrop-blur-xl rounded-3xl">
                             <Trophy size={120} className={`mb-10 animate-bounce ${getTeamConfig(state.winner).textColor}`} />
                             <h2 className="text-5xl text-gray-400 font-bold mb-6 uppercase tracking-[0.5em]">Round Winner</h2>
                             <h1 className={`text-9xl font-black mb-16 drop-shadow-[0_0_50px_rgba(255,255,255,0.4)] ${getTeamConfig(state.winner).textColor}`}>
                                 {getTeamConfig(state.winner).name}
                             </h1>
                             
                             <div className="flex gap-8">
                                 <button onClick={() => dispatch({type: 'END_GAME'})} className="bg-white text-gray-950 font-black py-5 px-12 rounded-2xl text-3xl hover:scale-105 transition-transform">
                                     View Leaderboard
                                 </button>
                             </div>
                         </div>
                    )}

                    {state.status === 'SUMMARY' && (
                         <div className="w-full h-full flex flex-col pt-10">
                             <h1 className="text-6xl font-black text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-red-400">FINAL RESULTS</h1>
                             
                             {isMultiplayer ? (
                                 <div className="grid grid-cols-2 gap-12 flex-1">
                                     {/* Individual Leaderboard */}
                                     <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 flex flex-col max-h-[60vh]">
                                         <h2 className="text-3xl font-black mb-6 text-white flex items-center gap-3"><Crown className="text-yellow-500"/> Top Players</h2>
                                         <div className="overflow-y-auto pr-4 space-y-4 flex-1">
                                             {Object.values(state.players)
                                                 .sort((a: any,b: any) => b.score - a.score)
                                                 .map((p: any, idx: number) => (
                                                     <div key={p.id} className="flex justify-between items-center bg-gray-950 p-4 rounded-xl border border-gray-800">
                                                         <div className="flex items-center gap-4">
                                                             <span className="text-2xl font-black text-gray-600 w-8">{idx + 1}</span>
                                                             <span className="text-xl font-bold text-white">{p.nickname}</span>
                                                             <span className={`text-xs font-bold px-2 py-1 rounded ${p.team === 'X' ? 'bg-blue-900/50 text-blue-400' : 'bg-red-900/50 text-red-400'}`}>{p.team}</span>
                                                         </div>
                                                         <span className="text-2xl font-black text-white">{p.score}</span>
                                                     </div>
                                                 ))}
                                         </div>
                                     </div>
                                     
                                     {/* Team Summary */}
                                     <div className="flex flex-col gap-6">
                                         {['X', 'O'].map(id => {
                                             const t = getTeamConfig(id);
                                             return (
                                                 <div key={id} className={`p-8 rounded-3xl border-2 flex-1 flex flex-col justify-center items-center ${state.winner === id ? t.color.replace('bg-','border-') + ' shadow-[0_0_40px_rgba(255,255,255,0.1)]' : 'border-gray-800 bg-gray-950'}`}>
                                                    <div className={`text-7xl font-black mb-4 ${t.textColor}`}>{id}</div>
                                                    <div className="text-3xl font-bold text-white mb-2">{t.name}</div>
                                                    <div className="text-gray-500 font-bold mb-4 uppercase tracking-widest">{state.history[id as 'X'|'O'].squares} Squares Claimed</div>
                                                    <div className="text-5xl font-black text-white">{t.score} PTS</div>
                                                 </div>
                                             );
                                         })}
                                     </div>
                                 </div>
                             ) : (
                                // Local Summary (Same as before)
                                <div className="flex justify-center items-center h-full">
                                    <div className="grid grid-cols-2 gap-12 w-full max-w-4xl">
                                         {['X', 'O'].map(id => {
                                             const t = getTeamConfig(id);
                                             return (
                                                 <div key={id} className={`p-10 rounded-3xl border-2 ${state.winner === id ? t.color.replace('bg-','border-') : 'border-gray-800 bg-gray-950'}`}>
                                                    <div className="text-center mb-6">
                                                        <div className={`text-6xl font-black mb-2 ${t.textColor}`}>{id}</div>
                                                        <div className="text-3xl font-bold text-white">{t.name}</div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between border-b border-gray-800 pb-3">
                                                            <span className="text-gray-500 font-medium text-xl">Final Score</span>
                                                            <span className="font-bold text-3xl text-white">{t.score}</span>
                                                        </div>
                                                    </div>
                                                 </div>
                                             );
                                         })}
                                     </div>
                                </div>
                             )}

                             <div className="flex justify-center mt-12 pb-8">
                                 <button onClick={() => dispatch({type: 'RETURN_TO_SETUP'})} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-5 px-12 rounded-2xl transition-colors flex items-center gap-3 text-2xl">
                                     <Settings size={28}/> Return to Setup
                                 </button>
                             </div>
                         </div>
                    )}
                </div>

                <div className="hidden lg:block h-[80vh]"><TeamPanel id="O" /></div>
            </div>
        </div>
    );
};


export const TicTacToe = ({ onViewChange, initialJoinData }: { onViewChange: (view: ViewState) => void, initialJoinData?: {code: string, nickname: string} | null }) => {
    const [appMode, setAppMode] = useState<string | null>(null); // 'LOCAL', 'HOST', 'JOIN', 'PLAYER_APP'
    const [state, dispatch] = useReducer(gameReducer, initialState);
    
    // Automatically join if initialJoinData is provided
    useEffect(() => {
        if (initialJoinData) {
            dispatch({ type: 'CREATE_ROOM', payload: initialJoinData.code });
            setAppMode('PLAYER_APP');
        }
    }, [initialJoinData]);

    // Listen for incoming player actions when hosting
    useEffect(() => {
        if (appMode === 'HOST') {
            NetworkManager.onMessage((msg: any) => {
                if (msg.type === 'PLAYER_ACTION') {
                    dispatch(msg.action);
                }
            });
        }
    }, [appMode]);

    // Broadcast state changes if host
    useEffect(() => {
        if (appMode === 'HOST') {
            NetworkManager.broadcastState(state);
        }
    }, [state, appMode]);

    if (!appMode) {
        return <ModeSelection onSelectMode={setAppMode} onViewChange={onViewChange} />;
    }

    if (appMode === 'JOIN') {
        const handleJoin = (code: string, name: string) => {
            dispatch({ type: 'CREATE_ROOM', payload: code }); // Set local state minimal for join
            setAppMode('PLAYER_APP');
            // We pass name via component props
        };
        return <JoinScreen onJoin={handleJoin} onBack={() => setAppMode(null)} />;
    }

    if (appMode === 'PLAYER_APP') {
        return <PlayerApp roomId={state.roomId || ""} initialNickname={initialJoinData?.nickname || "Player"} />;
    }

    // Host or Local Flow
    return (
        <div className="h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 relative" style={{ margin: "-1rem", height: "calc(100% + 2rem)" }}>
            <div className="absolute top-4 left-4 z-[60]">
                <button 
                    onClick={() => {
                        setAppMode(null);
                        dispatch({type: 'RETURN_TO_SETUP'});
                        NetworkManager.cleanup();
                        NetworkManager.messageCallback = null;
                        onViewChange("games");
                    }}
                    className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border border-gray-800 text-gray-400 hover:text-white bg-gray-900/50 hover:bg-gray-800 shadow-sm"
                >
                    <ArrowLeft size={24} />
                </button>
            </div>
            {state.status === 'SETUP' && (
                <HostSetupScreen state={state} dispatch={dispatch} isMultiplayer={appMode === 'HOST'} />
            )}
            
            {state.status === 'LOBBY' && appMode === 'HOST' && (
                <HostLobby state={state} dispatch={dispatch} />
            )}

            {state.status !== 'SETUP' && state.status !== 'LOBBY' && (
                <HostGameScreen state={state} dispatch={dispatch} isMultiplayer={appMode === 'HOST'} />
            )}
        </div>
    );
}
