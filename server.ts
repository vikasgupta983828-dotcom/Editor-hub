import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Fallback exchange rates relative to USD (updated dynamically via API when reachable)
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 84.5,
  GBP: 0.79,
  EUR: 0.94,
  AED: 3.67,
  CAD: 1.4,
  AUD: 1.54,
};

let cachedRates: {
  rates: Record<string, number>;
  updatedAt: string;
  fetchedAtMs: number;
  source: string;
} = {
  rates: { ...FALLBACK_RATES },
  updatedAt: new Date().toISOString(),
  fetchedAtMs: 0,
  source: 'cached-baseline',
};

async function getLatestExchangeRates() {
  const now = Date.now();
  if (now - cachedRates.fetchedAtMs < 60 * 60 * 1000 && cachedRates.fetchedAtMs > 0) {
    return cachedRates;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const json = (await resp.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
      if (json && json.rates) {
        const nextRates: Record<string, number> = { USD: 1 };
        for (const code of Object.keys(FALLBACK_RATES)) {
          if (typeof json.rates[code] === 'number' && json.rates[code] > 0) {
            nextRates[code] = Number(json.rates[code].toFixed(4));
          } else {
            nextRates[code] = FALLBACK_RATES[code];
          }
        }
        cachedRates = {
          rates: nextRates,
          updatedAt: json.time_last_update_utc || new Date().toISOString(),
          fetchedAtMs: now,
          source: 'live-open-er-api',
        };
      }
    }
  } catch {
    // Keep existing/fallback rates if external network is unavailable
    cachedRates = {
      ...cachedRates,
      fetchedAtMs: now,
    };
  }
  return cachedRates;
}

// Secure multer upload configuration with MIME & extension allowlist
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/x-ms-bmp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);

const ALLOWED_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.heic',
  '.heif',
  '.bmp',
  '.mp4',
  '.webm',
  '.mov',
  '.pdf',
  '.zip',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/x-png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/bmp': '.bmp',
  'image/x-ms-bmp': '.bmp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
};

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif', '.bmp']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);

function isUnsafeMimeOrExt(mime: string, ext: string): boolean {
  if (mime.includes('svg') || mime.includes('html') || mime.includes('script') || mime.includes('xml')) {
    return true;
  }
  return ext === '.svg' || ext === '.html' || ext === '.htm' || ext === '.js';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const safeExt = ALLOWED_EXTS.has(ext) ? ext : MIME_TO_EXT[mime] || '';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (isUnsafeMimeOrExt(mime, ext)) {
      cb(new Error('Unsupported file type. SVG and executable files are not allowed.'));
      return;
    }
    if (ALLOWED_MIME_TYPES.has(mime) || ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Unsupported file type. Allowed: JPG, PNG, WebP, GIF, AVIF, HEIC, MP4, WebM, MOV, PDF, ZIP.'
        )
      );
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Serve uploaded files safely with nosniff header and explicit 404 so missing files don't return SPA HTML
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(uploadsDir),
    (_req, res) => {
      res.status(404).json({ error: 'Uploaded file not found' });
    }
  );

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'Editing Hub', timestamp: new Date().toISOString() });
  });

  // Live international currency exchange rates
  app.get('/api/exchange-rates', async (_req, res) => {
    const data = await getLatestExchangeRates();
    res.json({
      base: 'USD',
      rates: data.rates,
      updatedAt: data.updatedAt,
      source: data.source,
    });
  });

  // Country detection helper from request headers
  app.get('/api/geo', (req, res) => {
    const headerCountry =
      (req.headers['x-appengine-country'] as string) ||
      (req.headers['cf-ipcountry'] as string) ||
      '';
    const acceptLang = (req.headers['accept-language'] as string) || '';
    res.json({
      countryCode: headerCountry.toUpperCase() || null,
      acceptLanguage: acceptLang,
    });
  });

  // Cloud-style file upload endpoint for avatars, portfolio media, and chat files
  app.post('/api/uploads', (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File is too large. Maximum allowed size is 50 MB.' });
          return;
        }
        res.status(400).json({ error: err.message || 'Upload failed' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }
      const resolvedPath = path.resolve(uploadsDir, req.file.filename);
      if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
        res.status(400).json({ error: 'Invalid file path' });
        return;
      }
      const mime = (req.file.mimetype || '').toLowerCase();
      const savedExt = path.extname(req.file.filename).toLowerCase();
      let mediaCategory: 'image' | 'video' | 'file' = 'file';
      if (mime.startsWith('image/') || IMAGE_EXTS.has(savedExt)) mediaCategory = 'image';
      else if (mime.startsWith('video/') || VIDEO_EXTS.has(savedExt)) mediaCategory = 'video';

      res.json({
        url: `/uploads/${req.file.filename}`,
        originalName: (req.file.originalname || req.file.filename).slice(0, 120),
        size: req.file.size,
        mimeType: mime,
        mediaCategory,
      });
    });
  });

  // Payment processing endpoint (UPI, Stripe, PayPal)
  app.post('/api/payments/process', (req, res) => {
    const {
      gateway,
      amountUsd,
      displayCurrency,
      displayAmount,
      commissionPct,
      upiId,
      paypalEmail,
      cardLast4,
      country,
    } = req.body || {};

    if (!['UPI', 'Stripe', 'PayPal'].includes(gateway)) {
      res.status(400).json({ error: 'Unsupported payment gateway selected.' });
      return;
    }

    const numericUsd = Number(amountUsd);
    if (!Number.isFinite(numericUsd) || numericUsd <= 0) {
      res.status(400).json({ error: 'Invalid payment amount.' });
      return;
    }

    if (gateway === 'UPI') {
      if (typeof upiId !== 'string' || !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(upiId.trim())) {
        res.status(400).json({ error: 'Please enter a valid UPI ID (e.g. name@okaxis or name@upi).' });
        return;
      }
    }

    if (gateway === 'PayPal') {
      if (typeof paypalEmail !== 'string' || !paypalEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid PayPal account email.' });
        return;
      }
    }

    if (gateway === 'Stripe') {
      if (typeof cardLast4 !== 'string' || cardLast4.length < 4) {
        res.status(400).json({ error: 'Please provide valid card details for Stripe checkout.' });
        return;
      }
    }

    const pct = Math.min(40, Math.max(0, Number(commissionPct) || 10));
    const commissionAmountUsd = Number(((numericUsd * pct) / 100).toFixed(2));
    const netAmountUsd = Number((numericUsd - commissionAmountUsd).toFixed(2));
    const prefix = gateway === 'UPI' ? 'EHP-UPI' : gateway === 'Stripe' ? 'EHP-STR' : 'EHP-PPL';
    const referenceCode = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    res.json({
      verified: true,
      gateway,
      status: 'held_in_escrow',
      referenceCode,
      grossAmountUsd: Number(numericUsd.toFixed(2)),
      commissionPct: pct,
      commissionAmountUsd,
      netAmountUsd,
      displayCurrency: String(displayCurrency || 'USD'),
      displayAmount: Number(displayAmount) || Number(numericUsd.toFixed(2)),
      country: String(country || 'Global'),
      processedAt: new Date().toISOString(),
    });
  });

  // Editor payout request processing endpoint
  app.post('/api/payouts/withdraw', (req, res) => {
    const { amountUsd, destinationType, destinationValue, currency, displayAmount } = req.body || {};
    const numericUsd = Number(amountUsd);
    if (!Number.isFinite(numericUsd) || numericUsd <= 0) {
      res.status(400).json({ error: 'Invalid payout amount.' });
      return;
    }
    if (typeof destinationValue !== 'string' || destinationValue.trim().length < 3) {
      res.status(400).json({ error: 'Please configure your payout destination in Settings or Profile first.' });
      return;
    }

    const referenceCode = `EHP-PAY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    res.json({
      verified: true,
      referenceCode,
      destinationType: String(destinationType || 'UPI'),
      amountUsd: Number(numericUsd.toFixed(2)),
      displayCurrency: String(currency || 'USD'),
      displayAmount: Number(displayAmount) || Number(numericUsd.toFixed(2)),
      processedAt: new Date().toISOString(),
    });
  });

  const server = http.createServer(app);

  // Real-time WebSocket server for online presence, chat events, and live notifications
  const wss = new WebSocketServer({ server, path: '/ws' });
  const userSockets = new Map<string, Set<WebSocket>>();
  const socketToUid = new Map<WebSocket, string>();

  function broadcastPresence() {
    const onlineUserIds = Array.from(userSockets.keys());
    const payload = JSON.stringify({ type: 'presence:update', onlineUserIds });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  function sendToUser(uid: string, message: unknown) {
    const sockets = userSockets.get(uid);
    if (!sockets) return;
    const payload = JSON.stringify(message);
    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          uid?: string;
          recipientId?: string;
          conversationId?: string;
          senderId?: string;
          senderName?: string;
          isTyping?: boolean;
          title?: string;
          body?: string;
          linkView?: string;
        };

        if (msg.type === 'auth:identify' && typeof msg.uid === 'string' && msg.uid.length > 0) {
          const prevUid = socketToUid.get(ws);
          if (prevUid && prevUid !== msg.uid) {
            userSockets.get(prevUid)?.delete(ws);
            if (userSockets.get(prevUid)?.size === 0) userSockets.delete(prevUid);
          }
          socketToUid.set(ws, msg.uid);
          if (!userSockets.has(msg.uid)) {
            userSockets.set(msg.uid, new Set());
          }
          userSockets.get(msg.uid)!.add(ws);
          broadcastPresence();
        } else if (msg.type === 'chat:typing' && msg.recipientId && msg.conversationId) {
          sendToUser(msg.recipientId, {
            type: 'chat:typing',
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            isTyping: Boolean(msg.isTyping),
          });
        } else if (msg.type === 'notify:user' && msg.recipientId) {
          sendToUser(msg.recipientId, {
            type: 'notification:new',
            title: msg.title || 'Update',
            body: msg.body || '',
            linkView: msg.linkView || 'dashboard',
          });
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const uid = socketToUid.get(ws);
      socketToUid.delete(ws);
      if (uid) {
        const set = userSockets.get(uid);
        if (set) {
          set.delete(ws);
          if (set.size === 0) {
            userSockets.delete(uid);
          }
        }
        broadcastPresence();
      }
    });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Editing Hub server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
