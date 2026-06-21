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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { cartId, all } = req.query;
      
      if (all === 'true') {
        const { data, error } = await supabase
          .from('store_carts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data.map(mapCartFromDB));
      }

      if (!cartId) {
        return res.status(400).json({ error: 'Missing cartId parameter' });
      }

      const { data: cart, error } = await supabase
        .from('store_carts')
        .select('*')
        .eq('id', cartId)
        .maybeSingle();

      if (error) throw error;
      if (!cart) {
        return res.status(404).json({ error: 'Cart not found' });
      }
      return res.status(200).json(mapCartFromDB(cart));
    } catch (err) {
      console.error("Failed to retrieve cart from Supabase:", err);
      return res.status(500).json({ error: 'Failed to retrieve cart' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, creatorItems, friendItems, creatorUsername, creatorPaid, friendPaid, paymentStatus, amountPaid, creatorMeasurements, creatorEmail, friendEmail } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Missing cart id' });
      }

      // Fetch existing cart if any
      const { data: existing, error: fetchErr } = await supabase
        .from('store_carts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const mappedExisting = mapCartFromDB(existing) || { 
        id, 
        creatorItems: [], 
        friendItems: [],
        creatorUsername: creatorUsername || null,
        creatorPaid: false,
        friendPaid: false,
        paymentStatus: 'unpaid',
        amountPaid: 0,
        creatorMeasurements: {},
        creatorNotified: false,
        friendNotified: false,
        batchPaidEmailSent: false
      };
      
      if (creatorItems !== undefined) mappedExisting.creatorItems = creatorItems;
      if (friendItems !== undefined) mappedExisting.friendItems = friendItems;
      if (creatorUsername !== undefined && creatorUsername !== null) mappedExisting.creatorUsername = creatorUsername;
      if (creatorMeasurements !== undefined) mappedExisting.creatorMeasurements = creatorMeasurements;
      if (creatorEmail !== undefined) mappedExisting.creatorEmail = creatorEmail;
      if (friendEmail !== undefined) mappedExisting.friendEmail = friendEmail;
      if (creatorPaid !== undefined) mappedExisting.creatorPaid = creatorPaid;
      if (friendPaid !== undefined) mappedExisting.friendPaid = friendPaid;
      if (paymentStatus !== undefined) mappedExisting.paymentStatus = paymentStatus;
      if (amountPaid !== undefined) mappedExisting.amountPaid = amountPaid;

      // Email notifications fallback
      try {
        if (mappedExisting.creatorPaid && !mappedExisting.creatorNotified) {
          await sendEmailNotification(id, 'creator', mappedExisting.amountPaid || 0);
          mappedExisting.creatorNotified = true;
        }
        if (mappedExisting.friendPaid && !mappedExisting.friendNotified) {
          await sendEmailNotification(id, 'friend', mappedExisting.amountPaid || 0);
          mappedExisting.friendNotified = true;
        }
        if (mappedExisting.paymentStatus === 'paid' && (!mappedExisting.creatorNotified || !mappedExisting.friendNotified)) {
          await sendEmailNotification(id, 'all', mappedExisting.amountPaid || 0);
          mappedExisting.creatorNotified = true;
          mappedExisting.friendNotified = true;
        }
      } catch (emailErr) {
        console.error("Failed to send cart-sync email notification:", emailErr);
      }

      // Batch fully paid email fallback
      if (mappedExisting.paymentStatus === 'paid' && !mappedExisting.batchPaidEmailSent) {
        try {
          await sendBatchFullyPaidEmail(mappedExisting);
          mappedExisting.batchPaidEmailSent = true;
        } catch (batchEmailErr) {
          console.error("Failed to send cart-sync batch fully paid email notification:", batchEmailErr);
        }
      }

      // Upsert cart
      const { data: upserted, error: upsertErr } = await supabase
        .from('store_carts')
        .upsert(mapCartToDB(mappedExisting), { onConflict: 'id' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      return res.status(200).json(mapCartFromDB(upserted));
    } catch (err) {
      console.error("Error saving cart:", err);
      return res.status(500).json({ error: 'Server error saving cart' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
