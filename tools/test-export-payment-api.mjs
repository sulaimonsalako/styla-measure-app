import fs from 'fs';
import path from 'path';

// Load .env first (ESM hoisting workaround)
const envPath = path.join(process.cwd(), '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

// Now dynamically import the payment handler
const { default: handler } = await import('../api/_store/export-payment.js');

function mockReqRes(body, query = {}) {
  const req = {
    method: 'POST',
    body: body,
    headers: {
      origin: 'http://localhost:3000'
    },
    query: query
  };
  
  let statusCode = 200;
  let responseData = null;
  
  const res = {
    setHeader: () => {},
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => {}
  };
  
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log("=== STARTING EXPORT PAYMENT API TEST ===");
  
  const testUserId = "00000000-0000-0000-0000-000000000000"; // Mock auth UUID
  const testEmail = "test-buyer@styla.ca";

  // Test 1: Create Stripe Checkout Session
  console.log("\n--- Test 1: Create Stripe Checkout Session ---");
  const { req: req1, res: res1, getStatus: status1, getData: data1 } = mockReqRes({
    action: "create-checkout-session",
    userId: testUserId,
    email: testEmail
  });
  
  await handler(req1, res1);
  console.log("HTTP Status:", status1());
  
  if (status1() === 200 && data1().id && data1().publishableKey) {
    console.log("Stripe Session ID:", data1().id);
    console.log("Stripe Publishable Key:", data1().publishableKey);
    console.log("? Test 1 Passed!");
  } else {
    console.error("? Test 1 Failed!", data1());
  }
  
  console.log("=== TESTS COMPLETE ===");
}

runTests().catch(err => {
  console.error("Test execution error:", err);
});
