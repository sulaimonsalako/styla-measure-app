import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, username, password, twin, code, newPassword, api_scans, measurement_overrides, manual_measurements } = req.body;

    if (!action || !username) {
      return res.status(400).json({ error: 'Missing action or username.' });
    }

    const cleanedUsername = username.trim().toLowerCase();

    if (action === 'signup') {
      if (!password) {
        return res.status(400).json({ error: 'Missing password.' });
      }

      // Check if user exists
      const { data: existing } = await supabase
        .from('store_profiles')
        .select('username, password, twin')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (existing) {
        if (existing.password === 'temp_guest_placeholder') {
          // Allow completing the signup by upgrading the guest profile
          const { error } = await supabase
            .from('store_profiles')
            .update({
              password: password,
              created_at: new Date().toISOString()
            })
            .eq('username', cleanedUsername);
            
          if (error) throw error;
          
          let parsedTwin = null;
          if (existing.twin) {
            try {
              parsedTwin = typeof existing.twin === 'string' ? JSON.parse(existing.twin) : existing.twin;
            } catch (e) {
              parsedTwin = existing.twin;
            }
          }

          return res.status(201).json({
            success: true,
            username: cleanedUsername,
            twin: parsedTwin
          });
        }
        return res.status(400).json({ error: 'Username already exists.' });
      }

      // Create new profile
      const { error } = await supabase
        .from('store_profiles')
        .insert({
          username: cleanedUsername,
          password: password,
          twin: twin ? (typeof twin === 'string' ? twin : JSON.stringify(twin)) : null,
          api_scans: api_scans || [],
          measurement_overrides: measurement_overrides || {},
          manual_measurements: manual_measurements || {}
        });

      if (error) throw error;

      return res.status(201).json({
        success: true,
        username: cleanedUsername,
        twin: null
      });
    }

    if (action === 'login') {
      if (!password) {
        return res.status(400).json({ error: 'Missing password.' });
      }

      const { data: profile, error } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('username', cleanedUsername)
        .eq('password', password)
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      return res.status(200).json({
        success: true,
        username: profile.username,
        twin: profile.twin,
        api_scans: profile.api_scans || [],
        measurement_overrides: profile.measurement_overrides || {},
        manual_measurements: profile.manual_measurements || {}
      });
    }

    if (action === 'update-profile') {
      // Upsert profile
      const updateData = {
        username: cleanedUsername,
        twin: twin || null
      };
      if (api_scans !== undefined) updateData.api_scans = api_scans;
      if (measurement_overrides !== undefined) updateData.measurement_overrides = measurement_overrides;
      if (manual_measurements !== undefined) updateData.manual_measurements = manual_measurements;

      const { data: profile, error } = await supabase
        .from('store_profiles')
        .upsert(updateData, { onConflict: 'username' })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        username: cleanedUsername,
        twin: profile.twin,
        api_scans: profile.api_scans || [],
        measurement_overrides: profile.measurement_overrides || {},
        manual_measurements: profile.manual_measurements || {}
      });
    }

    if (action === 'forgot-password') {
      // Check if user exists
      const { data: profile, error: findErr } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: updateErr } = await supabase
        .from('store_profiles')
        .update({
          verification_code: verificationCode,
          verification_code_expires: expiresAt
        })
        .eq('username', cleanedUsername);

      if (updateErr) throw updateErr;

      return res.status(200).json({
        success: true,
        message: 'Verification code generated.',
        code: verificationCode
      });
    }

    if (action === 'reset-password') {
      if (!code || !newPassword) {
        return res.status(400).json({ error: 'Missing code or new password.' });
      }

      const { data: profile, error: findErr } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      if (!profile.verification_code || profile.verification_code !== code.trim()) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      if (profile.verification_code_expires && new Date() > new Date(profile.verification_code_expires)) {
        return res.status(400).json({ error: 'Verification code has expired.' });
      }

      // Update password and clear verification code
      const { error: resetErr } = await supabase
        .from('store_profiles')
        .update({
          password: newPassword,
          verification_code: null,
          verification_code_expires: null
        })
        .eq('username', cleanedUsername);

      if (resetErr) throw resetErr;

      return res.status(200).json({
        success: true,
        message: 'Password reset successful.'
      });
    }

    return res.status(400).json({ error: 'Invalid action.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error processing auth request.' });
  }
}
