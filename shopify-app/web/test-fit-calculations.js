// Verification script for STYLA Fit Engine recommendations
const fs = require('fs');
const path = require('path');

// Extract the calculateStylaFit function from index.js dynamically to ensure we test the actual logic
const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

// Use a simple function extractor regex or eval to load the function for testing
const functionStartIndex = indexContent.indexOf('function calculateStylaFit(');
const functionEndIndex = indexContent.indexOf('// ----------------------------------------------------', functionStartIndex);
const calculateStylaFitCode = indexContent.substring(functionStartIndex, functionEndIndex !== -1 ? functionEndIndex : indexContent.length);

// Eval the function definition in this context
const calculateStylaFit = eval(`(${calculateStylaFitCode})`);

// Define Test Cases
const mockSizeChart = {
  shopify_product_id: "prod_12345",
  ease_profile_id: "regular", // Wearing ease Chest +2", Design ease Chest +2" (Total = +4" default)
  size_grid: {
    "S": {
      "Chest Width (Flat)": 19,    // Circumference = 38"
      "Waist Width (Flat)": 15,    // Circumference = 30"
      "Hips Width (Flat)": 17,     // Circumference = 34"
      "Shoulder Width": 17.5,      // Linear = 17.5"
      "Sleeve Length": 32.5        // Linear = 32.5"
    },
    "M": {
      "Chest Width (Flat)": 20,    // Circumference = 40"
      "Waist Width (Flat)": 16,    // Circumference = 32"
      "Hips Width (Flat)": 18,     // Circumference = 36"
      "Shoulder Width": 18,        // Linear = 18"
      "Sleeve Length": 33.2        // Linear = 33.2"
    },
    "L": {
      "Chest Width (Flat)": 21,    // Circumference = 42"
      "Waist Width (Flat)": 17,    // Circumference = 34"
      "Hips Width (Flat)": 19,     // Circumference = 38"
      "Shoulder Width": 18.5,      // Linear = 18.5"
      "Sleeve Length": 34.0        // Linear = 34.0"
    },
    "XL": {
      "Chest Width (Flat)": 22.5,  // Circumference = 45"
      "Waist Width (Flat)": 18.5,  // Circumference = 37"
      "Hips Width (Flat)": 20.5,   // Circumference = 41"
      "Shoulder Width": 19.2,      // Linear = 19.2"
      "Sleeve Length": 34.8        // Linear = 34.8"
    }
  }
};

const mockShopperTwin = {
  chest: 38.0,
  waist: 31.0,
  hips: 35.0,
  shoulders: 18.0
};

console.log("=== STYLA FIT ENGINE TEST ENVIRONMENT ===");
console.log("Shopper Measurements:", JSON.stringify(mockShopperTwin));
console.log("Garment Size Chart: S, M, L, XL");

// Test 1: Regular Fit Profile
console.log("\n--- TEST 1: Regular Fit Profile (Recommended Chest Ease +4.0\") ---");
const rec1 = calculateStylaFit(mockSizeChart, mockShopperTwin);
console.log("Recommended Size:", rec1.recommendedSize);
console.log("Match Rate:", rec1.matchRate + "%");
console.log("Design Intent:", rec1.designIntent);
console.log("Detail Analysis:");
console.table(rec1.measurements);

// Test 2: Slim Fit Profile (Recommended Chest Ease +2.0\")
console.log("\n--- TEST 2: Slim Fit Profile (Recommended Chest Ease +2.0\") ---");
mockSizeChart.ease_profile_id = "slim";
const rec2 = calculateStylaFit(mockSizeChart, mockShopperTwin);
console.log("Recommended Size:", rec2.recommendedSize);
console.log("Match Rate:", rec2.matchRate + "%");
console.log("Design Intent:", rec2.designIntent);
console.log("Detail Analysis:");
console.table(rec2.measurements);

// Test 3: Oversized Fit Profile (Recommended Chest Ease +10.0\")
console.log("\n--- TEST 3: Oversized Fit Profile (Recommended Chest Ease +10.0\") ---");
mockSizeChart.ease_profile_id = "oversized";
const rec3 = calculateStylaFit(mockSizeChart, mockShopperTwin);
console.log("Recommended Size:", rec3.recommendedSize);
console.log("Match Rate:", rec3.matchRate + "%");
console.log("Design Intent:", rec3.designIntent);
console.log("Detail Analysis:");
console.table(rec3.measurements);
