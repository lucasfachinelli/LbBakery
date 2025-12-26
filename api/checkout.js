export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers['x-forwarded-host'] || req.headers.host}`);
    const b64 = url.searchParams.get('items'); // JSON en base64
    if (!b64) return res.status(400).send('Faltan items');

    const json = Buffer.from(b64, 'base64').toString('utf8');
    const itemsIn = JSON.parse(json);
    if (!Array.isArray(itemsIn) || !itemsIn.length) return res.status(400).send('Carrito vacío');

    const clean = (n) => Number(String(n).replace(/[^0-9.,-]/g,'').replace(/\./g,'').replace(',', '.')) || 0;
    const mpItems = itemsIn.map(i => ({
      title: i.title,
      quantity: Math.max(1, Number(i.quantity || 1)),
      unit_price: clean(i.unit_price),
      currency_id: 'ARS'
    })).filter(i => i.title && i.quantity > 0 && i.unit_price > 0);

    if (!mpItems.length) return res.status(400).send('Items inválidos');

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const backendBase = `https://${host}`;

    const body = {
      items: mpItems,
      back_urls: {
        success: `${process.env.SITE_BASE_URL}/pago/resultado?status=success`,
        pending: `${process.env.SITE_BASE_URL}/pago/resultado?status=pending`,
        failure: `${process.env.SITE_BASE_URL}/pago/resultado?status=failure`
      },
      auto_return: 'approved',
      notification_url: `${backendBase}/api/webhook`,
      external_reference: `lb-${Date.now()}`,
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        // installments: 1,
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
    if (!r.ok || !data?.init_point) return res.status(400).send(data?.message || 'Error creando preferencia');

    res.writeHead(302, { Location: data.init_point });
    res.end();
  } catch (e) {
    res.status(500).send('Error');
  }
}
