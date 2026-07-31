/* Styla category taxonomy — single source of truth for admin + dashboard.
 * A CATEGORY is a measurement region (what the fit engine compares).
 * `includes` = the garment types shown to users so they know what's in a category.
 * `measures` = the body measurements that category keys off (admin guidance).
 * A chart's `subcategory` is a free brand tag (fabric / fit / garment type).
 */
window.STYLA_TAXONOMY = [
  { slug:'tops',       label:'Tops',       measures:'chest, shoulder, sleeve',        includes:['T-shirts','Shirts & blouses','Knitwear','Bodysuits','Tanks'] },
  { slug:'outerwear',  label:'Outerwear',  measures:'chest, shoulder, length',        includes:['Jackets','Coats','Blazers','Puffers','Trenches'] },
  { slug:'suits',      label:'Suits',      measures:'chest, waist, inseam',           includes:['Two-piece suits','Tuxedos','Blazer + trouser sets'] },
  { slug:'pants',      label:'Pants',      measures:'waist, hip, inseam, thigh',      includes:['Trousers','Jeans / denim','Chinos','Wide-leg','Tailored'] },
  { slug:'skirts',     label:'Skirts',     measures:'waist, hip, length',             includes:['Mini','Midi','Maxi','Pencil','A-line'] },
  { slug:'shorts',     label:'Shorts',     measures:'waist, hip, thigh',              includes:['Denim shorts','Tailored shorts','Bermuda','Athletic'] },
  { slug:'leggings',   label:'Leggings',   measures:'waist, hip, inseam',             includes:['Full-length','Capri','Yoga','Compression'] },
  { slug:'dresses',    label:'Dresses',    measures:'bust, waist, hip, length',       includes:['Everyday','Cocktail','Formal','Maxi','Midi'] },
  { slug:'jumpsuits',  label:'Jumpsuits',  measures:'bust, waist, hip, torso length', includes:['Jumpsuits','Rompers','Overalls'] },
  { slug:'bridal',     label:'Bridal',     measures:'bust, waist, hip, length',       includes:['Wedding gowns','Reception dresses'] },
  { slug:'bridesmaid', label:'Bridesmaid', measures:'bust, waist, hip, length',       includes:['Bridesmaid dresses'] },
  { slug:'bras',       label:'Bras',       measures:'underbust (band), bust (cup)',   includes:['T-shirt','Balconette','Sports','Bralette','Plunge'] },
  { slug:'shapewear',  label:'Shapewear',  measures:'waist, hip, bust',               includes:['Bodysuits','Waist cinchers','Thigh shapers','Slips'] },
  { slug:'swimwear',   label:'Swimwear',   measures:'bust, waist, hip',               includes:['One-piece','Bikini','Tankini'] },
];
window.STYLA_CAT_LABEL = window.STYLA_TAXONOMY.reduce(function(m,c){ m[c.slug]=c.label; return m; }, {});
window.STYLA_CAT_INCLUDES = window.STYLA_TAXONOMY.reduce(function(m,c){ m[c.slug]=c.includes; return m; }, {});
