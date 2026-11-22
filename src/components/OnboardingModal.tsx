import React, { useState } from 'react';
import { Briefcase, Film, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertCurrencyToUsd, getCurrencyForCountry } from '../lib/currency';
import { sanitizeRemoteOrLocalUrl, uploadMediaFile } from '../lib/upload';
import {
  CURRENCIES,
  CurrencyCode,
  EDITING_CATEGORIES,
  LanguageCode,
  SUPPORTED_COUNTRIES,
  UserRole,
} from '../types/marketplace';
import { AvatarImage } from './SafeImage';

export const OnboardingModal: React.FC = () => {
  const {
    needsOnboarding,
    firebaseUser,
    country: detectedCountry,
    currency: detectedCurrency,
    language: detectedLanguage,
    exchangeRates,
    platformConfig,
    saveUserProfile,
    showToast,
  } = useApp();

  const [role, setRole] = useState<UserRole>('editor');
  const [username, setUsername] = useState(
    (firebaseUser?.displayName || 'creator').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'creator'
  );
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [country, setCountry] = useState(detectedCountry);
  const [language, setLanguage] = useState<LanguageCode>(detectedLanguage);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(detectedCurrency);
  const [avatarUrl, setAvatarUrl] = useState(
    sanitizeRemoteOrLocalUrl(firebaseUser?.photoURL, 500)
  );
  const [bio, setBio] = useState('');
  const [skillsText, setSkillsText] = useState('Premiere Pro, DaVinci Resolve, After Effects');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([EDITING_CATEGORIES[0]]);
  const [experienceYears, setExperienceYears] = useState(2);
  const [startingPriceLocal, setStartingPriceLocal] = useState(detectedCurrency === 'INR' ? 2500 : 50);
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!needsOnboarding || !firebaseUser) return null;

  const handleCountryChange = (nextCountry: string) => {
    setCountry(nextCountry);
    const nextCurr = getCurrencyForCountry(nextCountry);
    setPreferredCurrency(nextCurr);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : prev.length < 12 ? [...prev, cat] : prev
    );
  };

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
      showToast('Profile photo uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim()) {
      showToast('Please enter a display name and username.', 'error');
      return;
    }
    setSaving(true);
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15);
      const startingPriceUsd =
        role === 'editor'
          ? Math.max(5, convertCurrencyToUsd(startingPriceLocal, preferredCurrency, exchangeRates))
          : 0;

      await saveUserProfile(
        {
          username: username.trim(),
          displayName: displayName.trim(),
          role,
          country,
          language,
          preferredCurrency,
          avatarUrl,
          bio: bio.trim() || (role === 'editor' ? 'Creative specialist available for global projects.' : 'Hiring editors and designers worldwide.'),
          skills: role === 'editor' ? skills : [],
          categories: role === 'editor' ? selectedCategories : [],
          experienceYears: role === 'editor' ? experienceYears : 0,
          startingPriceUsd,
          isPublicProfile: true,
        },
        {
          phone: '',
          payoutUpiId: upiId.trim(),
          payoutPaypalEmail: firebaseUser.email || '',
          payoutBankSummary: '',
          emailNotifications: true,
        }
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create account.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-2xl w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 sm:p-8 my-8">
        <div className="space-y-1 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 font-display">Complete your Editing Hub account</h2>
          <p className="text-sm text-slate-600">
            Select your account type and regional currency to unlock your dedicated dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Account Type Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('editor')}
              className={`text-left p-4 rounded-xl border transition-all ${
                role === 'editor'
                  ? 'border-violet-600 bg-violet-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Film className="w-4 h-4 text-violet-600" />
                <span>Editor / Designer Account</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Upload demo reels, set project rates, submit proposals, and earn worldwide.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole('client')}
              className={`text-left p-4 rounded-xl border transition-all ${
                role === 'client'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span>Client Account</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Post editing briefs, hire verified creators globally, and manage escrow payments.
              </p>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Display Name</label>
              <input
                type="text"
                required
                maxLength={80}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                required
                maxLength={60}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Country</label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Currency</label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              >
                {Object.values(CURRENCIES).map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.code} ({cur.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
          </div>

          {/* Profile Photo Upload */}
          <div className="flex flex-wrap items-center gap-4">
            <AvatarImage
              src={avatarUrl}
              alt="Avatar preview"
              fallbackInitial={displayName || 'E'}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
              fallbackClassName="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-lg font-semibold shrink-0"
            />
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : 'Upload Profile Picture'}</span>
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

          {role === 'editor' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Starting Price ({CURRENCIES[preferredCurrency].symbol} {preferredCurrency})
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={startingPriceLocal}
                    onChange={(e) => setStartingPriceLocal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
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
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Editing Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Premiere Pro, DaVinci Resolve, Color Grading, Photoshop"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Specialties (Select up to 12)
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          active
                            ? 'bg-violet-50 border-violet-600 text-violet-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {country === 'India' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    UPI ID for Indian Payouts (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@okaxis"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Professional Bio</label>
            <textarea
              rows={3}
              maxLength={1200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={
                role === 'editor'
                  ? 'Describe your editing style, turnaround speed, and tools...'
                  : 'Tell creators about your brand, channel, or agency needs...'
              }
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 px-5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl transition-all disabled:opacity-50"
          >
            {saving ? 'Creating Account...' : 'Create My Marketplace Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
