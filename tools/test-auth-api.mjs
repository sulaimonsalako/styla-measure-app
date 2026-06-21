import handler from '../api/_store/store-auth.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function mockReqRes(body) {
  const req = { method: 'POST', body: body, headers: {} };
  let statusCode = 200;
  let responseData = null;
  const res = {
    setHeader: () => {},
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
    end: () => {}
  };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log("=== STARTING AUTH API TEST ===");
  const testUser = "auth_test_user";
  
  // Set up mock profile in Supabase store_profiles
  const { error: setupErr } = await supabase
    .from('store_profiles')
    .upsert({
      username: testUser,
      password: "oldPassword123",
      twin: null
    }, { onConflict: 'username' });

  if (setupErr) {
    console.error("Failed to set up mock profile in Supabase:", setupErr.message);
    process.exit(1);
  }
  console.log("Mock profile set up in Supabase.");

  // Test 1: Forgot Password (generates code)
  console.log("\n--- Test 1: Forgot Password (Code Gen) ---");
  const { req: req1, res: res1, getStatus: status1, getData: data1 } = mockReqRes({
    action: "forgot-password",
    username: testUser
  });
  await handler(req1, res1);
  console.log("Status:", status1());
  console.log("Code generated:", data1().code);
  const code = data1().code;
  
  if (status1() === 200 && code && code.length === 6) {
    console.log("? Test 1 Passed!");
  } else {
    console.error("? Test 1 Failed!");
  }

  // Test 2: Reset Password (using code)
  console.log("\n--- Test 2: Reset Password ---");
  const { req: req2, res: res2, getStatus: status2, getData: data2 } = mockReqRes({
    action: "reset-password",
    username: testUser,
    code: code,
    newPassword: "newPassword999"
  });
  await handler(req2, res2);
  console.log("Status:", status2());
  console.log("Response Message:", data2().message);
  
  // Verify password changed
  const { data: updatedUser, error: fetchErr } = await supabase
    .from('store_profiles')
    .select('password')
    .eq('username', testUser)
    .single();

  if (fetchErr) throw fetchErr;
  console.log("Updated Password in Supabase:", updatedUser.password);
  
  if (status2() === 200 && updatedUser.password === "newPassword999") {
    console.log("? Test 2 Passed!");
  } else {
    console.error("? Test 2 Failed!");
  }

  // Clean up
  const { error: cleanErr } = await supabase
    .from('store_profiles')
    .delete()
    .eq('username', testUser);

  if (cleanErr) {
    console.error("Failed to clean mock profile in Supabase:", cleanErr.message);
  } else {
    console.log("\nMock profile cleaned from Supabase.");
  }
  
  console.log("=== TESTS COMPLETE ===");
}

runTests().catch(err => {
  console.error("Test execution error:", err);
});
