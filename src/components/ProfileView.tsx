import React, { useState } from 'react';
import {
  Briefcase,
  Heart,
  MessageSquare,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertCurrencyToUsd, formatFromUsd } from '../lib/currency';
import { t } from '../lib/i18n';
import { computeEditorStats, formatRelativeDate } from '../lib/stats';
import { uploadMediaFile } from '../lib/upload';
import { CURRENCIES, EDITING_CATEGORIES, PortfolioItem, Project } from '../types/marketplace';
import { PaymentModal } from './PaymentModal';
import { AvatarImage, SafeImage } from './SafeImage';

export const ProfileView: React.FC = () => {
  const {
    firebaseUser,
    currentUserProfile,
    language,
    currency,
    exchangeRates,
    users,
    portfolioItems,
    projects,
    transactions,
    reviews,
    favorites,
    onlineUserIds,
    platformConfig,
    selectedEditorId,
    setActiveView,
    toggleFavoriteEditor,
    startConversationWith,
    addPortfolioItem,
    deletePortfolioItem,
    createProject,
    signInWithGoogle,
    showToast,
  } = useApp();

  const targetUid = selectedEditorId || firebaseUser?.uid || null;
  const profile =
    users.find((u) => u.uid === targetUid) ||
    (currentUserProfile?.uid === targetUid ? currentUserProfile : null);

  const isOwnProfile = Boolean(firebaseUser && profile && firebaseUser.uid === profile.uid);

  // Portfolio upload modal state
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaCategory, setMediaCategory] = useState<string>(EDITING_CATEGORIES[0]);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaDesc, setMediaDesc] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);

  // Lightbox state
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);

  // Direct Hire Modal state
  const [showHireModal, setShowHireModal] = useState(false);
  const [hireTitle, setHireTitle] = useState('');
  const [hireCategory, setHireCategory] = useState<string>(EDITING_CATEGORIES[0]);
  const [hireBudgetLocal, setHireBudgetLocal] = useState(100);
  const [hireDeadline, setHireDeadline] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [hireDesc, setHireDesc] = useState('');
  const [checkoutProject, setCheckoutProject] = useState<{
    project: Project;
    budgetUsd: number;
  } | null>(null);

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 font-display">Profile Not Selected</h2>
        <p className="text-sm text-slate-600">
          Sign in to manage your profile or select a creator from Explore Editors.
        </p>
        <div className="flex justify-center gap-3">
          {!firebaseUser && (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
            >
              {t(language, 'signIn')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('editors')}
            className="px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl"
          >
            {t(language, 'exploreEditorsBtn')}
          </button>
        </div>
      </div>
    );
  }

  const stats = computeEditorStats(profile.uid, projects, transactions, reviews);
  const userPortfolio = portfolioItems.filter((item) => item.editorId === profile.uid);
  const demoVideos = userPortfolio.filter((item) => item.mediaType === 'video');
  const imageGallery = userPortfolio.filter((item) => item.mediaType === 'image');
  const editorReviews = reviews.filter((r) => r.editorId === profile.uid);
  const isFav = favorites.some((f) => f.editorId === profile.uid);
  const isOnline = onlineUserIds.has(profile.uid);

  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const data = await uploadMediaFile(file);
      setMediaUrl(data.url);
      setMediaType(data.mediaCategory === 'video' ? 'video' : 'image');
      showToast('Media file uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploadingMedia(false);
    }
  };

  const handleSavePortfolioItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl.trim()) {
      showToast('Please upload a video or image file first.', 'error');
      return;
    }
    setSavingMedia(true);
    try {
      await addPortfolioItem({
        title: mediaTitle,
        category: mediaCategory,
        mediaType,
        mediaUrl,
        thumbnailUrl: mediaType === 'image' ? mediaUrl : '',
        description: mediaDesc,
        durationSec: mediaType === 'video' ? 30 : 0,
      });
      setShowAddMedia(false);
      setMediaTitle('');
      setMediaUrl('');
      setMediaDesc('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save portfolio item', 'error');
    } finally {
      setSavingMedia(false);
    }
  };

  const handleStartHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !currentUserProfile) return;
    try {
      const budgetUsd = Math.max(5, convertCurrencyToUsd(hireBudgetLocal, currency, exchangeRates));
      const projId = await createProject({
        title: hireTitle,
        category: hireCategory,
        description: hireDesc,
        budgetUsd,
        originalBudget: hireBudgetLocal,
        originalCurrency: currency,
        deadline: hireDeadline,
        referenceUrl: '',
      });
      const createdProj = {
        id: projId,
        clientId: firebaseUser.uid,
        clientName: currentUserProfile.displayName,
        clientCountry: currentUserProfile.country,
        editorId: '',
        editorName: '',
        title: hireTitle,
        category: hireCategory,
        description: hireDesc,
        budgetUsd,
        originalBudget: hireBudgetLocal,
        originalCurrency: currency,
        deadline: hireDeadline,
        referenceUrl: '',
        deliveryUrl: '',
        deliveryNotes: '',
        revisionNotes: '',
        status: 'pending' as const,
        paymentStatus: 'unpaid' as const,
        paymentMethod: '',
        reviewed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setShowHireModal(false);
      setCheckoutProject({ project: createdProj, budgetUsd });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to initiate hire', 'error');
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      {/* Header Identity Block */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <AvatarImage
            src={profile.avatarUrl}
            alt={profile.displayName}
            fallbackInitial={profile.displayName}
            className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shrink-0"
            fallbackClassName="w-24 h-24 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-3xl font-bold shrink-0"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
                {profile.displayName}
              </h1>
              {profile.verifiedByAdmin && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                  <ShieldCheck className="w-4 h-4" />
                  {t(language, 'verifiedBadge')}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600">
              @{profile.username} · {profile.role.toUpperCase()} · {profile.country} ·{' '}
              {profile.language === 'hi' ? 'Hindi / English' : 'English'} ·{' '}
              <span className={isOnline ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                {isOnline ? t(language, 'onlineStatus') : t(language, 'offlineStatus')}
              </span>
            </div>
            <p className="text-sm text-slate-700 max-w-2xl leading-relaxed">{profile.bio}</p>
            {profile.role === 'editor' && (
              <div className="text-xs text-slate-600 pt-1">
                <span className="text-slate-500 font-medium">Skills:</span> {profile.skills.join(' · ') || '—'}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
          {profile.role === 'editor' && (
            <div className="lg:text-right">
              <div className="text-xs text-slate-500">{t(language, 'startingAt')}</div>
              <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {formatFromUsd(profile.startingPriceUsd, currency, exchangeRates)}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              <>
                {profile.role === 'editor' && (
                  <button
                    type="button"
                    onClick={() => setShowAddMedia(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload Demo / Portfolio</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveView('settings')}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl"
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleFavoriteEditor(profile.uid)}
                  className="p-2.5 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-600 bg-white"
                  aria-label="Favourite editor"
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!firebaseUser) {
                      await signInWithGoogle();
                      return;
                    }
                    await startConversationWith(profile);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t(language, 'messageEditor')}</span>
                </button>
                {profile.role === 'editor' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!firebaseUser) {
                        await signInWithGoogle();
                        return;
                      }
                      setHireCategory(profile.categories[0] || EDITING_CATEGORIES[0]);
                      setHireBudgetLocal(
                        Math.round(profile.startingPriceUsd * (exchangeRates[currency] || 1))
                      );
                      setShowHireModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>{t(language, 'hireEditor')}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Real Database-Computed Editor Statistics */}
      {profile.role === 'editor' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'clientsServed')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {stats.totalClientsServed}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'projectsDone')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {stats.totalProjectsCompleted}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'videosEdited')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {stats.totalVideosEdited}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'designsDone')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {stats.totalDesignsCompleted}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'experienceLabel')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {profile.experienceYears} {t(language, 'yearsUnit')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'ratingLabel')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 inline-flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              {stats.reviewCount > 0 ? stats.averageRating.toFixed(1) : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Demo Video Section */}
      {profile.role === 'editor' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 font-display">Demo Videos & Editing Reels</h2>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => {
                  setMediaType('video');
                  setShowAddMedia(true);
                }}
                className="text-xs font-semibold text-violet-600 hover:text-violet-700"
              >
                + Upload Demo Video
              </button>
            )}
          </div>

          {demoVideos.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No demo videos uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {demoVideos.map((vid) => (
                <div
                  key={vid.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="aspect-video bg-black">
                    <video
                      src={vid.mediaUrl}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">{vid.category}</div>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">{vid.title}</h3>
                      {vid.description && (
                        <p className="text-xs text-slate-600 mt-1">{vid.description}</p>
                      )}
                    </div>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => deletePortfolioItem(vid.id)}
                        aria-label="Delete video"
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Portfolio Image Gallery */}
      {profile.role === 'editor' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 font-display">Portfolio Gallery</h2>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => {
                  setMediaType('image');
                  setShowAddMedia(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Upload Design Sample
              </button>
            )}
          </div>

          {imageGallery.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No portfolio images uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {imageGallery.map((img) => (
                <div
                  key={img.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden group"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxItem(img)}
                    className="block w-full aspect-[4/3] bg-slate-100 overflow-hidden"
                  >
                    <SafeImage
                      src={img.mediaUrl}
                      alt={img.title}
                      fallbackTitle={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                  <div className="p-4 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">{img.category}</div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">{img.title}</div>
                    </div>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => deletePortfolioItem(img.id)}
                        aria-label="Delete image"
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Client Reviews */}
      {profile.role === 'editor' && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 font-display">
            Verified Client Reviews ({editorReviews.length})
          </h2>
          {editorReviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No completed project reviews yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editorReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {rev.clientName} · {rev.category}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-amber-600 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rev.comment}</p>
                  <div className="text-xs text-slate-500">{formatRelativeDate(rev.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upload Portfolio Modal */}
      {showAddMedia && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Upload Demo Video or Portfolio Sample
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMedia(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePortfolioItem} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Title</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="e.g. YouTube Tech Review Cut & Motion Pack"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={mediaCategory}
                    onChange={(e) => setMediaCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Media Type</label>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'video' | 'image')}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                  >
                    <option value="video">Demo Video (MP4/WebM)</option>
                    <option value="image">Design / Thumbnail Image</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Upload File (Video or Image)
                </label>
                <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-slate-300 hover:border-violet-600 rounded-xl bg-slate-50 cursor-pointer text-xs text-slate-700">
                  <Upload className="w-4 h-4 text-violet-600" />
                  <span>
                    {uploadingMedia
                      ? 'Uploading...'
                      : mediaUrl
                        ? 'Replace uploaded file'
                        : 'Choose JPG, PNG, WebP, MP4, or WebM file'}
                  </span>
                  <input
                    type="file"
                    accept="video/*,image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif,.mp4,.webm,.mov"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {mediaUrl && (
                  <div className="mt-2.5 flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {mediaType === 'image' && (
                        <SafeImage
                          src={mediaUrl}
                          alt={mediaTitle || 'Uploaded preview'}
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                          fallbackClassName="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"
                        />
                      )}
                      <span className="text-xs text-slate-700 truncate">{mediaUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      className="text-xs font-medium text-rose-600 hover:text-rose-700 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={mediaDesc}
                  onChange={(e) => setMediaDesc(e.target.value)}
                  placeholder="Software used, color pipeline, or turnaround details..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <button
                type="submit"
                disabled={savingMedia || uploadingMedia}
                className="w-full py-3 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl disabled:opacity-50"
              >
                {savingMedia ? 'Saving...' : 'Publish to Portfolio'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal (dark framing reserved for media inspection) */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full space-y-3">
            <div className="flex items-center justify-between text-white">
              <div>
                <div className="text-base font-semibold">{lightboxItem.title}</div>
                <div className="text-xs text-zinc-400">{lightboxItem.category}</div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full max-h-[80vh] aspect-[4/3] rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <SafeImage
                src={lightboxItem.mediaUrl}
                alt={lightboxItem.title}
                fallbackTitle={lightboxItem.title}
                className="w-full h-full max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Direct Hire Brief Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display">
                  Hire {profile.displayName}
                </h3>
                <p className="text-xs text-slate-600">Create brief & fund project escrow</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHireModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartHire} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Project Title</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={hireTitle}
                  onChange={(e) => setHireTitle(e.target.value)}
                  placeholder="e.g. Brand Intro Reel Edit"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={hireCategory}
                    onChange={(e) => setHireCategory(e.target.value)}
                    className="w-full px-2.5 py-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Budget ({CURRENCIES[currency].symbol})
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={hireBudgetLocal}
                    onChange={(e) => setHireBudgetLocal(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Deadline</label>
                  <input
                    type="date"
                    required
                    value={hireDeadline}
                    onChange={(e) => setHireDeadline(e.target.value)}
                    className="w-full px-2.5 py-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Project Brief</label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  value={hireDesc}
                  onChange={(e) => setHireDesc(e.target.value)}
                  placeholder="Describe requirements, footage links, and deliverables..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl"
              >
                Continue to Escrow Checkout
              </button>
            </form>
          </div>
        </div>
      )}

      {checkoutProject && (
        <PaymentModal
          project={checkoutProject.project}
          editor={profile}
          agreedBudgetUsd={checkoutProject.budgetUsd}
          onClose={() => setCheckoutProject(null)}
        />
      )}
    </div>
  );
};
