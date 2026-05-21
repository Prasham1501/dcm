// Razorpay loader + checkout opener.
// In live mode: calls /api/wallet/topup which returns a real order_id + key from Razorpay.
// In mock mode: simulates Razorpay's success popup so the user can click through end-to-end.

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script');
  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
  s.onload = () => resolve(true);
  s.onerror = () => reject(new Error('Razorpay SDK failed to load'));
  document.head.appendChild(s);
});

// Opens Razorpay checkout (or mock equivalent), returns a Promise that resolves with
// the verification result on success or rejects on failure/dismiss.
const openCheckout = async ({ type, amount, credits, items, user, description, onProgress }) => {
  // Step 1 — create order on backend.
  onProgress?.('Creating order…');
  const order = await mvApi.topup({ type, amount, credits, items });

  // Backend has no Razorpay configured → credit was applied immediately.
  if (order.auto_provisioned) {
    onProgress?.('Credit applied');
    return { balance: order.balance, invoice_id: order.invoice_id, invoice: order.invoice, auto_provisioned: true };
  }

  // Step 2 — open checkout. In mock mode, we simulate the popup with a real-feeling overlay.
  if (mvApi.getMode() === 'mock') {
    return openMockCheckout({ order, type, amount, credits, items, description, onProgress });
  }
  // Live mode — real Razorpay.
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.rzp_key,
      amount: Math.round(order.amount * 100), // paise
      currency: 'INR',
      name: 'MediView',
      description: description || 'Mediview top-up',
      order_id: order.order_id,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone || '' },
      theme: { color: '#DC2626' },
      handler: async (resp) => {
        onProgress?.('Verifying payment…');
        try {
          const v = await mvApi.verifyPayment({
            type, amount, credits, items,
            order_id: resp.razorpay_order_id,
            payment_id: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
            method: 'UPI',
          });
          resolve(v);
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.open();
  });
};

// Mock checkout — visual fidelity to Razorpay's modal so the flow feels real.
const openMockCheckout = ({ order, type, amount, credits, items, description, onProgress }) => new Promise((resolve, reject) => {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[300] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[var(--line)] shadow-2xl overflow-hidden">
      <div class="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-[#3395FF] grid place-items-center text-white font-bold text-sm">R</div>
          <div>
            <div class="font-bold text-sm">Razorpay (Test mode)</div>
            <div class="text-[11px] text-gray-500">Mediview · ${description || 'Top-up'}</div>
          </div>
        </div>
        <button id="mvm-close" class="h-8 w-8 grid place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5">×</button>
      </div>
      <div class="px-5 py-4 bg-gray-50 dark:bg-white/[0.02] flex items-center justify-between text-sm">
        <span class="text-gray-500">Amount</span>
        <span class="font-bold text-lg">₹${(Math.round(amount * 1.18)).toLocaleString('en-IN')}<span class="text-xs font-normal text-gray-500 ml-1">incl. GST</span></span>
      </div>
      <div class="px-5 py-4">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">Pay with</div>
        <div class="space-y-2" id="mvm-methods">
          ${[
            { id: 'upi', label: 'UPI', sub: 'PhonePe, GPay, Paytm + QR', icon: '⚡' },
            { id: 'card', label: 'Cards', sub: 'Credit / Debit / RuPay', icon: '💳' },
            { id: 'netbanking', label: 'Netbanking', sub: 'All major Indian banks', icon: '🏦' },
            { id: 'wallet', label: 'Wallets', sub: 'Mobikwik / Freecharge', icon: '👛' },
          ].map(m => `
            <button data-method="${m.id}" class="mvm-method w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--line)] hover:border-[#3395FF] hover:bg-[#3395FF]/5 transition text-left">
              <div class="h-10 w-10 grid place-items-center rounded-lg bg-gray-100 dark:bg-white/5 text-xl">${m.icon}</div>
              <div class="flex-1">
                <div class="font-semibold text-sm">${m.label}</div>
                <div class="text-xs text-gray-500">${m.sub}</div>
              </div>
              <div class="text-gray-400">›</div>
            </button>
          `).join('')}
        </div>
        <div class="mt-4 text-[10px] text-gray-500 leading-relaxed">
          Test mode · No real money will be charged. Order <span class="font-mono">${order.order_id}</span>.
        </div>
      </div>
      <div id="mvm-status" class="hidden px-5 py-8 text-center">
        <div class="mx-auto h-12 w-12 rounded-full border-4 border-[#3395FF]/20 border-t-[#3395FF] animate-spin mb-3"></div>
        <div class="font-semibold text-sm" id="mvm-status-text">Processing payment…</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const cleanup = () => {
    document.body.removeChild(overlay);
    document.body.style.overflow = '';
  };

  overlay.querySelector('#mvm-close').onclick = () => { cleanup(); reject(new Error('Payment cancelled')); };

  overlay.querySelectorAll('.mvm-method').forEach(btn => {
    btn.onclick = async () => {
      const method = btn.dataset.method;
      overlay.querySelector('#mvm-methods').parentElement.classList.add('hidden');
      overlay.querySelector('#mvm-status').classList.remove('hidden');
      const text = overlay.querySelector('#mvm-status-text');
      onProgress?.('Processing payment…');
      try {
        await new Promise(r => setTimeout(r, 1100));
        text.textContent = 'Verifying signature…';
        onProgress?.('Verifying signature…');
        const v = await mvApi.verifyPayment({
          type, amount, credits, items,
          order_id: order.order_id,
          payment_id: 'pay_mock_' + Math.random().toString(36).slice(2, 10),
          signature: 'sig_mock',
          method: method.toUpperCase(),
        });
        text.textContent = 'Success!';
        onProgress?.('Done');
        await new Promise(r => setTimeout(r, 500));
        cleanup();
        resolve(v);
      } catch (e) {
        cleanup(); reject(e);
      }
    };
  });
});

window.openCheckout = openCheckout;

window.openRazorpay = async ({ key, amount, order_id, name, description, handler }) => {
  if (mvApi.getMode() !== 'mock') await loadRazorpay();
  const finalAmount = Math.round(Number(amount || 0) * 100);
  if (mvApi.getMode() === 'mock' || !window.Razorpay) {
    await new Promise(r => setTimeout(r, 500));
    await handler({
      razorpay_order_id: order_id,
      razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).slice(2, 10),
      razorpay_signature: 'sig_mock',
    });
    return;
  }
  const rzp = new window.Razorpay({
    key,
    amount: finalAmount,
    currency: 'INR',
    name: name || 'Mediview',
    description: description || 'Mediview license',
    order_id,
    theme: { color: '#DC2626' },
    handler,
  });
  rzp.open();
};
