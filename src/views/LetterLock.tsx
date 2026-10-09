import React from 'react';

export const LetterLock = () => {
    return (
        <div className="w-full h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden relative">
            <iframe 
                src="/bubble-sentence.html" 
                className="w-full h-full border-none"
                title="Bubble Sentence Game"
            />
        </div>
    );
};
