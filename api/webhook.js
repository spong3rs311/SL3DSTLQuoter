const Stripe = require('stripe');
const { moveFile } = require('./lib/drive');
const { sendOwnerNotification, sendCustomerConfirmation } = require('./lib/email');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (_err) {
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  const sig = req.headers['stripe-signature'];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const meta = event.data.object.metadata;

  try {
    await moveFile(meta.file_id, process.env.GOOGLE_DRIVE_FOLDER_ID);
  } catch (err) {
    console.error('Drive move failed:', err.message);
    return res.status(500).json({ error: 'Drive move failed' });
  }

  const order = {
    customer_name: meta.customer_name,
    customer_email: meta.customer_email,
    stl_filename: meta.stl_filename,
    filament_id: meta.filament_id,
    strength_preset: meta.strength_preset,
    weight_g: Number(meta.weight_g),
    print_time_hours: Number(meta.print_time_hours),
    price_cents: Number(meta.price_cents),
    drive_link: meta.drive_link,
  };

  try {
    await sendOwnerNotification(order);
  } catch (err) {
    console.error('Owner notification failed:', err.message);
  }

  try {
    await sendCustomerConfirmation(meta.customer_email, order);
  } catch (err) {
    console.error('Customer confirmation failed:', err.message);
  }

  return res.status(200).json({ received: true });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
