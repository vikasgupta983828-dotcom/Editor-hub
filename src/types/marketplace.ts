export type LanguageCode = 'en' | 'hi';
export type UserRole = 'editor' | 'client';
export type CurrencyCode = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'CAD' | 'AUD';

export type ProjectStatus =
  | 'pending'
  | 'active'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'held_in_escrow' | 'released' | 'refunded' | 'disputed';
export type PaymentGateway = 'UPI' | 'Stripe' | 'PayPal' | 'PlatformPayout';

export const EDITING_CATEGORIES = [
  'Video Editing',
  'YouTube Video Editing',
  'Instagram Reels Editing',
  'Shorts Editing',
  'Wedding Video Editing',
  'Logo Designing',
  'Graphic Designing',
  'Thumbnail Designing',
  'Photo Editing',
  'Motion Graphics',
  'VFX Editing',
  'Social Media Post Designing',
] as const;

export const VIDEO_CATEGORIES = new Set<string>([
  'Video Editing',
  'YouTube Video Editing',
  'Instagram Reels Editing',
  'Shorts Editing',
  'Wedding Video Editing',
  'Motion Graphics',
  'VFX Editing',
]);

export const DESIGN_CATEGORIES = new Set<string>([
  'Logo Designing',
  'Graphic Designing',
  'Thumbnail Designing',
  'Photo Editing',
  'Social Media Post Designing',
]);

export interface CountryOption {
  name: string;
  code: string;
  defaultCurrency: CurrencyCode;
  defaultLanguage: LanguageCode;
  upiEligible: boolean;
}

export const SUPPORTED_COUNTRIES: CountryOption[] = [
  { name: 'India', code: 'IN', defaultCurrency: 'INR', defaultLanguage: 'en', upiEligible: true },
  { name: 'United States', code: 'US', defaultCurrency: 'USD', defaultLanguage: 'en', upiEligible: false },
  { name: 'United Kingdom', code: 'GB', defaultCurrency: 'GBP', defaultLanguage: 'en', upiEligible: false },
  { name: 'Canada', code: 'CA', defaultCurrency: 'CAD', defaultLanguage: 'en', upiEligible: false },
  { name: 'United Arab Emirates', code: 'AE', defaultCurrency: 'AED', defaultLanguage: 'en', upiEligible: false },
  { name: 'Australia', code: 'AU', defaultCurrency: 'AUD', defaultLanguage: 'en', upiEligible: false },
  { name: 'Germany', code: 'DE', defaultCurrency: 'EUR', defaultLanguage: 'en', upiEligible: false },
  { name: 'France', code: 'FR', defaultCurrency: 'EUR', defaultLanguage: 'en', upiEligible: false },
  { name: 'Singapore', code: 'SG', defaultCurrency: 'USD', defaultLanguage: 'en', upiEligible: false },
  { name: 'Netherlands', code: 'NL', defaultCurrency: 'EUR', defaultLanguage: 'en', upiEligible: false },
  { name: 'Japan', code: 'JP', defaultCurrency: 'USD', defaultLanguage: 'en', upiEligible: false },
  { name: 'Brazil', code: 'BR', defaultCurrency: 'USD', defaultLanguage: 'en', upiEligible: false },
  { name: 'Other International', code: 'INTL', defaultCurrency: 'USD', defaultLanguage: 'en', upiEligible: false },
];

export const CURRENCIES: Record<CurrencyCode, { code: CurrencyCode; symbol: string; name: string }> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
};

// Volumetric boundaries synchronized with firebase-blueprint.json & firestore.rules
export const FIELD_LIMITS = {
  usernameMax: 60,
  displayNameMax: 80,
  bioMax: 1200,
  titleMax: 140,
  descriptionMax: 3000,
  coverLetterMax: 1500,
  messageMax: 2000,
  reasonMax: 1200,
  commentMax: 1000,
  skillsMaxCount: 15,
  categoriesMaxCount: 12,
};

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  country: string;
  language: LanguageCode;
  preferredCurrency: CurrencyCode;
  avatarUrl: string;
  bio: string;
  skills: string[];
  categories: string[];
  experienceYears: number;
  startingPriceUsd: number;
  verifiedByAdmin: boolean;
  isBlocked: boolean;
  isPublicProfile: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  email: string;
  phone: string;
  payoutUpiId: string;
  payoutPaypalEmail: string;
  payoutBankSummary: string;
  emailNotifications: boolean;
  updatedAt: unknown;
}

export interface PortfolioItem {
  id: string;
  editorId: string;
  editorName: string;
  title: string;
  category: string;
  mediaType: 'video' | 'image';
  mediaUrl: string;
  thumbnailUrl: string;
  description: string;
  durationSec: number;
  createdAt: unknown;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  clientCountry: string;
  editorId: string;
  editorName: string;
  title: string;
  category: string;
  description: string;
  budgetUsd: number;
  originalBudget: number;
  originalCurrency: CurrencyCode;
  deadline: string;
  referenceUrl: string;
  deliveryUrl: string;
  deliveryNotes: string;
  revisionNotes: string;
  status: ProjectStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  reviewed: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Proposal {
  id: string;
  projectId: string;
  projectClientId: string;
  editorId: string;
  editorName: string;
  editorCountry: string;
  proposedPriceUsd: number;
  deliveryDays: number;
  coverLetter: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Review {
  id: string;
  projectId: string;
  editorId: string;
  clientId: string;
  clientName: string;
  rating: number;
  comment: string;
  category: string;
  createdAt: unknown;
}

export interface Conversation {
  id: string;
  participantA: string;
  participantB: string;
  participantAName: string;
  participantBName: string;
  participantAAvatar: string;
  participantBAvatar: string;
  projectId: string;
  projectTitle: string;
  lastMessage: string;
  lastMessageAt: unknown;
  createdAt: unknown;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: 'none' | 'image' | 'video' | 'file';
  createdAt: unknown;
}

export interface Transaction {
  id: string;
  projectId: string;
  projectTitle: string;
  clientId: string;
  editorId: string;
  type: 'escrow_payment' | 'editor_payout' | 'refund';
  gateway: PaymentGateway;
  grossAmountUsd: number;
  commissionPct: number;
  commissionAmountUsd: number;
  netAmountUsd: number;
  displayCurrency: string;
  displayAmount: number;
  status: 'held_in_escrow' | 'completed' | 'refunded' | 'disputed';
  referenceCode: string;
  country: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Dispute {
  id: string;
  projectId: string;
  projectTitle: string;
  openedBy: string;
  openedByName: string;
  clientId: string;
  editorId: string;
  reason: string;
  status: 'open' | 'resolved_refund' | 'resolved_release' | 'dismissed';
  adminNote: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface FavoriteEditor {
  id: string;
  clientId: string;
  editorId: string;
  createdAt: unknown;
}

export interface UserNotification {
  id: string;
  userId: string;
  senderId: string;
  title: string;
  body: string;
  linkView: string;
  read: boolean;
  createdAt: unknown;
}

export interface PlatformConfig {
  commissionRatePct: number;
  activeCategories: string[];
  updatedAt: unknown;
}

export type ActiveView =
  | 'home'
  | 'editors'
  | 'projects'
  | 'messages'
  | 'dashboard'
  | 'profile'
  | 'settings'
  | 'admin';
