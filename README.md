# 🔧 Tamir Dükkanı — Kurulum Rehberi

## Varsayılan Giriş Bilgileri
- **Kullanıcı adı:** admin
- **Şifre:** admin123
- ⚠️ Giriş yaptıktan sonra Ayarlar > Şifre Değiştir bölümünden şifrenizi değiştirin!

---

## Bilgisayarınızda Çalıştırma (Test için)

1. [Node.js](https://nodejs.org) indirin ve kurun (LTS sürümü)
2. Bu klasörü bir yere çıkarın
3. Klasörü açın, adres çubuğuna `cmd` yazın
4. Şu komutları sırayla yazın:
   ```
   npm install
   node server.js
   ```
5. Tarayıcıda açın: `http://localhost:3000`

---

## İnternetten Her Yerden Erişim — Railway.app (ÜCRETSİZ)

### Adım 1 — GitHub'a Yükle
1. [github.com](https://github.com) adresine gidin, hesap açın (ücretsiz)
2. Sağ üstten **+** > **New repository** tıklayın
3. Repository adı: `tamir-dukkan` → **Create repository**
4. Açılan sayfada "uploading an existing file" linkine tıklayın
5. Bu klasördeki TÜM dosyaları sürükleyip bırakın
6. **Commit changes** butonuna tıklayın

### Adım 2 — Railway'e Deploy Et
1. [railway.app](https://railway.app) adresine gidin
2. **Start a New Project** > **Deploy from GitHub repo** tıklayın
3. GitHub hesabınızı bağlayın
4. `tamir-dukkan` reposunu seçin
5. Railway otomatik kurulum yapacak (2-3 dakika)
6. **Settings** > **Networking** > **Generate Domain** tıklayın
7. Size `https://tamir-dukkan-xxxx.railway.app` gibi bir adres verilecek

### Adım 3 — Şifreyi Değiştirin
1. Verilen adrese gidin
2. Kullanıcı adı: `admin`, Şifre: `admin123` ile giriş yapın
3. **Ayarlar** > **Şifre Değiştir** bölümünden yeni şifre belirleyin

---

## Çalışan Ekleme (2-3 Kişi)
- Ayarlar > Kullanıcılar > Yeni Kullanıcı Ekle
- Her çalışan kendi kullanıcı adı ve şifresiyle giriş yapar

---

## Özellikler
- ✅ Kullanıcı adı / şifre koruması
- ✅ SQLite veritabanı (veriler kaybolmaz)
- ✅ Dolar ($), Euro (€), Sterlin (£) parça maliyeti
- ✅ Anlık döviz kuru
- ✅ Günlük / aylık kazanç raporu
- ✅ Tedarikçi takibi (biba, deji vb.)
- ✅ Ödendi / Ödenmedi takibi
- ✅ Tarih bazlı filtreleme
- ✅ CSV dışa aktarma
- ✅ Çoklu kullanıcı desteği
