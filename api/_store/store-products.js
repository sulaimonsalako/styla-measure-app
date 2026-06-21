import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mapProductFromDB = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  supplier: p.supplier,
  description: p.description,
  images: p.images || [],
  singlePrice: Number(p.single_price),
  bulkPrice: Number(p.bulk_price),
  sizes: p.sizes || [],
  colors: p.colors || [],
  colorImages: p.color_images || {},
  sizeChart: p.size_chart || {},
  status: p.status
});

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
        .from('store_products')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      const products = data.map(mapProductFromDB);
      return res.status(200).json(products);
    } catch (err) {
      console.error("Failed to fetch products from Supabase:", err);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, id, name, category, supplier, description, images, singlePrice, bulkPrice, sizes, colors, sizeChart, status } = req.body;

      if (action === 'update') {
        if (!id) {
          return res.status(400).json({ error: 'Missing product id' });
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (category !== undefined) updateData.category = category;
        if (supplier !== undefined) updateData.supplier = supplier;
        if (description !== undefined) updateData.description = description;
        if (Array.isArray(images)) updateData.images = images;
        if (singlePrice !== undefined) updateData.single_price = Number(singlePrice);
        if (bulkPrice !== undefined) updateData.bulk_price = Number(bulkPrice);
        if (Array.isArray(sizes)) updateData.sizes = sizes;
        if (Array.isArray(colors)) updateData.colors = colors;
        if (req.body.colorImages !== undefined) updateData.color_images = req.body.colorImages;
        if (sizeChart !== undefined) updateData.size_chart = sizeChart;
        if (status !== undefined) updateData.status = status;

        const { data, error } = await supabase
          .from('store_products')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json(mapProductFromDB(data));
      }

      if (action === 'delete') {
        if (!id) {
          return res.status(400).json({ error: 'Missing product id' });
        }

        const { error } = await supabase
          .from('store_products')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // Create new product
      if (!name || !category || !supplier || !singlePrice || !bulkPrice) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newProduct = {
        id: `prod_${Date.now()}`,
        name,
        category,
        supplier,
        description: description || '',
        images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop'],
        single_price: Number(singlePrice),
        bulk_price: Number(bulkPrice),
        sizes: Array.isArray(sizes) ? sizes : ['M'],
        colors: Array.isArray(colors) && colors.length > 0 ? colors : ['Standard'],
        color_images: req.body.colorImages || {},
        size_chart: sizeChart || {},
        status: status || 'active'
      };

      const { data, error } = await supabase
        .from('store_products')
        .insert(newProduct)
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(mapProductFromDB(data));
    } catch (err) {
      console.error("Error modifying products:", err);
      return res.status(500).json({ error: 'Server error modifying products' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
