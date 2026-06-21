import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendEmailNotification, sendBatchFullyPaidEmail } from '../_helpers/email-helper.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mapCartFromDB = (c) => {
  if (!c) return null;
  return {
    id: c.id,
    creatorUsername: c.creator_username,
    creatorEmail: c.creator_email,
    friendEmail: c.friend_email,
    creatorItems: c.creator_items || [],
    friendItems: c.friend_items || [],
    creatorPaid: c.creator_paid,
    friendPaid: c.friend_paid,
    paymentStatus: c.payment_status,
    amountPaid: Number(c.amount_paid || 0),
    creatorNotified: c.creator_notified,
    friendNotified: c.friend_notified,
    batchPaidEmailSent: c.batch_paid_email_sent,
    creatorMeasurements: c.creator_measurements || {}
  };
};

const mapCartToDB = (c) => {
  return {
    id: c.id,
    creator_username: c.creatorUsername,
    creator_email: c.creatorEmail,
    friend_email: c.friendEmail,
    creator_items: c.creatorItems,
    friend_items: c.friendItems,
    creator_paid: c.creatorPaid,
    friend_paid: c.friendPaid,
    payment_status: c.paymentStatus,
    amount_paid: c.amountPaid,
    creator_notified: c.creatorNotified,
    friend_notified: c.friendNotified,
    batch_paid_email_sent: c.batchPaidEmailSent,
    creator_measurements: c.creatorMeasurements
  };
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export const config = {
  api: {
    bodyParser: false, // Disables Vercel's automatic body parser to handle raw stream
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Stripe Webhooks send POST requests. The query param will be ?action=stripe-webhook
  const actionQuery = req.query?.action;
  
  if (actionQuery === 'stripe-webhook') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
      console.error("Stripe keys or Webhook secret not configured in env.");
      return res.status(500).json({ error: 'Stripe server configuration error.' });
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
      const { cartId, role, amount } = metadata;

      if (!cartId || !role || !amount) {
        console.error("Stripe webhook session completed but metadata is missing keys:", metadata);
        return res.status(400).json({ error: 'Missing metadata keys' });
      }

      try {
        const { data: cartData, error: fetchErr } = await supabase
          .from('store_carts')
          .select('*')
          .eq('id', cartId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        const cart = mapCartFromDB(cartData);
        if (!cart) {
          console.error(`Webhook received payment for non-existent Cart ${cartId}`);
          return res.status(404).json({ error: 'Cart not found' });
        }

        const email = session.customer_details?.email || "";

        if (role === 'creator') {
          cart.creatorPaid = true;
          cart.amountPaid += Number(amount);
          if (email) cart.creatorEmail = email;
        } else if (role === 'friend') {
          cart.friendPaid = true;
          cart.amountPaid += Number(amount);
          if (email) cart.friendEmail = email;
        } else if (role === 'all') {
          cart.creatorPaid = true;
          cart.friendPaid = true;
          cart.amountPaid += Number(amount);
          if (email) {
            cart.creatorEmail = email;
            cart.friendEmail = email;
          }
        }

        const hasFriendItems = Array.isArray(cart.friendItems) && cart.friendItems.length > 0;
        if (cart.creatorPaid && (!hasFriendItems || cart.friendPaid)) {
          cart.paymentStatus = 'paid';
        } else if (cart.creatorPaid || cart.friendPaid) {
          cart.paymentStatus = 'partially_paid';
        } else {
          cart.paymentStatus = 'unpaid';
        }

        // Email notifications
        try {
          if (role === 'creator' && !cart.creatorNotified) {
            await sendEmailNotification(cartId, 'creator', amount);
            cart.creatorNotified = true;
          } else if (role === 'friend' && !cart.friendNotified) {
            await sendEmailNotification(cartId, 'friend', amount);
            cart.friendNotified = true;
          } else if (role === 'all' && (!cart.creatorNotified || !cart.friendNotified)) {
            await sendEmailNotification(cartId, 'all', amount);
            cart.creatorNotified = true;
            cart.friendNotified = true;
          }
        } catch (emailErr) {
          console.error("Failed to send webhook email notification:", emailErr);
        }

        // Batch fully paid shipping trigger
        if (cart.paymentStatus === 'paid' && !cart.batchPaidEmailSent) {
          try {
            await sendBatchFullyPaidEmail(cart);
            cart.batchPaidEmailSent = true;
          } catch (batchEmailErr) {
            console.error("Failed to send batch fully paid email notification:", batchEmailErr);
          }
        }

        const { error: upsertErr } = await supabase
          .from('store_carts')
          .upsert(mapCartToDB(cart), { onConflict: 'id' });

        if (upsertErr) throw upsertErr;
        console.log(`Webhook updated cart ${cartId} to status ${cart.paymentStatus} successfully.`);

      } catch (e) {
        console.error(`Failed to process cart update inside webhook handler:`, e);
        return res.status(500).json({ error: 'Failed to update cart' });
      }
    }

    return res.status(200).json({ received: true });
  }

  // --- Handle standard client API actions ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = {};
    let rawString = '';
    
    if (req.body && typeof req.body === 'object') {
      body = req.body;
      rawString = JSON.stringify(req.body);
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

    const { action, cartId, role, amount } = body;

    // A. Action: confirm-payment (legacy mock sandbox checkout fallback)
    if (action === 'confirm-payment') {
      if (!cartId) return res.status(400).json({ error: 'Missing cartId' });
      if (!role) return res.status(400).json({ error: 'Missing role' });

      const { data: cartData, error: fetchErr } = await supabase
        .from('store_carts')
        .select('*')
        .eq('id', cartId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      const cart = mapCartFromDB(cartData);
      if (!cart) return res.status(404).json({ error: 'Cart not found' });

      if (cart.creatorPaid === undefined) cart.creatorPaid = false;
      if (cart.friendPaid === undefined) cart.friendPaid = false;
      if (cart.paymentStatus === undefined) cart.paymentStatus = 'unpaid';
      if (cart.amountPaid === undefined) cart.amountPaid = 0;

      if (role === 'creator') {
        cart.creatorPaid = true;
        cart.amountPaid += Number(amount || 0);
        cart.creatorEmail = body.email || cart.creatorEmail || 'creator@styla.ca';
      } else if (role === 'friend') {
        cart.friendPaid = true;
        cart.amountPaid += Number(amount || 0);
        cart.friendEmail = body.email || cart.friendEmail || 'friend@styla.ca';
      } else if (role === 'all') {
        cart.creatorPaid = true;
        cart.friendPaid = true;
        cart.amountPaid += Number(amount || 0);
        cart.creatorEmail = body.email || cart.creatorEmail || 'creator@styla.ca';
        cart.friendEmail = body.email || cart.friendEmail || 'friend@styla.ca';
      }

      const hasFriendItems = Array.isArray(cart.friendItems) && cart.friendItems.length > 0;
      if (cart.creatorPaid && (!hasFriendItems || cart.friendPaid)) {
        cart.paymentStatus = 'paid';
      } else if (cart.creatorPaid || cart.friendPaid) {
        cart.paymentStatus = 'partially_paid';
      } else {
        cart.paymentStatus = 'unpaid';
      }

      // Email notifications
      try {
        if (role === 'creator' && !cart.creatorNotified) {
          await sendEmailNotification(cartId, 'creator', amount || 0);
          cart.creatorNotified = true;
        } else if (role === 'friend' && !cart.friendNotified) {
          await sendEmailNotification(cartId, 'friend', amount || 0);
          cart.friendNotified = true;
        } else if (role === 'all' && (!cart.creatorNotified || !cart.friendNotified)) {
          await sendEmailNotification(cartId, 'all', amount || 0);
          cart.creatorNotified = true;
          cart.friendNotified = true;
        }
      } catch (emailErr) {
        console.error("Failed to send confirm-payment email notification:", emailErr);
      }

      // Batch fully paid shipping trigger
      if (cart.paymentStatus === 'paid' && !cart.batchPaidEmailSent) {
        try {
          await sendBatchFullyPaidEmail(cart);
          cart.batchPaidEmailSent = true;
        } catch (batchEmailErr) {
          console.error("Failed to send batch fully paid email notification:", batchEmailErr);
        }
      }

      const { error: upsertErr } = await supabase
        .from('store_carts')
        .upsert(mapCartToDB(cart), { onConflict: 'id' });

      if (upsertErr) throw upsertErr;

      return res.status(200).json({ success: true, cart: cart });
    }

    // B. Action: create-checkout-session (Stripe session creation)
    if (action === 'create-checkout-session') {
      if (!cartId || !role || !amount) {
        return res.status(400).json({ error: 'Missing parameters: cartId, role, and amount are required.' });
      }

      const apiKey = process.env.STRIPE_SECRET_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Stripe secret key not configured on server.' });
      }

      const stripe = new Stripe(apiKey);
      const origin = req.headers.origin || `https://${req.headers.host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: `STYLA Group Share - Cart ID ${cartId} (${role === 'creator' ? 'Creator' : 'Friend'} Share)`,
                description: `Group purchase share payment on Styla Store`,
              },
              unit_amount: Math.round(Number(amount) * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/store/index.html?payment=success&cartId=${cartId}&role=${role}&amount=${amount}`,
        cancel_url: `${origin}/store/index.html?payment=cancel`,
        metadata: {
          cartId: cartId,
          role: role,
          amount: amount.toString(),
        },
      });

      return res.status(200).json({
        id: session.id,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || ""
      });
    }

    return res.status(400).json({ error: 'Invalid or unsupported action' });

  } catch (error) {
    console.error("Error processing unified payment handler:", error);
    return res.status(500).json({ error: 'Server error processing request.' });
  }
}
