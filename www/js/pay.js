// ARUVA online payments — Razorpay Checkout (UPI, cards, netbanking, wallets, EMI, pay later)
// Usage: AruvaPay.start({ apiBase, token, payload, description, onSuccess(order), onUnavailable(), onError(msg) })
// `payload` is the same body POST /api/orders takes; the server computes the amount.
(function () {
  let sdk = null;
  function loadSdk() {
    if (window.Razorpay) return Promise.resolve();
    if (sdk) return sdk;
    sdk = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      s.onerror = () => { sdk = null; reject(new Error('Could not load payment window — check your internet')); };
      document.head.appendChild(s);
    });
    return sdk;
  }

  async function post(apiBase, token, path, body) {
    const res = await fetch(apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function start({ apiBase = '', token, payload, description = 'ARUVA order', onSuccess, onUnavailable, onError }) {
    const fail = msg => onError && onError(msg);
    try {
      const { res, data } = await post(apiBase, token, '/api/payment/create-order', payload);
      if (res.status === 503) { onUnavailable ? onUnavailable() : fail(data.error); return; }
      if (!res.ok) { fail(data.error || 'Could not start payment'); return; }
      await loadSdk();

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpay_order_id,
        name: 'ARUVA',
        description,
        prefill: data.prefill || {},
        theme: { color: '#6E3045' },
        handler: async resp => {
          const { res: vr, data: vd } = await post(apiBase, token, '/api/payment/verify', resp);
          if (vr.ok && vd.order) onSuccess && onSuccess(vd.order);
          else fail(vd.error || 'Payment received but order not saved — contact support with ID ' + resp.razorpay_payment_id);
        },
        modal: { ondismiss: () => fail('Payment cancelled') },
      });
      rzp.on('payment.failed', r => fail((r.error && r.error.description) || 'Payment failed'));
      rzp.open();
    } catch (e) {
      fail(e.message || 'Payment failed');
    }
  }

  window.AruvaPay = { start };
})();
