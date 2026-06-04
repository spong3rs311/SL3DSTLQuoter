const Stripe = require('stripe');
const { derivePrice } = require('./lib/pricing');
const { loadConfig } = require('./lib/config');
const { applyCors } = require('./lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const {
    fileId,
    driveLink,
    filament_id,
    strength_preset,
    volume_cm3,
    supports_likely,
    stl_filename,
    customer_name,
    customer_email,
  } = body || {};

  if (!fileId || !driveLink || !filament_id || !strength_preset ||
      !volume_cm3 || !stl_filename || !customer_name || !customer_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (customer_name.length > 100) return res.status(400).json({ error: 'Name too long' });
  if (customer_email.length > 254) return res.status(400).json({ error: 'Email too long' });
  if (stl_filename.length > 255)   return res.status(400).json({ error: 'Filename too long' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  let priceResult;
  try {
    const config = loadConfig();
    priceResult = derivePrice(
      { volume_cm3: Number(volume_cm3), supports_likely: Boolean(supports_likely) },
      filament_id,
      strength_preset,
      config
    );
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.SQUARESPACE_QUOTE_PAGE_URL;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: priceResult.price_cents,
            product_data: {
              name: `3D Print: ${stl_filename}`,
              description: `${filament_id.toUpperCase()} · ${strength_preset} · ${priceResult.weight_g}g`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email,
      success_url: `${baseUrl}?status=success`,
      cancel_url: `${baseUrl}?status=cancelled`,
      metadata: {
        file_id: fileId,
        drive_link: driveLink,
        customer_name,
        customer_email,
        stl_filename,
        filament_id,
        strength_preset,
        weight_g: String(priceResult.weight_g),
        print_time_hours: String(priceResult.print_time_hours),
        price_cents: String(priceResult.price_cents),
      },
    });
  } catch (_err) {
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }

  return res.status(200).json({ url: session.url });
};
