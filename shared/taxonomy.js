/* SINGLE SOURCE OF TRUTH — Styla category taxonomy.
 *
 * UMD so every runtime reads the same file:
 *   Vercel API (ESM)   import tax from '../../shared/taxonomy.js'
 *   Shopify app (CJS)  require('../../shared/taxonomy.js')
 *   Browser            <script src="/shared/taxonomy.js"> -> window.STYLA_TAX
 *
 * A CATEGORY is a measurement region (what the fit engine compares).
 * `audience` groups it for display; shared slugs (tops, pants, outerwear, shorts,
 * swimwear) appear under both men's and women's — the chart's gender field
 * disambiguates, so we never duplicate a slug per gender.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_TAX = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var TAXONOMY = [
    { slug:'tops',        label:'Tops',            audience:['men','women'], measures:'chest, shoulder, sleeve',        includes:['T-shirts','Shirts & blouses','Knitwear','Bodysuits','Tanks'] },
    { slug:'pants',       label:'Bottoms',         audience:['men','women'], measures:'waist, hip, inseam, thigh',      includes:['Trousers','Jeans / denim','Chinos','Wide-leg','Tailored'] },
    { slug:'outerwear',   label:'Coats & Jackets', audience:['men','women'], measures:'chest, shoulder, length',        includes:['Jackets','Coats','Blazers','Puffers','Trenches'] },
    { slug:'shorts',      label:'Shorts',          audience:['men','women'], measures:'waist, hip, thigh',              includes:['Denim shorts','Tailored shorts','Bermuda','Athletic'] },
    { slug:'swimwear',    label:'Swimwear',        audience:['men','women'], measures:'bust/chest, waist, hip',         includes:['One-piece','Bikini','Tankini','Trunks'] },

    { slug:'suits',        label:'Suits & Blazers', audience:['men'],        measures:'chest, waist, inseam',           includes:['Two-piece suits','Tuxedos','Blazer + trouser sets'] },
    { slug:'dress-shirts', label:'Dress shirts',    audience:['men'],        measures:'neck, chest, sleeve',            includes:['Formal shirts','Business shirts','Tuxedo shirts'] },
    { slug:'underwear',    label:'Underwear',       audience:['men'],        measures:'waist, hip',                     includes:['Boxers','Briefs','Trunks','Undershirts'] },

    { slug:'dresses',    label:'Dresses',    audience:['women'], measures:'bust, waist, hip, length',       includes:['Everyday','Cocktail','Formal','Maxi','Midi'] },
    { slug:'skirts',     label:'Skirts',     audience:['women'], measures:'waist, hip, length',             includes:['Mini','Midi','Maxi','Pencil','A-line'] },
    { slug:'bras',       label:'Bras',       audience:['women'], measures:'underbust (band), bust (cup)',   includes:['T-shirt','Balconette','Sports','Bralette','Plunge'] },
    { slug:'panties',    label:'Panties',    audience:['women'], measures:'waist, hip',                     includes:['Briefs','Thongs','Boyshorts','High-waist'] },
    { slug:'leggings',   label:'Leggings',   audience:['women'], measures:'waist, hip, inseam',             includes:['Full-length','Capri','Yoga','Compression'] },
    { slug:'jumpsuits',  label:'Jumpsuits',  audience:['women'], measures:'bust, waist, hip, torso length', includes:['Jumpsuits','Rompers','Overalls'] },
    { slug:'shapewear',  label:'Shapewear',  audience:['women'], measures:'waist, hip, bust',               includes:['Bodysuits','Waist cinchers','Thigh shapers','Slips'] },
    { slug:'bridal',     label:'Bridal',     audience:['women'], measures:'bust, waist, hip, length',       includes:['Wedding gowns','Reception dresses'] },
    { slug:'bridesmaid', label:'Bridesmaid', audience:['women'], measures:'bust, waist, hip, length',       includes:['Bridesmaid dresses'] },

    { slug:'infants',       label:'Infants',        audience:['kids'], measures:'height, weight, age',   includes:['Bodysuits','Sleepsuits','Newborn sets'] },
    { slug:'boys-tops',     label:"Boys' tops",     audience:['kids'], measures:'height, chest',         includes:['T-shirts','Shirts','Sweaters','Hoodies'] },
    { slug:'boys-bottoms',  label:"Boys' bottoms",  audience:['kids'], measures:'height, waist, inseam', includes:['Trousers','Jeans','Shorts','Joggers'] },
    { slug:'girls-tops',    label:"Girls' tops",    audience:['kids'], measures:'height, chest',         includes:['T-shirts','Blouses','Sweaters','Hoodies'] },
    { slug:'girls-bottoms', label:"Girls' bottoms", audience:['kids'], measures:'height, waist, inseam', includes:['Trousers','Jeans','Skirts','Leggings'] },
  ];

  var AUDIENCES = [
    { key:'men',   label:"Men's fashion" },
    { key:'women', label:"Women's fashion" },
    { key:'kids',  label:'Kids' },
  ];

  var GROUPED = AUDIENCES.map(function (a) {
    return { key:a.key, label:a.label,
      items: TAXONOMY.filter(function (c) { return (c.audience || []).indexOf(a.key) > -1; }) };
  });

  var CAT_LABEL = TAXONOMY.reduce(function (m, c) { m[c.slug] = c.label; return m; }, {});
  var CAT_INCLUDES = TAXONOMY.reduce(function (m, c) { m[c.slug] = c.includes; return m; }, {});

  return { TAXONOMY: TAXONOMY, AUDIENCES: AUDIENCES, GROUPED: GROUPED,
           CAT_LABEL: CAT_LABEL, CAT_INCLUDES: CAT_INCLUDES };
}));
