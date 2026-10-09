import React from 'react';
import { ViewState } from '../types';
import { BookOpen, Calendar, Clock, ChevronRight, FileSpreadsheet } from 'lucide-react';

export function Homework({ onViewChange }: { onViewChange: (view: ViewState) => void }) {
  const isLight = !document.documentElement.classList.contains('dark');
  const textMain = isLight ? 'text-slate-900' : 'text-slate-100';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';
  const bgPanel = isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700';

  const assignments: any[] = [];

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${textMain} mb-2 flex items-center gap-3`}>
          <BookOpen className="text-brand-purple" size={32} />
          Homework Assignments
        </h1>
        <p className={textMuted}>Complete your pending assignments to earn extra coins and XP!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Stats Cards */}
        <div className={`p-6 rounded-2xl border ${bgPanel} shadow-sm flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className={`text-sm font-medium ${textMuted}`}>Pending</p>
            <p className={`text-2xl font-bold ${textMain}`}>0</p>
          </div>
        </div>
        <div className={`p-6 rounded-2xl border ${bgPanel} shadow-sm flex items-center gap-4`}>
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div>
            <p className={`text-sm font-medium ${textMuted}`}>Completed This Week</p>
            <p className={`text-2xl font-bold ${textMain}`}>0</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className={`text-xl font-bold ${textMain} mb-4`}>Active Assignments</h2>
        
        {assignments.length === 0 ? (
          <div className={`p-10 text-center rounded-2xl border ${bgPanel} border-dashed`}>
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-slate-400" />
            </div>
            <h3 className={`text-xl font-bold ${textMain} mb-2`}>You're all caught up!</h3>
            <p className={textMuted}>No pending homework assignments right now. Enjoy your free time!</p>
          </div>
        ) : (
          assignments.map(assignment => (
            <div key={assignment.id} className={`p-6 rounded-2xl border ${bgPanel} shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    assignment.status === 'completed' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    {assignment.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                  <span className={`text-sm font-medium ${textMuted}`}>{assignment.type}</span>
                </div>
                <h3 className={`text-lg font-bold ${textMain} mb-1`}>{assignment.title}</h3>
                <p className={`text-sm ${textMuted} flex items-center gap-1`}>
                  <Clock size={14} /> Due: {assignment.dueDate}
                </p>
              </div>
              
              <button className={`shrink-0 px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 ${
                assignment.status === 'completed'
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  : 'bg-brand-purple text-white hover:bg-brand-purple/90'
              }`}>
                {assignment.status === 'completed' ? 'Review' : 'Start Assignment'}
                <ChevronRight size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
