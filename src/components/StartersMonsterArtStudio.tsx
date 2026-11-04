import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Sparkles, Layers } from 'lucide-react';
import type { SlideDeck } from '../views/MySlides';

export const STARTERS_MONSTER_ART_DECK_ID = 'deck-cambridge-starters-monster-art-class';

export const STARTERS_MONSTER_ART_DECK: SlideDeck = {
  id: STARTERS_MONSTER_ART_DECK_ID,
  title: 'Cambridge Pre-A1 Starters Speaking — Monster Art Class',
  description:
    'Official Test 1 Interactive Speaking Studio: Part 1A Point to Things, Part 1B Drag & Drop 8 Object Cards (frog, board game, trousers, train, book, lorry, shorts, fish), Part 2 Scene Q&A & "Tell me about...", Part 3 Object Cards Q&A, Pair Talk & Free Teacher Mode.',
  category: 'cambridge',
  gradeLevel: 'Starters',
  cambridgeLevel: 'Starters',
  curriculum: 'Cambridge Starters',
  theme: 'indigo',
  updatedAt: 1730743500000,
  authorName: 'Cambridge Pre-A1 Starters Studio',
  slides: [
    {
      id: 'starters-mac-s1',
      type: 'title',
      title: 'Cambridge Pre-A1 Starters: Monster Art Class',
      subtitle: 'Test 1 Speaking Studio • Parts 1A, 1B, 2, 3 & Free Teacher Mode',
    },
    {
      id: 'starters-mac-s2',
      type: 'discussion',
      discussionPrompt: 'Part 1A: Point to Things in the Monster Art Class',
      targetLevel: 'Cambridge Pre-A1 Starters • Part 1A',
      discussionQuestions: [
        "1. Look at the picture. Where's the ball? — The ball is under the red chair.",
        "2. Where's the computer? — The computer is on the brown table.",
        "3. Where's the camera? — The camera is in the monster's hands.",
        "4. Where's the grey cat? — The grey cat is sleeping under the table.",
        "5. Where is the clock? — The clock is on the wall.",
        "6. Where is the board? — The board is between the pictures.",
        "7. Where are the toys? — The toys are in the toy box.",
        "8. Where is the brown hat? — The brown hat is on the green monster's head.",
      ],
    },
    {
      id: 'starters-mac-s3',
      type: 'discussion',
      discussionPrompt: 'Part 1B: Place the 8 Test 1 Object Cards',
      targetLevel: 'Cambridge Pre-A1 Starters • Part 1B',
      discussionQuestions: [
        'Which is the book? Put the book under the table.',
        'Which is the frog? Put the frog on the red chair.',
        'Which is the fish? Put the fish on the whiteboard.',
        'Which is the train? Put the train in the brown box.',
        'Which is the lorry? Put the lorry in front of the door.',
      ],
    },
    {
      id: 'starters-mac-s4',
      type: 'discussion',
      discussionPrompt: 'Part 2: Scene Q&A & "Tell me about the monsters!"',
      targetLevel: 'Cambridge Pre-A1 Starters • Part 2',
      discussionQuestions: [
        "Look at the laptop on the table. What's this? What colour is it? Where is it?",
        'Look at the monster in the green dress. What is she doing? What is she wearing?',
        'Tell me about the green monster! (He is green, wearing a brown hat, red shirt and blue trousers, painting a house.)',
        'Tell me about the pink monster! (It is pink and triangle-shaped, looks sad, has 4 legs, painting a blue cat.)',
      ],
    },
    {
      id: 'starters-mac-s5',
      type: 'vocab',
      word: 'Test 1 Object Cards (8 Cutouts)',
      phonetic: 'frog • board game • trousers • train • book • lorry • shorts • fish',
      partOfSpeech: 'Part 3 Speaking Cards',
      definition:
        "Examiner asks 3 questions per card: What's this? What colour is it? Have you got a ... / Do you like ...?",
      exampleSentence: "It's a green and yellow frog. Yes, I like frogs!",
      imageUrl: '/assets/aistudio/image_091c3f75.png',
    },
    {
      id: 'starters-mac-s6',
      type: 'question',
      questionText: 'Where is the grey cat in the Monster Art Class picture?',
      options: [
        'Sleeping under the brown table',
        'On the red chair',
        'In the brown toy box',
        'In front of the door',
      ],
      correctOptionIndex: 0,
    },
  ],
};

const MONSTER_ART_STUDIO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cambridge Pre-A1 Starters Speaking — Monster Art Class</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #4F46E5;
      --gold: #F59E0B;
      --emerald: #10B981;
    }
    body {
      font-family: 'Nunito', sans-serif;
      background: radial-gradient(circle at top left, #FEF3C7, #E0E7FF 55%, #DBEAFE);
      min-height: 100vh;
      overflow-x: hidden;
      user-select: none;
    }
    h1, h2, h3, .font-kid {
      font-family: 'Fredoka', sans-serif;
    }

    /* Interactive SVG Scene Item Glow & Hover */
    .scene-item {
      cursor: pointer;
      transition: filter 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
      transform-box: fill-box;
      transform-origin: center;
    }
    .scene-item:hover {
      filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.95)) brightness(1.08);
    }
    /* When Original Book Art mode is active, keep vector items subtle until hovered/spotlighted */
    svg.book-art-active .scene-item {
      opacity: 0.02;
    }
    svg.book-art-active .scene-item:hover,
    svg.book-art-active .scene-item.glow-correct,
    svg.book-art-active .scene-item.glow-spotlight,
    svg.book-art-active .scene-item.shake-wrong {
      opacity: 0.88;
    }
    .scene-item.glow-correct {
      animation: magicalGlow 1.3s ease-in-out infinite alternate;
      z-index: 50;
    }
    .scene-item.glow-spotlight {
      filter: drop-shadow(0 0 16px #38BDF8) drop-shadow(0 0 28px #6366F1);
      animation: pulseBounce 1.4s infinite ease-in-out;
    }
    .scene-item.shake-wrong {
      animation: wrongShake 0.45s ease-in-out;
    }

    @keyframes magicalGlow {
      0% {
        filter: drop-shadow(0 0 10px #FBBF24) drop-shadow(0 0 22px #F59E0B) brightness(1.12);
        transform: scale(1.04);
      }
      100% {
        filter: drop-shadow(0 0 18px #34D399) drop-shadow(0 0 32px #10B981) brightness(1.2);
        transform: scale(1.09);
      }
    }

    @keyframes pulseBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes wrongShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px) rotate(-2deg); }
      75% { transform: translateX(6px) rotate(2deg); }
    }

    /* Drop Zones in SVG */
    .drop-zone {
      transition: all 0.25s ease;
      opacity: 0;
      pointer-events: none;
    }
    .drop-zone.show-hint {
      opacity: 0.78;
      animation: dashRotate 8s linear infinite;
    }
    .drop-zone.clickable-zone {
      pointer-events: auto;
      cursor: pointer;
    }
    .drop-zone.clickable-zone:hover,
    .drop-zone.active-hover {
      opacity: 0.95 !important;
      fill: rgba(16, 185, 129, 0.35) !important;
      stroke: #059669 !important;
      stroke-width: 4px !important;
    }

    /* Examiner Talking Mouth Animation */
    .mouth-talking {
      animation: talkAnim 0.22s infinite alternate ease-in-out;
      transform-origin: center;
      transform-box: fill-box;
    }
    @keyframes talkAnim {
      0% { transform: scaleY(0.35); }
      100% { transform: scaleY(1.35); }
    }

    /* Draggable Object Cards */
    .object-card {
      touch-action: none;
      cursor: grab;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
    }
    .object-card:hover {
      transform: translateY(-4px) scale(1.03);
      box-shadow: 0 12px 20px -5px rgba(79, 70, 229, 0.25);
    }
    .object-card:active {
      cursor: grabbing;
    }
    .object-card.selected-card {
      ring: 4px solid #F59E0B;
      box-shadow: 0 0 22px #FBBF24;
      transform: scale(1.06);
    }

    /* Floating Drag Ghost */
    #drag-ghost {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      width: 96px;
      height: 96px;
      transform: translate(-50%, -50%) scale(1.1) rotate(-3deg);
      filter: drop-shadow(0 16px 24px rgba(0,0,0,0.3));
      display: none;
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    ::-webkit-scrollbar-track {
      background: #F1F5F9;
      border-radius: 9999px;
    }
    ::-webkit-scrollbar-thumb {
      background: #CBD5E1;
      border-radius: 9999px;
    }
  </style>
</head>
<body class="text-slate-800 flex flex-col min-h-screen">

  <!-- Floating Drag Ghost Container -->
  <div id="drag-ghost" class="bg-white rounded-2xl border-4 border-amber-400 p-2 flex items-center justify-center"></div>

  <!-- Confetti Canvas -->
  <canvas id="confetti-canvas" class="fixed inset-0 pointer-events-none z-50"></canvas>

  <!-- TOP NAVIGATION BAR & SCORE/SHIELDS -->
  <header class="bg-white/95 backdrop-blur-md border-b-4 border-indigo-200 sticky top-0 z-40 shadow-sm px-3 py-2">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
      <!-- Brand / Title -->
      <div class="flex items-center gap-2.5">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md border-2 border-indigo-200">
          <span class="text-2xl">🎨</span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">Cambridge Pre-A1 Starters</span>
            <span class="text-xs font-bold text-indigo-600 hidden sm:inline">Test 1 • Speaking</span>
          </div>
          <h1 class="text-lg sm:text-xl font-bold text-slate-900 leading-tight">Monster Art Class Studio</h1>
        </div>
      </div>

      <!-- Mode Switcher Tabs -->
      <nav class="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        <button onclick="switchMode('part1a')" id="tab-part1a" class="mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 bg-indigo-600 text-white shadow">
          <span>👆</span> Part 1A: Point
        </button>
        <button onclick="switchMode('part1b')" id="tab-part1b" class="mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 text-slate-700 hover:bg-white">
          <span>🃏</span> Part 1B: Place Cards
        </button>
        <button onclick="switchMode('part2')" id="tab-part2" class="mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 text-slate-700 hover:bg-white">
          <span>🔍</span> Part 2: Scene Q&A
        </button>
        <button onclick="switchMode('part3')" id="tab-part3" class="mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 text-slate-700 hover:bg-white">
          <span>💬</span> Part 3: Object Cards
        </button>
        <button onclick="switchMode('sandbox')" id="tab-sandbox" class="mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 text-slate-700 hover:bg-white">
          <span>🎓</span> Free Teacher Mode
        </button>
      </nav>

      <!-- Score & 5 Cambridge Shields -->
      <div class="flex items-center gap-3">
        <!-- 5 Shields Progress -->
        <div class="flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-2xl border-2 border-indigo-100" title="Cambridge Speaking Shields Earned">
          <div id="shields-container" class="flex items-center gap-1">
            <!-- Populated by JS -->
          </div>
        </div>

        <!-- Star Points Counter -->
        <div class="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white px-3.5 py-1.5 rounded-2xl font-kid font-bold shadow border-2 border-amber-200">
          <span class="text-lg">⭐</span>
          <span id="score-display" class="text-base sm:text-lg">0</span>
          <span class="text-xs opacity-90">pts</span>
        </div>

        <!-- Certificate Button -->
        <button onclick="openCertificateModal()" class="p-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 transition" title="View Cambridge Report Card">
          <span>🏆</span>
        </button>
      </div>
    </div>
  </header>

  <!-- SUB-BAR: TEACHER HELPER & VOICE CONTROLS -->
  <div class="bg-indigo-950 text-indigo-100 px-4 py-1.5 text-xs border-b border-indigo-800">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-bold text-amber-300 flex items-center gap-1">🛠️ Teacher & Audio Bar:</span>
        <button onclick="repeatPromptAudio()" class="px-2.5 py-1 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 transition">
          🔊 Replay Examiner Voice
        </button>
        <button onclick="toggleSpeechRate()" id="btn-speech-rate" class="px-2.5 py-1 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white font-semibold transition">
          🐢 Speed: Normal (0.9x)
        </button>
        <button onclick="toggleMute()" id="btn-mute" class="px-2.5 py-1 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-white font-semibold transition">
          🔔 Sound: ON
        </button>
        <button onclick="toggleDropZonesHint()" id="btn-drop-hint" class="px-2.5 py-1 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-amber-200 font-semibold transition">
          🎯 Show Drop Zones: OFF
        </button>
        <button onclick="toggleOriginalBookArt()" id="btn-book-art" class="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-bold transition border border-purple-400">
          🖼️ Scene: Vector HD (Switch to Book Art)
        </button>
        <button onclick="openCardsSheetModal()" class="px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-bold transition border border-sky-400">
          ✂️ View Original 8 Cards Sheet
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="teacherAwardStar()" class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold flex items-center gap-1 shadow transition transform active:scale-95">
          ⭐ Award Student +15 Pts
        </button>
        <button onclick="resetAllPlacedCards()" class="px-2.5 py-1 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-white font-semibold transition">
          🔄 Clear Placed Cards
        </button>
        <button onclick="nextQuestion()" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition">
          ⏭️ Next Prompt
        </button>
      </div>
    </div>
  </div>

  <!-- MAIN WORKSPACE -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

    <!-- LEFT / CENTER COLUMN: SCENE PICTURE OR PART 3 STAGE (8 cols on desktop) -->
    <div class="lg:col-span-8 flex flex-col gap-3">

      <!-- EXAMINER PROMPT BANNER -->
      <div class="bg-white rounded-3xl p-3.5 sm:p-4 shadow-md border-4 border-indigo-200 flex items-center gap-3.5 relative">
        <!-- Animated Friendly Examiner Avatar -->
        <div class="relative shrink-0">
          <svg class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-sky-100 to-indigo-100 border-2 border-indigo-300 shadow-inner" viewBox="0 0 100 100">
            <!-- Shoulders -->
            <path d="M15,98 C15,72 85,72 85,98 Z" fill="#4F46E5" />
            <path d="M38,76 L50,92 L62,76 Z" fill="#FFFFFF" />
            <!-- Neck & Head -->
            <rect x="43" y="62" width="14" height="16" rx="5" fill="#FDBA74" />
            <circle cx="50" cy="44" r="24" fill="#FED7AA" />
            <!-- Hair -->
            <path d="M24,42 C22,18 78,18 76,42 C72,26 30,26 24,42 Z" fill="#451A03" />
            <!-- Glasses -->
            <rect x="33" y="37" width="14" height="10" rx="3" fill="none" stroke="#1E293B" stroke-width="2.5" />
            <rect x="53" y="37" width="14" height="10" rx="3" fill="none" stroke="#1E293B" stroke-width="2.5" />
            <line x1="47" y1="42" x2="53" y2="42" stroke="#1E293B" stroke-width="2.5" />
            <!-- Eyes -->
            <circle cx="40" cy="42" r="2.5" fill="#1E293B" />
            <circle cx="60" cy="42" r="2.5" fill="#1E293B" />
            <!-- Cheeks -->
            <circle cx="33" cy="50" r="3.5" fill="#FCA5A5" opacity="0.6" />
            <circle cx="67" cy="50" r="3.5" fill="#FCA5A5" opacity="0.6" />
            <!-- Animated Mouth -->
            <g id="examiner-mouth">
              <path d="M42,54 Q50,62 58,54 Z" fill="#E11D48" />
            </g>
          </svg>
          <span id="speaking-badge" class="hidden absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
            SPEAKING
          </span>
        </div>

        <!-- Speech Bubble Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span id="part-badge" class="text-xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Part 1 • Task A: Point to things
            </span>
            <span id="question-counter" class="text-xs font-bold text-slate-500">Question 1 of 8</span>
          </div>
          <p id="examiner-prompt-text" class="text-lg sm:text-xl font-kid font-bold text-slate-900 leading-snug">
            "Hello! Look at the picture of the Monster Art Class. Where's the ball?"
          </p>
          <p id="examiner-sub-hint" class="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            👉 Click or tap the object in the big picture to point to it!
          </p>
        </div>

        <!-- Quick Audio & Hint Buttons -->
        <div class="flex flex-col gap-1.5 shrink-0">
          <button onclick="repeatPromptAudio()" class="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition active:scale-95" title="Listen Again">
            🔊
          </button>
          <button onclick="triggerVisualClue()" class="w-11 h-11 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-800 border-2 border-amber-300 flex items-center justify-center shadow-sm transition active:scale-95" title="Show Hint Glow">
            💡
          </button>
        </div>
      </div>

      <!-- INTERACTIVE SCENE PICTURE CONTAINER -->
      <div id="scene-stage-wrapper" class="bg-white rounded-3xl p-2 sm:p-3 shadow-xl border-4 border-amber-300 relative overflow-hidden">
        <!-- Floating Toast Feedback inside Scene -->
        <div id="scene-toast" class="hidden absolute top-5 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl shadow-xl border-2 border-amber-400 font-kid font-bold text-base sm:text-lg flex items-center gap-2 transition-all">
          <span id="scene-toast-icon">🌟</span>
          <span id="scene-toast-text">Well done!</span>
        </div>

        <!-- FAITHFUL HIGH-DETAIL SVG RECREATION + ORIGINAL BOOK ILLUSTRATION OF MONSTER ART CLASS -->
        <div id="scene-canvas-container" class="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-300 shadow-inner bg-[#F5F3CE]">
          <svg id="monster-art-scene" viewBox="0 0 900 675" class="w-full h-full block select-none">
            <defs>
              <!-- Wall & Floor Gradients -->
              <linearGradient id="backWallGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#F5EE7A" />
                <stop offset="60%" stop-color="#FBF7A8" />
                <stop offset="100%" stop-color="#FDFBE2" />
              </linearGradient>
              <linearGradient id="leftWallGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#C8AF4B" />
                <stop offset="100%" stop-color="#DFC65B" />
              </linearGradient>
              <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#FAF9F5" />
                <stop offset="100%" stop-color="#E5E4DF" />
              </linearGradient>
              <linearGradient id="palmSky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38BDF8" />
                <stop offset="65%" stop-color="#E0F2FE" />
                <stop offset="100%" stop-color="#FEF08A" />
              </linearGradient>
              <linearGradient id="laptopScreen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#2563EB" />
                <stop offset="50%" stop-color="#60A5FA" />
                <stop offset="100%" stop-color="#EFF6FF" />
              </linearGradient>
            </defs>

            <!-- 1. ROOM ARCHITECTURE (Back Wall, Left Wall, Floor, Shadows) -->
            <g id="vector-room-bg">
              <!-- Back Wall -->
              <polygon points="180,0 900,0 900,275 180,275" fill="url(#backWallGrad)" />
              <!-- Left Angled Wall -->
              <polygon points="0,0 180,0 180,275 0,495" fill="url(#leftWallGrad)" />
              <!-- Floor -->
              <polygon points="180,275 900,275 900,675 0,675 0,495" fill="url(#floorGrad)" />
              <!-- Subtle Floor Texture Speckles -->
              <g fill="#D6D3CD" opacity="0.45">
                <ellipse cx="320" cy="390" rx="18" ry="5" />
                <ellipse cx="620" cy="420" rx="22" ry="6" />
                <ellipse cx="480" cy="520" rx="25" ry="7" />
                <ellipse cx="210" cy="580" rx="20" ry="6" />
                <ellipse cx="680" cy="590" rx="28" ry="7" />
              </g>

              <!-- Floor Cast Shadows (Matching the original art) -->
              <polygon points="0,565 180,275 265,500 95,675 0,675" fill="#B5B2A8" opacity="0.65" />
              <ellipse cx="490" cy="335" rx="95" ry="42" fill="#A8A49B" opacity="0.65" />
              <polygon points="315,425 460,425 545,675 340,675" fill="#B5B2A8" opacity="0.6" />
              <polygon points="435,515 565,515 705,675 495,675" fill="#B5B2A8" opacity="0.6" />
              <polygon points="685,430 850,430 900,590 735,610" fill="#B5B2A8" opacity="0.6" />
              <ellipse cx="795" cy="635" rx="95" ry="18" fill="#B5B2A8" opacity="0.6" />
            </g>

            <!-- Original Textbook Illustration Layer (Toggled via Teacher Bar) -->
            <image id="original-book-art-img" href="/assets/aistudio/image_7db17f83.png" x="0" y="0" width="900" height="675" preserveAspectRatio="none" class="hidden pointer-events-none" />

            <!-- 2. TALL WOODEN DOOR ON LEFT WALL -->
            <g id="item-door" class="scene-item" onclick="handleSceneItemClick('door', event)">
              <!-- Door Frame -->
              <polygon points="38,168 118,98 118,370 38,465" fill="#8C4A19" stroke="#5C2D0C" stroke-width="3" />
              <!-- Upper Panel -->
              <polygon points="46,178 110,118 110,218 46,282" fill="#D98A4E" />
              <!-- Middle Wood Band -->
              <polygon points="46,282 110,218 110,255 46,322" fill="#B85224" />
              <!-- Lower Panel -->
              <polygon points="46,322 110,255 110,362 46,448" fill="#D98A4E" />
              <!-- Door Knob -->
              <circle cx="103" cy="238" r="5" fill="#5C2D0C" />
            </g>

            <!-- 3. WALL CLOCK (TOP CENTER) -->
            <g id="item-clock" class="scene-item" onclick="handleSceneItemClick('clock', event)">
              <circle cx="478" cy="28" r="22" fill="#94A3B8" stroke="#475569" stroke-width="2.5" />
              <circle cx="478" cy="28" r="18" fill="#FFFBEB" stroke="#64748B" stroke-width="1.5" />
              <!-- Clock ticks -->
              <text x="478" y="16" text-anchor="middle" font-size="6" font-weight="bold" fill="#1E293B">12</text>
              <text x="492" y="30" text-anchor="middle" font-size="6" font-weight="bold" fill="#1E293B">3</text>
              <text x="478" y="43" text-anchor="middle" font-size="6" font-weight="bold" fill="#1E293B">6</text>
              <text x="464" y="30" text-anchor="middle" font-size="6" font-weight="bold" fill="#1E293B">9</text>
              <!-- Hands showing ~5:00 -->
              <line x1="478" y1="28" x2="478" y2="17" stroke="#1E293B" stroke-width="2" stroke-linecap="round" />
              <line x1="478" y1="28" x2="485" y2="35" stroke="#DC2626" stroke-width="2" stroke-linecap="round" />
              <circle cx="478" cy="28" r="2" fill="#1E293B" />
            </g>

            <!-- 4. BACK WALL FRAMED PICTURES (LEFT & RIGHT) -->
            <!-- Left Framed Picture: Palm Tree in Red Desert -->
            <g id="item-left_picture" class="scene-item" onclick="handleSceneItemClick('left_picture', event)">
              <rect x="210" y="92" width="136" height="96" rx="2" fill="#D99B52" stroke="#78350F" stroke-width="4" />
              <rect x="218" y="100" width="120" height="80" fill="#FFFFFF" stroke="#92400E" stroke-width="2" />
              <!-- Painting Inside -->
              <rect x="223" y="105" width="110" height="70" fill="url(#palmSky)" />
              <!-- Sun -->
              <circle cx="316" cy="126" r="6" fill="#FDE047" />
              <!-- Red Desert Hills -->
              <path d="M223,155 Q248,142 275,154 Q305,140 333,153 L333,175 L223,175 Z" fill="#B91C1C" />
              <path d="M223,164 Q275,156 333,165 L333,175 L223,175 Z" fill="#FCA5A5" />
              <!-- Palm Tree Trunk -->
              <path d="M268,175 Q271,148 269,130" stroke="#451A03" stroke-width="6" fill="none" stroke-linecap="round" />
              <!-- Pink/Magenta Palm Fronds -->
              <path d="M269,130 Q245,122 238,136 Q254,132 269,130 Z" fill="#EC4899" />
              <path d="M269,130 Q248,108 236,118 Q255,120 269,130 Z" fill="#DB2777" />
              <path d="M269,130 Q268,105 280,110 Q274,120 269,130 Z" fill="#F43F5E" />
              <path d="M269,130 Q292,112 302,124 Q284,124 269,130 Z" fill="#EC4899" />
              <path d="M269,130 Q295,128 298,142 Q282,135 269,130 Z" fill="#BE185D" />
            </g>

            <!-- Right Framed Picture: Animals & Orange Tree -->
            <g id="item-right_picture" class="scene-item" onclick="handleSceneItemClick('right_picture', event)">
              <rect x="660" y="88" width="138" height="96" rx="2" fill="#D99B52" stroke="#78350F" stroke-width="4" />
              <rect x="668" y="96" width="122" height="80" fill="#FFFFFF" stroke="#92400E" stroke-width="2" />
              <rect x="673" y="101" width="112" height="70" fill="url(#palmSky)" />
              <!-- Red/Orange Ground -->
              <path d="M673,148 Q728,142 785,148 L785,171 L673,171 Z" fill="#EA580C" />
              <!-- Little Brown Hippo/Bear on left -->
              <ellipse cx="696" cy="147" rx="13" ry="8" fill="#571A07" />
              <circle cx="708" cy="144" r="6" fill="#571A07" />
              <rect x="687" y="152" width="3" height="6" fill="#571A07" />
              <rect x="694" y="152" width="3" height="6" fill="#571A07" />
              <rect x="702" y="152" width="3" height="6" fill="#571A07" />
              <!-- Orange Tree on right -->
              <rect x="760" y="135" width="5" height="32" fill="#451A03" />
              <ellipse cx="762" cy="132" rx="18" ry="12" fill="#EA580C" />
              <!-- Toucan/Bird on tree -->
              <ellipse cx="764" cy="120" rx="6" ry="8" fill="#1E293B" />
              <ellipse cx="763" cy="121" rx="3" ry="5" fill="#FFFFFF" />
              <path d="M758,115 L748,118 L758,121 Z" fill="#FACC15" />
              <!-- White flower/rabbit below -->
              <circle cx="745" cy="160" r="5" fill="#F8FAFC" />
              <!-- Tiny Butterflies -->
              <circle cx="705" cy="112" r="2.5" fill="#22C55E" />
              <circle cx="728" cy="116" r="2" fill="#F59E0B" />
            </g>

            <!-- 5. CENTER LARGE WHITEBOARD WITH FISH DRAWING -->
            <g id="item-whiteboard" class="scene-item" onclick="handleSceneItemClick('whiteboard', event)">
              <rect x="372" y="64" width="232" height="156" fill="#64748B" stroke="#334155" stroke-width="3" />
              <rect x="382" y="74" width="212" height="136" fill="#FFFFFF" />
              <!-- Greenish Sketch of a Swimming Fish on Whiteboard -->
              <g stroke="#65A30D" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.85">
                <path d="M425,145 C445,112 495,112 522,135 C535,126 548,118 552,115 C548,132 548,148 554,162 C542,155 532,148 522,144 C495,165 445,164 425,145 Z" />
                <!-- Fins -->
                <path d="M468,120 Q482,102 495,118" />
                <path d="M475,157 Q485,170 496,156" />
                <!-- Eye & Smile -->
                <circle cx="445" cy="136" r="3" />
                <path d="M430,148 Q442,152 450,146" />
                <!-- Water Wave Lines -->
                <path d="M412,174 Q445,166 478,175 T545,172" />
                <path d="M435,184 Q475,177 515,185 T572,182" />
                <!-- Bubbles / Speed lines -->
                <line x1="560" y1="132" x2="572" y2="132" />
                <line x1="562" y1="142" x2="576" y2="142" />
                <line x1="558" y1="152" x2="570" y2="152" />
              </g>
            </g>

            <!-- 6. BROWN TABLE, SLEEPING GREY CAT & LAPTOP -->
            <!-- Brown Table -->
            <g id="item-table" class="scene-item" onclick="handleSceneItemClick('table', event)">
              <!-- Table Legs -->
              <rect x="385" y="275" width="9" height="65" fill="#7C2D12" />
              <rect x="554" y="275" width="9" height="65" fill="#7C2D12" />
              <!-- Table Top -->
              <polygon points="375,228 562,228 576,278 362,278" fill="#C27838" stroke="#7C2D12" stroke-width="2.5" />
              <rect x="362" y="276" width="214" height="7" fill="#7C2D12" />
            </g>

            <!-- Sleeping Grey Cat Under the Table -->
            <g id="item-gray_cat" class="scene-item" onclick="handleSceneItemClick('gray_cat', event)">
              <!-- Body -->
              <ellipse cx="485" cy="312" rx="32" ry="16" fill="#64748B" stroke="#334155" stroke-width="1.5" />
              <!-- Tail -->
              <path d="M515,314 Q538,308 542,318" stroke="#64748B" stroke-width="6" fill="none" stroke-linecap="round" />
              <!-- Head -->
              <circle cx="460" cy="310" r="14" fill="#64748B" stroke="#334155" stroke-width="1.5" />
              <!-- Ears -->
              <polygon points="449,301 446,289 457,297" fill="#475569" />
              <polygon points="464,297 473,289 471,301" fill="#475569" />
              <!-- Closed Sleeping Eyes & Whiskers -->
              <path d="M452,310 Q456,314 459,310" stroke="#1E293B" stroke-width="1.5" fill="none" />
              <path d="M463,310 Q467,314 470,310" stroke="#1E293B" stroke-width="1.5" fill="none" />
              <polygon points="459,315 463,315 461,318" fill="#F43F5E" />
              <!-- Paws -->
              <ellipse cx="452" cy="322" rx="6" ry="3.5" fill="#94A3B8" />
              <ellipse cx="468" cy="323" rx="6" ry="3.5" fill="#94A3B8" />
            </g>

            <!-- Laptop / Computer on the Table -->
            <g id="item-laptop" class="scene-item" onclick="handleSceneItemClick('laptop', event)">
              <!-- Laptop Screen Half -->
              <polygon points="525,198 570,214 552,256 508,238" fill="#334155" stroke="#1E293B" stroke-width="2" />
              <polygon points="528,203 565,217 550,251 513,235" fill="url(#laptopScreen)" />
              <!-- Laptop Keyboard Base -->
              <polygon points="508,238 552,256 522,273 482,253" fill="#CBD5E1" stroke="#475569" stroke-width="2" />
              <!-- Keyboard keys texture -->
              <polygon points="508,243 544,257 524,267 492,251" fill="#64748B" />
              <!-- Trackpad -->
              <polygon points="504,258 514,263 509,266 499,261" fill="#94A3B8" />
            </g>

            <!-- 7. MONSTER IN GREEN DRESS WITH CAMERA -->
            <g id="item-camera_monster" class="scene-item" onclick="handleSceneItemClick('camera_monster', event)">
              <!-- 3 Purple/Blue Legs & Black Shoes -->
              <path d="M332,395 L328,415" stroke="#4C1D95" stroke-width="6" stroke-linecap="round" />
              <path d="M348,395 L346,422" stroke="#4C1D95" stroke-width="6" stroke-linecap="round" />
              <path d="M362,395 L364,416" stroke="#4C1D95" stroke-width="6" stroke-linecap="round" />
              <ellipse cx="324" cy="417" rx="9" ry="5" fill="#1E293B" />
              <ellipse cx="344" cy="424" rx="9" ry="5" fill="#1E293B" />
              <ellipse cx="366" cy="418" rx="9" ry="5" fill="#1E293B" />

              <!-- Long Green Dress with Flowers -->
              <path d="M334,240 L385,240 L405,398 Q355,408 310,395 Z" fill="#16A34A" stroke="#14532D" stroke-width="2" />
              <!-- Dress Belt -->
              <path d="M331,278 Q360,284 388,278" stroke="#14532D" stroke-width="4" fill="none" />
              <!-- Pink/Purple Flowers on Dress -->
              <g fill="#F472B6">
                <circle cx="345" cy="302" r="4.5" /><circle cx="372" cy="312" r="4.5" />
                <circle cx="335" cy="338" r="4.5" /><circle cx="362" cy="348" r="4.5" />
                <circle cx="385" cy="365" r="4.5" /><circle cx="342" cy="375" r="4.5" />
              </g>
              <!-- Head & Ears/Horns -->
              <path d="M335,202 L315,192" stroke="#D97706" stroke-width="5" stroke-linecap="round" />
              <circle cx="313" cy="191" r="4.5" fill="#FDE047" />
              <path d="M392,202 L412,192" stroke="#D97706" stroke-width="5" stroke-linecap="round" />
              <circle cx="414" cy="191" r="4.5" fill="#FDE047" />
              <ellipse cx="364" cy="212" rx="30" ry="24" fill="#FDE047" stroke="#CA8A04" stroke-width="1.5" />
              <!-- Fluffy Pink Hair -->
              <path d="M330,204 C325,175 402,175 398,204 C385,194 345,194 330,204 Z" fill="#EC4899" />
              <circle cx="342" cy="186" r="10" fill="#EC4899" />
              <circle cx="364" cy="182" r="12" fill="#EC4899" />
              <circle cx="385" cy="186" r="10" fill="#EC4899" />
              <!-- 3 Eyes + 1 Winking Eye -->
              <path d="M344,208 Q348,204 352,208" stroke="#1E293B" stroke-width="2" fill="none" />
              <circle cx="360" cy="208" r="3" fill="#1E293B" />
              <circle cx="370" cy="208" r="3" fill="#1E293B" />
              <circle cx="380" cy="208" r="3" fill="#1E293B" />
              <!-- Smile -->
              <path d="M356,222 Q368,230 378,220" stroke="#E11D48" stroke-width="2.5" fill="none" />
              <!-- Green Sleeves & Hands holding Camera -->
              <path d="M334,242 Q305,258 318,270 L340,255" fill="#16A34A" />
              <path d="M385,242 Q412,258 395,270 L372,255" fill="#16A34A" />
            </g>

            <!-- Black Camera (Clickable separately OR as part of monster) -->
            <g id="item-camera" class="scene-item" onclick="handleSceneItemClick('camera', event)">
              <rect x="324" y="224" width="46" height="32" rx="5" fill="#1E293B" stroke="#0F172A" stroke-width="2" />
              <rect x="338" y="217" width="16" height="8" rx="2" fill="#334155" />
              <circle cx="347" cy="240" r="12" fill="#0F172A" stroke="#94A3B8" stroke-width="2" />
              <circle cx="347" cy="240" r="8" fill="#38BDF8" />
              <circle cx="344" cy="237" r="2.5" fill="#FFFFFF" />
              <circle cx="362" cy="230" r="2.5" fill="#EF4444" />
            </g>

            <!-- 8. LEFT EASEL & GREEN MONSTER PAINTING A HOUSE -->
            <g id="item-left_easel" class="scene-item" onclick="handleSceneItemClick('left_easel', event)">
              <!-- Wooden Easel Legs -->
              <polygon points="222,265 242,265 278,512 260,516" fill="#B47B44" stroke="#78350F" stroke-width="1.5" />
              <polygon points="245,420 262,420 225,582 206,578" fill="#C88A4B" stroke="#78350F" stroke-width="1.5" />
              <polygon points="150,415 166,415 135,555 118,552" fill="#B47B44" stroke="#78350F" stroke-width="1.5" />
              <!-- Canvas with House Painting -->
              <polygon points="175,286 284,296 244,468 134,442" fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" />
              <!-- Sky & Clouds on Canvas -->
              <polygon points="175,286 284,296 266,375 154,355" fill="#7DD3FC" />
              <!-- Painted House on Canvas -->
              <polygon points="184,335 248,342 232,418 172,405" fill="#7C2D12" />
              <!-- Yellow Roof & 3 Chimneys with Smoke -->
              <polygon points="180,322 254,330 248,345 178,337" fill="#FACC15" stroke="#CA8A04" stroke-width="1.5" />
              <rect x="195" y="305" width="9" height="19" fill="#EA580C" />
              <rect x="215" y="307" width="9" height="19" fill="#EA580C" />
              <rect x="234" y="310" width="9" height="19" fill="#EA580C" />
              <!-- Smoke puffs -->
              <path d="M199,303 Q204,292 212,294" stroke="#64748B" stroke-width="4" fill="none" stroke-linecap="round" />
              <path d="M219,305 Q225,294 233,296" stroke="#64748B" stroke-width="4" fill="none" stroke-linecap="round" />
              <path d="M238,308 Q244,297 252,299" stroke="#64748B" stroke-width="4" fill="none" stroke-linecap="round" />
              <!-- House Windows -->
              <rect x="184" y="350" width="14" height="14" fill="#FDE047" />
              <rect x="218" y="355" width="14" height="14" fill="#1E293B" />
              <rect x="208" y="382" width="16" height="24" fill="#DC2626" />
              <!-- Easel Tray & 3 Paint Jars -->
              <polygon points="124,442 244,468 236,486 116,458" fill="#D99B52" stroke="#78350F" stroke-width="1.5" />
              <!-- 3 Paint Jars -->
              <rect x="145" y="432" width="16" height="20" rx="3" fill="#FFFFFF" stroke="#64748B" />
              <rect x="147" y="436" width="12" height="6" fill="#EF4444" />
              <rect x="167" y="437" width="16" height="20" rx="3" fill="#FFFFFF" stroke="#64748B" />
              <rect x="169" y="441" width="12" height="6" fill="#FACC15" />
              <rect x="190" y="442" width="16" height="20" rx="3" fill="#FFFFFF" stroke="#64748B" />
              <rect x="192" y="446" width="12" height="6" fill="#2563EB" />
            </g>

            <!-- Green Monster on the Left (Wearing Brown Hat, Red Shirt, Blue Trousers, 4 Arms) -->
            <g id="item-green_monster" class="scene-item" onclick="handleSceneItemClick('green_monster', event)">
              <!-- 3 Legs in Blue Trousers & White Shoes -->
              <polygon points="82,485 144,485 154,578 130,580 122,520 114,582 94,582 96,520 84,585 66,582" fill="#1D4ED8" stroke="#1E3A8A" stroke-width="2" />
              <ellipse cx="74" cy="588" rx="12" ry="6" fill="#F8FAFC" stroke="#94A3B8" />
              <ellipse cx="104" cy="588" rx="12" ry="6" fill="#F8FAFC" stroke="#94A3B8" />
              <ellipse cx="144" cy="582" rx="12" ry="6" fill="#F8FAFC" stroke="#94A3B8" />

              <!-- Red T-Shirt Torso -->
              <polygon points="68,412 148,412 146,492 78,492" fill="#EF4444" stroke="#B91C1C" stroke-width="2" />

              <!-- 4 Green Arms (2 Left, 2 Right holding paintbrushes) -->
              <!-- Left Upper & Lower Arms -->
              <path d="M72,422 Q45,442 40,468" stroke="#A3E635" stroke-width="10" stroke-linecap="round" fill="none" />
              <path d="M75,448 Q52,475 56,502" stroke="#84CC16" stroke-width="10" stroke-linecap="round" fill="none" />
              <!-- Right Upper & Lower Arms reaching to Canvas -->
              <path d="M140,420 Q172,400 186,378" stroke="#A3E635" stroke-width="10" stroke-linecap="round" fill="none" />
              <path d="M142,442 Q178,428 195,405" stroke="#84CC16" stroke-width="10" stroke-linecap="round" fill="none" />
              <!-- 2 Paintbrushes in right hands -->
              <line x1="182" y1="382" x2="202" y2="360" stroke="#78350F" stroke-width="4" stroke-linecap="round" />
              <polygon points="200,362 208,352 205,365" fill="#EA580C" />
              <line x1="192" y1="408" x2="212" y2="390" stroke="#78350F" stroke-width="4" stroke-linecap="round" />
              <polygon points="210,392 218,383 215,395" fill="#FACC15" />

              <!-- Green Monster Head & Spotted Ears -->
              <circle cx="78" cy="395" r="7" fill="#A3E635" stroke="#65A30D" stroke-width="2" />
              <circle cx="88" cy="408" r="6" fill="#A3E635" stroke="#65A30D" stroke-width="2" />
              <ellipse cx="116" cy="382" rx="34" ry="28" fill="#A3E635" stroke="#65A30D" stroke-width="2" />
              <!-- Red Hair Tufts under Hat -->
              <path d="M78,375 L70,388 M85,372 L78,386 M92,370 L88,384" stroke="#DC2626" stroke-width="4" stroke-linecap="round" />
              <!-- 3 Eyes & Happy Smile -->
              <circle cx="112" cy="374" r="3" fill="#1E293B" />
              <circle cx="126" cy="368" r="3" fill="#1E293B" />
              <circle cx="138" cy="374" r="3" fill="#1E293B" />
              <path d="M114,392 Q128,400 138,388" stroke="#15803D" stroke-width="2.5" fill="none" />
              <!-- Brown Hat on Green Monster's Head (Clickable as brown_hat or green_monster) -->
              <g id="item-brown_hat" class="scene-item" onclick="handleSceneItemClick('brown_hat', event)">
                <ellipse cx="112" cy="356" rx="46" ry="15" fill="#78350F" stroke="#451A03" stroke-width="2" />
                <path d="M84,354 C84,325 140,325 140,354 Z" fill="#92400E" stroke="#451A03" stroke-width="2" />
              </g>
            </g>

            <!-- 9. RED CHAIR & SOCCER BALL UNDER CHAIR -->
            <g id="item-chair" class="scene-item" onclick="handleSceneItemClick('chair', event)">
              <!-- Backrest -->
              <polygon points="282,500 362,492 372,568 296,576" fill="#B91C1C" stroke="#7F1D1D" stroke-width="2" />
              <!-- Seat -->
              <polygon points="296,576 372,568 402,592 316,604" fill="#DC2626" stroke="#7F1D1D" stroke-width="2" />
              <!-- Chair Legs -->
              <line x1="296" y1="576" x2="292" y2="628" stroke="#991B1B" stroke-width="6" stroke-linecap="round" />
              <line x1="318" y1="602" x2="318" y2="655" stroke="#B91C1C" stroke-width="6" stroke-linecap="round" />
              <line x1="398" y1="592" x2="400" y2="644" stroke="#B91C1C" stroke-width="6" stroke-linecap="round" />
              <line x1="368" y1="572" x2="368" y2="618" stroke="#7F1D1D" stroke-width="5" stroke-linecap="round" />
            </g>

            <!-- Soccer Ball / Football Under the Red Chair -->
            <g id="item-ball" class="scene-item" onclick="handleSceneItemClick('ball', event)">
              <circle cx="350" cy="630" r="22" fill="#F8FAFC" stroke="#334155" stroke-width="2.5" />
              <!-- Classic Soccer Pentagon Patches -->
              <polygon points="350,618 358,624 355,633 345,633 342,624" fill="#1E293B" />
              <polygon points="350,608 356,612 344,612" fill="#1E293B" />
              <polygon points="330,624 336,620 338,629 331,633" fill="#1E293B" />
              <polygon points="370,624 364,620 362,629 369,633" fill="#1E293B" />
              <polygon points="340,646 346,639 354,639 360,646 350,651" fill="#1E293B" />
            </g>

            <!-- 10. CENTER EASEL (BLUE CAT PAINTING) & PINK TRIANGULAR MONSTER -->
            <g id="item-center_easel" class="scene-item" onclick="handleSceneItemClick('center_easel', event)">
              <!-- Wooden Legs -->
              <polygon points="410,310 432,310 448,545 428,545" fill="#B47B44" stroke="#78350F" stroke-width="1.5" />
              <polygon points="418,480 438,480 452,615 432,615" fill="#C88A4B" stroke="#78350F" stroke-width="1.5" />
              <polygon points="502,465 522,465 548,585 528,585" fill="#B47B44" stroke="#78350F" stroke-width="1.5" />
              <!-- White Canvas -->
              <polygon points="362,338 492,326 534,492 404,515" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
              <!-- Blue Cat Drinking Milk Painting on Canvas -->
              <g>
                <!-- Cat arched back & tail -->
                <ellipse cx="458" cy="404" rx="28" ry="18" transform="rotate(-20 458 404)" fill="#1E3A8A" />
                <circle cx="482" cy="392" r="14" fill="#1E3A8A" />
                <path d="M492,385 Q502,360 492,355" stroke="#1E3A8A" stroke-width="6" fill="none" stroke-linecap="round" />
                <!-- Cat head down by bowl -->
                <circle cx="426" cy="422" r="14" fill="#1E3A8A" />
                <polygon points="416,412 414,400 424,408" fill="#1E3A8A" />
                <polygon points="428,410 434,398 436,412" fill="#1E3A8A" />
                <circle cx="422" cy="424" r="2.5" fill="#38BDF8" />
                <!-- Cat legs -->
                <path d="M442,418 L438,442 M456,418 L454,444 M478,405 L476,436 M488,402 L492,432" stroke="#1E3A8A" stroke-width="6" stroke-linecap="round" />
                <!-- Milk Bowl -->
                <ellipse cx="424" cy="454" rx="16" ry="7" fill="#93C5FD" stroke="#475569" stroke-width="1.5" />
              </g>
            </g>

            <!-- Pink Triangular Monster -->
            <g id="item-pink_monster" class="scene-item" onclick="handleSceneItemClick('pink_monster', event)">
              <!-- 4 Blue/Cyan Cone Legs with Red Feet -->
              <polygon points="512,542 522,542 528,582 502,582" fill="#38BDF8" />
              <ellipse cx="514" cy="586" rx="13" ry="7" fill="#E11D48" />
              <polygon points="544,548 554,548 562,592 534,592" fill="#38BDF8" />
              <ellipse cx="548" cy="596" rx="13" ry="7" fill="#E11D48" />
              <polygon points="575,552 585,552 594,595 566,595" fill="#38BDF8" />
              <ellipse cx="580" cy="599" rx="13" ry="7" fill="#E11D48" />
              <polygon points="604,554 614,554 624,595 596,595" fill="#38BDF8" />
              <ellipse cx="610" cy="599" rx="13" ry="7" fill="#E11D48" />

              <!-- Pink Triangular Body -->
              <polygon points="562,462 608,566 502,550" fill="#EC4899" stroke="#BE185D" stroke-width="2" />
              <!-- 2 Left Arms holding Paintbrushes + 1 Right Arm -->
              <polygon points="552,476 500,446 494,458 544,492" fill="#EC4899" />
              <polygon points="546,492 496,478 492,490 540,506" fill="#F472B6" />
              <polygon points="574,482 628,505 622,520 568,498" fill="#EC4899" />
              <!-- Paintbrushes -->
              <line x1="498" y1="450" x2="478" y2="432" stroke="#78350F" stroke-width="3.5" />
              <circle cx="476" cy="430" r="3.5" fill="#EF4444" />
              <line x1="494" y1="482" x2="474" y2="472" stroke="#78350F" stroke-width="3.5" />
              <circle cx="472" cy="471" r="3.5" fill="#1E3A8A" />

              <!-- Inverted Pink Triangle Head & Triangle Ears -->
              <polygon points="522,420 608,420 564,474" fill="#EC4899" stroke="#BE185D" stroke-width="2" />
              <polygon points="526,442 512,448 522,456" fill="#DB2777" />
              <polygon points="602,442 616,448 606,456" fill="#DB2777" />
              <!-- Eyes & Sad Frown -->
              <circle cx="552" cy="438" r="2.8" fill="#1E293B" />
              <circle cx="578" cy="438" r="2.8" fill="#1E293B" />
              <path d="M554,456 Q565,448 576,456" stroke="#881337" stroke-width="2.5" fill="none" />
            </g>

            <!-- 11. RIGHT EASEL & BLUE MONSTER PAINTING PORTRAIT -->
            <g id="item-right_easel" class="scene-item" onclick="handleSceneItemClick('right_easel', event)">
              <!-- Wooden Legs -->
              <polygon points="682,216 706,216 716,522 692,522" fill="#B47B44" stroke="#78350F" stroke-width="1.5" />
              <polygon points="680,380 700,380 668,492 648,488" fill="#92400E" />
              <!-- White Canvas -->
              <polygon points="642,248 776,242 806,412 678,430" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
              <!-- Portrait of Smiling Blue Monster on Canvas -->
              <g>
                <path d="M694,325 C685,275 758,275 764,335 L782,395 L694,405 Z" fill="#0F172A" />
                <circle cx="724" cy="322" r="22" fill="#0284C7" />
                <!-- Antennae on canvas portrait -->
                <path d="M704,310 L682,302 M702,318 L680,315" stroke="#0284C7" stroke-width="4" stroke-linecap="round" />
                <circle cx="680" cy="301" r="4" fill="#0369A1" />
                <circle cx="678" cy="315" r="4" fill="#0369A1" />
                <!-- Eyes & Big White Smile -->
                <circle cx="716" cy="316" r="2.5" fill="#1E293B" />
                <circle cx="732" cy="316" r="2.5" fill="#1E293B" />
                <path d="M712,326 Q724,338 736,326 Z" fill="#FFFFFF" />
                <!-- Body on canvas -->
                <ellipse cx="736" cy="375" rx="28" ry="30" fill="#0369A1" />
              </g>
            </g>

            <!-- Blue Round Monster Artist (Right) -->
            <g id="item-blue_monster" class="scene-item" onclick="handleSceneItemClick('blue_monster', event)">
              <!-- Legs -->
              <path d="M784,485 L784,522 L772,526" stroke="#0369A1" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              <path d="M812,485 L812,516 L802,520" stroke="#0369A1" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              <!-- Round Blue Body -->
              <ellipse cx="812" cy="436" rx="44" ry="54" fill="#0284C7" stroke="#0369A1" stroke-width="2" />
              <!-- Blue Head & Black Hair with Antennae -->
              <circle cx="806" cy="356" r="28" fill="#0284C7" stroke="#0369A1" stroke-width="2" />
              <path d="M792,332 C812,316 858,332 854,415 C840,400 822,380 816,355 Z" fill="#0F172A" />
              <!-- Smile & Eye -->
              <circle cx="790" cy="350" r="3" fill="#1E293B" />
              <path d="M780,362 Q790,372 798,362 Z" fill="#FFFFFF" />
              <!-- Arms & Paint Palette -->
              <path d="M778,405 Q745,382 726,356" stroke="#0284C7" stroke-width="10" stroke-linecap="round" fill="none" />
              <path d="M775,432 Q748,438 730,435" stroke="#0284C7" stroke-width="10" stroke-linecap="round" fill="none" />
              <!-- Wooden Paint Palette with Red/Green/Yellow blobs -->
              <ellipse cx="716" cy="436" rx="26" ry="14" fill="#FDE68A" stroke="#B45309" stroke-width="2" />
              <circle cx="704" cy="432" r="4.5" fill="#EF4444" />
              <circle cx="716" cy="442" r="4.5" fill="#22C55E" />
              <circle cx="728" cy="434" r="4.5" fill="#2563EB" />
              <!-- Extra Small Back Arms on right side -->
              <path d="M852,395 Q872,398 878,410" stroke="#0284C7" stroke-width="7" stroke-linecap="round" fill="none" />
              <path d="M854,418 Q874,424 876,438" stroke="#0284C7" stroke-width="7" stroke-linecap="round" fill="none" />
            </g>

            <!-- 12. BOTTOM-RIGHT TOY BOX (CHECKERED BOARD, DOLL, BEACH BALL) -->
            <g id="item-box" class="scene-item" onclick="handleSceneItemClick('box', event)">
              <!-- Checkered Flag/Game Board sticking out -->
              <g transform="rotate(-14 745 555)">
                <rect x="725" y="525" width="42" height="46" fill="#FFFFFF" stroke="#1E293B" stroke-width="2" />
                <rect x="725" y="525" width="10" height="10" fill="#1E293B" />
                <rect x="745" y="525" width="10" height="10" fill="#1E293B" />
                <rect x="735" y="535" width="10" height="10" fill="#1E293B" />
                <rect x="755" y="535" width="10" height="10" fill="#1E293B" />
                <rect x="725" y="545" width="10" height="10" fill="#1E293B" />
                <rect x="745" y="545" width="10" height="10" fill="#1E293B" />
              </g>
              <!-- Sailor Toy Doll -->
              <g>
                <rect x="768" y="542" width="28" height="34" rx="4" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" />
                <path d="M772,544 L782,556 L792,544" fill="#1D4ED8" />
                <circle cx="782" cy="528" r="10" fill="#FDBA74" stroke="#C2410C" stroke-width="1" />
                <circle cx="779" cy="526" r="1.5" fill="#1E293B" />
                <circle cx="785" cy="526" r="1.5" fill="#1E293B" />
                <path d="M779,532 Q782,535 785,532" stroke="#E11D48" stroke-width="1.5" fill="none" />
                <!-- Sailor Hat -->
                <ellipse cx="782" cy="518" rx="11" ry="4" fill="#FFFFFF" stroke="#1D4ED8" stroke-width="1.5" />
              </g>
              <!-- Colorful Beach Ball -->
              <g>
                <circle cx="824" cy="552" r="28" fill="#FEF08A" stroke="#CA8A04" stroke-width="1.5" />
                <path d="M824,524 A28,28 0 0,1 852,552 L824,552 Z" fill="#EF4444" />
                <path d="M824,524 A28,28 0 0,0 796,552 L824,552 Z" fill="#3B82F6" />
                <path d="M796,552 A28,28 0 0,0 824,580 L824,552 Z" fill="#EC4899" />
                <circle cx="824" cy="532" r="5" fill="#FFFFFF" />
              </g>
              <!-- Cardboard Box Front & Side -->
              <polygon points="718,568 836,574 832,638 722,626" fill="#D6A874" stroke="#92400E" stroke-width="2" />
              <polygon points="836,574 854,556 846,620 832,638" fill="#B4824E" stroke="#92400E" stroke-width="2" />
            </g>

            <!-- 13. DROP ZONES FOR PART 1B (DRAG & DROP OR CLICK PLACEMENT TARGETS) -->
            <g id="drop-zones-layer">
              <!-- Drop Zone 1: Under the table -->
              <rect id="dz-under_table" data-zone="under_table" onclick="handleDropZoneClick('under_table', event)" class="drop-zone" x="392" y="295" width="160" height="58" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 2: On the red chair -->
              <rect id="dz-on_chair" data-zone="on_chair" onclick="handleDropZoneClick('on_chair', event)" class="drop-zone" x="298" y="540" width="98" height="62" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 3: On the whiteboard -->
              <rect id="dz-on_whiteboard" data-zone="on_whiteboard" onclick="handleDropZoneClick('on_whiteboard', event)" class="drop-zone" x="392" y="88" width="190" height="112" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 4: In the brown toy box -->
              <rect id="dz-in_box" data-zone="in_box" onclick="handleDropZoneClick('in_box', event)" class="drop-zone" x="720" y="520" width="132" height="105" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 5: In front of the door -->
              <rect id="dz-in_front_of_door" data-zone="in_front_of_door" onclick="handleDropZoneClick('in_front_of_door', event)" class="drop-zone" x="28" y="370" width="110" height="88" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 6: On the table (next to laptop) -->
              <rect id="dz-on_table" data-zone="on_table" onclick="handleDropZoneClick('on_table', event)" class="drop-zone" x="405" y="218" width="105" height="56" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 7: Between the red chair and pink monster -->
              <rect id="dz-between_chair_monster" data-zone="between_chair_monster" onclick="handleDropZoneClick('between_chair_monster', event)" class="drop-zone" x="405" y="545" width="95" height="75" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
              <!-- Drop Zone 8: Next to the green monster -->
              <rect id="dz-next_to_green_monster" data-zone="next_to_green_monster" onclick="handleDropZoneClick('next_to_green_monster', event)" class="drop-zone" x="150" y="525" width="110" height="80" rx="14" fill="rgba(251, 191, 36, 0.28)" stroke="#D97706" stroke-width="3" stroke-dasharray="8 6" />
            </g>

            <!-- 14. LAYER FOR CARDS PLACED INTO THE SCENE -->
            <g id="placed-cards-layer"></g>
          </svg>
        </div>

        <!-- PART 3 BIG OBJECT CARDS STAGE (Replaces the Big Scene Picture when Part 3 is active) -->
        <div id="part3-big-stage" class="hidden relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-inner bg-gradient-to-br from-sky-50 via-indigo-50 to-amber-50 p-4 sm:p-6 flex flex-col justify-between">
          <!-- Populated dynamically by JS in Part 3 -->
        </div>

        <!-- Bottom Quick Legend under Scene Picture -->
        <div id="scene-footer-bar" class="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-600">
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span id="scene-status-bar">Interactive Scene Ready — Click any object or drag an Object Card onto the room!</span>
          </div>
          <div class="flex items-center gap-2 font-semibold text-indigo-700">
            <button id="btn-footer-book-art" onclick="toggleOriginalBookArt()" class="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold">
              🖼️ Toggle Original Book Picture
            </button>
            <span>Placed Cards: <strong id="placed-count">0</strong>/8</span>
          </div>
        </div>
      </div>

    </div>

    <!-- RIGHT COLUMN: INTERACTIVE CONTROLS, OBJECT CARDS TRAY, SPEECH / ANSWER BUILDER (4 cols on desktop) -->
    <div class="lg:col-span-4 flex flex-col gap-3.5">

      <!-- DYNAMIC ACTIVITY PANEL (Changes per Mode: Part 1A, Part 1B, Part 2, Part 3, Sandbox) -->
      <div id="activity-panel" class="bg-white rounded-3xl p-4 shadow-lg border-4 border-indigo-200 flex flex-col gap-3">
        <!-- Populated dynamically by JS -->
      </div>

      <!-- 8 TEST 1 OBJECT CARDS TRAY (Always accessible for Part 1B, Part 3, and Sandbox) -->
      <div id="object-cards-tray-container" class="bg-white rounded-3xl p-4 shadow-lg border-4 border-amber-300">
        <div class="flex items-center justify-between mb-2.5">
          <div>
            <h2 class="text-base sm:text-lg font-kid font-bold text-slate-900 flex items-center gap-1.5">
              <span>✂️</span> Test 1 Object Cards (8 Cards)
            </h2>
            <p id="cards-tray-subtitle" class="text-xs text-slate-500 font-medium">
              Drag any card onto the big picture or click to inspect!
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="openCardsSheetModal()" class="text-[11px] font-bold px-2 py-1 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 transition" title="View Original Cutout Sheet">
              📄 Sheet
            </button>
            <button onclick="resetAllPlacedCards()" class="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition">
              Reset
            </button>
          </div>
        </div>

        <!-- Grid of 8 Cutout Cards with Dashed Scissor Borders -->
        <div id="object-cards-grid" class="grid grid-cols-4 gap-2">
          <!-- Rendered by JS -->
        </div>
      </div>

      <!-- MICROPHONE & GUIDED SPOKEN ANSWER BOX -->
      <div id="speech-practice-box" class="bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-3xl p-4 shadow-lg border-4 border-indigo-400">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎙️</span>
            <div>
              <h3 class="font-kid font-bold text-sm sm:text-base leading-tight">Speak or Build Your Answer</h3>
              <p class="text-[11px] text-indigo-200">Practice speaking aloud or tap the answer chips!</p>
            </div>
          </div>
          <button onclick="toggleMicrophone()" id="btn-mic" class="px-3 py-1.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-kid font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95">
            <span id="mic-icon">🎤</span> <span id="mic-label">Speak Answer</span>
          </button>
        </div>

        <!-- Live Speech Transcript Display -->
        <div id="transcript-box" class="bg-indigo-950/80 border border-indigo-700 rounded-2xl p-2.5 text-xs sm:text-sm text-indigo-100 min-h-[42px] flex items-center justify-between gap-2 mb-2.5">
          <span id="transcript-text" class="italic text-indigo-300">Tap "Speak Answer" or click an answer phrase below...</span>
          <span id="speech-match-badge" class="hidden px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[10px] shrink-0">✓ GREAT!</span>
        </div>

        <!-- Clickable Model Answer Chips -->
        <div id="answer-chips-container" class="flex flex-wrap gap-1.5">
          <!-- Populated dynamically per question -->
        </div>
      </div>

    </div>
  </main>

  <!-- ORIGINAL 8 OBJECT CARDS CUTOUT SHEET MODAL (/assets/aistudio/image_091c3f75.png) -->
  <div id="cards-sheet-modal" class="hidden fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4" onclick="closeCardsSheetModal()">
    <div class="bg-white rounded-3xl max-w-2xl w-full p-5 shadow-2xl border-4 border-indigo-300 relative" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between mb-3">
        <div>
          <span class="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Cambridge Pre-A1 Starters • Test 1</span>
          <h3 class="text-lg font-kid font-bold text-slate-900 mt-0.5">Official 8 Object Cards Cutout Sheet & Scene Reference</h3>
        </div>
        <button onclick="closeCardsSheetModal()" class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">✕</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center max-h-[75vh] overflow-y-auto p-1">
        <div class="bg-slate-50 p-2 rounded-2xl border border-slate-200 text-center">
          <div class="text-xs font-bold text-slate-600 mb-1.5">✂️ Test 1 Object Cards (8 Cutouts)</div>
          <img src="/assets/aistudio/image_091c3f75.png" alt="Test 1 Object Cards" class="w-full rounded-xl border border-slate-300 shadow-sm mx-auto" />
        </div>
        <div class="bg-slate-50 p-2 rounded-2xl border border-slate-200 text-center">
          <div class="text-xs font-bold text-slate-600 mb-1.5">🖼️ Monster Art Class Scene</div>
          <img src="/assets/aistudio/image_7db17f83.png" alt="Monster Art Class Scene" class="w-full rounded-xl border border-slate-300 shadow-sm mx-auto" />
        </div>
      </div>
    </div>
  </div>

  <!-- CAMBRIDGE 5-SHIELD CERTIFICATE MODAL -->
  <div id="certificate-modal" class="hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-8 border-amber-400 text-center relative animate-bounce-once">
      <button onclick="closeCertificateModal()" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">✕</button>
      <div class="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-4xl shadow-lg border-4 border-amber-200 mb-3">
        🏆
      </div>
      <span class="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-100 text-indigo-800">Cambridge English • Pre-A1 Starters</span>
      <h2 class="text-2xl sm:text-3xl font-kid font-bold text-slate-900 mt-2">Speaking Test Star Certificate!</h2>
      <p class="text-sm text-slate-600 mt-1">Monster Art Class — Official Speaking Practice Report</p>

      <!-- Shields & Score Box -->
      <div class="my-5 bg-gradient-to-r from-indigo-50 via-amber-50 to-indigo-50 p-4 rounded-2xl border-2 border-indigo-200">
        <div class="text-xs font-bold uppercase text-slate-500 mb-2">Cambridge Speaking Shields</div>
        <div id="modal-shields" class="flex justify-center gap-2 text-3xl mb-3"></div>
        <div class="text-2xl font-kid font-bold text-indigo-900">
          Total Score: <span id="modal-score" class="text-amber-600">0</span> ⭐ Points
        </div>
      </div>

      <!-- Breakdown -->
      <div class="grid grid-cols-2 gap-2 text-left text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-5">
        <div>✅ <strong>Part 1A (Pointing):</strong> Where is / Where are</div>
        <div>✅ <strong>Part 1B (Prepositions):</strong> Put the card on/under/in</div>
        <div>✅ <strong>Part 2 (Scene Q&A):</strong> Tell me about the monster</div>
        <div>✅ <strong>Part 3 (Object Cards):</strong> Have you got / Do you like</div>
      </div>

      <div class="flex items-center justify-center gap-3">
        <button onclick="celebrateWithConfetti(); playFanfare();" class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-kid font-bold shadow-lg transition">
          🎉 Celebrate Again!
        </button>
        <button onclick="closeCertificateModal()" class="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-kid font-bold shadow-lg transition">
          Keep Practicing
        </button>
      </div>
    </div>
  </div>

  <!-- APPLICATION JAVASCRIPT -->
  <script>
    const OBJECT_CARDS = [
      {
        id: 'frog',
        name: 'frog',
        article: 'a frog',
        isPlural: false,
        colorText: 'green and yellow',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <ellipse cx="22" cy="64" rx="14" ry="9" transform="rotate(25 22 64)" fill="#84CC16" />
            <ellipse cx="78" cy="64" rx="14" ry="9" transform="rotate(-25 78 64)" fill="#84CC16" />
            <ellipse cx="50" cy="58" rx="26" ry="22" fill="#A3E635" stroke="#65A30D" stroke-width="2" />
            <ellipse cx="50" cy="63" rx="16" ry="14" fill="#FDE047" />
            <ellipse cx="50" cy="36" rx="24" ry="16" fill="#A3E635" stroke="#65A30D" stroke-width="2" />
            <circle cx="37" cy="22" r="8" fill="#A3E635" stroke="#65A30D" stroke-width="1.5" />
            <circle cx="63" cy="22" r="8" fill="#A3E635" stroke="#65A30D" stroke-width="1.5" />
            <circle cx="37" cy="22" r="4.5" fill="#1E293B" />
            <circle cx="63" cy="22" r="4.5" fill="#1E293B" />
            <circle cx="35.5" cy="20.5" r="1.5" fill="#FFFFFF" />
            <circle cx="61.5" cy="20.5" r="1.5" fill="#FFFFFF" />
            <path d="M38,40 Q52,48 66,38 Q56,49 38,40 Z" fill="#DC2626" stroke="#991B1B" stroke-width="1.5" />
            <circle cx="32" cy="52" r="2.2" fill="#4D7C0F" />
            <circle cx="28" cy="60" r="2" fill="#4D7C0F" />
            <circle cx="68" cy="54" r="2.2" fill="#4D7C0F" />
            <path d="M32,68 L28,82 M68,68 L72,82" stroke="#84CC16" stroke-width="6" stroke-linecap="round" />
            <circle cx="23" cy="83" r="2.5" fill="#4D7C0F" />
            <circle cx="29" cy="85" r="2.5" fill="#4D7C0F" />
            <circle cx="35" cy="84" r="2.5" fill="#4D7C0F" />
            <circle cx="65" cy="84" r="2.5" fill="#4D7C0F" />
            <circle cx="71" cy="85" r="2.5" fill="#4D7C0F" />
            <circle cx="77" cy="83" r="2.5" fill="#4D7C0F" />
          </svg>\`
      },
      {
        id: 'board_game',
        name: 'board game',
        article: 'a board game',
        isPlural: false,
        colorText: 'pink, white and brown',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <rect x="8" y="24" width="84" height="52" fill="#FFFFFF" stroke="#1E293B" stroke-width="2.5" />
            <rect x="8" y="24" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="20" y="24" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="32" y="24" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="44" y="24" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="56" y="24" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="68" y="24" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="80" y="24" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="8" y="66" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="20" y="66" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="32" y="66" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="44" y="66" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="56" y="66" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="68" y="66" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="80" y="66" width="12" height="10" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="8" y="34" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="8" y="44" width="12" height="11" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="8" y="55" width="12" height="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="80" y="34" width="12" height="10" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <rect x="80" y="44" width="12" height="11" fill="#F472B6" stroke="#1E293B" stroke-width="1" />
            <rect x="80" y="55" width="12" height="11" fill="#FFFFFF" stroke="#1E293B" stroke-width="1" />
            <g stroke="#78350F" stroke-width="2">
              <line x1="14" y1="50" x2="34" y2="28" /><line x1="18" y1="53" x2="38" y2="31" />
              <line x1="47" y1="34" x2="47" y2="66" /><line x1="53" y1="34" x2="53" y2="66" />
              <line x1="47" y1="42" x2="53" y2="42" /><line x1="47" y1="50" x2="53" y2="50" /><line x1="47" y1="58" x2="53" y2="58" />
              <line x1="64" y1="68" x2="84" y2="48" /><line x1="68" y1="71" x2="88" y2="51" />
            </g>
          </svg>\`
      },
      {
        id: 'trousers',
        name: 'trousers',
        article: 'trousers',
        isPlural: true,
        colorText: 'black (or dark blue)',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <polygon points="32,12 68,12 74,88 56,88 50,36 44,88 26,88" fill="#1E293B" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round" />
            <line x1="32" y1="18" x2="68" y2="18" stroke="#334155" stroke-width="2" />
            <circle cx="50" cy="15" r="2" fill="#94A3B8" />
          </svg>\`
      },
      {
        id: 'train',
        name: 'train',
        article: 'a train',
        isPlural: false,
        colorText: 'red, blue and yellow',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <line x1="6" y1="68" x2="94" y2="68" stroke="#D97706" stroke-width="2.5" />
            <polygon points="10,62 15,54 15,62" fill="#0284C7" />
            <rect x="15" y="48" width="16" height="14" fill="#EF4444" stroke="#1E293B" stroke-width="1.2" />
            <rect x="27" y="42" width="12" height="20" fill="#0284C7" stroke="#1E293B" stroke-width="1.2" />
            <rect x="30" y="45" width="6" height="6" fill="#E0F2FE" />
            <rect x="18" y="40" width="4" height="8" fill="#FACC15" stroke="#1E293B" stroke-width="1" />
            <rect x="43" y="44" width="22" height="18" fill="#EF4444" stroke="#1E293B" stroke-width="1.2" />
            <rect x="46" y="47" width="4" height="5" fill="#E0F2FE" />
            <rect x="52" y="47" width="4" height="5" fill="#E0F2FE" />
            <rect x="58" y="47" width="4" height="5" fill="#E0F2FE" />
            <rect x="69" y="44" width="22" height="18" fill="#0284C7" stroke="#1E293B" stroke-width="1.2" />
            <rect x="72" y="47" width="4" height="5" fill="#FDE047" />
            <rect x="78" y="47" width="4" height="5" fill="#FDE047" />
            <rect x="84" y="47" width="4" height="5" fill="#FDE047" />
            <line x1="39" y1="58" x2="43" y2="58" stroke="#1E293B" stroke-width="2.5" />
            <line x1="65" y1="58" x2="69" y2="58" stroke="#1E293B" stroke-width="2.5" />
            <circle cx="20" cy="64" r="4" fill="#FACC15" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="32" cy="64" r="4" fill="#FACC15" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="48" cy="64" r="3.5" fill="#EF4444" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="60" cy="64" r="3.5" fill="#EF4444" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="74" cy="64" r="3.5" fill="#0284C7" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="86" cy="64" r="3.5" fill="#0284C7" stroke="#1E293B" stroke-width="1.5" />
          </svg>\`
      },
      {
        id: 'book',
        name: 'book',
        article: 'a book',
        isPlural: false,
        colorText: 'brown (or gold)',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <polygon points="18,28 62,16 86,66 38,84" fill="#78350F" stroke="#451A03" stroke-width="2" />
            <polygon points="36,80 84,62 86,67 38,85" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.5" />
            <polygon points="16,24 62,12 84,60 36,78" fill="#B4822C" stroke="#78350F" stroke-width="2" />
            <polygon points="16,24 24,22 44,75 36,78" fill="#92400E" />
            <polygon points="16,24 18,29 38,84 36,78" fill="#78350F" />
          </svg>\`
      },
      {
        id: 'lorry',
        name: 'lorry',
        article: 'a lorry (or truck)',
        isPlural: false,
        colorText: 'red and black',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <rect x="36" y="34" width="56" height="26" fill="#EF4444" stroke="#991B1B" stroke-width="2" />
            <polygon points="10,50 18,50 22,38 33,38 33,60 10,60" fill="#EF4444" stroke="#991B1B" stroke-width="2" />
            <polygon points="20,48 23,40 30,40 30,48" fill="#1E293B" />
            <rect x="10" y="59" width="82" height="4" fill="#334155" />
            <circle cx="20" cy="65" r="5.5" fill="#1E293B" /><circle cx="20" cy="65" r="2.5" fill="#E2E8F0" />
            <circle cx="42" cy="65" r="5.5" fill="#1E293B" /><circle cx="42" cy="65" r="2.5" fill="#E2E8F0" />
            <circle cx="54" cy="65" r="5.5" fill="#1E293B" /><circle cx="54" cy="65" r="2.5" fill="#E2E8F0" />
            <circle cx="74" cy="65" r="5.5" fill="#1E293B" /><circle cx="74" cy="65" r="2.5" fill="#E2E8F0" />
            <circle cx="85" cy="65" r="5.5" fill="#1E293B" /><circle cx="85" cy="65" r="2.5" fill="#E2E8F0" />
          </svg>\`
      },
      {
        id: 'shorts',
        name: 'shorts',
        article: 'shorts',
        isPlural: true,
        colorText: 'light blue',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <polygon points="22,18 78,18 86,78 55,78 50,48 45,78 14,78" fill="#7DD3FC" stroke="#0284C7" stroke-width="2.5" stroke-linejoin="round" />
            <rect x="22" y="18" width="56" height="7" fill="#0284C7" />
            <rect x="32" y="17" width="3" height="9" fill="#E0F2FE" />
            <rect x="50" y="17" width="3" height="9" fill="#E0F2FE" />
            <rect x="66" y="17" width="3" height="9" fill="#E0F2FE" />
            <path d="M22,34 Q32,34 34,25" stroke="#0369A1" stroke-width="2" fill="none" />
            <path d="M78,34 Q68,34 66,25" stroke="#0369A1" stroke-width="2" fill="none" />
            <line x1="50" y1="25" x2="50" y2="44" stroke="#0369A1" stroke-width="2" />
          </svg>\`
      },
      {
        id: 'fish',
        name: 'fish',
        article: 'a fish',
        isPlural: false,
        colorText: 'orange, brown and yellow',
        svg: \`
          <svg viewBox="0 0 100 100" class="w-full h-full">
            <rect x="6" y="6" width="88" height="88" rx="8" fill="#A5F3FC" />
            <path d="M35,38 Q52,18 68,22 Q58,32 58,40 Z" fill="#9A3412" />
            <path d="M44,64 Q52,74 62,72 Q54,65 54,60 Z" fill="#9A3412" />
            <path d="M66,52 C74,34 90,34 90,56 C90,72 88,80 94,84 C80,82 74,66 66,52 Z" fill="#9A3412" />
            <path d="M10,52 C22,30 52,32 68,52 C52,70 22,70 10,52 Z" fill="#F97316" stroke="#C2410C" stroke-width="1.5" />
            <circle cx="42" cy="46" r="2.2" fill="#FDE047" />
            <circle cx="50" cy="44" r="2.2" fill="#FDE047" />
            <circle cx="46" cy="53" r="2.2" fill="#FDE047" />
            <circle cx="55" cy="52" r="2.2" fill="#FDE047" />
            <circle cx="40" cy="58" r="2.2" fill="#FDE047" />
            <circle cx="52" cy="59" r="2.2" fill="#FDE047" />
            <circle cx="24" cy="49" r="7" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.5" />
            <circle cx="24" cy="49" r="4" fill="#1E293B" />
            <path d="M34,40 Q39,52 34,62" stroke="#9A3412" stroke-width="2" fill="none" />
          </svg>\`
      }
    ];

    const PART1A_TASKS = [
      {
        prompt: "Look at the picture. Where's the ball?",
        answer: "The ball is under the red chair.",
        subHint: "Point to the black and white football in the picture.",
        targets: ['ball'],
        successLabel: "The ball is under the red chair.",
        chips: ["The ball is under the red chair.", "It's under the red chair.", "Here it is!"]
      },
      {
        prompt: "Where's the computer?",
        answer: "The computer is on the brown table.",
        subHint: "Point to the laptop computer in the classroom.",
        targets: ['laptop'],
        successLabel: "The computer is on the brown table.",
        chips: ["The computer is on the brown table.", "It's on the table.", "Here it is!"]
      },
      {
        prompt: "Where's the camera?",
        answer: "The camera is in the monster's hands.",
        subHint: "Point to the black camera.",
        targets: ['camera', 'camera_monster'],
        successLabel: "The camera is in the monster's hands.",
        chips: ["The camera is in the monster's hands.", "The monster is holding it.", "Here it is!"]
      },
      {
        prompt: "Where's the grey cat?",
        answer: "The grey cat is sleeping under the table.",
        subHint: "Find the sleeping cat in the room.",
        targets: ['gray_cat'],
        successLabel: "The grey cat is sleeping under the table.",
        chips: ["The grey cat is sleeping under the table.", "It's under the table.", "Here it is!"]
      },
      {
        prompt: "Where is the clock?",
        answer: "The clock is on the wall.",
        subHint: "Look up high on the wall and point to the clock!",
        targets: ['clock'],
        successLabel: "The clock is on the wall.",
        chips: ["The clock is on the wall.", "It's on the wall.", "Here it is!"]
      },
      {
        prompt: "Where is the board?",
        answer: "The board is between the pictures.",
        subHint: "Point to the board between the two pictures on the wall.",
        targets: ['whiteboard'],
        successLabel: "The board is between the pictures.",
        chips: ["The board is between the pictures.", "It's between the pictures.", "Here it is!"]
      },
      {
        prompt: "Where are the toys?",
        answer: "The toys are in the toy box.",
        subHint: "Point to the toys in the toy box in the bottom right corner.",
        targets: ['box'],
        successLabel: "The toys are in the toy box.",
        chips: ["The toys are in the toy box.", "They are in the toy box.", "Here they are!"]
      },
      {
        prompt: "Where is the brown hat?",
        answer: "The brown hat is on the green monster's head.",
        subHint: "Point to the brown hat on the green monster's head!",
        targets: ['brown_hat', 'green_monster'],
        successLabel: "The brown hat is on the green monster's head.",
        chips: ["The brown hat is on the green monster's head.", "It's on the green monster's head.", "Here it is!"]
      }
    ];

    const PART1B_TASKS = [
      {
        selectPrompt: "Which is the book?",
        placePrompt: "Put the book under the table.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the book UNDER the table!",
        cardId: 'book',
        zoneId: 'under_table',
        zoneCoords: { x: 410, y: 292 },
        successLabel: "Well done! You put the book under the table!",
        selectChips: ["This is the book.", "Here is the book."],
        placeChips: ["I'm putting the book under the table.", "The book is under the table."]
      },
      {
        selectPrompt: "Which is the frog?",
        placePrompt: "Put the frog on the red chair.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the frog ON the red chair!",
        cardId: 'frog',
        zoneId: 'on_chair',
        zoneCoords: { x: 315, y: 536 },
        successLabel: "Super! The green frog is sitting on the red chair!",
        selectChips: ["This is the frog.", "Here is the frog."],
        placeChips: ["The frog is on the red chair.", "It's on the chair."]
      },
      {
        selectPrompt: "Which is the fish?",
        placePrompt: "Put the fish on the whiteboard.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the fish ON the whiteboard!",
        cardId: 'fish',
        zoneId: 'on_whiteboard',
        zoneCoords: { x: 515, y: 110 },
        successLabel: "Great! The fish is on the whiteboard!",
        selectChips: ["This is the fish.", "Here is the fish."],
        placeChips: ["The fish is on the whiteboard.", "It's on the board."]
      },
      {
        selectPrompt: "Which is the train?",
        placePrompt: "Put the train in the brown box.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the train IN the brown box!",
        cardId: 'train',
        zoneId: 'in_box',
        zoneCoords: { x: 755, y: 555 },
        successLabel: "Awesome! The toy train is in the brown box!",
        selectChips: ["This is the train.", "Here is the train."],
        placeChips: ["The train is in the box.", "It's in the toy box."]
      },
      {
        selectPrompt: "Which is the lorry?",
        placePrompt: "Put the lorry in front of the door.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the lorry IN FRONT OF the door!",
        cardId: 'lorry',
        zoneId: 'in_front_of_door',
        zoneCoords: { x: 52, y: 382 },
        successLabel: "Fantastic! The red lorry is in front of the door!",
        selectChips: ["This is the lorry.", "Here is the lorry."],
        placeChips: ["The lorry is in front of the door.", "It's by the door."]
      },
      {
        selectPrompt: "Which are the shorts?",
        placePrompt: "Put the shorts on the table, next to the computer.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the shorts ON the table!",
        cardId: 'shorts',
        zoneId: 'on_table',
        zoneCoords: { x: 425, y: 215 },
        successLabel: "Brilliant! The shorts are on the table next to the laptop!",
        selectChips: ["These are the shorts.", "Here are the shorts."],
        placeChips: ["They are on the table.", "They're next to the computer."]
      },
      {
        selectPrompt: "Which are the trousers?",
        placePrompt: "Put the trousers between the red chair and the pink monster.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the trousers BETWEEN the chair and the pink monster!",
        cardId: 'trousers',
        zoneId: 'between_chair_monster',
        zoneCoords: { x: 420, y: 548 },
        successLabel: "Amazing! The trousers are between the chair and the pink monster!",
        selectChips: ["These are the trousers.", "Here are the trousers."],
        placeChips: ["They are between the chair and the monster."]
      },
      {
        selectPrompt: "Which is the board game?",
        placePrompt: "Put the board game next to the green monster.",
        selectSubHint: "Step 1: Click or tap the right object card from the 8 cards!",
        placeSubHint: "Step 2: Now drag the card (or click the glowing spot) to put the board game NEXT TO the green monster!",
        cardId: 'board_game',
        zoneId: 'next_to_green_monster',
        zoneCoords: { x: 168, y: 530 },
        successLabel: "Hooray! You placed all 8 Object Cards correctly!",
        selectChips: ["This is the board game.", "Here is the board game."],
        placeChips: ["It's next to the green monster."]
      }
    ];

    const PART2_QUESTIONS = [
      {
        title: "Q1. What's this?",
        spotlightId: 'laptop',
        prompt: "Look at this on the table. What's this?",
        subHint: "Wait for the student's answer, then click Next Question!",
        keywords: ['computer', 'laptop'],
        chips: [
          "It's a computer.",
          "It's a laptop."
        ]
      },
      {
        title: "Q2. What colour?",
        spotlightId: 'laptop',
        prompt: "What colour is it?",
        subHint: "Look at the computer on the table. Wait for the answer, then click Next!",
        keywords: ['grey', 'blue', 'silver', 'white', 'black'],
        chips: [
          "It's grey and blue.",
          "Blue and grey."
        ]
      },
      {
        title: "Q3. Where is it?",
        spotlightId: 'laptop',
        prompt: "Where is it?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['table', 'on', 'brown'],
        chips: [
          "It's on the brown table.",
          "On the table."
        ]
      },
      {
        title: "Q4. What are these?",
        spotlightId: 'left_picture',
        secondarySpotlightId: 'right_picture',
        prompt: "Look at the wall. What are these?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['picture', 'painting', 'pictures', 'paintings'],
        chips: [
          "They're pictures.",
          "They're paintings."
        ]
      },
      {
        title: "Q5. How many?",
        spotlightId: 'left_picture',
        secondarySpotlightId: 'right_picture',
        prompt: "How many pictures are there on the wall?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['two', '2'],
        chips: [
          "There are two pictures.",
          "Two."
        ]
      },
      {
        title: "Q6. Ball colour?",
        spotlightId: 'ball',
        prompt: "Look at the ball. What colour is it?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['black', 'white'],
        chips: [
          "It's black and white.",
          "Black and white."
        ]
      },
      {
        title: "Q7. Where is the ball?",
        spotlightId: 'ball',
        prompt: "Where is the ball?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['under', 'chair', 'red'],
        chips: [
          "It's under the red chair.",
          "Under the chair."
        ]
      },
      {
        title: "Q8. Monster doing?",
        spotlightId: 'camera_monster',
        prompt: "Look at this monster in the green dress. What is she doing?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['photo', 'camera', 'picture', 'taking'],
        chips: [
          "She's taking a photo.",
          "She's holding a camera."
        ]
      },
      {
        title: "Q9. Wearing?",
        spotlightId: 'camera_monster',
        prompt: "What is she wearing?",
        subHint: "Wait for the student's answer, then click Next!",
        keywords: ['green', 'dress', 'flowers'],
        chips: [
          "She's wearing a green dress.",
          "A green dress with flowers."
        ]
      },
      {
        title: "Q10. ⭐ Green Monster",
        spotlightId: 'green_monster',
        isMonsterBuilder: true,
        monsterKey: 'green',
        prompt: "Tell me about this green monster.",
        subHint: "Wait for the student to describe the green monster, then click Next!",
        keywords: ['green', 'hat', 'red', 'blue', 'four', 'arms', 'painting', 'house', 'happy'],
        chips: [
          "He is green and happy.",
          "He is wearing a brown hat, a red T-shirt and blue trousers.",
          "He is painting a picture of a house."
        ]
      },
      {
        title: "Q11. ⭐ Pink Monster",
        spotlightId: 'pink_monster',
        isMonsterBuilder: true,
        monsterKey: 'pink',
        prompt: "Tell me about this pink monster.",
        subHint: "Wait for the student to describe the pink monster, then click Next!",
        keywords: ['pink', 'triangle', 'sad', 'four', 'legs', 'red', 'shoes', 'painting', 'cat'],
        chips: [
          "It is pink and looks sad.",
          "It has got four blue legs and red shoes.",
          "It is painting a blue cat."
        ]
      },
      {
        title: "Q12. ⭐ Blue Monster",
        spotlightId: 'blue_monster',
        isMonsterBuilder: true,
        monsterKey: 'blue',
        prompt: "Tell me about this blue monster.",
        subHint: "Wait for the student to describe the blue monster!",
        keywords: ['blue', 'round', 'black', 'hair', 'four', 'arms', 'happy', 'painting', 'monster'],
        chips: [
          "She is blue and round.",
          "She has got black hair and four arms.",
          "She is painting a picture of her friend."
        ]
      }
    ];

    const PART3_QUESTIONS = [
      {
        cardId: 'fish',
        steps: [
          { q: "What's this?", a: ["It's a fish.", "A fish."], keywords: ['fish'] },
          { q: "What colour is it?", a: ["It's orange and brown.", "It's orange with yellow spots."], keywords: ['orange', 'brown', 'yellow'] },
          { q: "Have you got a fish at home?", a: ["Yes, I have!", "No, I haven't."], keywords: ['yes', 'no', 'have', 'fish'] },
          { q: "Do you like fish?", a: ["Yes, I like fish!", "No, I don't."], keywords: ['yes', 'no', 'like', 'fish'] }
        ]
      },
      {
        cardId: 'frog',
        steps: [
          { q: "What's this?", a: ["It's a frog.", "A frog."], keywords: ['frog'] },
          { q: "What colour is the frog?", a: ["It's green and yellow.", "Green with a yellow tummy."], keywords: ['green', 'yellow'] },
          { q: "Do you like frogs?", a: ["Yes, I do!", "No, I don't."], keywords: ['yes', 'no', 'like'] },
          { q: "Can frogs jump?", a: ["Yes, they can!", "Yes, frogs can jump very high!"], keywords: ['yes', 'jump', 'can'] }
        ]
      },
      {
        cardId: 'book',
        steps: [
          { q: "What's this?", a: ["It's a book.", "A brown book."], keywords: ['book'] },
          { q: "What colour is it?", a: ["It's brown.", "Brown and white."], keywords: ['brown', 'gold', 'white'] },
          { q: "Have you got lots of books?", a: ["Yes, I have!", "No, I haven't."], keywords: ['yes', 'no', 'have', 'books'] },
          { q: "Where do you read your books?", a: ["In my bedroom.", "At school.", "In the living room."], keywords: ['bedroom', 'school', 'home', 'bed', 'living', 'room'] }
        ]
      },
      {
        cardId: 'train',
        steps: [
          { q: "What's this?", a: ["It's a train.", "It's a toy train."], keywords: ['train'] },
          { q: "What colour is it?", a: ["It's red, blue and yellow."], keywords: ['red', 'blue', 'yellow'] },
          { q: "Have you got a toy train?", a: ["Yes, I have!", "No, I haven't."], keywords: ['yes', 'no', 'have', 'train'] },
          { q: "Do you like riding on trains?", a: ["Yes, I do!", "Yes, I love trains!"], keywords: ['yes', 'no', 'like', 'train'] }
        ]
      },
      {
        cardId: 'lorry',
        steps: [
          { q: "What's this?", a: ["It's a lorry.", "It's a truck."], keywords: ['lorry', 'truck'] },
          { q: "What colour is it?", a: ["It's red and black."], keywords: ['red', 'black'] },
          { q: "Is it big or small?", a: ["It's big.", "It's a big red lorry."], keywords: ['big', 'small'] },
          { q: "How many wheels has this lorry got?", a: ["It has got six wheels.", "Five / Six wheels."], keywords: ['five', 'six', 'wheels'] }
        ]
      },
      {
        cardId: 'trousers',
        steps: [
          { q: "What are these?", a: ["They're trousers.", "They are pants."], keywords: ['trousers', 'pants', 'they'] },
          { q: "What colour are they?", a: ["They're black.", "They're dark blue."], keywords: ['black', 'blue', 'dark'] },
          { q: "Are you wearing trousers today?", a: ["Yes, I am!", "No, I'm not."], keywords: ['yes', 'no', 'wearing', 'am'] }
        ]
      },
      {
        cardId: 'shorts',
        steps: [
          { q: "What are these?", a: ["They're shorts."], keywords: ['shorts', 'they'] },
          { q: "What colour are they?", a: ["They're light blue.", "They're blue."], keywords: ['blue', 'light'] },
          { q: "Have you got blue shorts?", a: ["Yes, I have!", "No, I haven't."], keywords: ['yes', 'no', 'have'] },
          { q: "When do you wear shorts?", a: ["In summer.", "When it's sunny and hot."], keywords: ['summer', 'hot', 'sunny'] }
        ]
      },
      {
        cardId: 'board_game',
        steps: [
          { q: "What's this?", a: ["It's a board game.", "It's a game."], keywords: ['game', 'board'] },
          { q: "What colour is it?", a: ["It's pink and white."], keywords: ['pink', 'white', 'brown'] },
          { q: "Do you like playing board games?", a: ["Yes, I do!", "No, I don't."], keywords: ['yes', 'no', 'like'] },
          { q: "Who do you play with?", a: ["With my friends.", "With my family."], keywords: ['friends', 'family', 'mum', 'dad', 'brother', 'sister'] }
        ]
      }
    ];

    const SCENE_ITEM_LABELS = {
      ball: { name: "the ball (football)", sentence: "It's a black and white football under the red chair." },
      laptop: { name: "the computer / laptop", sentence: "It's a laptop computer on the brown table." },
      camera: { name: "the camera", sentence: "It's a black camera." },
      camera_monster: { name: "the monster in the green dress", sentence: "She has pink hair and is taking a photo with a camera." },
      clock: { name: "the clock", sentence: "The clock is on the wall." },
      gray_cat: { name: "the grey cat", sentence: "The grey cat is sleeping under the brown table." },
      left_picture: { name: "the palm tree picture", sentence: "It's a painting of a pink palm tree on the wall." },
      right_picture: { name: "the animals picture", sentence: "It's a painting of animals and a bird on the wall." },
      whiteboard: { name: "the board", sentence: "The board is between the pictures." },
      table: { name: "the brown table", sentence: "The laptop is on the table and the cat is under the table." },
      door: { name: "the brown door", sentence: "There is a tall brown door on the left wall." },
      left_easel: { name: "the house painting", sentence: "The green monster is painting a house with three chimneys." },
      brown_hat: { name: "the brown hat", sentence: "The brown hat is on the green monster's head." },
      green_monster: { name: "the green monster", sentence: "He has four arms, a brown hat, a red shirt and blue trousers." },
      chair: { name: "the red chair", sentence: "The red chair is in front of the easels." },
      center_easel: { name: "the blue cat painting", sentence: "It's a painting of a blue cat drinking milk." },
      pink_monster: { name: "the pink triangle monster", sentence: "It is pink, has four legs, and looks sad." },
      right_easel: { name: "the monster portrait", sentence: "It's a painting of a smiling blue monster." },
      blue_monster: { name: "the blue monster", sentence: "She is round, blue, has four arms, and is holding paints." },
      box: { name: "the toys / toy box", sentence: "The toys are in the toy box." }
    };

    let currentMode = 'part1a';
    let score = 0;
    let p1aIndex = 0;
    let p1bIndex = 0;
    let p1bStep = 'select'; // 'select' ("Which is the book?") -> 'place' ("Put the book under the table.")
    let p2Index = 0;
    let p3CardIndex = 0;
    let p3StepIndex = 0;
    let p3ShowAllGrid = false;
    let pairTalkMode = false;
    let useOriginalBookArt = false;

    let placedCards = {};
    let cardPersonalTags = {};
    OBJECT_CARDS.forEach(c => { cardPersonalTags[c.id] = { have: false, like: false }; });

    let soundMuted = false;
    let speechRate = 0.9;
    let showDropZonesHint = false;

    function toggleOriginalBookArt() {
      useOriginalBookArt = !useOriginalBookArt;
      const img = document.getElementById('original-book-art-img');
      const svg = document.getElementById('monster-art-scene');
      const btn = document.getElementById('btn-book-art');
      if (useOriginalBookArt) {
        if (img) img.classList.remove('hidden');
        if (svg) svg.classList.add('book-art-active');
        if (btn) btn.textContent = '🖼️ Scene: Original Book Art (Switch to Vector)';
        showSceneToast('Showing Original Textbook Monster Art Class Illustration!', '🖼️');
      } else {
        if (img) img.classList.add('hidden');
        if (svg) svg.classList.remove('book-art-active');
        if (btn) btn.textContent = '🖼️ Scene: Vector HD (Switch to Book Art)';
        showSceneToast('Showing Interactive High-Definition Vector Scene!', '🎨');
      }
      playChime('pop');
    }

    function openCardsSheetModal() {
      document.getElementById('cards-sheet-modal').classList.remove('hidden');
      playChime('pop');
    }

    function closeCardsSheetModal() {
      document.getElementById('cards-sheet-modal').classList.add('hidden');
    }

    let audioCtx = null;
    function getAudioCtx() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playChime(type = 'success') {
      if (soundMuted) return;
      try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        if (type === 'success') {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0.18, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.36);
          });
        } else if (type === 'pop') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.11);
        } else if (type === 'wrong') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.linearRampToValueAtTime(165, now + 0.22);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.26);
        }
      } catch (e) {}
    }

    function playFanfare() {
      if (soundMuted) return;
      try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        chord.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.2, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.7);
        });
      } catch (e) {}
    }

    function speakText(text) {
      if (soundMuted || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-GB';
        utter.rate = speechRate;
        utter.pitch = 1.08;

        const mouth = document.getElementById('examiner-mouth');
        const badge = document.getElementById('speaking-badge');

        utter.onstart = () => {
          if (mouth) mouth.classList.add('mouth-talking');
          if (badge) badge.classList.remove('hidden');
        };
        utter.onend = () => {
          if (mouth) mouth.classList.remove('mouth-talking');
          if (badge) badge.classList.add('hidden');
        };
        utter.onerror = () => {
          if (mouth) mouth.classList.remove('mouth-talking');
          if (badge) badge.classList.add('hidden');
        };

        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }

    function repeatPromptAudio() {
      const promptEl = document.getElementById('examiner-prompt-text');
      if (promptEl) {
        const clean = promptEl.textContent.replace(/"/g, '');
        speakText(clean);
      }
    }

    function toggleSpeechRate() {
      speechRate = speechRate === 0.9 ? 0.75 : (speechRate === 0.75 ? 1.05 : 0.9);
      const label = speechRate === 0.75 ? '🐢 Speed: Slow (0.75x)' : (speechRate === 1.05 ? '🐇 Speed: Fast (1.05x)' : '🐢 Speed: Normal (0.9x)');
      document.getElementById('btn-speech-rate').textContent = label;
      playChime('pop');
    }

    function toggleMute() {
      soundMuted = !soundMuted;
      document.getElementById('btn-mute').textContent = soundMuted ? '🔕 Sound: MUTED' : '🔔 Sound: ON';
      if (soundMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function toggleDropZonesHint() {
      showDropZonesHint = !showDropZonesHint;
      document.getElementById('btn-drop-hint').textContent = showDropZonesHint ? '🎯 Show Drop Zones: ON' : '🎯 Show Drop Zones: OFF';
      updateDropZonesVisibility();
    }

    function updateDropZonesVisibility() {
      const shouldShowZones = showDropZonesHint || (currentMode === 'part1b' && p1bStep === 'place');
      const shouldMakeClickable = currentMode === 'part1b' && p1bStep === 'place';
      document.querySelectorAll('.drop-zone').forEach(dz => {
        if (shouldShowZones) {
          dz.classList.add('show-hint');
        } else {
          dz.classList.remove('show-hint');
        }
        if (shouldMakeClickable) {
          dz.classList.add('clickable-zone');
        } else {
          dz.classList.remove('clickable-zone');
        }
      });
    }

    function addPoints(pts, toastMessage = null) {
      score += pts;
      const scoreEl = document.getElementById('score-display');
      scoreEl.textContent = score;
      scoreEl.parentElement.classList.add('scale-110');
      setTimeout(() => scoreEl.parentElement.classList.remove('scale-110'), 250);

      renderShields();
      playChime('success');
      if (toastMessage) showSceneToast(toastMessage, '🌟');
    }

    function teacherAwardStar() {
      addPoints(15, "Great speaking! Teacher awarded +15 Star Points!");
      celebrateWithConfetti(25);
    }

    function renderShields() {
      const thresholds = [20, 50, 90, 140, 200];
      const container = document.getElementById('shields-container');
      const modalShields = document.getElementById('modal-shields');
      let html = '';
      let modalHtml = '';

      thresholds.forEach((t, idx) => {
        const earned = score >= t;
        html += \`
          <svg class="w-5 h-6 transition-transform duration-300 \${earned ? 'scale-110 drop-shadow' : 'opacity-30 grayscale'}" viewBox="0 0 24 28">
            <path d="M12,2 L22,6 L22,14 C22,20.5 12,26 12,26 C12,26 2,20.5 2,14 L2,6 Z"
                  fill="\${earned ? '#F59E0B' : '#94A3B8'}" stroke="\${earned ? '#B45309' : '#64748B'}" stroke-width="2"/>
            <text x="12" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="#FFFFFF">\${idx + 1}</text>
          </svg>\`;
        modalHtml += \`<span class="\${earned ? '' : 'opacity-25 grayscale'}">🛡️</span>\`;
      });

      if (container) container.innerHTML = html;
      if (modalShields) modalShields.innerHTML = modalHtml;
      const modalScore = document.getElementById('modal-score');
      if (modalScore) modalScore.textContent = score;
    }

    let toastTimeout = null;
    function showSceneToast(text, icon = '🌟', isError = false) {
      const toast = document.getElementById('scene-toast');
      const toastIcon = document.getElementById('scene-toast-icon');
      const toastText = document.getElementById('scene-toast-text');
      if (!toast) return;

      toastIcon.textContent = icon;
      toastText.textContent = text;
      toast.className = \`absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-2xl shadow-xl border-2 font-kid font-bold text-sm sm:text-base flex items-center gap-2 transition-all \${
        isError ? 'bg-rose-900/95 text-white border-rose-300' : 'bg-slate-900/95 text-white border-amber-400'
      }\`;
      toast.classList.remove('hidden');

      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 3200);
    }

    function switchMode(mode) {
      currentMode = mode;
      if (mode === 'part1b') {
        p1bStep = 'select';
      }
      clearAllSceneHighlights();

      document.querySelectorAll('.mode-tab').forEach(btn => {
        btn.className = "mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 text-slate-700 hover:bg-white";
      });
      const activeTab = document.getElementById(\`tab-\${mode}\`);
      if (activeTab) {
        activeTab.className = "mode-tab px-3 py-1.5 rounded-xl font-kid font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 bg-indigo-600 text-white shadow";
      }

      updateDropZonesVisibility();
      renderCurrentMode();
    }

    function clearAllSceneHighlights() {
      document.querySelectorAll('.scene-item').forEach(el => {
        el.classList.remove('glow-correct', 'glow-spotlight', 'shake-wrong');
      });
    }

    function renderPart3BigStage() {
      const bigStage = document.getElementById('part3-big-stage');
      if (!bigStage) return;

      const cardObj = PART3_QUESTIONS[p3CardIndex];
      const cardMeta = OBJECT_CARDS.find(c => c.id === cardObj.cardId);
      const stepObj = cardObj.steps[p3StepIndex];
      const tags = cardPersonalTags[cardMeta.id];

      if (p3ShowAllGrid) {
        bigStage.innerHTML = \`
          <div class="flex items-center justify-between gap-2 mb-3">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Part 3 • All 8 Object Cards
              </span>
              <h3 class="text-base sm:text-lg font-kid font-bold text-slate-900 mt-0.5">
                Click any card to practice Examiner questions!
              </h3>
            </div>
            <button onclick="p3ShowAllGrid = false; renderPart3BigStage();" class="px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-kid font-bold text-xs sm:text-sm shadow transition">
              🔍 Show Giant Active Card
            </button>
          </div>
          <div class="flex-1 grid grid-cols-4 grid-rows-2 gap-3 sm:gap-4 items-center">
            \${OBJECT_CARDS.map(card => {
              const isSelected = card.id === cardMeta.id;
              return \`
                <div
                  onclick="selectPart3CardById('\${card.id}'); p3ShowAllGrid = false; renderPart3BigStage();"
                  class="cursor-pointer w-full h-full rounded-3xl bg-white p-3 sm:p-4 border-4 border-dashed transition transform hover:scale-105 flex items-center justify-center relative shadow-md \${
                    isSelected ? 'border-amber-500 ring-4 ring-amber-300 bg-amber-50/30 scale-105' : 'border-slate-300 hover:border-indigo-400'
                  }"
                >
                  <span class="absolute -top-2.5 -right-1.5 text-sm text-slate-500 pointer-events-none">✂️</span>
                  <div class="w-full h-full flex items-center justify-center p-1">
                    \${card.svg}
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        \`;
      } else {
        bigStage.innerHTML = \`
          <!-- Top Bar inside Big Stage -->
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-600 text-white shadow-sm">
                Card \${p3CardIndex + 1} of 8
              </span>
              <div class="flex items-center gap-1 bg-white/90 px-2 py-1 rounded-xl border border-indigo-200 shadow-sm">
                \${cardObj.steps.map((s, idx) => \`
                  <button onclick="p3StepIndex=\${idx}; renderCurrentMode();" class="px-2.5 py-1 rounded-lg font-kid font-bold text-xs transition \${
                    idx === p3StepIndex ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                  }">
                    Q\${idx + 1}
                  </button>
                \`).join('')}
              </div>
            </div>
            <button onclick="p3ShowAllGrid = true; renderPart3BigStage();" class="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-800 border-2 border-indigo-200 font-kid font-bold text-xs shadow-sm transition">
              🖼️ Show All 8 Cards Grid
            </button>
          </div>

          <!-- Center Huge Object Card Display -->
          <div class="flex-1 flex items-center justify-center gap-3 sm:gap-6 my-2">
            <button onclick="prevPart3Card()" class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white hover:bg-indigo-50 text-indigo-700 border-2 border-indigo-200 shadow-md flex items-center justify-center text-xl font-bold transition active:scale-95" title="Previous Object Card">
              ⬅️
            </button>

            <div class="relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-[2rem] bg-white border-4 border-dashed border-slate-400 shadow-2xl p-6 sm:p-8 flex items-center justify-center transition-all">
              <span class="absolute -top-3.5 -right-2 text-2xl text-slate-600 pointer-events-none">✂️</span>
              <div class="absolute top-3 left-3 flex gap-1.5 pointer-events-none">
                \${tags.have ? '<span class="text-xl" title="I have this!">🏠</span>' : ''}
                \${tags.like ? '<span class="text-xl" title="I like this!">❤️</span>' : ''}
              </div>
              <div class="w-full h-full flex items-center justify-center">
                \${cardMeta.svg}
              </div>
            </div>

            <button onclick="nextPart3Card()" class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white hover:bg-indigo-50 text-indigo-700 border-2 border-indigo-200 shadow-md flex items-center justify-center text-xl font-bold transition active:scale-95" title="Next Object Card">
              ➡️
            </button>
          </div>

          <!-- Bottom 8-Card Selector Strip (No words or Test 1 labels) -->
          <div class="bg-white/85 backdrop-blur rounded-2xl p-2 border-2 border-indigo-100 shadow-sm">
            <div class="grid grid-cols-8 gap-2">
              \${OBJECT_CARDS.map(card => {
                const isSelected = card.id === cardMeta.id;
                return \`
                  <button
                    onclick="selectPart3CardById('\${card.id}')"
                    class="aspect-square rounded-xl bg-white p-1.5 border-2 border-dashed transition transform hover:scale-105 flex items-center justify-center \${
                      isSelected ? 'border-amber-500 ring-2 ring-amber-400 bg-amber-50 scale-105 shadow' : 'border-slate-300 opacity-75 hover:opacity-100'
                    }"
                  >
                    \${card.svg}
                  </button>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      }
    }

    function selectPart3CardById(cardId) {
      const idx = PART3_QUESTIONS.findIndex(q => q.cardId === cardId);
      if (idx !== -1) {
        p3CardIndex = idx;
        p3StepIndex = 0;
        playChime('pop');
        renderCurrentMode();
      }
    }

    function prevPart3Card() {
      p3CardIndex = (p3CardIndex - 1 + PART3_QUESTIONS.length) % PART3_QUESTIONS.length;
      p3StepIndex = 0;
      playChime('pop');
      renderCurrentMode();
    }

    function nextPart3Card() {
      p3CardIndex = (p3CardIndex + 1) % PART3_QUESTIONS.length;
      p3StepIndex = 0;
      playChime('pop');
      renderCurrentMode();
    }

    function renderCurrentMode() {
      const partBadge = document.getElementById('part-badge');
      const qCounter = document.getElementById('question-counter');
      const promptText = document.getElementById('examiner-prompt-text');
      const subHint = document.getElementById('examiner-sub-hint');
      const panel = document.getElementById('activity-panel');
      const sceneContainer = document.getElementById('scene-canvas-container');
      const part3BigStage = document.getElementById('part3-big-stage');
      const statusText = document.getElementById('scene-status-bar');
      const bookArtBtn = document.getElementById('btn-footer-book-art');

      // Toggle between the Big Classroom Scene and the Big Object Cards Stage (Part 3)
      if (currentMode === 'part3') {
        if (sceneContainer) sceneContainer.classList.add('hidden');
        if (part3BigStage) part3BigStage.classList.remove('hidden');
        if (bookArtBtn) bookArtBtn.classList.add('hidden');
        if (statusText) statusText.textContent = "Part 3 Object Cards Stage — Answer the Examiner's question about the big card!";
        renderPart3BigStage();
      } else {
        if (sceneContainer) sceneContainer.classList.remove('hidden');
        if (part3BigStage) part3BigStage.classList.add('hidden');
        if (bookArtBtn) bookArtBtn.classList.remove('hidden');
        if (statusText) statusText.textContent = "Interactive Scene Ready — Click any object or drag an Object Card onto the room!";
      }

      updateDropZonesVisibility();

      if (currentMode === 'part1a') {
        const task = PART1A_TASKS[p1aIndex];
        partBadge.textContent = "Part 1 • Task A: Point to Things in the Big Picture";
        qCounter.textContent = \`Question \${p1aIndex + 1} of \${PART1A_TASKS.length}\`;
        promptText.textContent = \`"\${task.prompt}"\`;
        subHint.textContent = \`👉 \${task.subHint}\`;
        speakText(task.prompt);
        renderAnswerChips(task.chips, []);

        panel.innerHTML = \`
          <div class="flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-kid font-bold text-indigo-950">👆 Task A: Where is / Where are...?</h2>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">+10 pts each</span>
          </div>
          <p class="text-xs text-slate-600">
            Listen to the Examiner and <strong>click directly on the object(s)</strong> in the Monster Art Class picture!
          </p>
          <div class="bg-indigo-50/90 border-2 border-indigo-200 rounded-2xl p-2.5 text-xs space-y-1.5">
            <div class="font-extrabold uppercase text-[10px] text-indigo-700">Question \${p1aIndex + 1}: \${task.prompt}</div>
            <button onclick="practiceSentence('\${task.answer.replace(/'/g, "\\\\'")}')" class="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-indigo-200 hover:border-emerald-400 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between transition shadow-sm">
              <span>🗣️ "\${task.answer}"</span>
              <span class="text-emerald-600 text-xs font-extrabold">🔊 Listen</span>
            </button>
          </div>
          <div class="grid grid-cols-4 gap-1.5 my-1">
            \${PART1A_TASKS.map((t, idx) => \`
              <button onclick="p1aIndex=\${idx}; renderCurrentMode();" class="py-1.5 px-2 rounded-xl font-kid font-bold text-xs border transition \${
                idx === p1aIndex
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow'
                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
              }">
                Q\${idx + 1}
              </button>
            \`).join('')}
          </div>
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button onclick="prevQuestion()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-kid font-bold text-xs transition">
              ⬅️ Previous
            </button>
            <button onclick="triggerVisualClue()" class="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-kid font-bold text-xs transition">
              💡 Show Me Hint
            </button>
            <button onclick="nextQuestion()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-kid font-bold text-xs shadow transition">
              Next Question ➡️
            </button>
          </div>
        \`;
      }

      else if (currentMode === 'part1b') {
        const task = PART1B_TASKS[p1bIndex];
        const isSelectStep = p1bStep === 'select';
        const activePrompt = isSelectStep ? task.selectPrompt : task.placePrompt;
        const activeSubHint = isSelectStep ? task.selectSubHint : task.placeSubHint;

        partBadge.textContent = isSelectStep
          ? "Part 1 • Task B (Step 1/2): Find the Object Card"
          : "Part 1 • Task B (Step 2/2): Place the Card in the Room";
        qCounter.textContent = \`Task \${p1bIndex + 1} of \${PART1B_TASKS.length} • Step \${isSelectStep ? 1 : 2}/2\`;
        promptText.textContent = \`"\${activePrompt}"\`;
        subHint.textContent = \`🃏 \${activeSubHint}\`;
        speakText(activePrompt);
        renderAnswerChips(isSelectStep ? task.selectChips : task.placeChips, []);

        panel.innerHTML = \`
          <div class="flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-kid font-bold text-indigo-950">🃏 Task B: Select & Place Cards</h2>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Step \${isSelectStep ? '1: Select' : '2: Place'}</span>
          </div>

          \${isSelectStep ? \`
            <div class="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 text-xs text-indigo-950 flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-white border-2 border-dashed border-indigo-300 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                ❓
              </div>
              <div>
                <div class="font-extrabold uppercase text-[10px] text-indigo-600">Step 1: Listen & Select Object Card</div>
                <div class="font-bold text-sm text-slate-900 mt-0.5">"\${task.selectPrompt}"</div>
                <div class="text-[11px] text-slate-600 mt-0.5">Click the matching picture in the 8 Object Cards tray below!</div>
              </div>
            </div>
          \` : \`
            <div class="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 text-xs text-emerald-950 flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-white border-2 border-emerald-400 p-1 shrink-0 shadow-sm">
                \${OBJECT_CARDS.find(c => c.id === task.cardId).svg}
              </div>
              <div>
                <div class="font-extrabold uppercase text-[10px] text-emerald-700">✓ Correct Card Selected! Now Step 2:</div>
                <div class="font-bold text-sm text-slate-900 mt-0.5">"\${task.placePrompt}"</div>
                <div class="text-[11px] text-slate-600 mt-0.5">Drag the highlighted card to the dashed zone in the picture (or click the spot)!</div>
              </div>
            </div>
          \`}

          <div class="grid grid-cols-4 gap-1.5">
            \${PART1B_TASKS.map((t, idx) => \`
              <button onclick="p1bIndex=\${idx}; p1bStep='select'; renderCurrentMode();" class="py-1.5 px-2 rounded-xl font-kid font-bold text-xs border transition \${
                idx === p1bIndex
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow'
                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
              }">
                Task #\${idx + 1}
              </button>
            \`).join('')}
          </div>
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button onclick="prevQuestion()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-kid font-bold text-xs transition">
              ⬅️ Previous
            </button>
            <button onclick="autoDemoPlaceCurrentCard()" class="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-kid font-bold text-xs transition">
              ✨ \${isSelectStep ? 'Show Answer Card' : 'Auto-Place Card'}
            </button>
            <button onclick="nextQuestion()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-kid font-bold text-xs shadow transition">
              Next Task ➡️
            </button>
          </div>
        \`;
      }

      else if (currentMode === 'part2') {
        const q = PART2_QUESTIONS[p2Index];
        partBadge.textContent = "Part 2 • One Question at a Time (Wait for Answer)";
        qCounter.textContent = \`Question \${p2Index + 1} of \${PART2_QUESTIONS.length}\`;
        promptText.textContent = \`"\${q.prompt}"\`;
        subHint.textContent = \`🔍 \${q.subHint}\`;
        speakText(q.prompt);

        clearAllSceneHighlights();
        const spotEl = document.getElementById(\`item-\${q.spotlightId}\`);
        if (spotEl) spotEl.classList.add('glow-spotlight');
        if (q.secondarySpotlightId) {
          const secEl = document.getElementById(\`item-\${q.secondarySpotlightId}\`);
          if (secEl) secEl.classList.add('glow-spotlight');
        }

        renderAnswerChips(q.chips, q.keywords);

        panel.innerHTML = \`
          <div class="flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-kid font-bold text-indigo-950">🔍 Part 2: Scene Q&A (Step-by-Step)</h2>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">Q\${p2Index + 1}/\${PART2_QUESTIONS.length}</span>
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            \${PART2_QUESTIONS.map((item, idx) => \`
              <button onclick="p2Index=\${idx}; renderCurrentMode();" class="px-2 py-1 rounded-xl font-kid font-bold text-[11px] border truncate transition \${
                idx === p2Index
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow'
                  : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 border-slate-200'
              }">
                \${item.title}
              </button>
            \`).join('')}
          </div>

          <div class="bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl p-3">
            <div class="text-xs font-extrabold uppercase text-indigo-700 mb-1">\${q.prompt}</div>
            <p class="text-xs text-slate-600 mb-2">
              Wait for the student to answer aloud, or click a model answer below before clicking <strong>Next Question ➡️</strong>:
            </p>
            <div class="flex flex-col gap-1.5">
              \${q.chips.map(sentence => \`
                <button onclick="practiceSentence('\${sentence.replace(/'/g, "\\\\'")}')" class="text-left px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-indigo-200 hover:border-emerald-400 text-xs sm:text-sm font-bold text-slate-800 flex items-center justify-between transition shadow-sm">
                  <span>🗣️ "\${sentence}"</span>
                  <span class="text-emerald-600 text-xs font-extrabold">+10 ⭐</span>
                </button>
              \`).join('')}
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <button onclick="prevQuestion()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-kid font-bold text-xs transition">
              ⬅️ Previous
            </button>
            <button onclick="nextQuestion()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-kid font-bold text-xs shadow transition">
              Next Question ➡️
            </button>
          </div>
        \`;
      }

      else if (currentMode === 'part3') {
        const cardObj = PART3_QUESTIONS[p3CardIndex];
        const cardMeta = OBJECT_CARDS.find(c => c.id === cardObj.cardId);
        const stepObj = cardObj.steps[p3StepIndex];

        partBadge.textContent = "Part 3 • Object Cards Q&A (One Question at a Time)";
        qCounter.textContent = \`Card \${p3CardIndex + 1} of 8 • Question \${p3StepIndex + 1} of \${cardObj.steps.length}\`;
        promptText.textContent = \`"\${stepObj.q}"\`;
        subHint.textContent = \`💬 Look at the big Object Card on the left and answer the Examiner's question!\`;
        speakText(stepObj.q);
        renderAnswerChips(stepObj.a, stepObj.keywords);

        panel.innerHTML = \`
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base sm:text-lg font-kid font-bold text-indigo-950">💬 Part 3: Object Cards Q&A</h2>
            <button onclick="pairTalkMode = !pairTalkMode; renderCurrentMode();" class="text-xs font-bold px-2.5 py-1 rounded-xl border transition \${
              pairTalkMode ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }">
              👥 \${pairTalkMode ? 'Back to Examiner Q&A' : 'Pair Talk Activity'}
            </button>
          </div>

          \${!pairTalkMode ? \`
            <div class="bg-gradient-to-br from-sky-50 to-indigo-50 border-4 border-indigo-200 rounded-3xl p-3.5 flex flex-col gap-3 shadow-inner">
              <div class="flex flex-wrap items-center justify-between gap-1.5">
                <div class="flex flex-wrap items-center gap-1.5">
                  \${cardObj.steps.map((s, idx) => \`
                    <button onclick="p3StepIndex=\${idx}; renderCurrentMode();" class="px-2.5 py-1 rounded-lg font-kid font-bold text-xs transition \${
                      idx === p3StepIndex ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'
                    }">
                      Q\${idx + 1}
                    </button>
                  \`).join('')}
                </div>
                <span class="text-[11px] font-bold text-indigo-700">Card \${p3CardIndex + 1}/8</span>
              </div>
              <p class="text-base font-kid font-bold text-indigo-950">"\${stepObj.q}"</p>
              <div class="flex flex-col gap-1.5">
                \${stepObj.a.map(ans => \`
                  <button onclick="practiceSentence('\${ans.replace(/'/g, "\\\\'")}', true)" class="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-indigo-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center justify-between transition shadow-sm">
                    <span>💬 "\${ans}"</span>
                    <span class="text-emerald-600 font-extrabold">+10 ⭐</span>
                  </button>
                \`).join('')}
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1">
              <button onclick="prevPart3Step()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-kid font-bold text-xs transition">
                ⬅️ Previous
              </button>
              <button onclick="nextPart3Step()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-kid font-bold text-xs shadow transition">
                Next Question ➡️
              </button>
            </div>
          \` : \`
            <div class="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 text-xs space-y-2">
              <div class="font-kid font-bold text-sm text-amber-950">👥 Pair Talk Activity:</div>
              <ul class="list-disc list-inside text-slate-700 font-semibold space-y-0.5">
                <li>What colour are the things in the pictures?</li>
                <li>Which things do you have? (Tap <strong>"I have this!"</strong>)</li>
                <li>Which things do you like? Why? (Tap <strong>"I like this!"</strong>)</li>
              </ul>
              <div class="bg-white rounded-xl p-2.5 border border-amber-200 flex items-center gap-3">
                <div class="w-16 h-16 shrink-0 border border-dashed border-slate-300 rounded-lg p-1">
                  \${cardMeta.svg}
                </div>
                <div class="flex-1 space-y-1.5">
                  <div class="flex flex-wrap gap-1.5">
                    <button onclick="togglePersonalTag('\${cardMeta.id}', 'have')" class="px-2.5 py-1 rounded-lg font-bold text-xs border transition \${
                      cardPersonalTags[cardMeta.id].have ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-100 text-slate-700 border-slate-300'
                    }">
                      🏠 I have got this!
                    </button>
                    <button onclick="togglePersonalTag('\${cardMeta.id}', 'like')" class="px-2.5 py-1 rounded-lg font-bold text-xs border transition \${
                      cardPersonalTags[cardMeta.id].like ? 'bg-rose-500 text-white border-rose-600' : 'bg-slate-100 text-slate-700 border-slate-300'
                    }">
                      ❤️ I like this!
                    </button>
                  </div>
                </div>
              </div>
            </div>
          \`}
        \`;
      }

      else if (currentMode === 'sandbox') {
        partBadge.textContent = "🎓 Free Teacher & Student Sandbox Mode";
        qCounter.textContent = "All Items Interactive";
        promptText.textContent = \`"Click any object in the classroom to hear its name and sentence, or drag any card anywhere in the room!"\`;
        subHint.textContent = "✨ Teacher Tip: Use this mode to ask your own custom questions or review vocabulary freely.";
        renderAnswerChips([
          "There are four monsters.",
          "The ball is under the chair.",
          "The cat is sleeping under the table.",
          "She is taking a photo."
        ], []);

        panel.innerHTML = \`
          <div class="flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-kid font-bold text-indigo-950">🎓 Teacher Sandbox & Vocabulary Explorer</h2>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">Free Play</span>
          </div>
          <p class="text-xs text-slate-600">
            Click any button below to spotlight an item in the Monster Art Class and hear a model Cambridge Starters sentence:
          </p>
          <div class="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
            \${Object.entries(SCENE_ITEM_LABELS).map(([key, info]) => \`
              <button onclick="spotlightAndSpeakSandbox('\${key}')" class="text-left px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 truncate transition">
                ✨ \${info.name}
              </button>
            \`).join('')}
          </div>
        \`;
      }

      renderObjectCardsTray();
    }

    function handleSceneItemClick(itemId, event) {
      if (event) event.stopPropagation();
      const el = document.getElementById(\`item-\${itemId}\`);

      if (currentMode === 'part1a') {
        const task = PART1A_TASKS[p1aIndex];
        if (task.targets.includes(itemId)) {
          clearAllSceneHighlights();
          task.targets.forEach(tId => {
            const targetEl = document.getElementById(\`item-\${tId}\`);
            if (targetEl) targetEl.classList.add('glow-correct');
          });
          addPoints(10, task.successLabel);
          speakText(task.successLabel);
        } else {
          if (el) {
            el.classList.remove('shake-wrong');
            void el.offsetWidth;
            el.classList.add('shake-wrong');
          }
          playChime('wrong');
          const clickedInfo = SCENE_ITEM_LABELS[itemId];
          const msg = clickedInfo ? \`That's \${clickedInfo.name}. Try again: \${task.prompt}\` : \`Try again! \${task.prompt}\`;
          showSceneToast(msg, '🤔', true);
          speakText(\`That's \${clickedInfo ? clickedInfo.name : 'not it'}. \${task.prompt}\`);
        }
      } else if (currentMode === 'part1b' && p1bStep === 'select') {
        const task = PART1B_TASKS[p1bIndex];
        showSceneToast(\`First select the object card on the right: "\${task.selectPrompt}"\`, '👉');
        speakText(task.selectPrompt);
      } else {
        clearAllSceneHighlights();
        if (el) el.classList.add('glow-correct');
        const info = SCENE_ITEM_LABELS[itemId];
        if (info) {
          playChime('pop');
          showSceneToast(\`\${info.name}: "\${info.sentence}"\`, '🎨');
          speakText(info.sentence);
        }
      }
    }

    function handleDropZoneClick(zoneId, event) {
      if (event) event.stopPropagation();
      if (currentMode !== 'part1b') return;
      const task = PART1B_TASKS[p1bIndex];
      if (p1bStep === 'select') {
        showSceneToast(\`First click the object card: "\${task.selectPrompt}"\`, '👉', true);
        speakText(task.selectPrompt);
        return;
      }
      if (zoneId === task.zoneId) {
        placeCardInSceneSVG(task.cardId, task.zoneCoords.x, task.zoneCoords.y);
        addPoints(15, task.successLabel);
        speakText(task.successLabel);
        celebrateWithConfetti(30);
      } else {
        playChime('wrong');
        showSceneToast(\`Almost! Listen carefully: "\${task.placePrompt}"\`, '🎯', true);
        speakText(task.placePrompt);
      }
    }

    function spotlightAndSpeakSandbox(itemId) {
      clearAllSceneHighlights();
      const el = document.getElementById(\`item-\${itemId}\`);
      if (el) el.classList.add('glow-correct');
      const info = SCENE_ITEM_LABELS[itemId];
      if (info) {
        document.getElementById('examiner-prompt-text').textContent = \`"\${info.sentence}"\`;
        showSceneToast(info.sentence, '✨');
        speakText(info.sentence);
      }
    }

    function triggerVisualClue() {
      clearAllSceneHighlights();
      playChime('pop');
      if (currentMode === 'part1a') {
        const task = PART1A_TASKS[p1aIndex];
        task.targets.forEach(tId => {
          const el = document.getElementById(\`item-\${tId}\`);
          if (el) el.classList.add('glow-spotlight');
        });
        showSceneToast(\`Hint: Look at the glowing object!\`, '💡');
      } else if (currentMode === 'part1b') {
        const task = PART1B_TASKS[p1bIndex];
        if (p1bStep === 'select') {
          const cardEl = document.querySelector(\`[data-card-id="\${task.cardId}"]\`);
          if (cardEl) {
            cardEl.classList.add('ring-4', 'ring-amber-400', 'scale-105');
            setTimeout(() => cardEl.classList.remove('ring-4', 'ring-amber-400', 'scale-105'), 2000);
          }
          showSceneToast(\`Hint: Click the glowing card in the tray!\`, '💡');
        } else {
          const dz = document.getElementById(\`dz-\${task.zoneId}\`);
          if (dz) dz.classList.add('active-hover');
          setTimeout(() => { if (dz) dz.classList.remove('active-hover'); }, 2200);
          showSceneToast(\`Hint: Drag the card to the green glowing zone in the picture!\`, '💡');
        }
      } else if (currentMode === 'part2') {
        const q = PART2_QUESTIONS[p2Index];
        const el = document.getElementById(\`item-\${q.spotlightId}\`);
        if (el) el.classList.add('glow-correct');
      }
    }

    function renderObjectCardsTray() {
      const grid = document.getElementById('object-cards-grid');
      if (!grid) return;

      grid.innerHTML = OBJECT_CARDS.map((card, idx) => {
        const isPlaced = Boolean(placedCards[card.id]);
        const isCurrentP3 = currentMode === 'part3' && PART3_QUESTIONS[p3CardIndex].cardId === card.id;
        // Only highlight the target card in Part 1B AFTER the student has correctly selected it in Step 1!
        const isSelectedP1B = currentMode === 'part1b' && p1bStep === 'place' && PART1B_TASKS[p1bIndex].cardId === card.id;
        const tags = cardPersonalTags[card.id];

        return \`
          <div
            data-card-id="\${card.id}"
            onpointerdown="startCardDrag(event, '\${card.id}')"
            onclick="handleTrayCardClick('\${card.id}')"
            class="object-card relative rounded-2xl bg-white p-2 border-2 border-dashed \${
              isCurrentP3 || isSelectedP1B ? 'border-emerald-500 ring-4 ring-emerald-300 bg-emerald-50/50 scale-105' : 'border-slate-400'
            } \${isPlaced ? 'opacity-45' : ''} flex items-center justify-center aspect-square select-none shadow-sm"
          >
            <span class="absolute -top-2 -right-1 text-[11px] text-slate-500 pointer-events-none">✂️</span>
            <div class="absolute top-1 left-1 flex gap-0.5 pointer-events-none">
              \${tags.have ? '<span class="text-[10px]" title="I have this!">🏠</span>' : ''}
              \${tags.like ? '<span class="text-[10px]" title="I like this!">❤️</span>' : ''}
            </div>
            <div class="w-full h-full flex items-center justify-center pointer-events-none p-1">
              \${card.svg}
            </div>
          </div>
        \`;
      }).join('');

      document.getElementById('placed-count').textContent = Object.keys(placedCards).length;
    }

    function handleTrayCardClick(cardId) {
      const card = OBJECT_CARDS.find(c => c.id === cardId);
      if (!card) return;

      if (currentMode === 'part1b') {
        const task = PART1B_TASKS[p1bIndex];
        if (p1bStep === 'select') {
          if (cardId === task.cardId) {
            p1bStep = 'place';
            addPoints(10, \`Correct! Now: \${task.placePrompt}\`);
            renderCurrentMode();
          } else {
            const wrongEl = document.querySelector(\`[data-card-id="\${cardId}"]\`);
            if (wrongEl) {
              wrongEl.classList.add('shake-wrong');
              setTimeout(() => wrongEl.classList.remove('shake-wrong'), 500);
            }
            playChime('wrong');
            showSceneToast(\`Try again! "\${task.selectPrompt}"\`, '🤔', true);
            speakText(\`Try again! \${task.selectPrompt}\`);
          }
        } else {
          // Already in 'place' step
          if (cardId === task.cardId) {
            playChime('pop');
            showSceneToast(\`Now drag it onto the picture: "\${task.placePrompt}"\`, '👉');
            speakText(task.placePrompt);
          } else {
            playChime('wrong');
            showSceneToast(\`Use the highlighted card! "\${task.placePrompt}"\`, '🤔', true);
          }
        }
        return;
      }

      if (currentMode === 'part3') {
        const idx = PART3_QUESTIONS.findIndex(q => q.cardId === cardId);
        if (idx !== -1) {
          p3CardIndex = idx;
          p3StepIndex = 0;
          renderCurrentMode();
        }
      } else {
        playChime('pop');
        const phrase = card.isPlural ? \`These are \${card.name}. They are \${card.colorText}.\` : \`This is \${card.article}. It is \${card.colorText}.\`;
        showSceneToast(phrase, '🃏');
        speakText(phrase);
      }
    }

    let draggingCardId = null;
    let dragStartPos = { x: 0, y: 0 };
    let isDraggingActive = false;

    function startCardDrag(e, cardId) {
      if (e.button !== undefined && e.button !== 0) return;
      // In Part 1B Step 1 ('select'), require clicking/selecting the card first before dragging!
      if (currentMode === 'part1b' && p1bStep === 'select') {
        return;
      }
      draggingCardId = cardId;
      dragStartPos = { x: e.clientX, y: e.clientY };
      isDraggingActive = false;

      window.addEventListener('pointermove', onCardPointerMove);
      window.addEventListener('pointerup', onCardPointerUp);
    }

    function onCardPointerMove(e) {
      if (!draggingCardId) return;
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;

      if (!isDraggingActive && Math.hypot(dx, dy) > 8) {
        isDraggingActive = true;
        const card = OBJECT_CARDS.find(c => c.id === draggingCardId);
        const ghost = document.getElementById('drag-ghost');
        ghost.innerHTML = card.svg;
        ghost.style.display = 'flex';
        playChime('pop');
      }

      if (isDraggingActive) {
        const ghost = document.getElementById('drag-ghost');
        ghost.style.left = \`\${e.clientX}px\`;
        ghost.style.top = \`\${e.clientY}px\`;
        highlightHoveredDropZone(e.clientX, e.clientY);
      }
    }

    function getSvgCoordsFromClient(clientX, clientY) {
      const svg = document.getElementById('monster-art-scene');
      const rect = svg.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return null;
      }
      const x = ((clientX - rect.left) / rect.width) * 900;
      const y = ((clientY - rect.top) / rect.height) * 675;
      return { x, y };
    }

    function highlightHoveredDropZone(clientX, clientY) {
      document.querySelectorAll('.drop-zone').forEach(dz => dz.classList.remove('active-hover'));
      const pt = getSvgCoordsFromClient(clientX, clientY);
      if (!pt) return;

      document.querySelectorAll('.drop-zone').forEach(dz => {
        const x = parseFloat(dz.getAttribute('x'));
        const y = parseFloat(dz.getAttribute('y'));
        const w = parseFloat(dz.getAttribute('width'));
        const h = parseFloat(dz.getAttribute('height'));
        if (pt.x >= x - 15 && pt.x <= x + w + 15 && pt.y >= y - 15 && pt.y <= y + h + 15) {
          dz.classList.add('active-hover');
        }
      });
    }

    function onCardPointerUp(e) {
      window.removeEventListener('pointermove', onCardPointerMove);
      window.removeEventListener('pointerup', onCardPointerUp);

      const ghost = document.getElementById('drag-ghost');
      ghost.style.display = 'none';
      document.querySelectorAll('.drop-zone').forEach(dz => dz.classList.remove('active-hover'));

      if (isDraggingActive && draggingCardId) {
        const pt = getSvgCoordsFromClient(e.clientX, e.clientY);
        if (pt) {
          handleCardDropOnScene(draggingCardId, pt.x, pt.y);
        }
      }

      draggingCardId = null;
      isDraggingActive = false;
    }

    function handleCardDropOnScene(cardId, svgX, svgY) {
      let matchedZone = null;
      document.querySelectorAll('.drop-zone').forEach(dz => {
        const x = parseFloat(dz.getAttribute('x'));
        const y = parseFloat(dz.getAttribute('y'));
        const w = parseFloat(dz.getAttribute('width'));
        const h = parseFloat(dz.getAttribute('height'));
        if (svgX >= x - 20 && svgX <= x + w + 20 && svgY >= y - 20 && svgY <= y + h + 20) {
          matchedZone = dz.getAttribute('data-zone');
        }
      });

      if (currentMode === 'part1b') {
        const task = PART1B_TASKS[p1bIndex];
        if (cardId !== task.cardId) {
          playChime('wrong');
          showSceneToast(\`Please use the selected card! "\${task.placePrompt}"\`, '🤔', true);
          speakText(task.placePrompt);
          return;
        }

        if (matchedZone === task.zoneId) {
          placeCardInSceneSVG(cardId, task.zoneCoords.x, task.zoneCoords.y);
          addPoints(15, task.successLabel);
          speakText(task.successLabel);
          celebrateWithConfetti(30);
        } else {
          playChime('wrong');
          showSceneToast(\`Almost! Listen carefully: "\${task.placePrompt}"\`, '🎯', true);
          speakText(task.placePrompt);
        }
      } else {
        placeCardInSceneSVG(cardId, svgX - 42, svgY - 42);
        const card = OBJECT_CARDS.find(c => c.id === cardId);
        addPoints(5, \`Placed the card in the classroom!\`);
      }
    }

    function placeCardInSceneSVG(cardId, x, y) {
      placedCards[cardId] = { x, y };
      renderPlacedCardsInScene();
      renderObjectCardsTray();
    }

    function renderPlacedCardsInScene() {
      const layer = document.getElementById('placed-cards-layer');
      if (!layer) return;

      layer.innerHTML = Object.entries(placedCards).map(([cardId, pos]) => {
        const card = OBJECT_CARDS.find(c => c.id === cardId);
        return \`
          <g transform="translate(\${pos.x}, \${pos.y})"
             class="cursor-pointer glow-correct"
             onpointerdown="startPlacedCardRedrag(event, '\${cardId}')"
             onclick="removePlacedCard('\${cardId}', event)">
            <rect x="0" y="0" width="84" height="84" rx="14" fill="#FFFFFF" stroke="#F59E0B" stroke-width="3" />
            <svg x="4" y="4" width="76" height="76" viewBox="0 0 100 100">
              \${card.svg}
            </svg>
          </g>
        \`;
      }).join('');
    }

    function startPlacedCardRedrag(e, cardId) {
      e.stopPropagation();
      startCardDrag(e, cardId);
    }

    function removePlacedCard(cardId, e) {
      if (e) e.stopPropagation();
      delete placedCards[cardId];
      playChime('pop');
      renderPlacedCardsInScene();
      renderObjectCardsTray();
    }

    function resetAllPlacedCards() {
      placedCards = {};
      if (currentMode === 'part1b') {
        p1bStep = 'select';
      }
      playChime('pop');
      renderPlacedCardsInScene();
      renderCurrentMode();
      showSceneToast("All 8 Object Cards returned to the tray!", '🔄');
    }

    function autoDemoPlaceCurrentCard() {
      if (currentMode !== 'part1b') return;
      const task = PART1B_TASKS[p1bIndex];
      if (p1bStep === 'select') {
        p1bStep = 'place';
        addPoints(10, \`Selected! Now: \${task.placePrompt}\`);
        renderCurrentMode();
      } else {
        placeCardInSceneSVG(task.cardId, task.zoneCoords.x, task.zoneCoords.y);
        addPoints(15, task.successLabel);
        speakText(task.successLabel);
      }
    }

    function nextQuestion() {
      playChime('pop');
      if (currentMode === 'part1a') {
        p1aIndex = (p1aIndex + 1) % PART1A_TASKS.length;
      } else if (currentMode === 'part1b') {
        p1bIndex = (p1bIndex + 1) % PART1B_TASKS.length;
        p1bStep = 'select';
      } else if (currentMode === 'part2') {
        p2Index = (p2Index + 1) % PART2_QUESTIONS.length;
      } else if (currentMode === 'part3') {
        nextPart3Step();
        return;
      }
      renderCurrentMode();
    }

    function prevQuestion() {
      playChime('pop');
      if (currentMode === 'part1a') {
        p1aIndex = (p1aIndex - 1 + PART1A_TASKS.length) % PART1A_TASKS.length;
      } else if (currentMode === 'part1b') {
        p1bIndex = (p1bIndex - 1 + PART1B_TASKS.length) % PART1B_TASKS.length;
        p1bStep = 'select';
      } else if (currentMode === 'part2') {
        p2Index = (p2Index - 1 + PART2_QUESTIONS.length) % PART2_QUESTIONS.length;
      } else if (currentMode === 'part3') {
        prevPart3Step();
        return;
      }
      renderCurrentMode();
    }

    function nextPart3Step() {
      const cardObj = PART3_QUESTIONS[p3CardIndex];
      if (p3StepIndex < cardObj.steps.length - 1) {
        p3StepIndex++;
      } else {
        p3StepIndex = 0;
        p3CardIndex = (p3CardIndex + 1) % PART3_QUESTIONS.length;
      }
      renderCurrentMode();
    }

    function prevPart3Step() {
      if (p3StepIndex > 0) {
        p3StepIndex--;
      } else {
        p3CardIndex = (p3CardIndex - 1 + PART3_QUESTIONS.length) % PART3_QUESTIONS.length;
        p3StepIndex = PART3_QUESTIONS[p3CardIndex].steps.length - 1;
      }
      renderCurrentMode();
    }

    function togglePersonalTag(cardId, tagType) {
      cardPersonalTags[cardId][tagType] = !cardPersonalTags[cardId][tagType];
      const card = OBJECT_CARDS.find(c => c.id === cardId);
      if (cardPersonalTags[cardId][tagType]) {
        const sentence = tagType === 'have'
          ? \`I have got \${card.article} at home!\`
          : \`I like \${card.name}s because they are cool!\`;
        addPoints(10, sentence);
        speakText(sentence);
      }
      renderCurrentMode();
    }

    let currentExpectedKeywords = [];
    let recognition = null;
    let isListening = false;

    function renderAnswerChips(chips = [], keywords = []) {
      currentExpectedKeywords = keywords;
      const container = document.getElementById('answer-chips-container');
      if (!container) return;

      container.innerHTML = chips.map(chip => \`
        <button onclick="practiceSentence('\${chip.replace(/'/g, "\\\\'")}')"
                class="px-2.5 py-1.5 rounded-xl bg-indigo-800/90 hover:bg-emerald-600 text-indigo-100 hover:text-white border border-indigo-600 text-xs font-bold transition shadow-sm">
          🗣️ "\${chip}"
        </button>
      \`).join('');
    }

    function practiceSentence(sentence, autoAdvancePart3 = false) {
      const transcriptText = document.getElementById('transcript-text');
      const badge = document.getElementById('speech-match-badge');
      if (transcriptText) {
        transcriptText.textContent = \`"\${sentence}"\`;
        transcriptText.className = "font-bold text-emerald-300";
      }
      if (badge) badge.classList.remove('hidden');

      addPoints(10, \`Great speaking: "\${sentence}"\`);
      speakText(sentence);
    }

    function toggleMicrophone() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showSceneToast("Voice recognition isn't supported in this browser — tap any answer chip below instead!", 'ℹ️');
        return;
      }

      if (isListening && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const btnMic = document.getElementById('btn-mic');
      const micLabel = document.getElementById('mic-label');
      const transcriptText = document.getElementById('transcript-text');
      const badge = document.getElementById('speech-match-badge');

      recognition.onstart = () => {
        isListening = true;
        btnMic.className = "px-3 py-1.5 rounded-2xl bg-emerald-500 text-white font-kid font-bold text-xs flex items-center gap-1.5 shadow-md animate-pulse";
        micLabel.textContent = "Listening...";
        transcriptText.textContent = "Listening... Speak your answer now!";
        transcriptText.className = "text-amber-300 font-semibold";
        badge.classList.add('hidden');
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        transcriptText.textContent = \`"\${transcript}"\`;

        if (event.results[0].isFinal) {
          const lower = transcript.toLowerCase();
          const matched = currentExpectedKeywords.length === 0 || currentExpectedKeywords.some(kw => lower.includes(kw));
          if (matched) {
            badge.classList.remove('hidden');
            transcriptText.className = "font-bold text-emerald-300";
            addPoints(15, \`Awesome speaking! You said: "\${transcript}"\`);
          } else {
            addPoints(5, \`Good try! You said: "\${transcript}"\`);
          }
        }
      };

      recognition.onerror = () => {
        isListening = false;
        btnMic.className = "px-3 py-1.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-kid font-bold text-xs flex items-center gap-1.5 shadow-md transition";
        micLabel.textContent = "Speak Answer";
      };

      recognition.onend = () => {
        isListening = false;
        btnMic.className = "px-3 py-1.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-kid font-bold text-xs flex items-center gap-1.5 shadow-md transition";
        micLabel.textContent = "Speak Answer";
      };

      recognition.start();
    }

    function openCertificateModal() {
      renderShields();
      document.getElementById('certificate-modal').classList.remove('hidden');
      celebrateWithConfetti(60);
      playFanfare();
    }

    function closeCertificateModal() {
      document.getElementById('certificate-modal').classList.add('hidden');
    }

    function celebrateWithConfetti(count = 45) {
      const canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const colors = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#FACC15'];
      const pieces = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 100,
        size: 7 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: -2 + Math.random() * 4,
        vy: 3 + Math.random() * 5,
        angle: Math.random() * Math.PI * 2,
        spin: -0.1 + Math.random() * 0.2
      }));

      let frame = 0;
      function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.angle += p.spin;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        });
        frame++;
        if (frame < 110) {
          requestAnimationFrame(animateConfetti);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      animateConfetti();
    }

    window.onload = function () {
      renderShields();
      renderCurrentMode();
    };
  </script>
</body>
</html>`;

interface StartersMonsterArtStudioProps {
  onClose: () => void;
  onSwitchToStandardSlides?: () => void;
}

export const StartersMonsterArtStudio: React.FC<StartersMonsterArtStudioProps> = ({
  onClose,
  onSwitchToStandardSlides,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[320] bg-slate-950 flex flex-col overflow-hidden select-none"
    >
      {/* Top Studio Host Bar */}
      <div className="h-12 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 text-white">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to My Slides</span>
          </button>
          <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Cambridge Pre-A1 Starters • Interactive Speaking Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSwitchToStandardSlides && (
            <button
              onClick={onSwitchToStandardSlides}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Switch to Standard Slide Deck View"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Slide Deck View</span>
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Monster Art Class Studio Iframe */}
      <iframe
        title="Cambridge Pre-A1 Starters Speaking — Monster Art Class Studio"
        srcDoc={MONSTER_ART_STUDIO_HTML}
        className="w-full flex-1 border-0 bg-[#FEF3C7]"
        allow="microphone; autoplay"
      />
    </div>
  );
};
