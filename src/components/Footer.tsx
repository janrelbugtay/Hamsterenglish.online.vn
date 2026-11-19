import React from 'react';
import { Heart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ViewState } from '../types';

export function Footer({ onViewChange }: { onViewChange?: (view: ViewState) => void }) {
  const { t } = useLanguage();

  const handleNav = (view: ViewState) => {
    if (onViewChange) {
      onViewChange(view);
    }
  };

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-16 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="col-span-1 md:col-span-2">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className="flex items-center gap-2.5 mb-4 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple rounded-xl"
            >
              <img
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000"
                alt="Hamster English Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-sm"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/bubble-pop-card.jpg?v=3';
                }}
              />
              <span className="font-display font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-brand-purple transition-colors">
                Hamster English <span className="text-brand-purple">- ESL Studio</span>
              </span>
            </button>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              {t('footer.tagline')}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">{t('footer.platform')}</h4>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('games')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('footer.gamesLibrary')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('generator')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('footer.aiGenerator')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('my-slides')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('nav.mySlides')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('class-rewards')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('nav.classRewards')}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">{t('footer.resources')}</h4>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('public-dashboard')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('footer.teacherCommunity')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('homework')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  {t('nav.homework')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('squid-game-picker')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  Name Picker
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('sleeping-hamster')}
                  className="hover:text-brand-purple transition-colors cursor-pointer text-left"
                >
                  Noise Control
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>{t('footer.rights')}</p>
          <p className="flex items-center gap-1.5">
            {t('footer.createdBy')} <Heart size={14} className="text-brand-orange shrink-0" /> {t('footer.forTeachers')}
          </p>
        </div>
      </div>
    </footer>
  );
}
