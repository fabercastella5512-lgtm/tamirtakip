const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// DB setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'tamir.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kayitlar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    ariza TEXT NOT NULL,
    maliyet INTEGER DEFAULT 0,
    maliyet_doviz TEXT DEFAULT 'TRY',
    maliyet_try INTEGER DEFAULT 0,
    iscilik INTEGER DEFAULT 0,
    satis INTEGER DEFAULT 0,
    tedarik TEXT DEFAULT '',
    durum TEXT DEFAULT 'bekliyor',
    odeme TEXT DEFAULT 'odenmedi',
    not_text TEXT DEFAULT '',
    tarih TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tedarikler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT UNIQUE NOT NULL
  );
`);

// Seed default tedarikler
const tedarikCheck = db.prepare('SELECT COUNT(*) as c FROM tedarikler').get();
if (tedarikCheck.c === 0) {
  db.prepare('INSERT OR IGNORE INTO tedarikler (ad) VALUES (?)').run('biba');
  db.prepare('INSERT OR IGNORE INTO tedarikler (ad) VALUES (?)').run('deji');
}

// Seed default admin user if no users exist
const userCheck = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCheck.c === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
  console.log('Varsayılan kullanıcı oluşturuldu: admin / admin123');
  console.log('Lütfen giriş yaptıktan sonra şifrenizi değiştirin!');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const SQLiteStore = require('connect-sqlite3')(session);
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
  secret: process.env.SESSION_SECRET || 'tamir-gizli-anahtar-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 gün
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Giriş gerekli' });
  res.redirect('/login.html');
}

// ——— AUTH ROUTES ———
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.json({ ok: false, error: 'Kullanıcı adı veya şifre hatalı' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username });
});

app.post('/api/sifre-degistir', requireAuth, (req, res) => {
  const { eskiSifre, yeniSifre } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(eskiSifre, user.password)) {
    return res.json({ ok: false, error: 'Mevcut şifre hatalı' });
  }
  if (yeniSifre.length < 4) return res.json({ ok: false, error: 'Şifre en az 4 karakter olmalı' });
  const hash = bcrypt.hashSync(yeniSifre, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.session.userId);
  res.json({ ok: true });
});

app.post('/api/kullanici-ekle', requireAuth, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) return res.json({ ok: false, error: 'Geçersiz bilgi' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hash);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: 'Bu kullanıcı adı zaten var' });
  }
});

app.get('/api/kullanicilar', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, username, created_at FROM users').all();
  res.json(users);
});

app.delete('/api/kullanici/:id', requireAuth, (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) return res.json({ ok: false, error: 'Kendinizi silemezsiniz' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ——— KAYIT ROUTES ———
app.get('/api/kayitlar', requireAuth, (req, res) => {
  const { durum, odeme, arama, baslangic, bitis } = req.query;
  let sql = 'SELECT * FROM kayitlar WHERE 1=1';
  const params = [];
  if (durum && durum !== 'hepsi') { sql += ' AND durum = ?'; params.push(durum); }
  if (odeme === 'odenmedi') { sql += ' AND odeme = ?'; params.push('odenmedi'); }
  if (arama) { sql += ' AND (model LIKE ? OR ariza LIKE ? OR tedarik LIKE ? OR not_text LIKE ?)'; const s = `%${arama}%`; params.push(s,s,s,s); }
  if (baslangic) { sql += ' AND tarih >= ?'; params.push(baslangic); }
  if (bitis) { sql += ' AND tarih <= ?'; params.push(bitis); }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

function hesaplaMaliyetTRY(maliyet, maliyet_doviz, maliyet_try) {
  const m = parseFloat(maliyet) || 0;
  const mt = parseFloat(maliyet_try) || 0;
  // TRY seçilmişse direkt maliyeti kullan
  if (!maliyet_doviz || maliyet_doviz === 'TRY') return Math.round(m);
  // Döviz seçilmişse: maliyet_try frontend'den geldiyse ve sıfırdan büyükse kullan
  if (mt > 0) return Math.round(mt);
  // maliyet_try gelmemişse maliyet'i olduğu gibi kullan (kur bilinmiyor)
  return Math.round(m);
}

app.post('/api/kayitlar', requireAuth, (req, res) => {
  const { model, ariza, maliyet, maliyet_doviz, maliyet_try, iscilik, satis, tedarik, durum, odeme, not_text, tarih } = req.body;
  if (!model || !ariza) return res.status(400).json({ error: 'Model ve arıza zorunlu' });
  const maliyetTRY = hesaplaMaliyetTRY(maliyet, maliyet_doviz, maliyet_try);
  const stmt = db.prepare(`INSERT INTO kayitlar (model,ariza,maliyet,maliyet_doviz,maliyet_try,iscilik,satis,tedarik,durum,odeme,not_text,tarih,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const info = stmt.run(model, ariza, parseFloat(maliyet)||0, maliyet_doviz||'TRY', maliyetTRY, parseFloat(iscilik)||0, parseFloat(satis)||0, tedarik||'', durum||'bekliyor', odeme||'odenmedi', not_text||'', tarih, req.session.userId);
  res.json(db.prepare('SELECT * FROM kayitlar WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/kayitlar/:id', requireAuth, (req, res) => {
  const { model, ariza, maliyet, maliyet_doviz, maliyet_try, iscilik, satis, tedarik, durum, odeme, not_text } = req.body;
  const maliyetTRY = hesaplaMaliyetTRY(maliyet, maliyet_doviz, maliyet_try);
  db.prepare(`UPDATE kayitlar SET model=?,ariza=?,maliyet=?,maliyet_doviz=?,maliyet_try=?,iscilik=?,satis=?,tedarik=?,durum=?,odeme=?,not_text=?,updated_at=datetime('now') WHERE id=?`)
    .run(model, ariza, parseFloat(maliyet)||0, maliyet_doviz||'TRY', maliyetTRY, parseFloat(iscilik)||0, parseFloat(satis)||0, tedarik||'', durum||'bekliyor', odeme||'odenmedi', not_text||'', req.params.id);
  res.json(db.prepare('SELECT * FROM kayitlar WHERE id = ?').get(req.params.id));
});

app.delete('/api/kayitlar/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM kayitlar WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ——— TEDARIK ROUTES ———
app.get('/api/tedarikler', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM tedarikler ORDER BY ad').all());
});

app.post('/api/tedarikler', requireAuth, (req, res) => {
  const { ad } = req.body;
  if (!ad) return res.status(400).json({ error: 'Ad zorunlu' });
  try {
    const info = db.prepare('INSERT INTO tedarikler (ad) VALUES (?)').run(ad.toLowerCase().trim());
    res.json({ id: info.lastInsertRowid, ad: ad.toLowerCase().trim() });
  } catch { res.status(400).json({ error: 'Bu tedarikçi zaten var' }); }
});

app.delete('/api/tedarikler/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM tedarikler WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ——— RAPOR ROUTES ———
app.get('/api/rapor/aylik', requireAuth, (req, res) => {
  const yil = req.query.yil || new Date().getFullYear();
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', tarih) as ay,
      COUNT(*) as sayi,
      SUM(satis) as toplam_satis,
      SUM(maliyet_try + iscilik) as toplam_maliyet,
      SUM(satis - maliyet_try - iscilik) as kar
    FROM kayitlar WHERE strftime('%Y', tarih) = ?
    GROUP BY ay ORDER BY ay DESC
  `).all(String(yil));
  res.json(rows);
});

app.get('/api/rapor/gunluk', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT tarih,
      COUNT(*) as sayi,
      SUM(satis) as toplam_satis,
      SUM(maliyet_try + iscilik) as toplam_maliyet,
      SUM(satis - maliyet_try - iscilik) as kar
    FROM kayitlar
    WHERE tarih >= date('now', '-30 days')
    GROUP BY tarih ORDER BY tarih DESC
  `).all();
  res.json(rows);
});

app.get('/api/rapor/ozet', requireAuth, (req, res) => {
  const bugun = new Date().toISOString().split('T')[0];
  const buAy = bugun.slice(0, 7);
  const genel = db.prepare('SELECT COUNT(*) as toplam, SUM(satis) as satis, SUM(satis-maliyet_try-iscilik) as kar FROM kayitlar').get();
  const aylik = db.prepare("SELECT COUNT(*) as toplam, SUM(satis) as satis, SUM(satis-maliyet_try-iscilik) as kar FROM kayitlar WHERE strftime('%Y-%m',tarih)=?").get(buAy);
  const gunluk = db.prepare("SELECT COUNT(*) as toplam, SUM(satis) as satis, SUM(satis-maliyet_try-iscilik) as kar FROM kayitlar WHERE tarih=?").get(bugun);
  const bekliyor = db.prepare("SELECT COUNT(*) as c FROM kayitlar WHERE durum='bekliyor'").get().c;
  const odenmedi = db.prepare("SELECT COUNT(*) as c FROM kayitlar WHERE odeme='odenmedi'").get().c;
  res.json({ genel, aylik, gunluk, bekliyor, odenmedi });
});

// Redirect root to login if not auth
app.get('/', (req, res) => {
  if (req.session && req.session.userId) res.redirect('/app.html');
  else res.redirect('/login.html');
});

// Mevcut bozuk kayıtları düzelt: doviz=TRY ama maliyet_try=0 olanlar
const bozukKayitlar = db.prepare("SELECT id, maliyet FROM kayitlar WHERE (maliyet_doviz='TRY' OR maliyet_doviz IS NULL OR maliyet_doviz='') AND (maliyet_try=0 OR maliyet_try IS NULL) AND maliyet > 0").all();
if (bozukKayitlar.length > 0) {
  const fixStmt = db.prepare("UPDATE kayitlar SET maliyet_try=? WHERE id=?");
  bozukKayitlar.forEach(k => fixStmt.run(k.maliyet, k.id));
  console.log(`${bozukKayitlar.length} kayıt düzeltildi (maliyet_try güncellendi).`);
}

app.listen(PORT, () => {
  console.log(`Tamir Dükkanı çalışıyor: http://localhost:${PORT}`);
});
