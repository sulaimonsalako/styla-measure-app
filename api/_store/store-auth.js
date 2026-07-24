import bcrypt from 'bcryptjs';
import { supabaseAdmin as supabase } from '../_helpers/supabase-admin.js';

const GUEST_PLACEHOLDER = 'temp_guest_placeholder';
const SALT_ROUNDS = 10;

// bcrypt hashes start with $2a$, $2b$, or $2y$. Used to tell a hashed password
// apart from a legacy plaintext one during the lazy migration.
const isHashed = (val) => typeof val === 'string' && /^\$2[aby]\$/.test(val);

const parseTwin = (twin) => {
  if (!twin) return null;
  if (typeof twin !== 'string') return twin;
  try {
    return JSON.parse(twin);
  } catch (e) {
    return twin;
  }
};

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

      const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

      // Check if user exists
      const { data: existing } = await supabase
        .from('store_profiles')
        .select('username, password, twin')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (existing) {
        if (existing.password === GUEST_PLACEHOLDER) {
          // Allow completing the signup by upgrading the guest profile
          const { error } = await supabase
            .from('store_profiles')
            .update({
              password: hashedPassword,
              created_at: new Date().toISOString()
            })
            .eq('username', cleanedUsername);

          if (error) throw error;

          return res.status(201).json({
            success: true,
            username: cleanedUsername,
            twin: parseTwin(existing.twin)
          });
        }
        return res.status(400).json({ error: 'Username already exists.' });
      }

      // Create new profile
      const { error } = await supabase
        .from('store_profiles')
        .insert({
          username: cleanedUsername,
          password: hashedPassword,
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

      // Fetch by username only, then verify the password in code. (We can no
      // longer filter by password in the query because it is hashed.)
      const { data: profile, error } = await supabase
        .from('store_profiles')
        .select('*')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (error) throw error;
      if (!profile || profile.password === GUEST_PLACEHOLDER) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      let passwordValid = false;

      if (isHashed(profile.password)) {
        passwordValid = bcrypt.compareSync(password, profile.password);
      } else {
        // Legacy plaintext password. Verify, then transparently upgrade it to a
        // bcrypt hash so the plaintext is never stored again (lazy migration).
        passwordValid = profile.password === password;
        if (passwordValid) {
          try {
            const rehash = bcrypt.hashSync(password, SALT_ROUNDS);
            await supabase
              .from('store_profiles')
              .update({ password: rehash })
              .eq('username', cleanedUsername);
          } catch (rehashErr) {
            console.error('Lazy password rehash failed (login still allowed):', rehashErr);
          }
        }
      }

      if (!passwordValid) {
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

    // Read a profile's non-sensitive fields. Replaces direct client-side
    // SELECTs against store_profiles (never returns password).
    if (action === 'get-profile') {
      const { data: profile, error } = await supabase
        .from('store_profiles')
        .select('username, twin, api_scans, measurement_overrides, manual_measurements')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (error) throw error;
      if (!profile) {
        return res.status(200).json({ success: true, exists: false });
      }

      return res.status(200).json({
        success: true,
        exists: true,
        username: profile.username,
        twin: profile.twin,
        api_scans: profile.api_scans || [],
        measurement_overrides: profile.measurement_overrides || {},
        manual_measurements: profile.manual_measurements || {}
      });
    }

    // Create/refresh a guest profile without a real password. Replaces direct
    // client-side upserts. Never overwrites an existing real account's password.
    if (action === 'guest-init') {
      const { data: existing } = await supabase
        .from('store_profiles')
        .select('username, password')
        .eq('username', cleanedUsername)
        .maybeSingle();

      const fields = {};
      if (twin !== undefined) fields.twin = twin ? (typeof twin === 'string' ? twin : JSON.stringify(twin)) : null;
      if (api_scans !== undefined) fields.api_scans = api_scans;
      if (measurement_overrides !== undefined) fields.measurement_overrides = measurement_overrides;
      if (manual_measurements !== undefined) fields.manual_measurements = manual_measurements;

      if (existing) {
        // Update only the provided non-password fields; leave password intact.
        if (Object.keys(fields).length > 0) {
          const { error } = await supabase
            .from('store_profiles')
            .update(fields)
            .eq('username', cleanedUsername);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('store_profiles')
          .insert({
            username: cleanedUsername,
            password: GUEST_PLACEHOLDER,
            twin: fields.twin ?? null,
            api_scans: fields.api_scans ?? [],
            measurement_overrides: fields.measurement_overrides ?? {},
            manual_measurements: fields.manual_measurements ?? {}
          });
        if (error) throw error;
      }

      const { data: row } = await supabase
        .from('store_profiles')
        .select('username, twin, api_scans, measurement_overrides, manual_measurements')
        .eq('username', cleanedUsername)
        .maybeSingle();

      return res.status(200).json({ success: true, username: cleanedUsername, profile: row || null });
    }

    if (action === 'delete-profile') {
      const { error } = await supabase
        .from('store_profiles')
        .delete()
        .eq('username', cleanedUsername);

      if (error) throw error;
      return res.status(200).json({ success: true });
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

      // Preserve existing password (or guest placeholder for brand-new rows) so
      // the upsert never nulls out a real account's credentials.
      const { data: existing } = await supabase
        .from('store_profiles')
        .select('password')
        .eq('username', cleanedUsername)
        .maybeSingle();
      updateData.password = existing?.password || GUEST_PLACEHOLDER;

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
        .select('username')
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
        .select('verification_code, verification_code_expires')
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

      // Update password (hashed) and clear verification code
      const { error: resetErr } = await supabase
        .from('store_profiles')
        .update({
          password: bcrypt.hashSync(newPassword, SALT_ROUNDS),
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
