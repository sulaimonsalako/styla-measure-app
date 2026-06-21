import handler from '../api/_store/store-payment.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to mock request/response
function mockReqRes(body) {
  const req = {
    method: 'POST',
    body: body,
    headers: {}
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
  console.log("=== STARTING PAYMENT API TEST ===");
  
  const testCartId = "cart_test_123";

  // Set up mock cart in Supabase store_carts
  const mockCart = {
    id: testCartId,
    creator_username: "alex",
    creator_items: [{ productId: "prod_1", quantity: 2, bulkPrice: 10, singlePrice: 15 }],
    friend_items: [{ productId: "prod_2", quantity: 2, bulkPrice: 20, singlePrice: 25 }],
    creator_paid: false,
    friend_paid: false,
    payment_status: "unpaid",
    amount_paid: 0
  };
  
  const { error: setupErr } = await supabase
    .from('store_carts')
    .upsert(mockCart, { onConflict: 'id' });

  if (setupErr) {
    console.error("Failed to set up mock cart in Supabase:", setupErr.message);
    process.exit(1);
  }
  console.log("Mock cart setup successfully in Supabase.");

  // Test 1: Creator pays their share
  console.log("\n--- Test 1: Confirm Creator Share Payment ---");
  const { req: req1, res: res1, getStatus: status1, getData: data1 } = mockReqRes({
    action: "confirm-payment",
    cartId: testCartId,
    role: "creator",
    amount: 40
  });
  
  await handler(req1, res1);
  console.log("HTTP Status:", status1());
  console.log("Payment Status:", data1().cart.paymentStatus);
  console.log("Creator Paid:", data1().cart.creatorPaid);
  console.log("Friend Paid:", data1().cart.friendPaid);
  console.log("Amount Paid:", data1().cart.amountPaid);
  
  if (status1() === 200 && data1().cart.paymentStatus === 'partially_paid' && data1().cart.creatorPaid === true) {
    console.log("? Test 1 Passed!");
  } else {
    console.error("? Test 1 Failed!");
  }

  // Test 2: Friend pays their share
  console.log("\n--- Test 2: Confirm Friend Share Payment ---");
  const { req: req2, res: res2, getStatus: status2, getData: data2 } = mockReqRes({
    action: "confirm-payment",
    cartId: testCartId,
    role: "friend",
    amount: 40
  });
  
  await handler(req2, res2);
  console.log("HTTP Status:", status2());
  console.log("Payment Status:", data2().cart.paymentStatus);
  console.log("Creator Paid:", data2().cart.creatorPaid);
  console.log("Friend Paid:", data2().cart.friendPaid);
  console.log("Amount Paid:", data2().cart.amountPaid);
  
  if (status2() === 200 && data2().cart.paymentStatus === 'paid' && data2().cart.friendPaid === true) {
    console.log("? Test 2 Passed!");
  } else {
    console.error("? Test 2 Failed!");
  }

  // Clean up
  const { error: cleanErr } = await supabase
    .from('store_carts')
    .delete()
    .eq('id', testCartId);

  if (cleanErr) {
    console.error("Failed to clean mock cart in Supabase:", cleanErr.message);
  } else {
    console.log("\nMock cart cleaned from Supabase.");
  }
  
  console.log("=== TESTS COMPLETE ===");
}

runTests().catch(err => {
  console.error("Test execution error:", err);
});
