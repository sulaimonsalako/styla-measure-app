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

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('store_categories')
        .select('name')
        .order('name', { ascending: true });

      if (error) throw error;
      const categories = data.map(c => c.name);
      return res.status(200).json(categories);
    } catch (err) {
      console.error("Failed to fetch categories from Supabase:", err);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, name, oldName, newName } = req.body;

      if (action === 'add') {
        if (!name) return res.status(400).json({ error: 'Missing category name' });

        // Insert new category
        const { error } = await supabase
          .from('store_categories')
          .insert({ name });

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Category already exists' });
          }
          throw error;
        }

        // Fetch all categories to return updated list
        const { data: allCats, error: fetchErr } = await supabase
          .from('store_categories')
          .select('name')
          .order('name', { ascending: true });
        
        if (fetchErr) throw fetchErr;
        return res.status(201).json(allCats.map(c => c.name));
      }

      if (action === 'rename') {
        if (!oldName || !newName) {
          return res.status(400).json({ error: 'Missing oldName or newName' });
        }

        // Check if newName already exists
        const { data: existing } = await supabase
          .from('store_categories')
          .select('name')
          .eq('name', newName)
          .maybeSingle();

        if (existing) {
          return res.status(400).json({ error: 'New category name already exists' });
        }

        // Update category name
        const { error: renameErr } = await supabase
          .from('store_categories')
          .update({ name: newName })
          .eq('name', oldName);

        if (renameErr) throw renameErr;

        // Update references in store_products table
        const { error: prodUpdateErr } = await supabase
          .from('store_products')
          .update({ category: newName })
          .eq('category', oldName);

        if (prodUpdateErr) {
          console.error("Failed to update products category reference:", prodUpdateErr);
        }

        // Fetch updated list
        const { data: allCats, error: fetchErr } = await supabase
          .from('store_categories')
          .select('name')
          .order('name', { ascending: true });
        
        if (fetchErr) throw fetchErr;
        return res.status(200).json(allCats.map(c => c.name));
      }

      if (action === 'delete') {
        if (!name) return res.status(400).json({ error: 'Missing category name' });

        const { error: deleteErr } = await supabase
          .from('store_categories')
          .delete()
          .eq('name', name);

        if (deleteErr) throw deleteErr;

        // Set products under this category to 'Uncategorized'
        const { error: prodUpdateErr } = await supabase
          .from('store_products')
          .update({ category: 'Uncategorized' })
          .eq('category', name);

        if (prodUpdateErr) {
          console.error("Failed to update products category to Uncategorized:", prodUpdateErr);
        }

        // Fetch updated list
        const { data: allCats, error: fetchErr } = await supabase
          .from('store_categories')
          .select('name')
          .order('name', { ascending: true });
        
        if (fetchErr) throw fetchErr;
        return res.status(200).json(allCats.map(c => c.name));
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
      console.error("Error managing categories:", err);
      return res.status(500).json({ error: 'Server error managing categories' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
