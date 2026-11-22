import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Globe, Play, ShieldCheck, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatFromUsd } from '../lib/currency';
import { t } from '../lib/i18n';
import { computeEditorStats } from '../lib/stats';
import { CURRENCIES, CurrencyCode, EDITING_CATEGORIES, SUPPORTED_COUNTRIES } from '../types/marketplace';
import { AvatarImage, SafeImage } from './SafeImage';

interface HomeViewProps {
  onSelectCategory: (category: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectCategory }) => {
  const {
    firebaseUser,
    language,
    setLanguage,
    country,
    setCountry,
    currency,
    setCurrency,
    exchangeRates,
    users,
    projects,
    transactions,
    reviews,
    platformConfig,
    setActiveView,
    setSelectedEditorId,
    signInWithGoogle,
  } = useApp();

  const [heroVideoPlaying, setHeroVideoPlaying] = useState(false);

  const editors = users.filter((u) => u.role === 'editor' && !u.isBlocked);
  const openProjects = projects.filter((p) => p.status === 'pending');
  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  return (
    <div className="space-y-20 pb-20 bg-white">
      {/* Hero Split Section */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-10 sm:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
            <div className="space-y-5">
              <div className="text-xs font-semibold tracking-wide text-violet-600">
                {t(language, 'tagline')}
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 leading-[1.12] tracking-tight text-balance font-display">
                {t(language, 'heroTitle')}
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                {t(language, 'heroSubtitle')}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveView('editors')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl transition-all shadow-sm"
                >
                  <span>{t(language, 'exploreEditorsBtn')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('projects')}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                >
                  <span>{t(language, 'browseProjectsBtn')}</span>
                </button>
                {!firebaseUser && (
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                  >
                    <span>{t(language, 'joinAsEditor')}</span>
                  </button>
                )}
              </div>

              {/* Clean Regional Locale & Currency Selector Toolbar */}
              <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    aria-label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value, true)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-violet-600"
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  aria-label="Currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                >
                  {Object.values(CURRENCIES).map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.code} ({cur.symbol})
                    </option>
                  ))}
                </select>

                <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('hi')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      language === 'hi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Media Panel (Playable HD Studio Showreel) */}
          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
              {heroVideoPlaying ? (
                <video
                  src="/media/studio-showreel.mp4"
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <SafeImage
                    src="/src/assets/images/hero_studio_suite_1795326771866.jpg"
                    alt="Post-production color grading and editing studio"
                    fallbackTitle="Post-Production & Color Grading Suite"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          Post-Production & Color Grading Suite
                        </div>
                        <div className="text-xs text-slate-200 mt-0.5">
                          4K Cinema Editing · Motion Graphics · Brand Design
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHeroVideoPlaying(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/95 hover:bg-white text-slate-900 text-xs font-semibold transition-colors shrink-0 shadow"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play Showreel</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Full-width Live Database Summary Strip below hero */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-b border-slate-200 py-6">
          <div>
            <div className="text-xs text-slate-500">Registered Creators</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editors.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Open Client Briefs</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {openProjects.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Completed Projects</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {projects.filter((p) => p.status === 'completed').length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Supported Currencies</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              7 Global
            </div>
          </div>
        </div>
      </section>

      {/* 12 Editing Categories */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">
              {t(language, 'categoriesTitle')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">{t(language, 'categoriesSubtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('editors')}
            className="text-sm font-semibold text-violet-600 hover:text-violet-700 whitespace-nowrap"
          >
            Browse all creators →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat, idx) => {
            const count = editors.filter((e) => e.categories.includes(cat)).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className="text-left p-4 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-200 hover:border-violet-500 transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>{String(idx + 1).padStart(2, '0')}</span>
                  <span className="tabular-nums">{count} editors</span>
                </div>
                <div className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 mt-2">
                  {cat}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Playable Craft Showcase (Cinema Reel & Brand Identity) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-display">{t(language, 'showcaseTitle')}</h2>
          <p className="text-sm text-slate-600 mt-1">{t(language, 'showcaseSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <div className="aspect-video bg-black">
              <video
                src="/media/cinema-grade-demo.mp4"
                poster="/src/assets/images/portfolio_cinema_reel_1795326770511.jpg"
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Commercial Color & Motion Reel</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Video Editing · VFX Editing · DaVinci Resolve Grading
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategory('Video Editing')}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-800 whitespace-nowrap"
              >
                Find Video Editors
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
            <div className="aspect-video bg-slate-900 overflow-hidden">
              <SafeImage
                src="/src/assets/images/portfolio_brand_identity_1795326771475.jpg"
                alt="Luxury monogram logo and graphic identity showcase"
                fallbackTitle="Brand Identity & Thumbnail Systems"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Brand Identity & Thumbnail Systems</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Logo Designing · Graphic Designing · Thumbnail Designing
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategory('Logo Designing')}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-800 whitespace-nowrap"
              >
                Find Designers
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Registered Editors Preview */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">
              {t(language, 'featuredEditorsTitle')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Verified statistics computed live from completed marketplace contracts.
            </p>
          </div>
        </div>

        {editors.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center space-y-4">
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {t(language, 'featuredEditorsEmpty')}
            </p>
            <button
              type="button"
              onClick={firebaseUser ? () => setActiveView('profile') : signInWithGoogle}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors"
            >
              {firebaseUser ? 'Manage Profile' : t(language, 'joinAsEditor')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {editors.slice(0, 6).map((editor) => {
              const stats = computeEditorStats(editor.uid, projects, transactions, reviews);
              return (
                <button
                  key={editor.uid}
                  type="button"
                  onClick={() => {
                    setSelectedEditorId(editor.uid);
                    setActiveView('profile');
                  }}
                  className="text-left rounded-2xl border border-slate-200 bg-white hover:border-violet-500 p-5 transition-all space-y-4"
                >
                  <div className="flex items-start gap-3.5">
                    <AvatarImage
                      src={editor.avatarUrl}
                      alt={editor.displayName}
                      fallbackInitial={editor.displayName}
                      className="w-12 h-12 rounded-xl object-cover bg-slate-100 shrink-0"
                      fallbackClassName="w-12 h-12 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-semibold text-slate-900 truncate">
                          {editor.displayName}
                        </span>
                        {editor.verifiedByAdmin && (
                          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        @{editor.username} · {editor.country}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{editor.bio}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        {stats.reviewCount > 0 ? stats.averageRating.toFixed(1) : 'New'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{stats.totalProjectsCompleted} done</span>
                    </div>
                    <div className="font-semibold text-slate-900 font-mono tabular-nums">
                      {formatFromUsd(editor.startingPriceUsd, currency, exchangeRates)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Open Projects Preview */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 font-display">
              {t(language, 'openProjectsTitle')}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Active global project briefs ready for editor proposals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('projects')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            View project board →
          </button>
        </div>

        {openProjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center space-y-4">
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {t(language, 'openProjectsEmpty')}
            </p>
            <button
              type="button"
              onClick={() => setActiveView('projects')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
            >
              {t(language, 'postProject')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openProjects.slice(0, 4).map((proj) => (
              <div
                key={proj.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-xs text-slate-500">
                    {proj.category} · {proj.clientCountry} · Due {proj.deadline}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{proj.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{proj.description}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                    {formatFromUsd(proj.budgetUsd, currency, exchangeRates)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveView('projects')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Open Brief</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
