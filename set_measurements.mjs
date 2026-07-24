import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_ANON_KEY);

async function run() {
  const email = 'suloasis@gmail.com';
  const password = 'Password123!';

  // Try to sign up first
  let { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password
  });

  if (authErr && authErr.message.includes('already registered')) {
    console.log('User already exists, logging in...');
    const res = await supabase.auth.signInWithPassword({ email, password });
    authData = res.data;
    authErr = res.error;
  }

  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }

  const userId = authData.user.id;
  console.log('Logged in. User ID:', userId);

  const measurements = {
    chest: 38.5,
    waist: 31.2,
    hips: 37,
    height: 68.5,
    inseam: 30,
    belly: 31.2
  };

  const { error: dbErr } = await supabase.from('profiles').upsert({
    id: userId,
    ...measurements
  });

  if (dbErr) {
    console.error('Error saving to profiles:', dbErr.message);
  } else {
    console.log('Successfully saved measurements for suloasis@gmail.com!');
    console.log('You can now log in with:');
    console.log('Email:', email);
    console.log('Password:', password);
  }
}

run();
