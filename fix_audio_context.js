import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

const oldAudio = `const playSFX = (type: 'push' | 'stun' | 'win') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();`;

const newAudio = `
let sharedAudioCtx: AudioContext | null = null;

const playSFX = (type: 'push' | 'stun' | 'win') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;
    
    // Resume context if suspended (browser auto-play policy)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();`;

content = content.replace(oldAudio, newAudio);
fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Fixed AudioContext memory leak");
