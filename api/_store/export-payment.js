import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Use Service Role Key to bypass RLS in Stripe webhook updates. Fallback to Anon Key if not configured.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const config = {
  api: {
    bodyParser: false, // Disables Vercel's automatic body parser to handle raw stream for webhooks
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const actionQuery = req.query?.action;

  // 1. Stripe Webhook Handler (?action=stripe-webhook)
  if (actionQuery === 'stripe-webhook') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.error("Stripe secret key or Webhook secret not configured on server.");
      return res.status(500).json({ error: 'Stripe webhook configuration error.' });
    }

    const stripe = new Stripe(stripeKey);
    let event;

    try {
      const rawBody = await getRawBody(req);
      const signature = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};

      // If it is a storefront group cart checkout session, ignore gracefully in export handler
      if (metadata.cartId) {
        console.log("Export payment webhook received a storefront cart payment event. Ignoring gracefully.");
        return res.status(200).json({ received: true });
      }

      if (metadata.type === 'export_payment') {
        const userId = metadata.userId;
        if (!userId) {
          console.error("Stripe webhook session completed for export_payment but userId is missing in metadata.");
          return res.status(400).json({ error: 'Missing userId in metadata' });
        }

        try {
          console.log(`Setting has_paid_export = true for user ${userId}...`);
          
          // Perform database update using Supabase service role client (bypassing RLS)
          const { data, error } = await supabase
            .from('profiles')
            .update({ has_paid_export: true, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .select();

          if (error) {
            console.error(`Database error setting profile payment state:`, error.message);
            throw error;
          }

          console.log(`Successfully updated profile payment state for user ${userId}. Profile data:`, data);
        } catch (e) {
          console.error(`Error handling database write inside Stripe webhook:`, e);
          return res.status(500).json({ error: 'Database update failed' });
        }
      }
    }

    return res.status(200).json({ received: true });
  }

  // 2. Standard Client API Actions
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = {};
    let rawString = '';

    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else if (req.body && typeof req.body === 'string') {
      rawString = req.body;
      try {
        body = JSON.parse(rawString);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload', details: e.message });
      }
    } else {
      try {
        const rawBody = await getRawBody(req);
        rawString = rawBody.toString('utf8');
        if (rawString) {
          body = JSON.parse(rawString);
        }
      } catch (e) {
        return res.status(400).json({ error: 'Failed to read raw body stream', details: e.message });
      }
    }

    const { action, userId, email } = body;

    // Action: create-checkout-session
    if (action === 'create-checkout-session') {
      if (!userId || !email) {
        return res.status(400).json({ error: 'Missing parameters: userId and email are required.' });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(500).json({ error: 'Stripe secret key not configured on server.' });
      }

      const stripe = new Stripe(stripeKey);
      const origin = req.headers.origin || `https://${req.headers.host}`;

      console.log(`Creating Stripe checkout session for user ${userId} (${email})...`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: 'STYLA Premium AI Tailor Report (80+ Measurements)',
                description: 'Unlock your complete 3D body scan export in PDF format for custom tailoring and fitting.',
              },
              unit_amount: 749, // $7.49 CAD in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/index.html?payment=success&type=export`,
        cancel_url: `${origin}/index.html?payment=cancel`,
        metadata: {
          userId: userId,
          email: email,
          type: 'export_payment'
        },
      });

      console.log(`Session created: ${session.id}`);

      return res.status(200).json({
        id: session.id,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ""
      });
    }

    return res.status(400).json({ error: 'Invalid or unsupported action' });

  } catch (error) {
    console.error("Error processing export payment request:", error);
    return res.status(500).json({ error: 'Server error processing request.' });
  }
}
