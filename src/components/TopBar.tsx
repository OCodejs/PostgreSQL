import React from 'react';
import { Download, Menu, Moon, Sun, Globe } from 'lucide-react';
import { Language, NavSection } from '../types/infra';
import { Translations } from '../i18n/translations';

interface TopBarProps {
  activeSection: NavSection;
  t: Translations;
  lang: Language;
  onToggleLang: (lang: Language) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onOpenExport: () => void;
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  t,
  lang,
  onToggleLang,
  darkMode,
  onToggleDark,
  onOpenExport,
  onOpenMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:inline">
            {t.breadcrumbs.root}
          </span>
          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {t.breadcrumbs[activeSection]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div
          className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg"
          role="group"
          aria-label="Language"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1.5 mr-1 hidden sm:block" />
          <button
            type="button"
            onClick={() => onToggleLang('vi')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'vi'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            VI
          </button>
          <button
            type="button"
            onClick={() => onToggleLang('en')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              lang === 'en'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            EN
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleDark}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{t.actions.exportBundle}</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  );
};
