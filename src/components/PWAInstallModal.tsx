import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../lib/i18n';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { language } = useApp();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg border border-amber-700"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t(language, 'offlineNotice')}</span>
    </div>
  );
};

interface PWAInstallModalProps {
  open: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ open, onClose }) => {
  const { language } = useApp();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedManifest, setCopiedManifest] = useState(false);

  if (!open) return null;

  const manifestUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/manifest.webmanifest`
      : '/manifest.webmanifest';

  const handleCopyManifest = async () => {
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopiedManifest(true);
      setTimeout(() => setCopiedManifest(false), 2000);
    } catch {
      // Ignore clipboard failures on restricted contexts
    }
  };

  const handleTriggerInstall = async () => {
    const result = await install();
    if (result === 'accepted') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Editing Hub App Icon"
              className="w-12 h-12 rounded-xl border border-slate-200 object-cover shrink-0 bg-black"
            />
            <div className="min-w-0">
              <h2
                id="pwa-install-title"
                className="text-lg font-bold text-slate-900 font-display truncate"
              >
                {t(language, 'appModeTitle')}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{t(language, 'appModeSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install guide"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {isInstalled ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs leading-relaxed">
                <div className="font-semibold">Standalone App Mode Active</div>
                <div>
                  Editing Hub is already running as an installed standalone app on this device.
                </div>
              </div>
            </div>
          ) : isInstallable ? (
            <div className="p-4 rounded-xl bg-violet-50 border border-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-700">
                <div className="font-semibold text-slate-900">Ready for 1-Tap Android / Desktop Install</div>
                <div className="mt-0.5">
                  Installs as a full-screen standalone WebAPK with home icon and offline cache.
                </div>
              </div>
              <button
                type="button"
                onClick={handleTriggerInstall}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t(language, 'installApp')}</span>
              </button>
            </div>
          ) : null}

          {/* Android WebAPK Instructions */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Smartphone className="w-4 h-4 text-violet-600" />
              <span>Android (Chrome WebAPK Standalone Mode)</span>
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Open this app link directly in <strong>Google Chrome</strong> on your Android phone
                (outside an embedded preview frame).
              </li>
              <li>
                Tap the <strong>⋮ Menu</strong> in Chrome’s top-right corner and choose{' '}
                <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
              </li>
              <li>
                Android automatically packages a signed <strong>WebAPK</strong> on your home screen
                with zero browser bars and offline asset caching.
              </li>
            </ol>
          </div>

          {/* iOS Safari Instructions */}
          <div
            className={`rounded-xl border p-4 space-y-2.5 ${
              isIOS ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Share className="w-4 h-4 text-blue-600" />
              <span>iPhone / iPad (Safari)</span>
            </div>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Open Editing Hub in <strong>Safari</strong> and tap the <strong>Share</strong> icon.
              </li>
              <li>
                Scroll down and select <strong>Add to Home Screen</strong>, then tap{' '}
                <strong>Add</strong>.
              </li>
            </ol>
          </div>

          {/* Packaging Signed .apk for Play Store / Sideloading */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-900">
                Export Distributable Android .apk File (PWABuilder / Bubblewrap)
              </span>
              <a
                href="https://www.pwabuilder.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-800 whitespace-nowrap"
              >
                <span>PWABuilder</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              To download a standalone <code className="font-mono text-slate-800">.apk</code>{' '}
              installer for sideloading or Google Play, paste your live Editing Hub URL into{' '}
              <strong>PWABuilder.com</strong> or run{' '}
              <code className="font-mono text-slate-800">npx @bubblewrap/cli init</code> with your
              Web Manifest URL:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={manifestUrl}
                aria-label="Web App Manifest URL"
                className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-700"
              />
              <button
                type="button"
                onClick={handleCopyManifest}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0"
              >
                {copiedManifest ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile-drawer' | 'settings';
  onActionComplete?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onActionComplete,
}) => {
  const { language } = useApp();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  if (isInstalled && variant !== 'settings') {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable && !isInstalled) {
      const outcome = await install();
      if (outcome === 'accepted') {
        onActionComplete?.();
        return;
      }
    }
    setModalOpen(true);
  };

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleClick}
          title={t(language, 'installApp')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
        >
          <Smartphone className="w-3.5 h-3.5 text-violet-600" />
          <span className="hidden sm:inline">{t(language, 'installApp')}</span>
        </button>
      )}

      {variant === 'mobile-drawer' && (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>{t(language, 'installApp')}</span>
          </span>
          <Download className="w-4 h-4" />
        </button>
      )}

      {variant === 'settings' && (
        <div className="flex flex-wrap items-center gap-3">
          {isInstalled ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t(language, 'installedAppBadge')}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-xs font-semibold shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{t(language, 'installApp')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700"
          >
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span>Android APK / iOS Guide</span>
          </button>
        </div>
      )}

      <PWAInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
