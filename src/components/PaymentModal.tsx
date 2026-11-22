import React, { useState } from 'react';
import { CheckCircle2, CreditCard, Lock, Smartphone, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { convertUsdToCurrency, formatExactCurrency, isIndiaCountry } from '../lib/currency';
import { PaymentGateway, Project, UserProfile } from '../types/marketplace';

interface PaymentModalProps {
  project: Project;
  editor: UserProfile;
  agreedBudgetUsd: number;
  proposalId?: string;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  project,
  editor,
  agreedBudgetUsd,
  proposalId,
  onClose,
}) => {
  const {
    country,
    currency,
    exchangeRates,
    platformConfig,
    hireEditorAndFundEscrow,
    showToast,
  } = useApp();

  const indiaEligible = isIndiaCountry(country) || currency === 'INR';
  const [gateway, setGateway] = useState<Exclude<PaymentGateway, 'PlatformPayout'>>(
    indiaEligible ? 'UPI' : 'Stripe'
  );
  const [upiId, setUpiId] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [processing, setProcessing] = useState(false);

  const displayAmount = convertUsdToCurrency(agreedBudgetUsd, currency, exchangeRates);
  const commissionPct = platformConfig.commissionRatePct;
  const commissionUsd = Number(((agreedBudgetUsd * commissionPct) / 100).toFixed(2));
  const netToEditorUsd = Number((agreedBudgetUsd - commissionUsd).toFixed(2));

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const cleanedDigits = cardNumber.replace(/\D/g, '');
      const cardLast4 = cleanedDigits.slice(-4) || '4242';
      if (gateway === 'Stripe' && (cleanedDigits.length < 12 || !cardExpiry.trim() || cardCvc.trim().length < 3)) {
        throw new Error('Enter valid card number, expiry, and CVC.');
      }

      const resp = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          amountUsd: agreedBudgetUsd,
          displayCurrency: currency,
          displayAmount,
          commissionPct,
          upiId,
          paypalEmail,
          cardLast4,
          country,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || 'Payment verification failed');
      }

      await hireEditorAndFundEscrow({
        project,
        editor,
        agreedBudgetUsd: result.grossAmountUsd,
        proposalId,
        gateway,
        referenceCode: result.referenceCode,
        commissionPct: result.commissionPct,
        commissionAmountUsd: result.commissionAmountUsd,
        netAmountUsd: result.netAmountUsd,
        displayCurrency: currency,
        displayAmount,
      });

      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment error', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Escrow Checkout & Hire</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Hiring {editor.displayName} for {project.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary breakdown */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Escrow Total ({currency})</span>
            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
              {formatExactCurrency(displayAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>USD Settlement Equivalent</span>
            <span className="font-mono tabular-nums">${agreedBudgetUsd.toFixed(2)} USD</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Platform Escrow Fee ({commissionPct}%)</span>
            <span className="font-mono tabular-nums">${commissionUsd.toFixed(2)} USD</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-700 pt-2 border-t border-slate-200">
            <span>Editor Net Payout Upon Approval</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700">${netToEditorUsd.toFixed(2)} USD</span>
          </div>
        </div>

        <form onSubmit={handleConfirmPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">
              Select Payment Method ({country})
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGateway('UPI')}
                className={`p-3 rounded-xl border text-center transition-colors ${
                  gateway === 'UPI'
                    ? 'border-violet-600 bg-violet-50 text-violet-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Smartphone className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs font-semibold">UPI</div>
                <div className="text-[11px] text-slate-500">India</div>
              </button>
              <button
                type="button"
                onClick={() => setGateway('Stripe')}
                className={`p-3 rounded-xl border text-center transition-colors ${
                  gateway === 'Stripe'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs font-semibold">Stripe</div>
                <div className="text-[11px] text-slate-500">Global Card</div>
              </button>
              <button
                type="button"
                onClick={() => setGateway('PayPal')}
                className={`p-3 rounded-xl border text-center transition-colors ${
                  gateway === 'PayPal'
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs font-semibold">PayPal</div>
                <div className="text-[11px] text-slate-500">International</div>
              </button>
            </div>
          </div>

          {gateway === 'UPI' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                UPI ID (GPay, PhonePe, Paytm, BHIM)
              </label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="username@okaxis"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-violet-600"
              />
            </div>
          )}

          {gateway === 'Stripe' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Card Number</label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Expiry</label>
                  <input
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="12/28"
                    maxLength={7}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">CVC</label>
                  <input
                    type="text"
                    required
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {gateway === 'PayPal' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">PayPal Email Address</label>
              <input
                type="email"
                required
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Funds remain held in escrow until you approve the final delivery.</span>
          </div>

          <button
            type="submit"
            disabled={processing}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 rounded-xl transition-all disabled:opacity-50"
          >
            {processing
              ? 'Verifying Escrow Payment...'
              : `Pay ${formatExactCurrency(displayAmount, currency)} into Escrow`}
          </button>
        </form>
      </div>
    </div>
  );
};
