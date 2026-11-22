import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Shield,
  SlidersHorizontal,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import { ActiveView } from '../types/marketplace';
import { AvatarImage } from './SafeImage';
import { PWAInstallButton } from './PWAInstallModal';

export const TopNav: React.FC = () => {
  const {
    firebaseUser,
    currentUserProfile,
    isAdmin,
    activeView,
    setActiveView,
    setSelectedEditorId,
    language,
    notifications,
    markNotificationRead,
    signInWithGoogle,
    signOutUser,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'home', label: t(language, 'navHome') },
    { id: 'editors', label: t(language, 'navEditors') },
    { id: 'projects', label: t(language, 'navProjects') },
    { id: 'messages', label: t(language, 'navMessages') },
    { id: 'dashboard', label: t(language, 'navDashboard') },
  ];

  const handleNavigate = (view: ActiveView) => {
    if (view === 'profile' && firebaseUser) {
      setSelectedEditorId(firebaseUser.uid);
    }
    setActiveView(view);
    setMenuOpen(false);
    setNotifOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavigate('home')}
          className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded"
        >
          {t(language, 'brand')}
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-7" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded ${
                  isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-[21px] h-[2px] bg-gradient-to-r from-violet-600 to-blue-600" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action / Account Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton variant="header" />
          {!firebaseUser ? (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-lg transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t(language, 'signIn')}
            </button>
          ) : (
            <div className="relative flex items-center gap-2">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setMenuOpen(false);
                  }}
                  aria-label="Notifications"
                  className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors relative"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-semibold bg-violet-600 text-white rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-900">Notifications</span>
                      <span className="text-xs text-slate-500 tabular-nums">{unreadCount} unread</span>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No notifications yet.</p>
                    ) : (
                      <div className="max-h-72 overflow-y-auto space-y-1.5">
                        {notifications.slice(0, 12).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotificationRead(n.id);
                              setNotifOpen(false);
                              if (n.linkView === 'messages' || n.linkView === 'dashboard' || n.linkView === 'profile') {
                                handleNavigate(n.linkView as ActiveView);
                              }
                            }}
                            className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                              n.read ? 'bg-transparent hover:bg-slate-50' : 'bg-violet-50 hover:bg-violet-100/70'
                            }`}
                          >
                            <div className="text-xs font-semibold text-slate-900">{n.title}</div>
                            <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.body}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Account Dropdown Trigger */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <AvatarImage
                  src={currentUserProfile?.avatarUrl || firebaseUser.photoURL}
                  alt={currentUserProfile?.displayName || firebaseUser.displayName || 'Account'}
                  fallbackInitial={currentUserProfile?.displayName || firebaseUser.displayName || 'U'}
                  className="w-6 h-6 rounded-md object-cover bg-slate-200 shrink-0"
                  fallbackClassName="w-6 h-6 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold shrink-0"
                />
                <span className="hidden sm:inline text-sm font-medium text-slate-900 max-w-[130px] truncate">
                  {currentUserProfile?.displayName || firebaseUser.displayName || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {currentUserProfile?.displayName || firebaseUser.displayName}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {currentUserProfile ? `${currentUserProfile.role.toUpperCase()} · ${currentUserProfile.country}` : 'Complete registration'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate('profile')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>{t(language, 'navProfile')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate('settings')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                    <span>{t(language, 'navSettings')}</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleNavigate('admin')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-blue-600 hover:bg-slate-50 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{t(language, 'navAdmin')}</span>
                    </button>
                  )}
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={signOutUser}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t(language, 'signOut')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle Menu"
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:text-slate-900 border border-slate-200"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                activeView === item.id ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
          {firebaseUser && (
            <>
              <button
                type="button"
                onClick={() => handleNavigate('profile')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t(language, 'navProfile')}
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('settings')}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t(language, 'navSettings')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavigate('admin')}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-slate-50"
                >
                  {t(language, 'navAdmin')}
                </button>
              )}
            </>
          )}
          <div className="pt-2">
            <PWAInstallButton variant="mobile-drawer" onActionComplete={() => setMobileOpen(false)} />
          </div>
          <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500 px-3">
            <Globe className="w-3.5 h-3.5" />
            <span>Global Marketplace · EN / HI</span>
          </div>
        </div>
      )}
    </header>
  );
};
