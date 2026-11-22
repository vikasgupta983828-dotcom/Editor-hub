import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertCurrencyToUsd, convertUsdToCurrency } from '../lib/currency';
import { t } from '../lib/i18n';
import { uploadMediaFile } from '../lib/upload';
import {
  CURRENCIES,
  CurrencyCode,
  EDITING_CATEGORIES,
  LanguageCode,
  SUPPORTED_COUNTRIES,
} from '../types/marketplace';
import { AvatarImage } from './SafeImage';
import { PWAInstallButton } from './PWAInstallModal';

export const SettingsView: React.FC = () => {
  const {
    firebaseUser,
    currentUserProfile,
    currentUserPrivate,
    language,
    setLanguage,
    country,
    setCountry,
    currency,
    setCurrency,
    exchangeRates,
    platformConfig,
    saveUserProfile,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [displayName, setDisplayName] = useState(currentUserProfile?.displayName || '');
  const [username, setUsername] = useState(currentUserProfile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUserProfile?.avatarUrl || '');
  const [bio, setBio] = useState(currentUserProfile?.bio || '');
  const [skillsText, setSkillsText] = useState((currentUserProfile?.skills || []).join(', '));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    currentUserProfile?.categories || []
  );
  const [experienceYears, setExperienceYears] = useState(currentUserProfile?.experienceYears || 0);
  const [startingPriceLocal, setStartingPriceLocal] = useState(50);
  const [isPublicProfile, setIsPublicProfile] = useState(
    currentUserProfile?.isPublicProfile ?? true
  );

  // Private payout & security settings
  const [phone, setPhone] = useState(currentUserPrivate?.phone || '');
  const [payoutUpiId, setPayoutUpiId] = useState(currentUserPrivate?.payoutUpiId || '');
  const [payoutPaypalEmail, setPayoutPaypalEmail] = useState(
    currentUserPrivate?.payoutPaypalEmail || ''
  );
  const [payoutBankSummary, setPayoutBankSummary] = useState(
    currentUserPrivate?.payoutBankSummary || ''
  );
  const [emailNotifications, setEmailNotifications] = useState(
    currentUserPrivate?.emailNotifications ?? true
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUserProfile) {
      setDisplayName(currentUserProfile.displayName);
      setUsername(currentUserProfile.username);
      setAvatarUrl(currentUserProfile.avatarUrl);
      setBio(currentUserProfile.bio);
      setSkillsText(currentUserProfile.skills.join(', '));
      setSelectedCategories(currentUserProfile.categories);
      setExperienceYears(currentUserProfile.experienceYears);
      setStartingPriceLocal(
        Math.round(
          convertUsdToCurrency(currentUserProfile.startingPriceUsd, currency, exchangeRates)
        )
      );
      setIsPublicProfile(currentUserProfile.isPublicProfile);
    }
  }, [currentUserProfile, currency, exchangeRates]);

  useEffect(() => {
    if (currentUserPrivate) {
      setPhone(currentUserPrivate.phone);
      setPayoutUpiId(currentUserPrivate.payoutUpiId);
      setPayoutPaypalEmail(currentUserPrivate.payoutPaypalEmail);
      setPayoutBankSummary(currentUserPrivate.payoutBankSummary);
      setEmailNotifications(currentUserPrivate.emailNotifications);
    }
  }, [currentUserPrivate]);

  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadMediaFile(file);
      if (data.mediaCategory !== 'image') {
        throw new Error('Please choose an image file (JPG, PNG, WebP, GIF, AVIF, or HEIC).');
      }
      setAvatarUrl(data.url);
      showToast('Avatar uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !currentUserProfile) return;
    setSaving(true);
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);
      const startingPriceUsd =
        currentUserProfile.role === 'editor'
          ? Math.max(5, convertCurrencyToUsd(startingPriceLocal, currency, exchangeRates))
          : 0;

      await saveUserProfile(
        {
          username,
          displayName,
          role: currentUserProfile.role,
          country,
          language,
          preferredCurrency: currency,
          avatarUrl,
          bio,
          skills,
          categories: selectedCategories,
          experienceYears,
          startingPriceUsd,
          isPublicProfile,
        },
        {
          phone,
          payoutUpiId,
          payoutPaypalEmail,
          payoutBankSummary,
          emailNotifications,
        }
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 font-display">{t(language, 'navSettings')}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure global region, language, currency, privacy controls, and payout methods.
        </p>
      </div>

      {/* Regional Preferences (works even before sign-in) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Region, Language & Currency</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t(language, 'countryLabel')}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value, true)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t(language, 'currencyLabel')}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
            >
              {Object.values(CURRENCIES).map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.code} ({cur.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t(language, 'languageLabel')}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile App Mode & Android WebAPK Install */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{t(language, 'appModeTitle')}</h2>
          <p className="text-xs text-slate-600 mt-1">
            Install Editing Hub on Android (Chrome WebAPK), iPhone/iPad, or desktop for full-screen standalone launch and offline caching, or export a signed .apk via PWABuilder.
          </p>
        </div>
        <PWAInstallButton variant="settings" />
      </div>

      {!firebaseUser ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center space-y-3">
          <p className="text-sm text-slate-600">Sign in to edit your profile, privacy, and payout preferences.</p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
          >
            {t(language, 'signIn')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900">Public Profile Details</h2>

            <div className="flex flex-wrap items-center gap-4">
              <AvatarImage
                src={avatarUrl}
                alt={displayName || 'Profile Avatar'}
                fallbackInitial={displayName || 'U'}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                fallbackClassName="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0"
              />
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'Uploading...' : 'Change Profile Photo'}</span>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-xs font-medium text-slate-500 hover:text-rose-600"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            {currentUserProfile?.role === 'editor' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Starting Price ({CURRENCIES[currency].symbol} {currency})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={startingPriceLocal}
                      onChange={(e) => setStartingPriceLocal(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const active = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setSelectedCategories((prev) =>
                              prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                            )
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                            active
                              ? 'bg-violet-50 border-violet-600 text-violet-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Payout & Privacy Controls */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Private Payout & Security Controls</h2>
            <p className="text-xs text-slate-600">
              PII and payout credentials are stored in a strictly private user subcollection.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">UPI ID (India Payouts)</label>
                <input
                  type="text"
                  value={payoutUpiId}
                  onChange={(e) => setPayoutUpiId(e.target.value)}
                  placeholder="name@okaxis"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">PayPal Email</label>
                <input
                  type="email"
                  value={payoutPaypalEmail}
                  onChange={(e) => setPayoutPaypalEmail(e.target.value)}
                  placeholder="payouts@domain.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Bank / SWIFT Reference
                </label>
                <input
                  type="text"
                  value={payoutBankSummary}
                  onChange={(e) => setPayoutBankSummary(e.target.value)}
                  placeholder="Bank Name · Last 4 digits"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublicProfile}
                  onChange={(e) => setIsPublicProfile(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600"
                />
                <span>Publicly visible in Explore Editors directory</span>
              </label>

              <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="rounded border-slate-300 text-violet-600"
                />
                <span>Receive project & message alerts</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving...' : t(language, 'saveChanges')}
          </button>
        </form>
      )}
    </div>
  );
};
