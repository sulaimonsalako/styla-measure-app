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
  
  console.log('Attempting signup...');
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    console.log('--- RAW ERROR ---');
    console.log(JSON.stringify(error, null, 2));
    console.log('Message:', error.message);
    console.log('Status:', error.status);
  } else {
    console.log('Signup successful!');
    console.log(data);
  }
}

run();
