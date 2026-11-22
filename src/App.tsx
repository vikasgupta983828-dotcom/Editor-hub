import React, { useState } from 'react';
import { ArrowLeft, Briefcase, Home, LayoutDashboard, MessageSquare, Users } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopNav } from './components/TopNav';
import { OfflineIndicator } from './components/PWAInstallModal';
import { OnboardingModal } from './components/OnboardingModal';
import { HomeView } from './components/HomeView';
import { ExploreEditorsView } from './components/ExploreEditorsView';
import { FindProjectsView } from './components/FindProjectsView';
import { MessagesView } from './components/MessagesView';
import { DashboardView } from './components/DashboardView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { t } from './lib/i18n';
import { ActiveView } from './types/marketplace';

const VIEW_LABEL_KEYS: Record<ActiveView, Parameters<typeof t>[1]> = {
  home: 'navHome',
  editors: 'navEditors',
  projects: 'navProjects',
  messages: 'navMessages',
  dashboard: 'navDashboard',
  profile: 'navProfile',
  settings: 'navSettings',
  admin: 'navAdmin',
};

const MarketplaceShell: React.FC = () => {
  const { activeView, setActiveView, previousView, goBack, language, toast } = useApp();
  const [editorFilterCategory, setEditorFilterCategory] = useState('All');

  const handleSelectCategoryFromHome = (category: string) => {
    setEditorFilterCategory(category);
    setActiveView('editors');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col pb-14 md:pb-0">
      <TopNav />

      <main className="flex-1 bg-white">
        {activeView !== 'home' && (
          <div className="border-b border-slate-100 bg-slate-50/50">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-600" />
                  <span>{t(language, 'backBtn')}</span>
                </button>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 truncate">
                  {previousView && (
                    <>
                      <button
                        type="button"
                        onClick={goBack}
                        className="hover:text-slate-900 transition-colors truncate"
                      >
                        {t(language, VIEW_LABEL_KEYS[previousView])}
                      </button>
                      <span aria-hidden="true">/</span>
                    </>
                  )}
                  <span className="font-medium text-slate-800 truncate">
                    {t(language, VIEW_LABEL_KEYS[activeView])}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                {t(language, 'backToHome')}
              </button>
            </div>
          </div>
        )}

        {activeView === 'home' && <HomeView onSelectCategory={handleSelectCategoryFromHome} />}
        {activeView === 'editors' && (
          <ExploreEditorsView key={editorFilterCategory} initialCategory={editorFilterCategory} />
        )}
        {activeView === 'projects' && <FindProjectsView />}
        {activeView === 'messages' && <MessagesView />}
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'profile' && <ProfileView />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'admin' && <AdminView />}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50/70">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-900">{t(language, 'brand')}</span>
            <span className="mx-2">·</span>
            <span>{t(language, 'mission')}</span>
          </div>
          <div className="flex items-center gap-5 shrink-0">
            <button type="button" onClick={() => setActiveView('editors')} className="hover:text-slate-900">
              {t(language, 'navEditors')}
            </button>
            <button type="button" onClick={() => setActiveView('projects')} className="hover:text-slate-900">
              {t(language, 'navProjects')}
            </button>
            <button type="button" onClick={() => setActiveView('profile')} className="hover:text-slate-900">
              {t(language, 'navProfile')}
            </button>
            <button type="button" onClick={() => setActiveView('settings')} className="hover:text-slate-900">
              {t(language, 'navSettings')}
            </button>
          </div>
        </div>
      </footer>

      <OnboardingModal />
      <OfflineIndicator />

      {/* Mobile App Bottom Tab Bar (for standalone Android/iOS & mobile web UX) */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5"
      >
        {(
          [
            { id: 'home', label: t(language, 'navHome'), icon: Home },
            { id: 'editors', label: 'Editors', icon: Users },
            { id: 'projects', label: 'Projects', icon: Briefcase },
            { id: 'messages', label: t(language, 'navMessages'), icon: MessageSquare },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                active ? 'text-violet-700 font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[64px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-16 md:bottom-5 right-4 md:right-5 z-50 px-4 py-3 rounded-xl border text-xs font-medium shadow-lg ${
            toast.kind === 'error'
              ? 'bg-rose-600 border-rose-700 text-white'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MarketplaceShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
