/**
 * ARUVA Fashion Platform — Backend Server
 * Stack: Express + better-sqlite3 + JWT + bcrypt
 */

const express = require('express');
const { DatabaseSync: Database } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aruva_jwt_secret_2026_fashion';
const DB_PATH = path.join(__dirname, 'aruva.db');

// ── RAZORPAY CONFIG ─────────────────────────────────────────────
// Replace these with your real keys from https://dashboard.razorpay.com
const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || 'rzp_test_YOUR_KEY_ID';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET';

const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

const ROOT_DIR = path.join(__dirname, '..');
const WWW_DIR  = path.join(__dirname, '..', 'www');

function isMobile(req) {
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(req.headers['user-agent'] || '');
}

// ── MIDDLEWARE ──────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mobile routing — redirect top-level HTML to /www/ for mobile devices
app.use((req, res, next) => {
  if (!isMobile(req)) return next();
  if (req.path.startsWith('/www/')) return next();
  const isTopHtml = req.path === '/' || /^\/[^\/]+\.html$/.test(req.path);
  if (!isTopHtml) return next();
  const file = req.path === '/' ? 'login.html' : path.basename(req.path);
  const wwwFile = path.join(WWW_DIR, file);
  if (fs.existsSync(wwwFile)) return res.redirect('/www/' + file);
  next();
});

app.use(express.static(ROOT_DIR));

// ── DATABASE ────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category_id INTEGER REFERENCES categories(id),
    price REAL NOT NULL,
    sale_price REAL,
    is_on_sale INTEGER DEFAULT 0,
    is_customizable INTEGER DEFAULT 0,
    is_new INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 100,
    rating REAL DEFAULT 4.5,
    review_count INTEGER DEFAULT 0,
    color TEXT DEFAULT '#1a1a1a',
    colors TEXT DEFAULT '["#1a1a1a"]',
    sizes TEXT DEFAULT '["S","M","L","XL"]',
    material TEXT DEFAULT '',
    care TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    size TEXT DEFAULT 'M',
    color TEXT DEFAULT '',
    custom_design TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT DEFAULT 'Home',
    full_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    line1 TEXT DEFAULT '',
    line2 TEXT DEFAULT '',
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    country TEXT DEFAULT 'India',
    is_default INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_number TEXT UNIQUE NOT NULL,
    subtotal REAL DEFAULT 0,
    shipping REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    payment_method TEXT DEFAULT 'card',
    shipping_address TEXT DEFAULT '{}',
    tracking_number TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    product_name TEXT,
    quantity INTEGER DEFAULT 1,
    size TEXT DEFAULT '',
    color TEXT DEFAULT '',
    price REAL NOT NULL,
    custom_design TEXT
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    title TEXT DEFAULT '',
    body TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'percent',
    value REAL NOT NULL,
    min_order REAL DEFAULT 0,
    max_uses INTEGER,
    used INTEGER DEFAULT 0,
    expires_at TEXT
  );

`);


// ── SEED DATA ──────────────────────────────────────────────────
function seed() {
  if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c > 0) return;

  const insCat = db.prepare('INSERT OR IGNORE INTO categories (id,name,slug,parent_id,sort_order) VALUES (?,?,?,?,?)');
  [
    [1,"Men's",'mens',null,1], [2,"Women's",'womens',null,2],
    [3,'Kids','kids',null,3], [4,'Custom Studio','custom',null,4],
    [5,'T-Shirts','mens-tshirts',1,1], [6,'Shirts','mens-shirts',1,2],
    [7,'Hoodies','mens-hoodies',1,3], [8,'Jackets','mens-jackets',1,4],
    [9,'Trousers','mens-trousers',1,5],
    [10,'Tops','womens-tops',2,1], [11,'Dresses','womens-dresses',2,2],
    [12,'Jeans','womens-jeans',2,3], [13,'Activewear','womens-activewear',2,4],
    [14,'Skirts','womens-skirts',2,5],
  ].forEach(r => insCat.run(...r));

  const insProd = db.prepare(`INSERT OR IGNORE INTO products
    (name,description,category_id,price,sale_price,is_on_sale,is_customizable,is_new,is_featured,stock,rating,review_count,color,colors,sizes,material,care)
    VALUES (@name,@desc,@cat,@price,@sale,@onsale,@custom,@isnew,@feat,@stock,@rating,@reviews,@color,@colors,@sizes,@material,@care)`);

  const PRODS = [
    {name:'Essential White Tee',desc:'Classic comfort meets modern minimalism. Made from 100% GOTS-certified organic cotton with a relaxed fit that works for every occasion.',cat:5,price:29,sale:null,onsale:0,custom:0,isnew:1,feat:1,stock:120,rating:4.7,reviews:128,color:'#F5F5F0',colors:'["#F5F5F0","#111111","#808080","#1a1a2e","#e63946"]',sizes:'["XS","S","M","L","XL","2XL"]',material:'100% Organic Cotton, 180gsm',care:'Machine wash cold, tumble dry low'},
    {name:'Midnight Black Hoodie',desc:'Premium heavyweight French terry hoodie. Double-lined hood, kangaroo pocket, and ribbed cuffs for the perfect cozy fit.',cat:7,price:79,sale:64,onsale:1,custom:0,isnew:0,feat:1,stock:80,rating:4.9,reviews:256,color:'#111111',colors:'["#111111","#1a1a2e","#2C3E50","#808080"]',sizes:'["S","M","L","XL","2XL","3XL"]',material:'80% Cotton, 20% Polyester, 320gsm fleece',care:'Machine wash cold, do not bleach'},
    {name:'Classic Oxford Shirt',desc:'Timeless Oxford-weave shirt cut for a modern slim fit. Button-down collar and single-button cuffs. Office to weekend, effortlessly.',cat:6,price:59,sale:null,onsale:0,custom:0,isnew:0,feat:0,stock:90,rating:4.6,reviews:89,color:'#E8E0D0',colors:'["#E8E0D0","#FFFFFF","#87CEEB","#98FB98"]',sizes:'["S","M","L","XL"]',material:'100% Cotton Oxford weave',care:'Machine wash 30°C, iron medium'},
    {name:'Slim Fit Chinos',desc:'Stretch-cotton slim chinos with a flat front and tapered leg. Versatile enough for casual Fridays or weekend brunch.',cat:9,price:69,sale:null,onsale:0,custom:0,isnew:0,feat:0,stock:75,rating:4.5,reviews:67,color:'#C4A882',colors:'["#C4A882","#808080","#000080","#2F4F4F","#111111"]',sizes:'["28","30","32","34","36"]',material:'98% Cotton, 2% Elastane',care:'Machine wash 30°C, hang dry'},
    {name:'Custom 3D T-Shirt',desc:'Design your own T-shirt from scratch using our real-time 3D studio. Choose colors, add text, graphics, and patterns. 100% yours.',cat:4,price:49,sale:null,onsale:0,custom:1,isnew:1,feat:1,stock:999,rating:4.8,reviews:312,color:'#FFFFFF',colors:'["#FFFFFF","#111111","#e63946","#2196F3","#4CAF50","#C9A84C","#9C27B0"]',sizes:'["XS","S","M","L","XL","2XL","3XL","4XL"]',material:'Premium 200gsm cotton jersey',care:'Machine wash cold inside out'},
    {name:'Denim Bomber Jacket',desc:'Statement-piece denim jacket with contrast stitching, premium brass hardware, and a relaxed fit. The kind of jacket you keep forever.',cat:8,price:129,sale:null,onsale:0,custom:0,isnew:0,feat:1,stock:45,rating:4.8,reviews:95,color:'#2B4B7E',colors:'["#2B4B7E","#1a1a2e","#111111"]',sizes:'["S","M","L","XL"]',material:'100% Cotton Denim, 12oz',care:'Machine wash cold, hang dry'},
    {name:'Floral Summer Dress',desc:'Light and breezy midi dress with an all-over floral print. V-neckline, smocked waist, and flowy skirt perfect for warm days.',cat:11,price:79,sale:59,onsale:1,custom:0,isnew:0,feat:1,stock:60,rating:4.7,reviews:143,color:'#E8B4C8',colors:'["#E8B4C8","#98FB98","#87CEEB","#FFF5E0"]',sizes:'["XS","S","M","L","XL"]',material:'100% Viscose',care:'Hand wash cold, lay flat to dry'},
    {name:'High-Waist Straight Jeans',desc:'Classic straight-leg high-waist jeans in premium non-stretch denim. Timeless silhouette that pairs with everything.',cat:12,price:89,sale:null,onsale:0,custom:0,isnew:1,feat:0,stock:85,rating:4.6,reviews:201,color:'#3B6998',colors:'["#3B6998","#1a1a2e","#2F4F4F","#111111"]',sizes:'["24","26","28","30","32","34"]',material:'100% Cotton Denim, 11oz',care:'Machine wash cold, hang dry'},
    {name:'Graphic Print Tee',desc:'Bold oversized graphic tee with ARUVA signature artwork. Drop shoulders, relaxed fit, premium soft-wash cotton.',cat:5,price:35,sale:null,onsale:0,custom:0,isnew:1,feat:0,stock:110,rating:4.5,reviews:78,color:'#111111',colors:'["#111111","#F5F5F0","#1a1a2e"]',sizes:'["XS","S","M","L","XL","2XL"]',material:'100% Cotton, 200gsm garment-washed',care:'Machine wash cold, inside out'},
    {name:'Premium Linen Shirt',desc:'Relaxed, breathable linen shirt for warm seasons. Slightly oversized fit with a camp collar and chest pocket.',cat:6,price:65,sale:null,onsale:0,custom:0,isnew:0,feat:0,stock:70,rating:4.4,reviews:55,color:'#D4C5A9',colors:'["#D4C5A9","#FFFFFF","#87CEEB","#E8E0D0"]',sizes:'["S","M","L","XL"]',material:'100% Belgian Linen',care:'Machine wash 30°C, light iron'},
    {name:'Activewear Sports Top',desc:'High-performance stretch crop top with a built-in shelf bra. Four-way stretch, moisture-wicking fabric for yoga, gym, or running.',cat:13,price:45,sale:null,onsale:0,custom:0,isnew:0,feat:0,stock:95,rating:4.7,reviews:189,color:'#7B4592',colors:'["#7B4592","#111111","#FF69B4","#00CED1","#1a1a2e"]',sizes:'["XS","S","M","L","XL"]',material:'80% Nylon, 20% Spandex',care:'Machine wash cold, hang dry, no fabric softener'},
    {name:'Custom 3D Hoodie',desc:'Design your own premium hoodie in our real-time 3D studio. Full customization: colors, text, graphics, patterns.',cat:4,price:89,sale:null,onsale:0,custom:1,isnew:1,feat:1,stock:999,rating:4.9,reviews:147,color:'#1a1a2e',colors:'["#1a1a2e","#111111","#FFFFFF","#e63946","#C9A84C"]',sizes:'["S","M","L","XL","2XL","3XL"]',material:'Premium 320gsm fleece',care:'Machine wash cold, inside out'},
    {name:'Utility Cargo Trousers',desc:'Relaxed utility trousers with six deep pockets. Adjustable ankle cuffs and a drawstring waist for the perfect fit.',cat:9,price:75,sale:null,onsale:0,custom:0,isnew:0,feat:0,stock:55,rating:4.5,reviews:92,color:'#4A5240',colors:'["#4A5240","#111111","#808080","#8B4513"]',sizes:'["28","30","32","34","36"]',material:'100% Cotton Canvas',care:'Machine wash 30°C'},
    {name:'Oversized Crewneck Sweatshirt',desc:'Soft and cozy oversized crewneck in thick fleece cotton. Relaxed fit, ribbed hem and cuffs, slight dropped shoulders.',cat:7,price:69,sale:55,onsale:1,custom:0,isnew:0,feat:0,stock:88,rating:4.6,reviews:167,color:'#B8B8B8',colors:'["#B8B8B8","#C9A84C","#FF6B6B","#4ECDC4","#111111"]',sizes:'["S","M","L","XL","2XL"]',material:'60% Cotton, 40% Polyester fleece',care:'Machine wash cold, tumble dry low'},
    {name:'Wrap Midi Dress',desc:'Elegant wrap midi dress with a deep V-neck, adjustable tie waist, and flowing A-line skirt. Day to night versatility.',cat:11,price:99,sale:null,onsale:0,custom:0,isnew:0,feat:1,stock:42,rating:4.8,reviews:83,color:'#7D1A3C',colors:'["#7D1A3C","#1a1a2e","#228B22","#111111"]',sizes:'["XS","S","M","L","XL"]',material:'100% Crepe Viscose',care:'Dry clean recommended, or hand wash cold'},
  ];

  PRODS.forEach(p => insProd.run(p));

  const insCoupon = db.prepare('INSERT OR IGNORE INTO coupons (code,type,value,min_order,max_uses) VALUES (?,?,?,?,?)');
  [
    ['WELCOME15','percent',15,0,null],
    ['FIRST20','percent',20,0,1000],
    ['ARUVA10','percent',10,500,null],
    ['FLAT200','fixed',200,1500,500],
    ['SALE30','percent',30,0,200],
  ].forEach(r => insCoupon.run(...r));

  console.log('✓ Database seeded with', PRODS.length, 'products');
}
seed();

// ── DEMO 3D ORDER ───────────────────────────────────────────────
function seedDemo3DOrder() {
  let userId = db.prepare("SELECT id FROM users WHERE email='demo@aruva.com'").get()?.id;
  if (!userId) {
    const hash = bcrypt.hashSync('demo1234', 8);
    userId = db.prepare("INSERT INTO users (email,password,first_name,last_name,phone) VALUES (?,?,?,?,?)").run('demo@aruva.com', hash, 'Aryan', 'Kadam', '9999999999').lastInsertRowid;
  }

  // 3D canvas render preview SVG
  const svgImg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%231a1a2e'/><text x='50%25' y='45%25' font-family='sans-serif' font-size='28' fill='%2387B9D4' text-anchor='middle' dy='.3em'>ARUVA</text><text x='50%25' y='60%25' font-family='sans-serif' font-size='16' fill='%234A6B82' text-anchor='middle' dy='.3em'>Custom Hoodie Design</text></svg>`;

  // Uploaded artwork image (separate from the 3D render)
  const uploadedImg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%230d1b2a' rx='12'/><circle cx='150' cy='110' r='55' fill='none' stroke='%2387B9D4' stroke-width='3'/><text x='150' y='118' font-family='sans-serif' font-size='22' fill='%2387B9D4' text-anchor='middle'>ARUVA</text><text x='150' y='200' font-family='sans-serif' font-size='12' fill='%234A6B82' text-anchor='middle'>Uploaded Artwork</text><text x='150' y='220' font-family='sans-serif' font-size='10' fill='%23334455' text-anchor='middle'>logo_design_v2.png</text></svg>`;

  // ── Demo Address ──
  if (db.prepare('SELECT COUNT(*) c FROM addresses WHERE user_id=?').get(userId).c === 0) {
    db.prepare("INSERT INTO addresses (user_id,label,full_name,phone,line1,line2,city,state,pincode,country,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,1)").run(
      userId, 'Home', 'Rahul Sharma', '9876543210', 'Flat 4B, Sunrise Apartments', 'MG Road', 'Mumbai', 'Maharashtra', '400001', 'India'
    );
  }

  // ── Demo 3D Order ──
  if (db.prepare("SELECT COUNT(*) c FROM orders WHERE notes='demo_3d'").get().c === 0) {
    const customDesign = JSON.stringify({
      productType: 'hoodie', color: '#1a1a2e', colorName: 'Midnight Navy',
      text: 'ARUVA', textColor: '#87B9D4', font: 'Bebas Neue', size: 'L', qty: 2,
      designImage: svgImg,
      uploadedImage: uploadedImg,
      brushColors: ['#87B9D4', '#ffffff', '#e8c96e'],
      ideaText: 'Drop shoulders please, oversized fit. Logo should go on the left sleeve, not the chest.'
    });
    const orderId = db.prepare("INSERT INTO orders (user_id,order_number,subtotal,shipping,total,status,payment_method,notes) VALUES (?,?,?,?,?,?,?,?)").run(userId, 'ORD-DEMO-3D', 1999, 0, 1999, 'Processing', 'UPI', 'demo_3d').lastInsertRowid;
    db.prepare("INSERT INTO order_items (order_id,product_id,product_name,quantity,size,color,price,custom_design) VALUES (?,?,?,?,?,?,?,?)").run(orderId, null, 'Custom Hoodie — Midnight Navy', 1, 'L', '#1a1a2e', 1999, customDesign);
    console.log('✓ Demo 3D order seeded');
  }

}

// ── EXTEND SCHEMA (designs + is_admin) ─────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS designs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    DEFAULT 'My Design',
    product_type TEXT  DEFAULT 'hoodie',
    design_data  TEXT  NOT NULL DEFAULT '{}',
    thumbnail    TEXT  DEFAULT '',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
try { db.exec("ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''"); } catch {}

function ensureAdmin() {
  const email = 'admin@aruva.com';
  if (!db.prepare('SELECT id FROM users WHERE email=?').get(email)) {
    const hash = bcrypt.hashSync('Admin@123456', 10);
    try {
      db.prepare('INSERT INTO users (email,password,first_name,last_name,is_admin) VALUES (?,?,?,?,1)')
        .run(email, hash, 'ARUVA', 'Admin');
      console.log('  Admin created: admin@aruva.com / Admin@123456');
    } catch {}
  }
}
ensureAdmin();
seedDemo3DOrder();

// ── AUTH MIDDLEWARE ─────────────────────────────────────────────
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ── AUTH ROUTES ─────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { email, password, first_name = '', last_name = '' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO users (email,password,first_name,last_name) VALUES (?,?,?,?)').run(email.toLowerCase(), hash, first_name, last_name);
    const user = { id: r.lastInsertRowid, email: email.toLowerCase(), first_name, last_name };
    const token = jwt.sign({ id: user.id, email: user.email, is_admin: 0 }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch { res.status(409).json({ error: 'Email already registered' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get((email||'').toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  const { password: _, ...safe } = user;
  const token = jwt.sign({ id: user.id, email: user.email, is_admin: user.is_admin || 0 }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: safe });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,email,first_name,last_name,phone,created_at FROM users WHERE id=?').get(req.user.id);
  res.json(user || null);
});

// ── CATEGORIES ──────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY parent_id,sort_order').all());
});

// ── PRODUCTS ────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { cat, search, sort, min_price, max_price, is_on_sale, is_new, is_featured, is_customizable, limit = 12, offset = 0 } = req.query;
  const conds = ['1=1'], params = [];

  if (cat) {
    const c = db.prepare('SELECT id FROM categories WHERE slug=?').get(cat);
    if (c) {
      const kids = db.prepare('SELECT id FROM categories WHERE parent_id=?').all(c.id);
      const ids = [c.id, ...kids.map(k => k.id)];
      conds.push(`p.category_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }
  if (search)        { conds.push('p.name LIKE ?'); params.push(`%${search}%`); }
  if (min_price)     { conds.push('p.price >= ?');  params.push(+min_price); }
  if (max_price)     { conds.push('p.price <= ?');  params.push(+max_price); }
  if (is_on_sale==='1') conds.push('p.is_on_sale=1');
  if (is_new==='1')     conds.push('p.is_new=1');
  if (is_featured==='1')conds.push('p.is_featured=1');
  if (is_customizable==='1') conds.push('p.is_customizable=1');

  const ORDER = { price_asc:'p.price ASC', price_desc:'p.price DESC', rating:'p.rating DESC', newest:'p.id DESC', popular:'p.review_count DESC' };
  const order = ORDER[sort] || 'p.is_featured DESC, p.rating DESC';
  const w = conds.join(' AND ');

  const products = db.prepare(`SELECT p.*,c.name cat_name,c.slug cat_slug FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, +limit, +offset);
  const { total } = db.prepare(`SELECT COUNT(*) total FROM products p WHERE ${w}`).get(...params);
  res.json({ products, total, limit: +limit, offset: +offset });
});

app.get('/api/products/featured', (req, res) => {
  res.json(db.prepare('SELECT p.*,c.name cat_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_featured=1 ORDER BY p.rating DESC LIMIT 8').all());
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT p.*,c.name cat_name,c.slug cat_slug,cp.name parent_cat FROM products p LEFT JOIN categories c ON p.category_id=c.id LEFT JOIN categories cp ON c.parent_id=cp.id WHERE p.id=?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  p.reviews = db.prepare('SELECT r.*,u.first_name,u.last_name FROM reviews r JOIN users u ON r.user_id=u.id WHERE r.product_id=? ORDER BY r.created_at DESC LIMIT 20').all(p.id);
  p.related = db.prepare('SELECT p.*,c.name cat_name FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.id!=? ORDER BY p.rating DESC LIMIT 8').all(p.id);
  res.json(p);
});

// ── CART ────────────────────────────────────────────────────────
app.get('/api/cart', auth, (req, res) => {
  res.json(db.prepare('SELECT c.*,p.name,p.price,p.sale_price,p.is_on_sale,p.color FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?').all(req.user.id));
});

app.post('/api/cart', auth, (req, res) => {
  const { product_id, quantity = 1, size = 'M', color = '', custom_design = null } = req.body;
  const ex = db.prepare('SELECT id,quantity FROM cart WHERE user_id=? AND product_id=? AND size=? AND color=?').get(req.user.id, product_id, size, color);
  if (ex) db.prepare('UPDATE cart SET quantity=? WHERE id=?').run(ex.quantity + quantity, ex.id);
  else db.prepare('INSERT INTO cart (user_id,product_id,quantity,size,color,custom_design) VALUES (?,?,?,?,?,?)').run(req.user.id, product_id, quantity, size, color, custom_design);
  res.json(db.prepare('SELECT c.*,p.name,p.price,p.sale_price,p.is_on_sale,p.color FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?').all(req.user.id));
});

app.put('/api/cart/:id', auth, (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) db.prepare('DELETE FROM cart WHERE id=? AND user_id=?').run(+req.params.id, req.user.id);
  else db.prepare('UPDATE cart SET quantity=? WHERE id=? AND user_id=?').run(quantity, +req.params.id, req.user.id);
  res.json(db.prepare('SELECT c.*,p.name,p.price,p.sale_price,p.is_on_sale,p.color FROM cart c JOIN products p ON c.product_id=p.id WHERE c.user_id=?').all(req.user.id));
});

app.delete('/api/cart/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cart WHERE id=? AND user_id=?').run(+req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/cart', auth, (req, res) => {
  db.prepare('DELETE FROM cart WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

// ── WISHLIST ────────────────────────────────────────────────────
app.get('/api/wishlist', auth, (req, res) => {
  res.json(db.prepare('SELECT w.*,p.name,p.price,p.sale_price,p.is_on_sale,p.color,p.colors,p.sizes FROM wishlist w JOIN products p ON w.product_id=p.id WHERE w.user_id=?').all(req.user.id));
});

app.post('/api/wishlist', auth, (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO wishlist (user_id,product_id) VALUES (?,?)').run(req.user.id, req.body.product_id);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Failed' }); }
});

app.delete('/api/wishlist/:pid', auth, (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.user.id, +req.params.pid);
  res.json({ ok: true });
});

// ── ORDERS ──────────────────────────────────────────────────────
app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(orders.map(o => ({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id) })));
});

app.get('/api/orders/:id', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(+req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Not found' });
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  res.json(o);
});

app.post('/api/orders', auth, (req, res) => {
  const { items, shipping_address, payment_method = 'card', coupon_code, notes = '' } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });

  let subtotal = 0;
  const enriched = [];
  for (const item of items) {
    const p = db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
    if (!p) return res.status(400).json({ error: `Product ${item.product_id} not found` });
    const price = p.is_on_sale && p.sale_price ? p.sale_price : p.price;
    subtotal += price * item.quantity;
    enriched.push({ ...item, product_name: p.name, price });
  }

  let discount = 0;
  if (coupon_code) {
    const cp = db.prepare("SELECT * FROM coupons WHERE code=? AND (max_uses IS NULL OR used<max_uses)").get(coupon_code.toUpperCase());
    if (cp && subtotal >= cp.min_order) {
      discount = cp.type === 'percent' ? subtotal * cp.value / 100 : cp.value;
      discount = Math.min(discount, subtotal);
      db.prepare('UPDATE coupons SET used=used+1 WHERE id=?').run(cp.id);
    }
  }

  const shipping = subtotal - discount >= 1000 ? 0 : 99;
  const tax = Math.round((subtotal - discount) * 0.18 * 100) / 100;
  const total = subtotal - discount + shipping + tax;
  const orderNumber = 'ARV' + Date.now().toString().slice(-9);

  const r = db.prepare('INSERT INTO orders (user_id,order_number,subtotal,shipping,tax,discount,total,payment_method,shipping_address,notes) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.user.id, orderNumber, subtotal, shipping, tax, discount, total, payment_method, JSON.stringify(shipping_address || {}), notes);

  const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,size,color,price,custom_design) VALUES (?,?,?,?,?,?,?,?)');
  enriched.forEach(i => insItem.run(r.lastInsertRowid, i.product_id, i.product_name, i.quantity, i.size || 'M', i.color || '', i.price, i.custom_design || null));

  db.prepare('DELETE FROM cart WHERE user_id=?').run(req.user.id);

  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(r.lastInsertRowid);
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
  res.json(order);
});

// ── REVIEWS ─────────────────────────────────────────────────────
app.get('/api/products/:id/reviews', (req, res) => {
  res.json(db.prepare('SELECT r.*,u.first_name,u.last_name FROM reviews r JOIN users u ON r.user_id=u.id WHERE r.product_id=? ORDER BY r.created_at DESC').all(+req.params.id));
});

app.post('/api/products/:id/reviews', auth, (req, res) => {
  const { rating, title = '', body = '' } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 required' });
  try {
    db.prepare('INSERT OR REPLACE INTO reviews (product_id,user_id,rating,title,body) VALUES (?,?,?,?,?)').run(+req.params.id, req.user.id, rating, title, body);
    const { avg, cnt } = db.prepare('SELECT AVG(rating) avg,COUNT(*) cnt FROM reviews WHERE product_id=?').get(+req.params.id);
    db.prepare('UPDATE products SET rating=?,review_count=? WHERE id=?').run(Math.round(avg * 10) / 10, cnt, +req.params.id);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Could not submit' }); }
});

// ── USER ────────────────────────────────────────────────────────
app.put('/api/users/me', auth, (req, res) => {
  const { first_name = '', last_name = '', phone = '' } = req.body;
  db.prepare('UPDATE users SET first_name=?,last_name=?,phone=? WHERE id=?').run(first_name, last_name, phone, req.user.id);
  res.json(db.prepare('SELECT id,email,first_name,last_name,phone,created_at FROM users WHERE id=?').get(req.user.id));
});

app.put('/api/users/me/password', auth, (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password)) return res.status(400).json({ error: 'Current password is wrong' });
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'New password must be 8+ chars' });
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.json({ ok: true });
});

app.get('/api/users/me/addresses', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id ASC').all(req.user.id));
});

app.post('/api/users/me/addresses', auth, (req, res) => {
  const { label='Home', full_name='', phone='', line1='', line2='', city='', state='', pincode='', country='India', is_default=0 } = req.body;
  if (is_default) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  const r = db.prepare('INSERT INTO addresses (user_id,label,full_name,phone,line1,line2,city,state,pincode,country,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(req.user.id,label,full_name,phone,line1,line2,city,state,pincode,country,is_default?1:0);
  res.json(db.prepare('SELECT * FROM addresses WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/users/me/addresses/:id', auth, (req, res) => {
  const { label='Home', full_name='', phone='', line1='', line2='', city='', state='', pincode='', country='India', is_default=0 } = req.body;
  if (is_default) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  db.prepare('UPDATE addresses SET label=?,full_name=?,phone=?,line1=?,line2=?,city=?,state=?,pincode=?,country=?,is_default=? WHERE id=? AND user_id=?').run(label,full_name,phone,line1,line2,city,state,pincode,country,is_default?1:0,+req.params.id,req.user.id);
  res.json(db.prepare('SELECT * FROM addresses WHERE id=?').get(+req.params.id));
});

app.delete('/api/users/me/addresses/:id', auth, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(+req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── COUPONS ─────────────────────────────────────────────────────
app.post('/api/coupons/validate', (req, res) => {
  const { code, subtotal = 0 } = req.body;
  const cp = db.prepare('SELECT * FROM coupons WHERE code=?').get((code || '').toUpperCase());
  if (!cp) return res.status(404).json({ error: 'Coupon not found' });
  if (cp.max_uses && cp.used >= cp.max_uses) return res.status(400).json({ error: 'Coupon has been fully redeemed' });
  if (subtotal < cp.min_order) return res.status(400).json({ error: `Minimum order ₹${cp.min_order} required` });
  const discount = cp.type === 'percent' ? Math.round(subtotal * cp.value / 100) : cp.value;
  res.json({ valid: true, type: cp.type, value: cp.value, discount: Math.min(discount, subtotal) });
});

// ── SEARCH ──────────────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const { q = '' } = req.query;
  if (q.length < 2) return res.json([]);
  res.json(db.prepare('SELECT id,name,price,sale_price,is_on_sale,color FROM products WHERE name LIKE ? LIMIT 8').all(`%${q}%`));
});

// ── STATS ───────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({
    products: db.prepare('SELECT COUNT(*) c FROM products').get().c,
    users:    db.prepare('SELECT COUNT(*) c FROM users').get().c,
    orders:   db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    revenue:  db.prepare('SELECT COALESCE(SUM(total),0) r FROM orders').get().r,
  });
});

// ── DESIGNS ─────────────────────────────────────────────────────
app.get('/api/designs', auth, (req, res) => {
  res.json(db.prepare('SELECT id,name,product_type,thumbnail,created_at,updated_at FROM designs WHERE user_id=? ORDER BY updated_at DESC').all(req.user.id));
});

app.get('/api/designs/:id', auth, (req, res) => {
  const d = db.prepare('SELECT * FROM designs WHERE id=? AND user_id=?').get(+req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(d);
});

app.post('/api/designs', auth, (req, res) => {
  const { name = 'My Design', product_type = 'hoodie', design_data = {}, thumbnail = '' } = req.body;
  const r = db.prepare('INSERT INTO designs (user_id,name,product_type,design_data,thumbnail) VALUES (?,?,?,?,?)').run(req.user.id, name, product_type, JSON.stringify(design_data), thumbnail);
  res.json(db.prepare('SELECT * FROM designs WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/designs/:id', auth, (req, res) => {
  const d = db.prepare('SELECT id FROM designs WHERE id=? AND user_id=?').get(+req.params.id, req.user.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  const { name, design_data, thumbnail } = req.body;
  db.prepare("UPDATE designs SET name=COALESCE(?,name), design_data=COALESCE(?,design_data), thumbnail=COALESCE(?,thumbnail), updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(name || null, design_data ? JSON.stringify(design_data) : null, thumbnail || null, +req.params.id);
  res.json(db.prepare('SELECT * FROM designs WHERE id=?').get(+req.params.id));
});

app.delete('/api/designs/:id', auth, (req, res) => {
  db.prepare('DELETE FROM designs WHERE id=? AND user_id=?').run(+req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── ADMIN ────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Auth required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json({
    total_revenue:  db.prepare('SELECT COALESCE(SUM(total),0) v FROM orders').get().v,
    total_orders:   db.prepare('SELECT COUNT(*) v FROM orders').get().v,
    total_users:    db.prepare('SELECT COUNT(*) v FROM users WHERE is_admin=0').get().v,
    total_products: db.prepare('SELECT COUNT(*) v FROM products').get().v,
    today_orders:   db.prepare("SELECT COUNT(*) v FROM orders WHERE date(created_at)=?").get(today).v,
    today_revenue:  db.prepare("SELECT COALESCE(SUM(total),0) v FROM orders WHERE date(created_at)=?").get(today).v,
    pending_orders: db.prepare("SELECT COUNT(*) v FROM orders WHERE status='Confirmed'").get().v,
    total_designs:  db.prepare('SELECT COUNT(*) v FROM designs').get().v,
  });
});

app.get('/api/admin/orders', adminAuth, (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let q = 'SELECT o.*,u.email,u.first_name,u.last_name,u.phone FROM orders o JOIN users u ON o.user_id=u.id';
  const params = [];
  if (status) { q += ' WHERE o.status=?'; params.push(status); }
  q += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(+limit, +offset);
  const orders = db.prepare(q).all(...params);
  const total = status
    ? db.prepare('SELECT COUNT(*) c FROM orders WHERE status=?').get(status).c
    : db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  orders.forEach(o => {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
    // Attach saved address for this user (default first)
    const addr = db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id ASC LIMIT 1').get(o.user_id);
    o.address = addr || null;
    try { o.shipping_address = JSON.parse(o.shipping_address || '{}'); } catch { o.shipping_address = {}; }
  });
  res.json({ orders, total });
});

app.put('/api/admin/orders/:id', adminAuth, (req, res) => {
  const { status, tracking_number } = req.body;
  db.prepare('UPDATE orders SET status=COALESCE(?,status), tracking_number=COALESCE(?,tracking_number) WHERE id=?')
    .run(status || null, tracking_number || null, +req.params.id);
  res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(+req.params.id));
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(db.prepare(`SELECT u.id,u.email,u.first_name,u.last_name,u.phone,u.created_at,u.is_admin,
    COUNT(DISTINCT o.id) order_count, COALESCE(SUM(o.total),0) total_spent
    FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`).all());
});

app.get('/api/admin/products', adminAuth, (req, res) => {
  res.json(db.prepare('SELECT p.*,c.name cat_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.id DESC').all());
});

app.post('/api/admin/products', adminAuth, (req, res) => {
  const { name, description='', category_id, price, sale_price=null, is_on_sale=0, is_customizable=0, is_new=0, is_featured=0, stock=100, color='#1a1a1a', colors='["#1a1a1a"]', sizes='["S","M","L","XL"]', material='', care='', image='' } = req.body;
  if (!name || !price || !category_id) return res.status(400).json({ error: 'name, price, category_id required' });
  const r = db.prepare('INSERT INTO products (name,description,category_id,price,sale_price,is_on_sale,is_customizable,is_new,is_featured,stock,color,colors,sizes,material,care,image) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(name,description,+category_id,+price,sale_price?+sale_price:null,is_on_sale?1:0,is_customizable?1:0,is_new?1:0,is_featured?1:0,+stock,color,colors,sizes,material,care,image);
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/admin/products/:id', adminAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const f = { ...p, ...req.body };
  db.prepare('UPDATE products SET name=?,description=?,price=?,sale_price=?,is_on_sale=?,is_new=?,is_featured=?,stock=?,color=?,material=?,care=?,image=? WHERE id=?')
    .run(f.name,f.description,+f.price,f.sale_price?+f.sale_price:null,f.is_on_sale?1:0,f.is_new?1:0,f.is_featured?1:0,+f.stock,f.color,f.material,f.care,f.image||'',+req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id=?').get(+req.params.id));
});

app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});


// ── RAZORPAY PAYMENT ────────────────────────────────────────────

// Step 1: Frontend calls this to create a Razorpay order
app.post('/api/payment/create-order', auth, async (req, res) => {
  try {
    const { amount } = req.body; // amount in rupees
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });
    const options = {
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: 'aruva_' + Date.now(),
    };
    const order = await razorpay.orders.create(options);
    res.json({ razorpay_order_id: order.id, amount: order.amount, currency: order.currency, key_id: RAZORPAY_KEY_ID });
  } catch (e) {
    console.error('Razorpay create-order error:', e);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// Step 2: Frontend calls this after payment to verify signature & save order
app.post('/api/payment/verify', auth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_data } = req.body;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expectedSig !== razorpay_signature) return res.status(400).json({ error: 'Payment verification failed' });

    // Save order to DB
    const { items, address_id, payment_method, coupon_code, subtotal, discount, shipping, tax, total } = order_data;
    const addr = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(address_id, req.user.id);
    const orderNumber = 'ARV' + Date.now().toString().slice(-9);
    const r = db.prepare('INSERT INTO orders (user_id,order_number,subtotal,shipping,tax,discount,total,payment_method,shipping_address,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(req.user.id, orderNumber, subtotal, shipping, tax, discount, total, payment_method, JSON.stringify(addr || {}), 'razorpay:' + razorpay_payment_id);

    if (items?.length) {
      const insItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,size,color,price,custom_design) VALUES (?,?,?,?,?,?,?,?)');
      items.forEach(i => insItem.run(r.lastInsertRowid, i.product_id, i.product_name, i.quantity, i.size||'M', i.color||'', i.price, i.custom_design||null));
    }
    db.prepare('DELETE FROM cart WHERE user_id=?').run(req.user.id);

    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(r.lastInsertRowid);
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
    res.json({ ok: true, order });
  } catch (e) {
    console.error('Razorpay verify error:', e);
    res.status(500).json({ error: 'Could not save order' });
  }
});

// ── DEBUG ─────────────────────────────────────────────────────────
app.get('/debug-ua', (req, res) => {
  const ua = req.headers['user-agent'] || 'none';
  res.json({ ua, isMobile: isMobile(req) });
});

// ── FALLBACK ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/login.html'));

// ── START ───────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
    }
  }
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║         ARUVA Fashion Platform               ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Local   → http://localhost:${PORT}            ║`);
  console.log(`║  Mobile  → http://${localIP}:${PORT}/home.html  ║`);
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log('  Sample coupons: WELCOME15, FIRST20, ARUVA10, FLAT200\n');
});
