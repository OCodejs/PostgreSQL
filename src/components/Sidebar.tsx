import React from 'react';
import { User } from 'firebase/auth';
import {
  Activity,
  Database,
  FileCode2,
  HardDriveDownload,
  Lock,
  GitBranch,
  LogIn,
  LogOut,
  Plug,
  X,
} from 'lucide-react';
import { Language, NavSection } from '../types/infra';
import { Translations } from '../i18n/translations';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  t: Translations;
  lang: Language;
  brandName: string;
  repoSlug: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: User | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: NavSection; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', icon: Activity },
  { id: 'blueprints', icon: FileCode2 },
  { id: 'optimization', icon: Database },
  { id: 'backups', icon: HardDriveDownload },
  { id: 'security', icon: Lock },
  { id: 'cicd', icon: GitBranch },
  { id: 'integrations', icon: Plug },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  t,
  lang,
  brandName,
  repoSlug,
  mobileOpen,
  onCloseMobile,
  user,
  authLoading,
  onSignIn,
  onSignOut,
}) => {
  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((s) => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'OC';

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div>
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {brandName || 'ocodejs'}
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={t.actions.close}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelectSection(id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-left min-h-[42px] ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-teal-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="truncate">{t.nav[id]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-xs font-semibold font-mono shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user ? user.displayName || user.email : repoSlug}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {user
                ? lang === 'vi'
                  ? 'Đã đồng bộ Firestore'
                  : 'Firestore synced'
                : lang === 'vi'
                ? 'Lưu trữ phân tán'
                : 'Distributed Storage'}
            </p>
          </div>
        </div>

        {!authLoading &&
          (user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng xuất' : 'Sign out'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đăng nhập Google Cloud Sync' : 'Sign in with Google'}</span>
            </button>
          ))}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
