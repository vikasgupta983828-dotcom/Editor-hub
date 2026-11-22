import React, { useMemo, useState } from 'react';
import { Calendar, Plus, Search, Upload, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertCurrencyToUsd, formatFromUsd } from '../lib/currency';
import { t } from '../lib/i18n';
import { formatRelativeDate } from '../lib/stats';
import { uploadMediaFile } from '../lib/upload';
import { CURRENCIES, EDITING_CATEGORIES, Project, SUPPORTED_COUNTRIES } from '../types/marketplace';

export const FindProjectsView: React.FC = () => {
  const {
    firebaseUser,
    currentUserProfile,
    language,
    currency,
    exchangeRates,
    projects,
    myProposals,
    platformConfig,
    createProject,
    submitProposal,
    signInWithGoogle,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCountry, setSelectedCountry] = useState('All');

  // Post Project Modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(EDITING_CATEGORIES[0]);
  const [budgetLocal, setBudgetLocal] = useState(currency === 'INR' ? 5000 : 120);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [uploadingRef, setUploadingRef] = useState(false);
  const [posting, setPosting] = useState(false);

  // Submit Proposal Modal state
  const [proposalTarget, setProposalTarget] = useState<Project | null>(null);
  const [proposedLocal, setProposedLocal] = useState(100);
  const [deliveryDays, setDeliveryDays] = useState(5);
  const [coverLetter, setCoverLetter] = useState('');
  const [submittingProp, setSubmittingProp] = useState(false);

  const categories = platformConfig.activeCategories.length
    ? platformConfig.activeCategories
    : [...EDITING_CATEGORIES];

  const openProjects = useMemo(() => {
    return projects
      .filter((p) => p.status === 'pending')
      .filter((p) => {
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (selectedCountry !== 'All' && p.clientCountry !== selectedCountry) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          return (
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.clientName.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [projects, selectedCategory, selectedCountry, searchTerm]);

  const handleOpenPostModal = async () => {
    if (!firebaseUser) {
      await signInWithGoogle();
      return;
    }
    setBudgetLocal(currency === 'INR' ? 5000 : 120);
    setShowPostModal(true);
  };

  const handleRefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    try {
      const data = await uploadMediaFile(file);
      setReferenceUrl(data.url);
      showToast('Reference file uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploadingRef(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      showToast('Please enter at least 10 characters in the project description.', 'error');
      return;
    }
    setPosting(true);
    try {
      const budgetUsd = Math.max(5, convertCurrencyToUsd(budgetLocal, currency, exchangeRates));
      await createProject({
        title,
        category,
        description,
        budgetUsd,
        originalBudget: budgetLocal,
        originalCurrency: currency,
        deadline,
        referenceUrl,
      });
      setShowPostModal(false);
      setTitle('');
      setDescription('');
      setReferenceUrl('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to publish project', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleOpenProposalModal = async (proj: Project) => {
    if (!firebaseUser) {
      await signInWithGoogle();
      return;
    }
    if (proj.clientId === firebaseUser.uid) {
      showToast('You cannot submit a proposal on your own project.', 'error');
      return;
    }
    setProposalTarget(proj);
    setProposedLocal(Math.round(proj.budgetUsd * (exchangeRates[currency] || 1)));
    setDeliveryDays(5);
    setCoverLetter('');
  };

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTarget) return;
    if (coverLetter.trim().length < 5) {
      showToast('Please write a short proposal note (min 5 characters).', 'error');
      return;
    }
    setSubmittingProp(true);
    try {
      const proposedPriceUsd = Math.max(
        5,
        convertCurrencyToUsd(proposedLocal, currency, exchangeRates)
      );
      await submitProposal(proposalTarget, {
        proposedPriceUsd,
        deliveryDays,
        coverLetter,
      });
      setProposalTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit proposal', 'error');
    } finally {
      setSubmittingProp(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">{t(language, 'navProjects')}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Browse open client editing briefs or publish a new project for worldwide proposals.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenPostModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{t(language, 'postProject')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects by title or brief..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-violet-600"
          />
        </div>

        <select
          aria-label="Filter projects by category"
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
          aria-label="Filter projects by client country"
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
      </div>

      {/* Open Projects List */}
      {openProjects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center space-y-4">
          <p className="text-sm text-slate-600">
            No open editing projects found for the current filters.
          </p>
          <button
            type="button"
            onClick={handleOpenPostModal}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
          >
            {t(language, 'postProject')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {openProjects.map((proj) => {
            const alreadyApplied = myProposals.some((pr) => pr.projectId === proj.id);
            const isOwner = firebaseUser?.uid === proj.clientId;
            return (
              <div
                key={proj.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>
                      {proj.category} · {proj.clientCountry}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Calendar className="w-3.5 h-3.5" />
                      Due {proj.deadline}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{proj.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                    {proj.description}
                  </p>
                  {proj.referenceUrl && (
                    <a
                      href={proj.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                    >
                      View Reference Brief / Sample Asset
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500">
                      Posted by {proj.clientName} · {formatRelativeDate(proj.createdAt)}
                    </div>
                    <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {formatFromUsd(proj.budgetUsd, currency, exchangeRates)}
                    </div>
                  </div>

                  {isOwner ? (
                    <span className="text-xs font-medium text-slate-500">Your Project</span>
                  ) : alreadyApplied ? (
                    <span className="text-xs font-semibold text-emerald-600">Proposal Sent</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenProposalModal(proj)}
                      disabled={currentUserProfile?.isBlocked}
                      className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {t(language, 'submitProposal')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Post Project Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 font-display">Publish Editing Project</h2>
              <button
                type="button"
                onClick={() => setShowPostModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Project Title</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. YouTube Documentary Edit + Custom Thumbnail"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Budget ({CURRENCIES[currency].symbol} {currency})
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={budgetLocal}
                    onChange={(e) => setBudgetLocal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Deadline</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Project Requirements & Deliverables
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Specify aspect ratio, target duration, pacing, color grade style, or design dimensions..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Reference File or Brief Link (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referenceUrl}
                    onChange={(e) => setReferenceUrl(e.target.value)}
                    placeholder="Upload a file or paste reference URL"
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingRef ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" onChange={handleRefUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={posting}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl transition-all disabled:opacity-50"
              >
                {posting ? 'Publishing...' : 'Publish Project Globally'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Submit Proposal Modal */}
      {proposalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">Submit Proposal</h2>
                <p className="text-xs text-slate-500 mt-0.5">{proposalTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setProposalTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProposalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Proposed Rate ({CURRENCIES[currency].symbol} {currency})
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={proposedLocal}
                    onChange={(e) => setProposedLocal(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Delivery Days
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={365}
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-violet-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Proposal Message & Relevant Experience
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1500}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Explain your approach, turnaround timeline, and relevant editing samples..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingProp}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors disabled:opacity-50"
              >
                {submittingProp ? 'Submitting...' : 'Send Proposal to Client'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
