import React, { useMemo, useState } from 'react';
import { Heart, MessageSquare, Search, ShieldCheck, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatFromUsd } from '../lib/currency';
import { t } from '../lib/i18n';
import { computeEditorStats } from '../lib/stats';
import { EDITING_CATEGORIES, SUPPORTED_COUNTRIES, UserProfile } from '../types/marketplace';
import { AvatarImage } from './SafeImage';

interface ExploreEditorsViewProps {
  initialCategory?: string;
}

export const ExploreEditorsView: React.FC<ExploreEditorsViewProps> = ({ initialCategory = 'All' }) => {
  const {
    firebaseUser,
    language,
    currency,
    exchangeRates,
    users,
    projects,
    transactions,
    reviews,
    favorites,
    onlineUserIds,
    platformConfig,
    setSelectedEditorId,
    setActiveView,
    toggleFavoriteEditor,
    startConversationWith,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'completed' | 'price_asc' | 'price_desc' | 'rating'>('completed');

  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  const editorsWithStats = useMemo(() => {
    const editors = users.filter((u) => u.role === 'editor' && !u.isBlocked);
    return editors
      .map((editor) => ({
        editor,
        stats: computeEditorStats(editor.uid, projects, transactions, reviews),
      }))
      .filter(({ editor }) => {
        if (selectedCategory !== 'All' && !editor.categories.includes(selectedCategory)) return false;
        if (selectedCountry !== 'All' && editor.country !== selectedCountry) return false;
        if (verifiedOnly && !editor.verifiedByAdmin) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const match =
            editor.displayName.toLowerCase().includes(q) ||
            editor.username.toLowerCase().includes(q) ||
            editor.country.toLowerCase().includes(q) ||
            editor.bio.toLowerCase().includes(q) ||
            editor.skills.some((s) => s.toLowerCase().includes(q)) ||
            editor.categories.some((c) => c.toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.editor.startingPriceUsd - b.editor.startingPriceUsd;
        if (sortBy === 'price_desc') return b.editor.startingPriceUsd - a.editor.startingPriceUsd;
        if (sortBy === 'rating') return b.stats.averageRating - a.stats.averageRating;
        return b.stats.totalProjectsCompleted - a.stats.totalProjectsCompleted;
      });
  }, [users, projects, transactions, reviews, selectedCategory, selectedCountry, verifiedOnly, searchTerm, sortBy]);

  const handleMessage = async (editor: UserProfile) => {
    if (!firebaseUser) {
      await signInWithGoogle();
      return;
    }
    if (firebaseUser.uid === editor.uid) {
      showToast('This is your own profile.', 'error');
      return;
    }
    try {
      await startConversationWith(editor);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to start chat', 'error');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">{t(language, 'navEditors')}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Discover video editors, motion designers, and graphic artists worldwide.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {editorsWithStats.length} creators matching filters
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(language, 'searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-violet-600"
          />
        </div>

        <select
          aria-label="Filter by category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-violet-600"
        >
          <option value="All">{t(language, 'allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by country"
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-violet-600"
        >
          <option value="All">{t(language, 'allCountries')}</option>
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <select
            aria-label="Sort editors"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="flex-1 px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-violet-600"
          >
            <option value="completed">Most Completed</option>
            <option value="rating">Highest Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={`px-3 py-2.5 text-xs font-medium rounded-xl border whitespace-nowrap transition-colors ${
              verifiedOnly
                ? 'bg-blue-50 border-blue-600 text-blue-700'
                : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
          >
            Verified
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {editorsWithStats.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center space-y-4">
          <p className="text-sm text-slate-600">
            No editors match your current filters yet. Reset filters or register an Editor profile to list your studio.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setSelectedCountry('All');
              setVerifiedOnly(false);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {editorsWithStats.map(({ editor, stats }) => {
            const isFav = favorites.some((f) => f.editorId === editor.uid);
            const isOnline = onlineUserIds.has(editor.uid);
            return (
              <div
                key={editor.uid}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <AvatarImage
                        src={editor.avatarUrl}
                        alt={editor.displayName}
                        fallbackInitial={editor.displayName}
                        className="w-14 h-14 rounded-xl object-cover bg-slate-100 shrink-0"
                        fallbackClassName="w-14 h-14 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg font-bold shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-semibold text-slate-900 truncate">
                            {editor.displayName}
                          </h3>
                          {editor.verifiedByAdmin && (
                            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          @{editor.username} · {editor.country}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span className={isOnline ? 'text-emerald-600 font-medium' : ''}>
                            {isOnline ? 'Online now' : 'Offline'}
                          </span>{' '}
                          · {editor.experienceYears} {t(language, 'yearsUnit')} exp
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFavoriteEditor(editor.uid)}
                      aria-label="Save favourite editor"
                      className="p-2 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{editor.bio}</p>

                  <div className="text-xs text-slate-500 leading-relaxed">
                    {editor.categories.slice(0, 3).join(' · ') || 'General Editing'}
                  </div>

                  {/* Real Database Stats Row */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <div className="text-slate-500">Completed</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {stats.totalProjectsCompleted}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Clients</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {stats.totalClientsServed}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Rating</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5 inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {stats.reviewCount > 0 ? `${stats.averageRating.toFixed(1)} (${stats.reviewCount})` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div>
                    <div className="text-[11px] text-slate-500">{t(language, 'startingAt')}</div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      {formatFromUsd(editor.startingPriceUsd, currency, exchangeRates)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleMessage(editor)}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                      aria-label="Message Editor"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEditorId(editor.uid);
                        setActiveView('profile');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {t(language, 'viewProfile')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
