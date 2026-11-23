import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ViewState } from '../types';

export const LetterLock = ({ onViewChange }: { onViewChange?: (view: ViewState, data?: any) => void }) => {
    return (
        <div className="w-full min-h-full flex-1 flex flex-col bg-slate-900 rounded-none overflow-hidden relative">
            {onViewChange && (
                <div className="absolute top-3 left-3 z-20">
                    <button
                        type="button"
                        onClick={() => onViewChange('home', { __stepBack: true })}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 hover:bg-white text-slate-900 font-black text-sm shadow-md transition-all cursor-pointer border border-slate-200"
                    >
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>
                </div>
            )}
            <iframe 
                src="/bubble-sentence.html" 
                className="w-full h-full flex-1 border-none"
                title="Bubble Sentence Game"
            />
        </div>
    );
};
