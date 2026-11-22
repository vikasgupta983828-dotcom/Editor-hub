import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Star,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertUsdToCurrency, formatFromUsd } from '../lib/currency';
import { t } from '../lib/i18n';
import { computeEditorStats, formatRelativeDate } from '../lib/stats';
import { uploadMediaFile } from '../lib/upload';
import { Project, Proposal, UserProfile } from '../types/marketplace';
import { PaymentModal } from './PaymentModal';

export const DashboardView: React.FC = () => {
  const {
    firebaseUser,
    currentUserProfile,
    currentUserPrivate,
    language,
    currency,
    exchangeRates,
    users,
    projects,
    myProposals,
    transactions,
    reviews,
    favorites,
    setActiveView,
    setSelectedEditorId,
    cancelProject,
    deliverProjectWork,
    requestProjectRevision,
    approveProjectAndReleasePayment,
    submitReview,
    openDispute,
    recordEditorPayout,
    signInWithGoogle,
    showToast,
  } = useApp();

  // Modals state
  const [deliverTarget, setDeliverTarget] = useState<Project | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [uploadingDelivery, setUploadingDelivery] = useState(false);

  const [revisionTarget, setRevisionTarget] = useState<Project | null>(null);
  const [revisionNotes, setRevisionNotes] = useState('');

  const [reviewTarget, setReviewTarget] = useState<Project | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const [disputeTarget, setDisputeTarget] = useState<Project | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const [checkoutPayload, setCheckoutPayload] = useState<{
    project: Project;
    editor: UserProfile;
    budgetUsd: number;
    proposalId: string;
  } | null>(null);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutDest, setPayoutDest] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const isEditor = currentUserProfile?.role === 'editor';

  // Editor-specific computed metrics
  const editorStats = useMemo(() => {
    if (!firebaseUser) return null;
    return computeEditorStats(firebaseUser.uid, projects, transactions, reviews);
  }, [firebaseUser, projects, transactions, reviews]);

  const editorProjects = useMemo(
    () => (firebaseUser ? projects.filter((p) => p.editorId === firebaseUser.uid) : []),
    [firebaseUser, projects]
  );

  const editorPendingRequests = useMemo(
    () =>
      firebaseUser
        ? myProposals.filter((pr) => pr.editorId === firebaseUser.uid && pr.status === 'pending')
        : [],
    [firebaseUser, myProposals]
  );

  const availablePayoutUsd = useMemo(() => {
    if (!firebaseUser || !editorStats) return 0;
    const alreadyWithdrawn = transactions
      .filter((tx) => tx.editorId === firebaseUser.uid && tx.type === 'editor_payout')
      .reduce((sum, tx) => sum + tx.netAmountUsd, 0);
    return Math.max(0, Number((editorStats.totalEarningsUsd - alreadyWithdrawn).toFixed(2)));
  }, [firebaseUser, editorStats, transactions]);

  // Client-specific computed metrics
  const clientProjects = useMemo(
    () => (firebaseUser ? projects.filter((p) => p.clientId === firebaseUser.uid) : []),
    [firebaseUser, projects]
  );

  const clientProposalsReceived = useMemo(
    () =>
      firebaseUser
        ? myProposals.filter((pr) => pr.projectClientId === firebaseUser.uid && pr.status === 'pending')
        : [],
    [firebaseUser, myProposals]
  );

  const clientHiredEditorsCount = useMemo(() => {
    const ids = new Set(clientProjects.map((p) => p.editorId).filter(Boolean));
    return ids.size;
  }, [clientProjects]);

  const favouriteEditorProfiles = useMemo(
    () =>
      favorites
        .map((f) => users.find((u) => u.uid === f.editorId))
        .filter((u): u is UserProfile => Boolean(u)),
    [favorites, users]
  );

  if (!firebaseUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 font-display">{t(language, 'navDashboard')}</h2>
        <p className="text-sm text-slate-600">
          Sign in to access your Editor or Client workspace, track active projects, deliveries, and payments.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
        >
          {t(language, 'signIn')}
        </button>
      </div>
    );
  }

  const handleDeliveryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingDelivery(true);
    try {
      const data = await uploadMediaFile(file);
      setDeliveryUrl(data.url);
      showToast('Final delivery file uploaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      input.value = '';
      setUploadingDelivery(false);
    }
  };

  const handleAcceptProposal = (proposal: Proposal, proj: Project) => {
    const editor = users.find((u) => u.uid === proposal.editorId);
    if (!editor) {
      showToast('Editor profile is currently unavailable.', 'error');
      return;
    }
    setCheckoutPayload({
      project: proj,
      editor,
      budgetUsd: proposal.proposedPriceUsd,
      proposalId: proposal.id,
    });
  };

  const handleWithdrawPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availablePayoutUsd <= 0) {
      showToast('No available balance to withdraw yet.', 'error');
      return;
    }
    setWithdrawing(true);
    try {
      const displayAmount = convertUsdToCurrency(availablePayoutUsd, currency, exchangeRates);
      const resp = await fetch('/api/payouts/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: availablePayoutUsd,
          destinationType: currentUserPrivate?.payoutUpiId ? 'UPI' : 'PayPal/Bank',
          destinationValue: payoutDest,
          currency,
          displayAmount,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Payout failed');
      await recordEditorPayout({
        amountUsd: data.amountUsd,
        displayCurrency: currency,
        displayAmount,
        referenceCode: data.referenceCode,
        destinationLabel: payoutDest,
      });
      setShowPayoutModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payout failed', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  // ===========================================================================
  // EDITOR DASHBOARD
  // ===========================================================================
  if (isEditor && editorStats) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 font-display">Editor Dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">
              Live earnings, deliveries, and client metrics calculated directly from database records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPayoutDest(
                  currentUserPrivate?.payoutUpiId ||
                    currentUserPrivate?.payoutPaypalEmail ||
                    currentUserPrivate?.payoutBankSummary ||
                    ''
                );
                setShowPayoutModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl"
            >
              <Wallet className="w-4 h-4" />
              <span>Withdraw ({formatFromUsd(availablePayoutUsd, currency, exchangeRates)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('projects')}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
            >
              Browse Projects
            </button>
          </div>
        </div>

        {/* 9 Editor Dashboard Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'totalEarnings')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatFromUsd(editorStats.totalEarningsUsd, currency, exchangeRates)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'monthlyEarnings')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatFromUsd(editorStats.monthlyEarningsUsd, currency, exchangeRates)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'activeProjects')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorStats.activeProjectsCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'pendingRequests')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorPendingRequests.length}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'ratingLabel')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 inline-flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              {editorStats.reviewCount > 0 ? editorStats.averageRating.toFixed(1) : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'clientsServed')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorStats.totalClientsServed}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'projectsDone')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorStats.totalProjectsCompleted}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'videosEdited')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorStats.totalVideosEdited}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{t(language, 'designsDone')}</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {editorStats.totalDesignsCompleted}
            </div>
          </div>
        </div>

        {/* Assigned Projects */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 font-display">Assigned Client Projects</h2>
          {editorProjects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No hired projects yet. Apply to open briefs in Find Projects.
            </div>
          ) : (
            <div className="space-y-3">
              {editorProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-500">
                      {proj.category} · Client: {proj.clientName} ({proj.clientCountry}) · Status:{' '}
                      <span className="text-slate-900 font-semibold uppercase">{proj.status.replace('_', ' ')}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{proj.title}</h3>
                    {proj.status === 'revision_requested' && proj.revisionNotes && (
                      <p className="text-xs text-amber-700 font-medium">Revision Notes: {proj.revisionNotes}</p>
                    )}
                    {proj.deliveryUrl && (
                      <a
                        href={proj.deliveryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                      >
                        <span>Latest Delivery Asset</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums mr-2">
                      {formatFromUsd(proj.budgetUsd, currency, exchangeRates)}
                    </span>
                    {(proj.status === 'active' || proj.status === 'revision_requested') && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeliverTarget(proj);
                          setDeliveryUrl(proj.deliveryUrl || '');
                          setDeliveryNotes('');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg"
                      >
                        {t(language, 'deliverWork')}
                      </button>
                    )}
                    {(proj.status === 'active' || proj.status === 'delivered' || proj.status === 'revision_requested') && (
                      <button
                        type="button"
                        onClick={() => {
                          setDisputeTarget(proj);
                          setDisputeReason('');
                        }}
                        className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                      >
                        {t(language, 'openDispute')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submitted Proposals */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 font-display">Submitted Proposals</h2>
          {myProposals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No proposals submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project ID</th>
                    <th className="px-4 py-3 font-medium">Proposed Rate</th>
                    <th className="px-4 py-3 font-medium">Timeline</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {myProposals.map((pr) => (
                    <tr key={pr.id}>
                      <td className="px-4 py-3 text-slate-700 font-mono text-xs">{pr.projectId}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-900 font-semibold">
                        {formatFromUsd(pr.proposedPriceUsd, currency, exchangeRates)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{pr.deliveryDays} days</td>
                      <td className="px-4 py-3 text-xs uppercase font-semibold text-violet-700">
                        {pr.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Payout & Escrow History */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 font-display">{t(language, 'paymentHistory')}</h2>
          <TransactionTable transactions={transactions} currency={currency} exchangeRates={exchangeRates} />
        </section>

        {/* Deliver Final Work Modal */}
        {deliverTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 font-display">Submit Final Delivery</h3>
                <button type="button" onClick={() => setDeliverTarget(null)} className="text-slate-500 hover:text-slate-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await deliverProjectWork(deliverTarget, deliveryUrl, deliveryNotes);
                  setDeliverTarget(null);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Upload Deliverable File (MP4, WebM, JPG, PNG, ZIP, PDF)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={deliveryUrl}
                      onChange={(e) => setDeliveryUrl(e.target.value)}
                      placeholder="/uploads/... or delivery link"
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-800 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingDelivery ? 'Uploading...' : 'Upload'}</span>
                      <input type="file" onChange={handleDeliveryUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Delivery Notes</label>
                  <textarea
                    rows={3}
                    required
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Summary of render specs, resolution, or design assets..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploadingDelivery}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
                >
                  Deliver Project to Client
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Withdraw Payout Modal */}
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 font-display">Withdraw Earnings</h3>
                <button type="button" onClick={() => setShowPayoutModal(false)} className="text-slate-500 hover:text-slate-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleWithdrawPayout} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm flex justify-between">
                  <span className="text-slate-600">Available Balance</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {formatFromUsd(availablePayoutUsd, currency, exchangeRates)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Payout Destination (UPI ID, PayPal Email, or Bank Account)
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutDest}
                    onChange={(e) => setPayoutDest(e.target.value)}
                    placeholder="creator@okaxis or creator@paypal.com"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={withdrawing || availablePayoutUsd <= 0}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50"
                >
                  {withdrawing ? 'Processing Payout...' : 'Confirm Payout Withdrawal'}
                </button>
              </form>
            </div>
          </div>
        )}

        {disputeTarget && (
          <DisputeModal
            project={disputeTarget}
            reason={disputeReason}
            setReason={setDisputeReason}
            onClose={() => setDisputeTarget(null)}
            onSubmit={async () => {
              await openDispute(disputeTarget, disputeReason);
              setDisputeTarget(null);
            }}
          />
        )}
      </div>
    );
  }

  // ===========================================================================
  // CLIENT DASHBOARD
  // ===========================================================================
  const activeClientProjects = clientProjects.filter((p) =>
    ['active', 'delivered', 'revision_requested'].includes(p.status)
  );
  const completedClientProjects = clientProjects.filter((p) => p.status === 'completed');
  const pendingDeliveries = clientProjects.filter((p) => p.status === 'active' || p.status === 'revision_requested');

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">Client Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage posted briefs, review editor proposals, approve deliveries, and track escrow payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('projects')}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl"
        >
          {t(language, 'postProject')}
        </button>
      </div>

      {/* Client Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'postedProjects')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {clientProjects.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'hiredEditors')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {clientHiredEditorsCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'activeProjects')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {activeClientProjects.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'completedProjects')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {completedClientProjects.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'pendingDeliveries')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {pendingDeliveries.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">{t(language, 'favouriteEditors')}</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {favouriteEditorProfiles.length}
          </div>
        </div>
      </div>

      {/* Incoming Proposals on Posted Projects */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 font-display">
          Incoming Editor Proposals ({clientProposalsReceived.length})
        </h2>
        {clientProposalsReceived.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No pending proposals awaiting selection.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientProposalsReceived.map((prop) => {
              const proj = clientProjects.find((p) => p.id === prop.projectId);
              if (!proj || proj.status !== 'pending') return null;
              return (
                <div
                  key={prop.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500">{proj.title}</div>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                        {prop.editorName} ({prop.editorCountry})
                      </h3>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-base font-bold text-slate-900">
                        {formatFromUsd(prop.proposedPriceUsd, currency, exchangeRates)}
                      </div>
                      <div className="text-xs text-slate-500">{prop.deliveryDays} days</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{prop.coverLetter}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleAcceptProposal(prop, proj)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg"
                    >
                      Select Editor & Fund Escrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEditorId(prop.editorId);
                        setActiveView('profile');
                      }}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Client Projects Management */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 font-display">Your Projects & Deliveries</h2>
        {clientProjects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
            You have not posted any projects yet.
          </div>
        ) : (
          <div className="space-y-3">
            {clientProjects.map((proj) => (
              <div
                key={proj.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500">
                    {proj.category} · Due {proj.deadline} · Status:{' '}
                    <span className="text-slate-900 font-semibold uppercase">{proj.status.replace('_', ' ')}</span>
                    {proj.editorName ? ` · Editor: ${proj.editorName}` : ''}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{proj.title}</h3>
                  {proj.deliveryUrl && (
                    <div className="pt-1 space-y-1">
                      <a
                        href={proj.deliveryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        <span>Inspect Delivered File</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      {proj.deliveryNotes && (
                        <p className="text-xs text-slate-600">Editor Notes: {proj.deliveryNotes}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-slate-900 font-mono tabular-nums mr-2">
                    {formatFromUsd(proj.budgetUsd, currency, exchangeRates)}
                  </span>

                  {proj.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => cancelProject(proj.id)}
                      className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-rose-600 border border-slate-300 rounded-lg"
                    >
                      Cancel Brief
                    </button>
                  )}

                  {proj.status === 'delivered' && (
                    <>
                      <button
                        type="button"
                        onClick={() => approveProjectAndReleasePayment(proj)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t(language, 'approveRelease')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRevisionTarget(proj);
                          setRevisionNotes('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t(language, 'requestRevision')}</span>
                      </button>
                    </>
                  )}

                  {proj.status === 'completed' && !proj.reviewed && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTarget(proj);
                        setRating(5);
                        setReviewComment('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{t(language, 'leaveReview')}</span>
                    </button>
                  )}

                  {['active', 'delivered', 'revision_requested'].includes(proj.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDisputeTarget(proj);
                        setDisputeReason('');
                      }}
                      className="px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      {t(language, 'openDispute')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Favourite Editors */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 font-display">{t(language, 'favouriteEditors')}</h2>
        {favouriteEditorProfiles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No favourite editors saved yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favouriteEditorProfiles.map((ed) => (
              <button
                key={ed.uid}
                type="button"
                onClick={() => {
                  setSelectedEditorId(ed.uid);
                  setActiveView('profile');
                }}
                className="text-left rounded-xl border border-slate-200 bg-white shadow-sm hover:border-violet-400 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{ed.displayName}</div>
                  <div className="text-xs text-slate-500">
                    @{ed.username} · {ed.country}
                  </div>
                </div>
                <div className="text-sm font-mono font-bold text-slate-900">
                  {formatFromUsd(ed.startingPriceUsd, currency, exchangeRates)}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Payment History */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 font-display">{t(language, 'paymentHistory')}</h2>
        <TransactionTable transactions={transactions} currency={currency} exchangeRates={exchangeRates} />
      </section>

      {/* Payment Escrow Checkout Modal */}
      {checkoutPayload && (
        <PaymentModal
          project={checkoutPayload.project}
          editor={checkoutPayload.editor}
          agreedBudgetUsd={checkoutPayload.budgetUsd}
          proposalId={checkoutPayload.proposalId}
          onClose={() => setCheckoutPayload(null)}
        />
      )}

      {/* Request Revision Modal */}
      {revisionTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-display">Request Revision</h3>
              <button type="button" onClick={() => setRevisionTarget(null)} className="text-slate-500 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await requestProjectRevision(revisionTarget, revisionNotes);
                setRevisionTarget(null);
              }}
              className="space-y-4"
            >
              <textarea
                rows={4}
                required
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Describe exact timestamps or visual edits needed..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl"
              >
                Send Revision Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Leave Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-display">Rate & Review Editor</h3>
              <button type="button" onClick={() => setReviewTarget(null)} className="text-slate-500 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await submitReview(reviewTarget, rating, reviewComment);
                setReviewTarget(null);
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1.5"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                required
                minLength={2}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience working with this creator..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl"
              >
                Publish Verified Review
              </button>
            </form>
          </div>
        </div>
      )}

      {disputeTarget && (
        <DisputeModal
          project={disputeTarget}
          reason={disputeReason}
          setReason={setDisputeReason}
          onClose={() => setDisputeTarget(null)}
          onSubmit={async () => {
            await openDispute(disputeTarget, disputeReason);
            setDisputeTarget(null);
          }}
        />
      )}
    </div>
  );
};

const TransactionTable: React.FC<{
  transactions: ReturnType<typeof useApp>['transactions'];
  currency: ReturnType<typeof useApp>['currency'];
  exchangeRates: Record<string, number>;
}> = ({ transactions, currency, exchangeRates }) => {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No transactions recorded yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">Project / Description</th>
            <th className="px-4 py-3 font-medium">Gateway</th>
            <th className="px-4 py-3 font-medium">Gross</th>
            <th className="px-4 py-3 font-medium">Fee</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{tx.referenceCode}</td>
              <td className="px-4 py-3 text-slate-900 font-medium">{tx.projectTitle}</td>
              <td className="px-4 py-3 text-xs text-slate-700">{tx.gateway}</td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                {formatFromUsd(tx.grossAmountUsd, currency, exchangeRates)}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                {tx.commissionPct}%
              </td>
              <td className="px-4 py-3 text-xs uppercase font-semibold text-blue-700">
                {tx.status.replace('_', ' ')}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {formatRelativeDate(tx.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DisputeModal: React.FC<{
  project: Project;
  reason: string;
  setReason: (val: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}> = ({ project, reason, setReason, onClose, onSubmit }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 font-display">Open Dispute</h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Project: {project.title}. Opening a dispute pauses escrow release until resolved by an Admin.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit();
        }}
        className="space-y-4"
      >
        <textarea
          rows={4}
          required
          minLength={5}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain the issue or refund/release request clearly..."
          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
        />
        <button
          type="submit"
          className="w-full py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
        >
          Submit Dispute to Admin
        </button>
      </form>
    </div>
  </div>
);
