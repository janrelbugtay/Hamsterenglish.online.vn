import React from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ViewState } from '../types';
import { HamsterBrandLogo } from './HamsterBrandLogo';

function TikTokIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1Z" />
    </svg>
  );
}

function FacebookIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95Z" />
    </svg>
  );
}

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column + TikTok & Facebook Buttons */}
          <div className="col-span-1 md:col-span-2 flex flex-col items-start">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className="mb-4 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple rounded-2xl"
            >
              <HamsterBrandLogo variant="footer" />
            </button>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed font-medium mb-5">
              {t('footer.tagline')}
            </p>

            {/* TikTok & Facebook Social Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://www.tiktok.com/@hamsterenglish.online"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#25F4EE] via-slate-950 to-[#FE2C55] p-0.5 flex items-center justify-center">
                  <span className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center text-white">
                    <TikTokIcon className="w-4 h-4" />
                  </span>
                </span>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-semibold text-slate-300">Follow on</span>
                  <span className="font-extrabold tracking-tight">TikTok</span>
                </div>
                <ExternalLink size={13} className="text-slate-400 group-hover:text-white transition-colors ml-0.5" />
              </a>

              <a
                href="https://www.facebook.com/hamsterenglish.online"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <span className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center text-white">
                  <FacebookIcon className="w-4 h-4" />
                </span>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] font-semibold text-blue-100">Join us on</span>
                  <span className="font-extrabold tracking-tight">Facebook</span>
                </div>
                <ExternalLink size={13} className="text-blue-200 group-hover:text-white transition-colors ml-0.5" />
              </a>
            </div>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-4">
              {t('footer.platform')}
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('games')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  {t('footer.gamesLibrary')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('my-slides')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  {t('nav.mySlides')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('class-rewards')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  {t('nav.classRewards')}
                </button>
              </li>
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-4">
              {t('footer.resources')}
            </h4>
            <ul className="space-y-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('public-dashboard')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  {t('footer.teacherCommunity')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('homework')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  {t('nav.homework')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('squid-game-picker')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  Name Picker
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('sleeping-hamster')}
                  className="hover:text-brand-purple dark:hover:text-purple-400 transition-colors cursor-pointer text-left"
                >
                  Noise Control
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
          <p>{t('footer.rights')}</p>
          <p className="flex items-center gap-1.5">
            {t('footer.createdBy')} <Heart size={15} className="text-rose-500 fill-rose-500 shrink-0" /> {t('footer.forTeachers')}
          </p>
        </div>
      </div>
    </footer>
  );
}
