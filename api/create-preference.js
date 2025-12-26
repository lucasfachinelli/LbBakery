export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items = [], buyer, external_reference } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Carrito vacío' });

    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const clean = (n) => Number(String(n).replace(/[^0-9.,-]/g,'').replace(/\./g,'').replace(',', '.')) || 0;
    const mpItems = items.map(i => ({
      title: i.title,
      quantity: Math.max(1, Number(i.quantity || 1)),
      unit_price: clean(i.unit_price),
      currency_id: 'ARS'
    }));

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const backendBase = `https://${host}`;

    const body = {
      items: mpItems,
      payer: buyer?.email ? { email: buyer.email, name: buyer.name || '' } : undefined,
      back_urls: {
        success: `${process.env.SITE_BASE_URL}/pago/resultado?status=success`,
        pending: `${process.env.SITE_BASE_URL}/pago/resultado?status=pending`,
        failure: `${process.env.SITE_BASE_URL}/pago/resultado?status=failure`
      },
      auto_return: 'approved',
      notification_url: `${backendBase}/api/webhook`,
      external_reference: external_reference || `lb-${Date.now()}`,
      // 👉 habilitá todos los medios (tarjeta, dinero en cuenta, transferencia/QR)
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        // Opcional: si NO querés cuotas, descomentá:
        // installments: 1,
        // Opcional: sugerir transferencia:
        // default_payment_method_id: "bank_transfer"
      }
    };

    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data?.message || 'Error creando preferencia' });
    return res.status(200).json({ init_point: data.init_point });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
