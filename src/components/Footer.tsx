import React from 'react';
import { Heart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-20 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src="https://drive.google.com/thumbnail?id=1IrQAzr2JXZjfhDxPhP-MZkFlbF8GfW9n&sz=w1000" 
                alt="Hamster English Logo"
                className="w-10 h-10 rounded-xl object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
              <span className="font-display font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">
                Hamster English <span className="text-brand-purple">- ESL Studio</span>
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-brand-purple hover:text-white transition-colors cursor-pointer">
                <span className="font-bold">X</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-brand-purple hover:text-white transition-colors cursor-pointer">
                <span className="font-bold">in</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">{t('footer.platform')}</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.gamesLibrary')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.aiGenerator')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.pricing')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.forSchools')}</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">{t('footer.resources')}</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.helpCenter')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.teacherCommunity')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.blog')}</a></li>
              <li><a href="#" className="hover:text-brand-purple transition-colors">{t('footer.webinars')}</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>{t('footer.rights')}</p>
          <p className="flex items-center gap-1">
            {t('footer.createdBy')} <Heart size={14} className="text-brand-orange" /> {t('footer.forTeachers')}
          </p>
        </div>
      </div>
    </footer>
  );
}
