import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Image as ImageIcon, Music, Type, CheckCircle, Wand2, Gamepad2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function AIGenerator() {
  return (
    <div className="min-h-screen py-10 max-w-7xl mx-auto px-6">
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-purple/10 text-brand-purple mb-6">
          <Wand2 size={32} />
        </div>
        <h1 className="text-4xl font-display font-bold text-slate-900 mb-4">AI Game Generator</h1>
        <p className="text-slate-600 text-lg">Create a fully playable educational game in seconds. Just tell us what you want to teach.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Input Form */}
          <div className="bg-white rounded-[24px] p-8 premium-shadow">
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">Configure Your Game</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Topic or Learning Objective</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:bg-white transition-all resize-none h-32"
                  placeholder="e.g. Present perfect vs past simple using travel vocabulary. I want students to practice forming questions and answering them."
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Student Level</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:bg-white transition-all appearance-none">
                    <option>A1 Beginner</option>
                    <option>A2 Elementary</option>
                    <option>B1 Intermediate</option>
                    <option>B2 Upper Intermediate</option>
                    <option>C1 Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Game Style</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-purple focus:bg-white transition-all appearance-none">
                    <option>Escape Room</option>
                    <option>Board Game</option>
                    <option>Quiz Show</option>
                    <option>Card Match</option>
                    <option>Roleplay Scenario</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">AI Assets to Generate</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <AssetToggle icon={Type} label="Questions" defaultChecked={true} color="brand-blue" />
                  <AssetToggle icon={ImageIcon} label="Images" defaultChecked={true} color="brand-purple" />
                  <AssetToggle icon={Music} label="Voice/Audio" defaultChecked={false} color="brand-green" />
                  <AssetToggle icon={Sparkles} label="Animations" defaultChecked={true} color="brand-orange" />
                </div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <button className="px-8 py-4 bg-gradient-to-r from-brand-purple to-brand-blue text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all hover-lift shadow-[0_10px_25px_rgba(109,94,247,0.3)] flex items-center gap-2">
                <Sparkles size={20} />
                Generate Magic
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar / Preview / Tips */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[24px] p-6 text-white premium-shadow overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
            
            <h3 className="font-display font-bold text-xl mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-yellow" /> Pro Tips
            </h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              For best results, paste your actual reading text or vocabulary list into the prompt. The AI will extract the key learning points automatically.
            </p>
            
            <div className="space-y-3">
              <TipBadge text="Paste reading passages" />
              <TipBadge text="Specify target grammar" />
              <TipBadge text="Set the exact age group" />
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-6 premium-shadow">
            <h3 className="font-display font-bold text-lg text-slate-900 mb-4">Recent Generations</h3>
            <div className="space-y-4">
              <RecentGen title="Space Race: Conditionals" time="2 hours ago" />
              <RecentGen title="Food Market Vocab" time="Yesterday" />
              <RecentGen title="PET Speaking Part 2" time="3 days ago" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetToggle({ icon: Icon, label, defaultChecked, color }: { icon: any, label: string, defaultChecked: boolean, color: string }) {
  const [active, setActive] = React.useState(defaultChecked);
  
  return (
    <button 
      onClick={() => setActive(!active)}
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2",
        active 
          ? `border-brand-purple bg-brand-purple/5 text-brand-purple` 
          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
      )}
    >
      <Icon size={24} className={active ? `text-${color}` : ""} />
      <span className="text-sm font-semibold">{label}</span>
      {active && <CheckCircle size={14} className="absolute top-2 right-2 text-brand-purple" />}
    </button>
  );
}

function TipBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-200 bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
      <CheckCircle size={14} className="text-brand-green" />
      {text}
    </div>
  );
}

function RecentGen({ title, time }: { title: string, time: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-brand-purple/10 group-hover:text-brand-purple transition-colors">
          <Gamepad2 size={18} className="text-slate-500 group-hover:text-brand-purple" />
        </div>
        <div>
          <div className="font-medium text-slate-900 text-sm group-hover:text-brand-purple transition-colors">{title}</div>
          <div className="text-xs text-slate-400">{time}</div>
        </div>
      </div>
      <button className="text-slate-300 hover:text-brand-purple transition-colors">
        <Sparkles size={16} />
      </button>
    </div>
  );
}
