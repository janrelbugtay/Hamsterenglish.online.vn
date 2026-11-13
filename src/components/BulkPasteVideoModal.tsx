import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Video,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface BulkPasteVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBulkPasteWithSample?: (sampleText: string) => void;
}

const SAMPLE_AI_PROMPT = `Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`;

const SAMPLE_PASTE_DATA = `1. The classroom _____ every morning by the cleaner.
A. cleans
B. is cleaned
C. cleaned
D. is cleaning
Answer: B. is cleaned

2. English _____ in many countries around the world.
A. speaks
B. is spoken
C. spoke
D. is speaking
Answer: B. is spoken

3. The windows _____ yesterday because they were very dirty.
A. cleaned
B. are cleaned
C. were cleaned
D. have cleaned
Answer: C. were cleaned

4. This book _____ by millions of people every year.
A. reads
B. is read
C. was reading
D. has read
Answer: B. is read

5. The new shopping mall _____ next month.
A. will open
B. will be opened
C. is opening
D. opened
Answer: B. will be opened`;

export function BulkPasteVideoModal({
  isOpen,
  onClose,
  onOpenBulkPasteWithSample,
}: BulkPasteVideoModalProps) {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInternalFullscreen, setIsInternalFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    setIsFullscreen(!!document.fullscreenElement);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsVideoPlaying(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isInternalFullscreen && !document.fullscreenElement) {
          setIsInternalFullscreen(false);
          e.stopPropagation();
        } else if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose();
        }
      } else if (
        (e.key === 'f' || e.key === 'F') &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isInternalFullscreen, onClose]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !isInternalFullscreen) {
        if (containerRef.current && containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else {
          setIsInternalFullscreen(true);
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsInternalFullscreen(false);
      }
    } catch {
      setIsInternalFullscreen((prev) => !prev);
    }
  };

  if (!isOpen) return null;

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    setIsVideoPlaying(true);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(SAMPLE_AI_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2200);
  };

  const handleTrySample = () => {
    if (onOpenBulkPasteWithSample) {
      onOpenBulkPasteWithSample(SAMPLE_PASTE_DATA);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onClose();
  };

  const isTrulyFullscreen = isFullscreen || isInternalFullscreen;

  const modalContent = (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[10050] flex flex-col bg-slate-950/90 text-slate-100 backdrop-blur-md transition-all duration-200 ${
        isTrulyFullscreen
          ? 'w-screen h-screen p-0 m-0'
          : 'p-3 sm:p-6 items-center justify-center'
      }`}
      onClick={(e) => {
        if (e.target === containerRef.current && !isTrulyFullscreen) {
          onClose();
        }
      }}
    >
      <div
        className={`flex flex-col bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden ${
          isTrulyFullscreen
            ? 'w-full h-full rounded-none border-none'
            : 'w-full max-w-4xl rounded-3xl max-h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimal Header */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Video size={18} />
            </div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
              How to Bulk Paste
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://drive.google.com/file/d/1Q6HPdlNguMMimfkb2TADo44AqOOZCh7l/view?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors hidden sm:flex"
            >
              <ExternalLink size={13} />
              <span>Open Video</span>
            </a>

            <button
              type="button"
              onClick={toggleFullscreen}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                isTrulyFullscreen
                  ? 'bg-purple-600 text-white border-purple-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
              }`}
              title={isTrulyFullscreen ? 'Exit Fullscreen' : 'Full Screen'}
            >
              {isTrulyFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen?.().catch(() => {});
                }
                onClose();
              }}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Stage - Always Visible Immediately */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
          <div
            className={`w-full relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl flex items-center justify-center ${
              isTrulyFullscreen ? 'flex-1 min-h-0' : 'aspect-video'
            }`}
          >
            {videoFailed ? (
              <iframe
                src="https://drive.google.com/file/d/1Q6HPdlNguMMimfkb2TADo44AqOOZCh7l/preview"
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
                title="How to Bulk Paste Video"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  src="/videos/bulk-paste-tutorial.mp4#t=0.5"
                  controls
                  preload="auto"
                  playsInline
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                  onError={() => setVideoFailed(true)}
                  className="w-full h-full object-contain bg-black"
                >
                  <source src="/videos/bulk-paste-tutorial.mp4" type="video/mp4" />
                </video>

                {!isVideoPlaying && (
                  <button
                    type="button"
                    onClick={handlePlayClick}
                    aria-label="Play Tutorial Video"
                    className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/15 transition-colors cursor-pointer group"
                  >
                    <div className="w-20 h-20 rounded-full bg-purple-600/95 group-hover:bg-purple-500 text-white flex items-center justify-center shadow-2xl ring-4 ring-white/30 group-hover:scale-110 transition-transform">
                      <Play size={36} className="ml-1 fill-current" />
                    </div>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Minimal Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
            >
              {copiedPrompt ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} className="text-purple-400" />}
              <span>{copiedPrompt ? 'Copied AI Prompt!' : 'Copy AI Prompt'}</span>
            </button>

            <button
              type="button"
              onClick={handleTrySample}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/25 transition-all active:scale-95"
            >
              <Sparkles size={15} />
              <span>Try Sample in Bulk Paste</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default BulkPasteVideoModal;
