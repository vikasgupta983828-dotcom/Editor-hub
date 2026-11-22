import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  DEFAULT_EXCHANGE_RATES,
  detectLocaleCountryAndCurrency,
  getCurrencyForCountry,
} from '../lib/currency';
import { toMillis } from '../lib/stats';
import { sanitizeRemoteOrLocalUrl } from '../lib/upload';
import {
  ActiveView,
  ChatMessage,
  Conversation,
  CurrencyCode,
  Dispute,
  EDITING_CATEGORIES,
  FavoriteEditor,
  LanguageCode,
  PaymentGateway,
  PlatformConfig,
  PortfolioItem,
  Project,
  Proposal,
  Review,
  Transaction,
  UserNotification,
  UserPrivateInfo,
  UserProfile,
  UserRole,
} from '../types/marketplace';

interface AppContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  currentUserProfile: UserProfile | null;
  currentUserPrivate: UserPrivateInfo | null;
  needsOnboarding: boolean;
  isAdmin: boolean;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  canGoBack: boolean;
  previousView: ActiveView | null;
  goBack: () => void;
  selectedEditorId: string | null;
  setSelectedEditorId: (uid: string | null) => void;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;

  // Global localization & currency
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  country: string;
  setCountry: (country: string, syncCurrency?: boolean) => void;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  exchangeRates: Record<string, number>;
  ratesUpdatedAt: string;

  // Marketplace data
  users: UserProfile[];
  portfolioItems: PortfolioItem[];
  projects: Project[];
  myProposals: Proposal[];
  reviews: Review[];
  conversations: Conversation[];
  transactions: Transaction[];
  disputes: Dispute[];
  favorites: FavoriteEditor[];
  notifications: UserNotification[];
  platformConfig: PlatformConfig;

  // Real-time WebSocket presence & typing
  onlineUserIds: Set<string>;
  typingByConversation: Record<string, string | null>;
  sendTypingSignal: (conversationId: string, recipientId: string, isTyping: boolean) => void;

  // Toast feedback
  toast: { message: string; kind: 'success' | 'error' } | null;
  showToast: (message: string, kind?: 'success' | 'error') => void;

  // Auth & Profile actions
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  saveUserProfile: (
    profileInput: {
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
      isPublicProfile: boolean;
    },
    privateInput?: {
      phone: string;
      payoutUpiId: string;
      payoutPaypalEmail: string;
      payoutBankSummary: string;
      emailNotifications: boolean;
    }
  ) => Promise<void>;

  // Portfolio actions
  addPortfolioItem: (input: {
    title: string;
    category: string;
    mediaType: 'video' | 'image';
    mediaUrl: string;
    thumbnailUrl: string;
    description: string;
    durationSec: number;
  }) => Promise<void>;
  deletePortfolioItem: (itemId: string) => Promise<void>;

  // Project & Proposal actions
  createProject: (input: {
    title: string;
    category: string;
    description: string;
    budgetUsd: number;
    originalBudget: number;
    originalCurrency: CurrencyCode;
    deadline: string;
    referenceUrl: string;
  }) => Promise<string>;
  cancelProject: (projectId: string) => Promise<void>;
  submitProposal: (
    project: Project,
    input: { proposedPriceUsd: number; deliveryDays: number; coverLetter: string }
  ) => Promise<void>;
  hireEditorAndFundEscrow: (input: {
    project: Project;
    editor: UserProfile;
    agreedBudgetUsd: number;
    proposalId?: string;
    gateway: Exclude<PaymentGateway, 'PlatformPayout'>;
    referenceCode: string;
    commissionPct: number;
    commissionAmountUsd: number;
    netAmountUsd: number;
    displayCurrency: CurrencyCode;
    displayAmount: number;
  }) => Promise<void>;
  deliverProjectWork: (project: Project, deliveryUrl: string, deliveryNotes: string) => Promise<void>;
  requestProjectRevision: (project: Project, revisionNotes: string) => Promise<void>;
  approveProjectAndReleasePayment: (project: Project) => Promise<void>;
  submitReview: (project: Project, rating: number, comment: string) => Promise<void>;
  openDispute: (project: Project, reason: string) => Promise<void>;
  toggleFavoriteEditor: (editorId: string) => Promise<void>;

  // Messaging & Notifications
  startConversationWith: (otherUser: UserProfile, project?: Project) => Promise<string>;
  sendChatMessage: (
    conversation: Conversation,
    text: string,
    attachment?: { url: string; name: string; type: 'image' | 'video' | 'file' }
  ) => Promise<void>;
  subscribeConversationMessages: (
    conversationId: string,
    callback: (msgs: ChatMessage[]) => void
  ) => () => void;
  markNotificationRead: (notificationId: string) => Promise<void>;

  // Payouts
  recordEditorPayout: (input: {
    amountUsd: number;
    displayCurrency: CurrencyCode;
    displayAmount: number;
    referenceCode: string;
    destinationLabel: string;
  }) => Promise<void>;

  // Admin actions
  adminSetEditorVerified: (uid: string, verified: boolean) => Promise<void>;
  adminSetUserBlocked: (uid: string, blocked: boolean) => Promise<void>;
  adminUpdatePlatformConfig: (commissionRatePct: number, activeCategories: string[]) => Promise<void>;
  adminResolveDispute: (
    dispute: Dispute,
    resolution: 'resolved_refund' | 'resolved_release' | 'dismissed',
    adminNote: string
  ) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const localeDefault = useMemo(() => detectLocaleCountryAndCurrency(), []);

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [currentUserPrivate, setCurrentUserPrivate] = useState<UserPrivateInfo | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const [activeView, setActiveViewState] = useState<ActiveView>('home');
  const [selectedEditorId, setSelectedEditorId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [viewHistory, setViewHistory] = useState<
    { view: ActiveView; editorId: string | null; conversationId: string | null }[]
  >([]);

  const activeSnapshotRef = useRef<{
    view: ActiveView;
    editorId: string | null;
    conversationId: string | null;
  }>({ view: 'home', editorId: null, conversationId: null });

  useEffect(() => {
    activeSnapshotRef.current = {
      view: activeView,
      editorId: selectedEditorId,
      conversationId: selectedConversationId,
    };
  }, [activeView, selectedEditorId, selectedConversationId]);

  const setActiveView = useCallback((nextView: ActiveView) => {
    const current = activeSnapshotRef.current;
    if (current.view !== nextView) {
      setViewHistory((prev) => [...prev.slice(-19), current]);
    }
    setActiveViewState(nextView);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const canGoBack = viewHistory.length > 0 || activeView !== 'home';
  const previousView = viewHistory.length > 0 ? viewHistory[viewHistory.length - 1].view : activeView !== 'home' ? 'home' : null;

  const goBack = useCallback(() => {
    setViewHistory((prev) => {
      if (prev.length === 0) {
        setActiveViewState('home');
        return [];
      }
      const target = prev[prev.length - 1];
      setSelectedEditorId(target.editorId);
      setSelectedConversationId(target.conversationId);
      setActiveViewState(target.view);
      return prev.slice(0, -1);
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const [language, setLanguage] = useState<LanguageCode>('en');
  const [country, setCountryState] = useState<string>(localeDefault.country);
  const [currency, setCurrency] = useState<CurrencyCode>(localeDefault.currency);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_EXCHANGE_RATES);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string>(new Date().toISOString());

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myProposals, setMyProposals] = useState<Proposal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEditor[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    commissionRatePct: 10,
    activeCategories: [...EDITING_CATEGORIES],
    updatedAt: null,
  });

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  const isAdmin = useMemo(() => {
    if (!firebaseUser) return false;
    return (
      (firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified) ||
      isAdminDoc
    );
  }, [firebaseUser, isAdminDoc]);

  const needsOnboarding = Boolean(authReady && firebaseUser && profileChecked && !currentUserProfile);

  const setCountry = useCallback((nextCountry: string, syncCurrency = true) => {
    setCountryState(nextCountry);
    if (syncCurrency) {
      setCurrency(getCurrencyForCountry(nextCountry));
    }
  }, []);

  // Fetch live exchange rates & geo on startup
  useEffect(() => {
    fetch('/api/exchange-rates')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.rates) {
          setExchangeRates(data.rates);
          if (data.updatedAt) setRatesUpdatedAt(data.updatedAt);
        }
      })
      .catch(() => {});

    fetch('/api/geo')
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (geo?.countryCode === 'IN') {
          setCountryState('India');
          setCurrency('INR');
        } else if (geo?.countryCode === 'GB') {
          setCountryState('United Kingdom');
          setCurrency('GBP');
        } else if (geo?.countryCode === 'AE') {
          setCountryState('United Arab Emirates');
          setCurrency('AED');
        } else if (geo?.countryCode === 'CA') {
          setCountryState('Canada');
          setCurrency('CAD');
        } else if (geo?.countryCode === 'AU') {
          setCountryState('Australia');
          setCurrency('AUD');
        }
      })
      .catch(() => {});
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setCurrentUserProfile(null);
        setCurrentUserPrivate(null);
        setProfileChecked(true);
        setIsAdminDoc(false);
        return;
      }
      setProfileChecked(false);
      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        setIsAdminDoc(adminSnap.exists());
      } catch {
        setIsAdminDoc(false);
      }
    });
    return () => unsub();
  }, []);

  // WebSocket real-time connection for presence, typing, and push notifications
  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;

    function connect() {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (firebaseUser) {
          ws.send(JSON.stringify({ type: 'auth:identify', uid: firebaseUser.uid }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence:update' && Array.isArray(data.onlineUserIds)) {
            setOnlineUserIds(new Set(data.onlineUserIds));
          } else if (data.type === 'chat:typing' && data.conversationId) {
            setTypingByConversation((prev) => ({
              ...prev,
              [data.conversationId]: data.isTyping ? data.senderId : null,
            }));
          } else if (data.type === 'notification:new' && data.title) {
            showToast(`${data.title}: ${data.body || ''}`, 'success');
          }
        } catch {
          // Ignore invalid socket frames
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [firebaseUser, showToast]);

  // Identify on existing WS when firebaseUser changes
  useEffect(() => {
    if (firebaseUser && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth:identify', uid: firebaseUser.uid }));
    }
  }, [firebaseUser]);

  // Public Marketplace Firestore Listeners (platformConfig, portfolioItems, reviews, public users, public projects)
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'platformConfig', 'settings'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PlatformConfig;
          setPlatformConfig({
            commissionRatePct: data.commissionRatePct ?? 10,
            activeCategories:
              Array.isArray(data.activeCategories) && data.activeCategories.length > 0
                ? data.activeCategories
                : [...EDITING_CATEGORIES],
            updatedAt: data.updatedAt,
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'platformConfig/settings')
    );

    const unsubPortfolio = onSnapshot(
      query(collection(db, 'portfolioItems'), where('mediaType', 'in', ['video', 'image'])),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as PortfolioItem);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setPortfolioItems(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'portfolioItems')
    );

    const unsubReviews = onSnapshot(
      query(collection(db, 'reviews'), where('rating', 'in', [1, 2, 3, 4, 5])),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Review);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setReviews(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    return () => {
      unsubConfig();
      unsubPortfolio();
      unsubReviews();
    };
  }, []);

  // Users listener (Admin sees all; public sees public & non-blocked)
  useEffect(() => {
    if (!authReady) return;
    const usersQuery = isAdmin
      ? collection(db, 'users')
      : query(
          collection(db, 'users'),
          where('isPublicProfile', '==', true),
          where('isBlocked', '==', false)
        );

    const unsub = onSnapshot(
      usersQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserProfile);
        setUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );
    return () => unsub();
  }, [authReady, isAdmin]);

  // Current user's own profile & private PII listener
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const uid = firebaseUser.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const prof = snap.data() as UserProfile;
          setCurrentUserProfile(prof);
          setLanguage(prof.language || 'en');
          setCountryState(prof.country || localeDefault.country);
          setCurrency(prof.preferredCurrency || localeDefault.currency);
        } else {
          setCurrentUserProfile(null);
        }
        setProfileChecked(true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const unsubPrivate = onSnapshot(
      doc(db, 'users', uid, 'private', 'info'),
      (snap) => {
        if (snap.exists()) {
          setCurrentUserPrivate(snap.data() as UserPrivateInfo);
        } else {
          setCurrentUserPrivate(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}/private/info`)
    );

    return () => {
      unsubProfile();
      unsubPrivate();
    };
  }, [authReady, firebaseUser, localeDefault.country, localeDefault.currency]);

  // Projects listener (combines public pending/completed + user's own client/editor projects + admin all)
  useEffect(() => {
    if (!authReady) return;
    const buckets: Record<string, Project[]> = {
      public: [],
      client: [],
      editor: [],
    };

    const mergeProjects = () => {
      const map = new Map<string, Project>();
      for (const arr of Object.values(buckets)) {
        for (const p of arr) map.set(p.id, p);
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
      );
      setProjects(merged);
    };

    if (isAdmin) {
      const unsubAll = onSnapshot(
        collection(db, 'projects'),
        (snap) => {
          buckets.public = snap.docs.map((d) => d.data() as Project);
          mergeProjects();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
      );
      return () => unsubAll();
    }

    const unsubs: (() => void)[] = [];
    unsubs.push(
      onSnapshot(
        query(collection(db, 'projects'), where('status', 'in', ['pending', 'completed'])),
        (snap) => {
          buckets.public = snap.docs.map((d) => d.data() as Project);
          mergeProjects();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
      )
    );

    if (firebaseUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'projects'), where('clientId', '==', firebaseUser.uid)),
          (snap) => {
            buckets.client = snap.docs.map((d) => d.data() as Project);
            mergeProjects();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'projects'), where('editorId', '==', firebaseUser.uid)),
          (snap) => {
            buckets.editor = snap.docs.map((d) => d.data() as Project);
            mergeProjects();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, firebaseUser, isAdmin]);

  // Authenticated-only Listeners (Conversations, Transactions, Disputes, Favorites, Notifications, Proposals)
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setConversations([]);
      setTransactions([]);
      setDisputes([]);
      setFavorites([]);
      setNotifications([]);
      setMyProposals([]);
      return;
    }

    const uid = firebaseUser.uid;
    const unsubs: (() => void)[] = [];

    // Conversations (participantA or participantB)
    const convBuckets: { a: Conversation[]; b: Conversation[] } = { a: [], b: [] };
    const mergeConvs = () => {
      const map = new Map<string, Conversation>();
      for (const c of [...convBuckets.a, ...convBuckets.b]) map.set(c.id, c);
      setConversations(
        Array.from(map.values()).sort((x, y) => toMillis(y.lastMessageAt) - toMillis(x.lastMessageAt))
      );
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'conversations'), where('participantA', '==', uid)),
        (snap) => {
          convBuckets.a = snap.docs.map((d) => d.data() as Conversation);
          mergeConvs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collection(db, 'conversations'), where('participantB', '==', uid)),
        (snap) => {
          convBuckets.b = snap.docs.map((d) => d.data() as Conversation);
          mergeConvs();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
      )
    );

    // Transactions
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'transactions'),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as Transaction);
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            setTransactions(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );
    } else {
      const txBuckets: { c: Transaction[]; e: Transaction[] } = { c: [], e: [] };
      const mergeTxs = () => {
        const map = new Map<string, Transaction>();
        for (const t of [...txBuckets.c, ...txBuckets.e]) map.set(t.id, t);
        setTransactions(
          Array.from(map.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        );
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'transactions'), where('clientId', '==', uid)),
          (snap) => {
            txBuckets.c = snap.docs.map((d) => d.data() as Transaction);
            mergeTxs();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'transactions'), where('editorId', '==', uid)),
          (snap) => {
            txBuckets.e = snap.docs.map((d) => d.data() as Transaction);
            mergeTxs();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );
    }

    // Disputes
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'disputes'),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as Dispute);
            list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
            setDisputes(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'disputes')
        )
      );
    } else {
      const dispBuckets: { c: Dispute[]; e: Dispute[] } = { c: [], e: [] };
      const mergeDisputes = () => {
        const map = new Map<string, Dispute>();
        for (const d of [...dispBuckets.c, ...dispBuckets.e]) map.set(d.id, d);
        setDisputes(
          Array.from(map.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        );
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'disputes'), where('clientId', '==', uid)),
          (snap) => {
            dispBuckets.c = snap.docs.map((d) => d.data() as Dispute);
            mergeDisputes();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'disputes')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'disputes'), where('editorId', '==', uid)),
          (snap) => {
            dispBuckets.e = snap.docs.map((d) => d.data() as Dispute);
            mergeDisputes();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'disputes')
        )
      );
    }

    // Favorites
    unsubs.push(
      onSnapshot(
        query(collection(db, 'favorites'), where('clientId', '==', uid)),
        (snap) => {
          setFavorites(snap.docs.map((d) => d.data() as FavoriteEditor));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'favorites')
      )
    );

    // Notifications
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('userId', '==', uid)),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as UserNotification);
          list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setNotifications(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    // Proposals (submitted by editor or received on client's projects)
    const propBuckets: { e: Proposal[]; c: Proposal[] } = { e: [], c: [] };
    const mergeProposals = () => {
      const map = new Map<string, Proposal>();
      for (const p of [...propBuckets.e, ...propBuckets.c]) map.set(p.id, p);
      setMyProposals(
        Array.from(map.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      );
    };
    unsubs.push(
      onSnapshot(
        query(collectionGroup(db, 'proposals'), where('editorId', '==', uid)),
        (snap) => {
          propBuckets.e = snap.docs.map((d) => d.data() as Proposal);
          mergeProposals();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'proposals')
      )
    );
    unsubs.push(
      onSnapshot(
        query(collectionGroup(db, 'proposals'), where('projectClientId', '==', uid)),
        (snap) => {
          propBuckets.c = snap.docs.map((d) => d.data() as Proposal);
          mergeProposals();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'proposals')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady, firebaseUser, isAdmin]);

  // Actions
  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Signed in successfully.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Sign-in cancelled.', 'error');
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
    setViewHistory([]);
    setSelectedEditorId(null);
    setSelectedConversationId(null);
    setActiveViewState('home');
    showToast('Signed out.', 'success');
  }, [showToast]);

  const pushNotification = useCallback(
    async (targetUid: string, title: string, body: string, linkView: string) => {
      if (!firebaseUser || !targetUid || targetUid === firebaseUser.uid) return;
      const notifId = makeId('notif');
      try {
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: targetUid,
          senderId: firebaseUser.uid,
          title: title.slice(0, 140),
          body: body.slice(0, 400),
          linkView: linkView.slice(0, 60),
          read: false,
          createdAt: serverTimestamp(),
        });
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'notify:user',
              recipientId: targetUid,
              title,
              body,
              linkView,
            })
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `notifications/${notifId}`);
      }
    },
    [firebaseUser]
  );

  const saveUserProfile = useCallback(
    async (
      profileInput: {
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
        isPublicProfile: boolean;
      },
      privateInput?: {
        phone: string;
        payoutUpiId: string;
        payoutPaypalEmail: string;
        payoutBankSummary: string;
        emailNotifications: boolean;
      }
    ) => {
      if (!firebaseUser) throw new Error('Authentication required');
      const uid = firebaseUser.uid;
      const existingSnap = await getDoc(doc(db, 'users', uid));

      const safeAvatarUrl = sanitizeRemoteOrLocalUrl(profileInput.avatarUrl, 500);

      try {
        if (!existingSnap.exists()) {
          await setDoc(doc(db, 'users', uid), {
            uid,
            username: profileInput.username.trim().slice(0, 60),
            displayName: profileInput.displayName.trim().slice(0, 80),
            role: profileInput.role,
            country: profileInput.country.slice(0, 60),
            language: profileInput.language,
            preferredCurrency: profileInput.preferredCurrency,
            avatarUrl: safeAvatarUrl,
            bio: profileInput.bio.trim().slice(0, 1200),
            skills: profileInput.skills.slice(0, 15),
            categories: profileInput.categories.slice(0, 12),
            experienceYears: Math.max(0, Math.min(60, Number(profileInput.experienceYears) || 0)),
            startingPriceUsd: Math.max(0, Math.min(1000000, Number(profileInput.startingPriceUsd) || 0)),
            verifiedByAdmin: false,
            isBlocked: false,
            isPublicProfile: profileInput.isPublicProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'users', uid), {
            username: profileInput.username.trim().slice(0, 60),
            displayName: profileInput.displayName.trim().slice(0, 80),
            country: profileInput.country.slice(0, 60),
            language: profileInput.language,
            preferredCurrency: profileInput.preferredCurrency,
            avatarUrl: safeAvatarUrl,
            bio: profileInput.bio.trim().slice(0, 1200),
            skills: profileInput.skills.slice(0, 15),
            categories: profileInput.categories.slice(0, 12),
            experienceYears: Math.max(0, Math.min(60, Number(profileInput.experienceYears) || 0)),
            startingPriceUsd: Math.max(0, Math.min(1000000, Number(profileInput.startingPriceUsd) || 0)),
            isPublicProfile: profileInput.isPublicProfile,
            updatedAt: serverTimestamp(),
          });
        }

        if (privateInput) {
          await setDoc(doc(db, 'users', uid, 'private', 'info'), {
            email: (firebaseUser.email || '').slice(0, 160),
            phone: privateInput.phone.trim().slice(0, 40),
            payoutUpiId: privateInput.payoutUpiId.trim().slice(0, 100),
            payoutPaypalEmail: privateInput.payoutPaypalEmail.trim().slice(0, 160),
            payoutBankSummary: privateInput.payoutBankSummary.trim().slice(0, 200),
            emailNotifications: privateInput.emailNotifications,
            updatedAt: serverTimestamp(),
          });
        }

        setLanguage(profileInput.language);
        setCountryState(profileInput.country);
        setCurrency(profileInput.preferredCurrency);
        showToast('Profile saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    },
    [firebaseUser, showToast]
  );

  const addPortfolioItem = useCallback(
    async (input: {
      title: string;
      category: string;
      mediaType: 'video' | 'image';
      mediaUrl: string;
      thumbnailUrl: string;
      description: string;
      durationSec: number;
    }) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Profile required');
      const id = makeId('port');
      try {
        await setDoc(doc(db, 'portfolioItems', id), {
          id,
          editorId: firebaseUser.uid,
          editorName: currentUserProfile.displayName.slice(0, 80),
          title: input.title.trim().slice(0, 120),
          category: input.category.slice(0, 60),
          mediaType: input.mediaType,
          mediaUrl: input.mediaUrl.slice(0, 500),
          thumbnailUrl: input.thumbnailUrl.slice(0, 500),
          description: input.description.trim().slice(0, 600),
          durationSec: Math.max(0, Number(input.durationSec) || 0),
          createdAt: serverTimestamp(),
        });
        showToast('Portfolio item added.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `portfolioItems/${id}`);
      }
    },
    [firebaseUser, currentUserProfile, showToast]
  );

  const deletePortfolioItem = useCallback(
    async (itemId: string) => {
      try {
        await deleteDoc(doc(db, 'portfolioItems', itemId));
        showToast('Portfolio item removed.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `portfolioItems/${itemId}`);
      }
    },
    [showToast]
  );

  const createProject = useCallback(
    async (input: {
      title: string;
      category: string;
      description: string;
      budgetUsd: number;
      originalBudget: number;
      originalCurrency: CurrencyCode;
      deadline: string;
      referenceUrl: string;
    }) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Profile required');
      const id = makeId('proj');
      try {
        await setDoc(doc(db, 'projects', id), {
          id,
          clientId: firebaseUser.uid,
          clientName: currentUserProfile.displayName.slice(0, 80),
          clientCountry: currentUserProfile.country.slice(0, 60),
          editorId: '',
          editorName: '',
          title: input.title.trim().slice(0, 140),
          category: input.category.slice(0, 60),
          description: input.description.trim().slice(0, 3000),
          budgetUsd: Math.max(1, Number(input.budgetUsd)),
          originalBudget: Math.max(1, Number(input.originalBudget)),
          originalCurrency: input.originalCurrency,
          deadline: input.deadline.slice(0, 30),
          referenceUrl: input.referenceUrl.trim().slice(0, 500),
          deliveryUrl: '',
          deliveryNotes: '',
          revisionNotes: '',
          status: 'pending',
          paymentStatus: 'unpaid',
          paymentMethod: '',
          reviewed: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('Project published globally.', 'success');
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${id}`);
      }
    },
    [firebaseUser, currentUserProfile, showToast]
  );

  const cancelProject = useCallback(
    async (projectId: string) => {
      try {
        await updateDoc(doc(db, 'projects', projectId), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
        showToast('Project cancelled.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`);
      }
    },
    [showToast]
  );

  const submitProposal = useCallback(
    async (
      project: Project,
      input: { proposedPriceUsd: number; deliveryDays: number; coverLetter: string }
    ) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Profile required');
      const propId = makeId('prop');
      try {
        await setDoc(doc(db, 'projects', project.id, 'proposals', propId), {
          id: propId,
          projectId: project.id,
          projectClientId: project.clientId,
          editorId: firebaseUser.uid,
          editorName: currentUserProfile.displayName.slice(0, 80),
          editorCountry: currentUserProfile.country.slice(0, 60),
          proposedPriceUsd: Math.max(1, Number(input.proposedPriceUsd)),
          deliveryDays: Math.max(1, Math.min(365, Number(input.deliveryDays) || 3)),
          coverLetter: input.coverLetter.trim().slice(0, 1500),
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await pushNotification(
          project.clientId,
          'New Editor Proposal',
          `${currentUserProfile.displayName} submitted a proposal on "${project.title}".`,
          'dashboard'
        );
        showToast('Proposal submitted to client.', 'success');
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `projects/${project.id}/proposals/${propId}`
        );
      }
    },
    [firebaseUser, currentUserProfile, pushNotification, showToast]
  );

  const hireEditorAndFundEscrow = useCallback(
    async (input: {
      project: Project;
      editor: UserProfile;
      agreedBudgetUsd: number;
      proposalId?: string;
      gateway: Exclude<PaymentGateway, 'PlatformPayout'>;
      referenceCode: string;
      commissionPct: number;
      commissionAmountUsd: number;
      netAmountUsd: number;
      displayCurrency: CurrencyCode;
      displayAmount: number;
    }) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Authentication required');
      const txId = makeId('tx');
      const batch = writeBatch(db);

      batch.update(doc(db, 'projects', input.project.id), {
        editorId: input.editor.uid,
        editorName: input.editor.displayName.slice(0, 80),
        budgetUsd: input.agreedBudgetUsd,
        status: 'active',
        paymentStatus: 'held_in_escrow',
        paymentMethod: input.gateway,
        updatedAt: serverTimestamp(),
      });

      if (input.proposalId) {
        batch.update(doc(db, 'projects', input.project.id, 'proposals', input.proposalId), {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
      }

      batch.set(doc(db, 'transactions', txId), {
        id: txId,
        projectId: input.project.id,
        projectTitle: input.project.title.slice(0, 140),
        clientId: firebaseUser.uid,
        editorId: input.editor.uid,
        type: 'escrow_payment',
        gateway: input.gateway,
        grossAmountUsd: input.agreedBudgetUsd,
        commissionPct: input.commissionPct,
        commissionAmountUsd: input.commissionAmountUsd,
        netAmountUsd: input.netAmountUsd,
        displayCurrency: input.displayCurrency,
        displayAmount: input.displayAmount,
        status: 'held_in_escrow',
        referenceCode: input.referenceCode.slice(0, 100),
        country: currentUserProfile.country.slice(0, 60),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        await pushNotification(
          input.editor.uid,
          'You were hired!',
          `${currentUserProfile.displayName} funded escrow for "${input.project.title}".`,
          'dashboard'
        );
        showToast('Editor hired and escrow payment secured.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `projects/${input.project.id}`);
      }
    },
    [firebaseUser, currentUserProfile, pushNotification, showToast]
  );

  const deliverProjectWork = useCallback(
    async (project: Project, deliveryUrl: string, deliveryNotes: string) => {
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          deliveryUrl: deliveryUrl.trim().slice(0, 500),
          deliveryNotes: deliveryNotes.trim().slice(0, 1000),
          status: 'delivered',
          updatedAt: serverTimestamp(),
        });
        await pushNotification(
          project.clientId,
          'Final Delivery Uploaded',
          `${project.editorName} delivered work for "${project.title}".`,
          'dashboard'
        );
        showToast('Final delivery submitted to client.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
      }
    },
    [pushNotification, showToast]
  );

  const requestProjectRevision = useCallback(
    async (project: Project, revisionNotes: string) => {
      try {
        await updateDoc(doc(db, 'projects', project.id), {
          revisionNotes: revisionNotes.trim().slice(0, 1000),
          status: 'revision_requested',
          updatedAt: serverTimestamp(),
        });
        await pushNotification(
          project.editorId,
          'Revision Requested',
          `Client requested revisions on "${project.title}".`,
          'dashboard'
        );
        showToast('Revision request sent to editor.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
      }
    },
    [pushNotification, showToast]
  );

  const approveProjectAndReleasePayment = useCallback(
    async (project: Project) => {
      const escrowTx = transactions.find(
        (tx) =>
          tx.projectId === project.id &&
          tx.type === 'escrow_payment' &&
          tx.status === 'held_in_escrow'
      );
      const batch = writeBatch(db);
      batch.update(doc(db, 'projects', project.id), {
        status: 'completed',
        paymentStatus: 'released',
        updatedAt: serverTimestamp(),
      });
      if (escrowTx) {
        batch.update(doc(db, 'transactions', escrowTx.id), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        await pushNotification(
          project.editorId,
          'Project Approved & Payment Released',
          `Payment for "${project.title}" has been released to your balance.`,
          'dashboard'
        );
        showToast('Project approved and payment released!', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${project.id}`);
      }
    },
    [transactions, pushNotification, showToast]
  );

  const submitReview = useCallback(
    async (project: Project, rating: number, comment: string) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Authentication required');
      const revId = makeId('rev');
      const batch = writeBatch(db);
      batch.set(doc(db, 'reviews', revId), {
        id: revId,
        projectId: project.id,
        editorId: project.editorId,
        clientId: firebaseUser.uid,
        clientName: currentUserProfile.displayName.slice(0, 80),
        rating: Math.max(1, Math.min(5, Math.round(rating))),
        comment: comment.trim().slice(0, 1000),
        category: project.category.slice(0, 60),
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'projects', project.id), {
        reviewed: true,
        updatedAt: serverTimestamp(),
      });
      try {
        await batch.commit();
        await pushNotification(
          project.editorId,
          'New Client Review',
          `${currentUserProfile.displayName} left a ${rating}-star review on "${project.title}".`,
          'profile'
        );
        showToast('Review published.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reviews/${revId}`);
      }
    },
    [firebaseUser, currentUserProfile, pushNotification, showToast]
  );

  const openDispute = useCallback(
    async (project: Project, reason: string) => {
      if (!firebaseUser || !currentUserProfile) throw new Error('Authentication required');
      const dispId = makeId('disp');
      const escrowTx = transactions.find(
        (tx) => tx.projectId === project.id && tx.status === 'held_in_escrow'
      );
      const batch = writeBatch(db);
      batch.set(doc(db, 'disputes', dispId), {
        id: dispId,
        projectId: project.id,
        projectTitle: project.title.slice(0, 140),
        openedBy: firebaseUser.uid,
        openedByName: currentUserProfile.displayName.slice(0, 80),
        clientId: project.clientId,
        editorId: project.editorId,
        reason: reason.trim().slice(0, 1200),
        status: 'open',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'projects', project.id), {
        status: 'disputed',
        paymentStatus: 'disputed',
        updatedAt: serverTimestamp(),
      });
      if (escrowTx) {
        batch.update(doc(db, 'transactions', escrowTx.id), {
          status: 'disputed',
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        showToast('Dispute filed for Admin review.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `disputes/${dispId}`);
      }
    },
    [firebaseUser, currentUserProfile, transactions, showToast]
  );

  const toggleFavoriteEditor = useCallback(
    async (editorId: string) => {
      if (!firebaseUser) {
        showToast('Sign in to save favourite editors.', 'error');
        return;
      }
      const favId = `${firebaseUser.uid}_${editorId}`;
      const exists = favorites.some((f) => f.id === favId);
      try {
        if (exists) {
          await deleteDoc(doc(db, 'favorites', favId));
          showToast('Removed from favourites.', 'success');
        } else {
          await setDoc(doc(db, 'favorites', favId), {
            id: favId,
            clientId: firebaseUser.uid,
            editorId,
            createdAt: serverTimestamp(),
          });
          showToast('Saved to favourite editors.', 'success');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `favorites/${favId}`);
      }
    },
    [firebaseUser, favorites, showToast]
  );

  const startConversationWith = useCallback(
    async (otherUser: UserProfile, project?: Project): Promise<string> => {
      if (!firebaseUser || !currentUserProfile) {
        throw new Error('Sign in to send messages.');
      }
      const [a, b] = [firebaseUser.uid, otherUser.uid].sort();
      const convId = `${a}_${b}`;
      const existing = conversations.find((c) => c.id === convId);
      if (!existing) {
        const isMeA = a === firebaseUser.uid;
        try {
          await setDoc(doc(db, 'conversations', convId), {
            id: convId,
            participantA: a,
            participantB: b,
            participantAName: (isMeA ? currentUserProfile.displayName : otherUser.displayName).slice(0, 80),
            participantBName: (isMeA ? otherUser.displayName : currentUserProfile.displayName).slice(0, 80),
            participantAAvatar: sanitizeRemoteOrLocalUrl(
              isMeA ? currentUserProfile.avatarUrl : otherUser.avatarUrl,
              500
            ),
            participantBAvatar: sanitizeRemoteOrLocalUrl(
              isMeA ? otherUser.avatarUrl : currentUserProfile.avatarUrl,
              500
            ),
            projectId: project?.id || '',
            projectTitle: project?.title.slice(0, 140) || '',
            lastMessage: 'Conversation started',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}`);
        }
      }
      setSelectedConversationId(convId);
      setActiveView('messages');
      return convId;
    },
    [firebaseUser, currentUserProfile, conversations, setActiveView]
  );

  const sendChatMessage = useCallback(
    async (
      conversation: Conversation,
      text: string,
      attachment?: { url: string; name: string; type: 'image' | 'video' | 'file' }
    ) => {
      if (!firebaseUser || !currentUserProfile) return;
      const trimmed = text.trim();
      if (!trimmed && !attachment) return;
      const msgId = makeId('msg');
      const recipientId =
        conversation.participantA === firebaseUser.uid
          ? conversation.participantB
          : conversation.participantA;

      const batch = writeBatch(db);
      batch.set(doc(db, 'conversations', conversation.id, 'messages', msgId), {
        id: msgId,
        conversationId: conversation.id,
        senderId: firebaseUser.uid,
        senderName: currentUserProfile.displayName.slice(0, 80),
        text: trimmed.slice(0, 2000),
        attachmentUrl: attachment?.url.slice(0, 500) || '',
        attachmentName: attachment?.name.slice(0, 140) || '',
        attachmentType: attachment?.type || 'none',
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'conversations', conversation.id), {
        lastMessage: (trimmed || `Shared ${attachment?.name || 'file'}`).slice(0, 300),
        lastMessageAt: serverTimestamp(),
      });
      try {
        await batch.commit();
        await pushNotification(
          recipientId,
          `Message from ${currentUserProfile.displayName}`,
          trimmed || `Sent attachment: ${attachment?.name}`,
          'messages'
        );
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `conversations/${conversation.id}/messages/${msgId}`
        );
      }
    },
    [firebaseUser, currentUserProfile, pushNotification]
  );

  const subscribeConversationMessages = useCallback(
    (conversationId: string, callback: (msgs: ChatMessage[]) => void) => {
      return onSnapshot(
        collection(db, 'conversations', conversationId, 'messages'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as ChatMessage);
          list.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          callback(list);
        },
        (err) =>
          handleFirestoreError(
            err,
            OperationType.LIST,
            `conversations/${conversationId}/messages`
          )
      );
    },
    []
  );

  const sendTypingSignal = useCallback(
    (conversationId: string, recipientId: string, isTyping: boolean) => {
      if (!firebaseUser || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:typing',
          conversationId,
          recipientId,
          senderId: firebaseUser.uid,
          isTyping,
        })
      );
    },
    [firebaseUser]
  );

  const markNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  }, []);

  const recordEditorPayout = useCallback(
    async (input: {
      amountUsd: number;
      displayCurrency: CurrencyCode;
      displayAmount: number;
      referenceCode: string;
      destinationLabel: string;
    }) => {
      if (!firebaseUser || !currentUserProfile) return;
      const txId = makeId('pay');
      try {
        await setDoc(doc(db, 'transactions', txId), {
          id: txId,
          projectId: '',
          projectTitle: `Payout (${input.destinationLabel})`.slice(0, 140),
          clientId: '',
          editorId: firebaseUser.uid,
          type: 'editor_payout',
          gateway: 'PlatformPayout',
          grossAmountUsd: input.amountUsd,
          commissionPct: 0,
          commissionAmountUsd: 0,
          netAmountUsd: input.amountUsd,
          displayCurrency: input.displayCurrency,
          displayAmount: input.displayAmount,
          status: 'completed',
          referenceCode: input.referenceCode.slice(0, 100),
          country: currentUserProfile.country.slice(0, 60),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`Payout processed (${input.referenceCode}).`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
      }
    },
    [firebaseUser, currentUserProfile, showToast]
  );

  // Admin Operations
  const adminSetEditorVerified = useCallback(
    async (uid: string, verified: boolean) => {
      try {
        await updateDoc(doc(db, 'users', uid), {
          verifiedByAdmin: verified,
          updatedAt: serverTimestamp(),
        });
        await pushNotification(
          uid,
          verified ? 'Profile Verified' : 'Verification Removed',
          verified
            ? 'An administrator verified your Editor Hub Pro profile.'
            : 'Your verification status was updated by an administrator.',
          'profile'
        );
        showToast(verified ? 'Editor verified.' : 'Verification removed.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [pushNotification, showToast]
  );

  const adminSetUserBlocked = useCallback(
    async (uid: string, blocked: boolean) => {
      try {
        await updateDoc(doc(db, 'users', uid), {
          isBlocked: blocked,
          updatedAt: serverTimestamp(),
        });
        showToast(blocked ? 'Account blocked.' : 'Account restored.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [showToast]
  );

  const adminUpdatePlatformConfig = useCallback(
    async (commissionRatePct: number, activeCategories: string[]) => {
      try {
        await setDoc(doc(db, 'platformConfig', 'settings'), {
          commissionRatePct: Math.max(0, Math.min(40, Number(commissionRatePct) || 0)),
          activeCategories: activeCategories.slice(0, 24),
          updatedAt: serverTimestamp(),
        });
        showToast('Platform settings saved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'platformConfig/settings');
      }
    },
    [showToast]
  );

  const adminResolveDispute = useCallback(
    async (
      dispute: Dispute,
      resolution: 'resolved_refund' | 'resolved_release' | 'dismissed',
      adminNote: string
    ) => {
      const escrowTx = transactions.find(
        (tx) => tx.projectId === dispute.projectId && tx.type === 'escrow_payment'
      );
      const batch = writeBatch(db);
      batch.update(doc(db, 'disputes', dispute.id), {
        status: resolution,
        adminNote: adminNote.trim().slice(0, 1000),
        updatedAt: serverTimestamp(),
      });

      if (resolution === 'resolved_refund') {
        batch.update(doc(db, 'projects', dispute.projectId), {
          status: 'cancelled',
          paymentStatus: 'refunded',
          updatedAt: serverTimestamp(),
        });
        if (escrowTx) {
          batch.update(doc(db, 'transactions', escrowTx.id), {
            status: 'refunded',
            updatedAt: serverTimestamp(),
          });
        }
      } else if (resolution === 'resolved_release') {
        batch.update(doc(db, 'projects', dispute.projectId), {
          status: 'completed',
          paymentStatus: 'released',
          updatedAt: serverTimestamp(),
        });
        if (escrowTx) {
          batch.update(doc(db, 'transactions', escrowTx.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        batch.update(doc(db, 'projects', dispute.projectId), {
          status: 'active',
          paymentStatus: 'held_in_escrow',
          updatedAt: serverTimestamp(),
        });
        if (escrowTx) {
          batch.update(doc(db, 'transactions', escrowTx.id), {
            status: 'held_in_escrow',
            updatedAt: serverTimestamp(),
          });
        }
      }

      try {
        await batch.commit();
        showToast('Dispute resolved.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `disputes/${dispute.id}`);
      }
    },
    [transactions, showToast]
  );

  const value: AppContextValue = {
    authReady,
    firebaseUser,
    currentUserProfile,
    currentUserPrivate,
    needsOnboarding,
    isAdmin,
    activeView,
    setActiveView,
    canGoBack,
    previousView,
    goBack,
    selectedEditorId,
    setSelectedEditorId,
    selectedConversationId,
    setSelectedConversationId,
    language,
    setLanguage,
    country,
    setCountry,
    currency,
    setCurrency,
    exchangeRates,
    ratesUpdatedAt,
    users,
    portfolioItems,
    projects,
    myProposals,
    reviews,
    conversations,
    transactions,
    disputes,
    favorites,
    notifications,
    platformConfig,
    onlineUserIds,
    typingByConversation,
    sendTypingSignal,
    toast,
    showToast,
    signInWithGoogle,
    signOutUser,
    saveUserProfile,
    addPortfolioItem,
    deletePortfolioItem,
    createProject,
    cancelProject,
    submitProposal,
    hireEditorAndFundEscrow,
    deliverProjectWork,
    requestProjectRevision,
    approveProjectAndReleasePayment,
    submitReview,
    openDispute,
    toggleFavoriteEditor,
    startConversationWith,
    sendChatMessage,
    subscribeConversationMessages,
    markNotificationRead,
    recordEditorPayout,
    adminSetEditorVerified,
    adminSetUserBlocked,
    adminUpdatePlatformConfig,
    adminResolveDispute,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
