import React, { useMemo, useState } from 'react';
import { Ban, CheckCircle2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatFromUsd } from '../lib/currency';
import { computeCountryStats, formatRelativeDate } from '../lib/stats';

export const AdminView: React.FC = () => {
  const {
    isAdmin,
    currency,
    exchangeRates,
    users,
    projects,
    transactions,
    disputes,
    platformConfig,
    adminSetEditorVerified,
    adminSetUserBlocked,
    adminUpdatePlatformConfig,
    adminResolveDispute,
  } = useApp();

  const [tab, setTab] = useState<'users' | 'projects' | 'transactions' | 'disputes' | 'countries' | 'config'>('users');
  const [commissionInput, setCommissionInput] = useState(platformConfig.commissionRatePct);
  const [newCategory, setNewCategory] = useState('');
  const [adminNotesByDispute, setAdminNotesByDispute] = useState<Record<string, string>>({});

  const countryStats = useMemo(
    () => computeCountryStats(users, projects, transactions),
    [users, projects, transactions]
  );

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
        <h2 className="text-2xl font-bold text-slate-900 font-display">Administrator Access Required</h2>
        <p className="text-sm text-slate-600">
          This console is restricted to verified platform administrators.
        </p>
      </div>
    );
  }

  const totalEscrowVolumeUsd = transactions
    .filter((tx) => tx.type === 'escrow_payment' && tx.status !== 'refunded')
    .reduce((acc, tx) => acc + tx.grossAmountUsd, 0);

  const totalCommissionEarnedUsd = transactions
    .filter((tx) => tx.type === 'escrow_payment' && tx.status === 'completed')
    .reduce((acc, tx) => acc + tx.commissionAmountUsd, 0);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'users', label: `Users (${users.length})` },
    { id: 'projects', label: `Projects (${projects.length})` },
    { id: 'transactions', label: `Transactions (${transactions.length})` },
    { id: 'disputes', label: `Disputes (${disputes.filter((d) => d.status === 'open').length} open)` },
    { id: 'countries', label: 'Country Stats' },
    { id: 'config', label: 'Commission & Categories' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 font-display">Admin Control Panel</h1>
          <p className="text-sm text-slate-600 mt-1">
            Verify editors, manage accounts, resolve disputes, adjust commission, and inspect global volume.
          </p>
        </div>
      </div>

      {/* Top Admin Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">Registered Users</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">{users.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">Total Projects</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">{projects.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">Gross Escrow Volume</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatFromUsd(totalEscrowVolumeUsd, currency, exchangeRates)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs text-slate-500">Platform Commission Revenue</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatFromUsd(totalCommissionEarnedUsd, currency, exchangeRates)}
          </div>
        </div>
      </div>

      {/* Segmented Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100 border border-slate-200 rounded-xl w-fit">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === item.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Users Management */}
      {tab === 'users' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.uid}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{u.displayName}</div>
                    <div className="text-xs text-slate-500">@{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-700">{u.role}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{u.country}</td>
                  <td className="px-4 py-3 text-xs">
                    {u.role === 'editor' ? (
                      u.verifiedByAdmin ? (
                        <span className="text-blue-600 font-semibold">Verified</span>
                      ) : (
                        <span className="text-slate-500">Unverified</span>
                      )
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.isBlocked ? (
                      <span className="text-rose-600 font-semibold">Blocked</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {u.role === 'editor' && (
                      <button
                        type="button"
                        onClick={() => adminSetEditorVerified(u.uid, !u.verifiedByAdmin)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-blue-700"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{u.verifiedByAdmin ? 'Unverify' : 'Verify'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => adminSetUserBlocked(u.uid, !u.isBlocked)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-lg ${
                        u.isBlocked
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{u.isBlocked ? 'Unblock' : 'Block'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Projects Overview */}
      {tab === 'projects' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Editor</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-900 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{p.category}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {p.clientName} ({p.clientCountry})
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">{p.editorName || 'Unassigned'}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                    {formatFromUsd(p.budgetUsd, currency, exchangeRates)}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-semibold text-violet-700">
                    {p.status} · {p.paymentStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Gateway</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{tx.referenceCode}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{tx.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{tx.gateway}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                    {formatFromUsd(tx.grossAmountUsd, currency, exchangeRates)}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-emerald-700">
                    {formatFromUsd(tx.commissionAmountUsd, currency, exchangeRates)} ({tx.commissionPct}%)
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-semibold text-blue-700">
                    {tx.status}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatRelativeDate(tx.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disputes Management */}
      {tab === 'disputes' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No disputes filed.
            </div>
          ) : (
            disputes.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    Project: <strong className="text-slate-900">{d.projectTitle}</strong> · Opened by {d.openedByName}
                  </span>
                  <span className="uppercase font-semibold text-amber-700">{d.status}</span>
                </div>
                <p className="text-sm text-slate-800">{d.reason}</p>
                {d.status === 'open' ? (
                  <div className="space-y-3 pt-2">
                    <input
                      type="text"
                      value={adminNotesByDispute[d.id] || ''}
                      onChange={(e) =>
                        setAdminNotesByDispute((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                      placeholder="Admin resolution note..."
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          adminResolveDispute(
                            d,
                            'resolved_refund',
                            adminNotesByDispute[d.id] || 'Refunded to client by Admin'
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
                      >
                        Refund Client
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          adminResolveDispute(
                            d,
                            'resolved_release',
                            adminNotesByDispute[d.id] || 'Released to editor by Admin'
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                      >
                        Release Payment to Editor
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          adminResolveDispute(
                            d,
                            'dismissed',
                            adminNotesByDispute[d.id] || 'Dismissed by Admin'
                          )
                        }
                        className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg"
                      >
                        Dismiss & Resume Project
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Admin Note: {d.adminNote}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Country-Wise Statistics */}
      {tab === 'countries' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Editors</th>
                <th className="px-4 py-3 font-medium">Clients</th>
                <th className="px-4 py-3 font-medium">Projects</th>
                <th className="px-4 py-3 font-medium text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {countryStats.map((row) => (
                <tr key={row.country}>
                  <td className="px-4 py-3 text-slate-900 font-medium">{row.country}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{row.editorsCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{row.clientsCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{row.projectsCount}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-right text-slate-900">
                    {formatFromUsd(row.volumeUsd, currency, exchangeRates)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Platform Commission & Categories Config */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Platform Commission Rate</h3>
            <p className="text-xs text-slate-600">
              Applied automatically to all new escrow transactions (0% – 40%).
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={commissionInput}
                onChange={(e) => setCommissionInput(Number(e.target.value))}
                className="w-32 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
              <span className="text-sm text-slate-600">%</span>
              <button
                type="button"
                onClick={() =>
                  adminUpdatePlatformConfig(commissionInput, platformConfig.activeCategories)
                }
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Commission</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Marketplace Categories</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Add new editing discipline..."
                className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newCategory.trim();
                  if (!trimmed || platformConfig.activeCategories.includes(trimmed)) return;
                  adminUpdatePlatformConfig(platformConfig.commissionRatePct, [
                    ...platformConfig.activeCategories,
                    trimmed,
                  ]);
                  setNewCategory('');
                }}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {platformConfig.activeCategories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800"
                >
                  <span>{cat}</span>
                  {platformConfig.activeCategories.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        adminUpdatePlatformConfig(
                          platformConfig.commissionRatePct,
                          platformConfig.activeCategories.filter((c) => c !== cat)
                        )
                      }
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
