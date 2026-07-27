import Stripe from 'stripe';
import getRawBody from 'raw-body';
import { supabaseAdmin as supabase } from '../_helpers/supabase-admin.js';
import { sendMatchUnlockEmail, sendWeddingReportEmail } from '../_helpers/email-helper.js';

export const config = {
  api: {
    bodyParser: false, // Disabling bodyParser is necessary for raw Stripe webhook verification
  },
};

export default async function handler(req, res) {
  const { action: actionQuery } = req.query;

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
      const result = await fulfillCheckoutSession(event.data.object);
      if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({ received: true });
  }

  // 2. Standard Client API Actions
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  return clientActions(req, res);
}

// Shared fulfillment: called by BOTH the Stripe webhook and verify-session, so a
// missed webhook can never strand a paying customer.
async function fulfillCheckoutSession(session) {
  const metadata = session.metadata || {};

  // Storefront group-cart sessions are not ours to fulfill.
  if (metadata.cartId) return { status: 200 };

  const paymentType = metadata.type || 'export_payment';
  const userId = metadata.userId;
  if (!userId) {
    console.error(`Checkout session for ${paymentType} missing userId in metadata.`);
    return { status: 400, error: 'Missing userId in metadata' };
  }

  try {
        // Wedding-party report unlock — coordinator paid once for the whole party.
        if (metadata.partyId) {
          try { await supabase.from('wedding_parties').update({ has_paid_report: true }).eq('id', metadata.partyId); }
          catch (e) { console.error('party report flag update failed:', e); }
        }

        let updatePayload = { updated_at: new Date().toISOString() };
        
        if (paymentType === 'export_payment') {
          updatePayload.has_paid_export = true;
        } else if (paymentType === 'bridesmaid_scan_payment') {
          updatePayload.has_paid_bridesmaid_scan = true;
        } else if (paymentType === 'bridesmaid_report_payment') {
          updatePayload.has_paid_bridesmaid_report = true;
        } else if (paymentType === 'match_unlock_payment') {
          updatePayload.has_paid_matches = true;
        } else {
          updatePayload.has_paid_export = true;
        }

        console.log(`Setting payment attributes in Supabase for user ID / Username: ${userId}`, updatePayload);
        
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

        if (isUuid) {
          // 1. Update public.profiles (registered user)
          const { error: profileErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', userId);
          if (profileErr) throw profileErr;

          // 2. Fetch email to sync state back to store_profiles (guest cache table)
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .maybeSingle();

          if (userProfile && userProfile.email) {
            await supabase
              .from('store_profiles')
              .update(updatePayload)
              .eq('username', userProfile.email.toLowerCase());
          }
        } else {
          // Update store_profiles directly (guest user)
          const { error: guestErr } = await supabase
            .from('store_profiles')
            .update(updatePayload)
            .eq('username', userId.toLowerCase());
          if (guestErr) throw guestErr;
        }

        console.log(`Successfully completed payment registration in DB for user ${userId}.`);

        // Fire the customer receipt email (best-effort; never blocks the webhook).
        try {
          const recipientEmail = (metadata.email || '').trim();
          if (recipientEmail) {
            let firstName = '';
            if (isUuid) {
              const { data: p } = await supabase
                .from('profiles').select('first_name').eq('id', userId).maybeSingle();
              firstName = (p && p.first_name) || '';
            }
            const amountStr = session.amount_total ? `$${(session.amount_total / 100).toFixed(2)}` : undefined;
            const purchaseDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            if (paymentType === 'match_unlock_payment') {
              await sendMatchUnlockEmail(recipientEmail, firstName, { amount: amountStr, orderId: session.id, purchaseDate });
            } else if (paymentType === 'bridesmaid_report_payment') {
              await sendWeddingReportEmail(recipientEmail, firstName, { amount: amountStr, orderId: session.id, purchaseDate });
            }
          }
        } catch (mailErr) {
          console.error('[WEBHOOK EMAIL] Receipt send failed (non-fatal):', mailErr.message);
        }
    return { status: 200 };
  } catch (e) {
    console.error('Error fulfilling checkout session:', e);
    return { status: 500, error: 'Database update failed' };
  }
}

async function clientActions(req, res) {
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

    const { action, userId, email, amount, productName, productDescription, paymentType, successUrl, cancelUrl, partyId, sessionId } = body;

    // Action: verify-session — client returns from Stripe with ?session_id=...;
    // we confirm payment directly with Stripe and fulfill. Webhook-independent.
    if (action === 'verify-session') {
      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      const vKey = process.env.STRIPE_SECRET_KEY;
      if (!vKey) return res.status(500).json({ error: 'Stripe not configured on server.' });
      const vStripe = new Stripe(vKey);
      const vSession = await vStripe.checkout.sessions.retrieve(sessionId);
      if (vSession && vSession.payment_status === 'paid') {
        const result = await fulfillCheckoutSession(vSession);
        if (result.status !== 200) return res.status(result.status).json({ error: result.error });
        return res.status(200).json({ ok: true, paid: true });
      }
      return res.status(200).json({ ok: true, paid: false });
    }

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

      const unitAmount = amount ? parseInt(amount) : 499;
      const name = productName || 'STYLA Premium AI Tailor Report (80+ Measurements)';
      const desc = productDescription || 'Unlock your complete 3D body scan export in PDF format for custom tailoring and fitting.';
      const pType = paymentType || 'export_payment';
      const success = successUrl || `${origin}/index.html?payment=success&type=export`;
      const cancel = cancelUrl || `${origin}/index.html?payment=cancel`;

      console.log(`Creating Stripe checkout session for user ${userId} (${email}) for product ${name} ($${(unitAmount/100).toFixed(2)})...`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: name,
                description: desc,
              },
              unit_amount: unitAmount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: success,
        cancel_url: cancel,
        metadata: Object.assign({ userId: userId, email: email, type: pType }, partyId ? { partyId: String(partyId) } : {}),
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
