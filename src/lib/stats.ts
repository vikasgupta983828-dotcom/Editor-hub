import {
  DESIGN_CATEGORIES,
  Project,
  Review,
  Transaction,
  UserProfile,
  VIDEO_CATEGORIES,
} from '../types/marketplace';

export interface EditorComputedStats {
  totalClientsServed: number;
  totalProjectsCompleted: number;
  totalVideosEdited: number;
  totalDesignsCompleted: number;
  activeProjectsCount: number;
  totalEarningsUsd: number;
  monthlyEarningsUsd: number;
  averageRating: number;
  reviewCount: number;
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return ((ts as { seconds: number }).seconds || 0) * 1000;
  }
  return 0;
}

export function formatRelativeDate(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return 'Just now';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function computeEditorStats(
  editorId: string,
  projects: Project[],
  transactions: Transaction[],
  reviews: Review[]
): EditorComputedStats {
  const editorProjects = projects.filter((p) => p.editorId === editorId);
  const completed = editorProjects.filter((p) => p.status === 'completed');
  const active = editorProjects.filter(
    (p) => p.status === 'active' || p.status === 'delivered' || p.status === 'revision_requested'
  );

  const uniqueClients = new Set(completed.map((p) => p.clientId).filter(Boolean));
  const totalVideosEdited = completed.filter((p) => VIDEO_CATEGORIES.has(p.category)).length;
  const totalDesignsCompleted = completed.filter((p) => DESIGN_CATEGORIES.has(p.category)).length;

  const releasedEscrowTxs = transactions.filter(
    (tx) => tx.editorId === editorId && tx.type === 'escrow_payment' && tx.status === 'completed'
  );

  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();

  let totalEarningsUsd = 0;
  let monthlyEarningsUsd = 0;

  for (const tx of releasedEscrowTxs) {
    totalEarningsUsd += tx.netAmountUsd;
    const txDate = new Date(toMillis(tx.updatedAt) || toMillis(tx.createdAt));
    if (txDate.getUTCMonth() === currentMonth && txDate.getUTCFullYear() === currentYear) {
      monthlyEarningsUsd += tx.netAmountUsd;
    }
  }

  const editorReviews = reviews.filter((r) => r.editorId === editorId);
  const reviewCount = editorReviews.length;
  const averageRating =
    reviewCount > 0
      ? Number((editorReviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1))
      : 0;

  return {
    totalClientsServed: uniqueClients.size,
    totalProjectsCompleted: completed.length,
    totalVideosEdited,
    totalDesignsCompleted,
    activeProjectsCount: active.length,
    totalEarningsUsd: Number(totalEarningsUsd.toFixed(2)),
    monthlyEarningsUsd: Number(monthlyEarningsUsd.toFixed(2)),
    averageRating,
    reviewCount,
  };
}

export interface CountryStatsRow {
  country: string;
  editorsCount: number;
  clientsCount: number;
  projectsCount: number;
  volumeUsd: number;
}

export function computeCountryStats(
  users: UserProfile[],
  projects: Project[],
  transactions: Transaction[]
): CountryStatsRow[] {
  const map = new Map<string, CountryStatsRow>();

  const ensure = (country: string): CountryStatsRow => {
    const key = country || 'Other International';
    if (!map.has(key)) {
      map.set(key, {
        country: key,
        editorsCount: 0,
        clientsCount: 0,
        projectsCount: 0,
        volumeUsd: 0,
      });
    }
    return map.get(key)!;
  };

  for (const u of users) {
    const row = ensure(u.country);
    if (u.role === 'editor') row.editorsCount += 1;
    else row.clientsCount += 1;
  }

  for (const p of projects) {
    const row = ensure(p.clientCountry);
    row.projectsCount += 1;
  }

  for (const tx of transactions) {
    if (tx.type === 'escrow_payment' && tx.status !== 'refunded') {
      const row = ensure(tx.country);
      row.volumeUsd = Number((row.volumeUsd + tx.grossAmountUsd).toFixed(2));
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.editorsCount + b.clientsCount - (a.editorsCount + a.clientsCount)
  );
}
