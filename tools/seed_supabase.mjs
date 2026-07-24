import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log("=== STARTING SUPABASE SEEDING ===");

  // 1. Seed Categories
  const categoriesPath = path.join(process.cwd(), 'categories.json');
  if (fs.existsSync(categoriesPath)) {
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    console.log(`Found ${categories.length} categories to seed.`);
    for (const name of categories) {
      const { error } = await supabase.from('store_categories').upsert({ name });
      if (error) {
        console.error(`Failed to upsert category "${name}":`, error.message);
      } else {
        console.log(`Successfully seeded category: ${name}`);
      }
    }
  }

  // 2. Seed Products
  const productsPath = path.join(process.cwd(), 'products.json');
  if (fs.existsSync(productsPath)) {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    console.log(`Found ${products.length} products to seed.`);
    for (const p of products) {
      const mapped = {
        id: p.id,
        name: p.name,
        category: p.category,
        supplier: p.supplier,
        description: p.description,
        images: p.images || [],
        single_price: p.singlePrice,
        bulk_price: p.bulkPrice,
        sizes: p.sizes || [],
        colors: p.colors || [],
        color_images: p.colorImages || {},
        size_chart: p.sizeChart || {},
        status: p.status || 'active'
      };
      const { error } = await supabase.from('store_products').upsert(mapped);
      if (error) {
        console.error(`Failed to upsert product "${p.name}":`, error.message);
      } else {
        console.log(`Successfully seeded product: ${p.name} (${p.id})`);
      }
    }
  }

  console.log("=== SEEDING COMPLETED ===");
}

seed().catch(err => {
  console.error("Seeding failed:", err);
});
