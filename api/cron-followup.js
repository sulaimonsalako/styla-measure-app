import { createClient } from '@supabase/supabase-js';
import { sendScanAbandonedEmail } from './_helpers/email-helper.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Secure endpoint with cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret;

  if (cronSecret) {
    const isAuthorized = 
      querySecret === cronSecret || 
      (authHeader && authHeader.replace('Bearer ', '').trim() === cronSecret.trim());
      
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database connection not configured' });
  }

  try {
    const portalUrl = `https://${req.headers.host || 'styla-measure.vercel.app'}`;
    console.log(`[CRON FOLLOW-UP] Starting abandoned scan follow-up check. Portal URL: ${portalUrl}`);

    // Query guest profiles
    const { data: storeProfiles, error: fetchError } = await supabase
      .from('store_profiles')
      .select('*')
      .eq('password', 'temp_guest_placeholder');

    if (fetchError) throw fetchError;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sentList = [];

    for (const profile of storeProfiles || []) {
      const scans = profile.api_scans || [];
      const overrides = profile.measurement_overrides || {};
      const createdAt = new Date(profile.created_at);

      // Criteria: 
      // 1. Scan array is empty (abandoned)
      // 2. Created more than 1 hour ago
      // 3. Email not already sent
      const isAbandoned = scans.length === 0;
      const isOldEnough = createdAt < oneHourAgo;
      const alreadyEmailed = overrides.abandoned_email_sent === true;

      if (isAbandoned && isOldEnough && !alreadyEmailed) {
        console.log(`[CRON FOLLOW-UP] Found abandoned user: ${profile.username}. Sending follow-up...`);
        
        const emailResult = await sendScanAbandonedEmail(profile.username, portalUrl);
        
        if (emailResult && emailResult.success) {
          // Update profile to mark email as sent
          const updatedOverrides = { ...overrides, abandoned_email_sent: true };
          
          const { error: updateError } = await supabase
            .from('store_profiles')
            .update({ measurement_overrides: updatedOverrides })
            .eq('username', profile.username);

          if (updateError) {
            console.error(`[CRON FOLLOW-UP] Error updating profile overrides for ${profile.username}:`, updateError);
          } else {
            console.log(`[CRON FOLLOW-UP] Marked ${profile.username} as follow-up sent.`);
            sentList.push(profile.username);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      processed: storeProfiles ? storeProfiles.length : 0,
      emailed_count: sentList.length,
      emailed_recipients: sentList
    });

  } catch (error) {
    console.error('[CRON FOLLOW-UP ERROR]:', error);
    return res.status(500).json({ error: 'Server error running follow-up job' });
  }
}
