# Foça Kantin Başkanlığı — Mobil Fiyat Araştırma

Ürün adı yaz (+ opsiyonel barkod) → Tavily Search + Market Fiyatı resmi verisiyle
Türkiye'deki güncel fiyatları karşılaştır. Mobil uyumlu, tek sayfa.

## Çalıştır (telefonda / bilgisayarda)

1. Bu klasörde basit sunucu başlat:
   ```powershell
   npx serve .
   ```
2. Tarayıcıda aç: `http://localhost:3000`
3. Telefonda açmak için: bilgisayar + telefon aynı Wi-Fi'da → `http://BILGISAYAR-IP:3000`

## GitHub Pages yayını

Deponun köküne şu dosyaları yükle: `index.html`, `app.js`, `style.css`,
`banner.jpg` (bu dosya opsiyonel). Settings → Pages → Deploy from a branch → `main` / root.

## Nasıl çalışır?

- **Tavily Search** (`POST https://api.tavily.com/search`, `Authorization: Bearer ANAHTAR`):
  3 paralel arama — zincir marketler, e-ticaret + karşılaştırma siteleri, tüm web.
  `country: turkey`, sosyal siteler `exclude_domains` ile dışlanır.
  Sonuçlar süzülür: yabancı site yok, `/marka/` liste sayfası yok,
  ürün adıyla eşleşmeyen yok.
  Sabit sıralama: marketfiyatı → marketkarşılaştır → migros → carrefoursa →
  şok → bim → a101 → diğerleri (tik açık/kapalı fark etmez).
- **Market Fiyatı resmi API'si** (`https://api.marketfiyati.org.tr/api/v2`,
  anahtarsız): Foça konumu için yakın marketler (`nearest`) + ürün adı
  (`search`) veya barkod (`searchByIdentity`) ile gerçek fiyatlar.
  Ürün adının TÜM kelimeleri eşleşmek zorunda (birebir).
  🏛️ rozetli altın kartlar. Detaylı Arama tiki işaretliyse daha çok
  resmi sonuç çekilir (30 yerine 20).
- Fiyat, başlık + açıklama metnindeki TL bilgisinden yakalanır.

## Çoklu anahtar (karışık kullanım)

- `app.js` içindeki `DEFAULT_TAVILY_KEYS` dizisine satır ekle, veya ⚙️ menüsüne
  her satıra bir anahtar yapıştır.
- Site her API isteğinde **rastgele bir anahtarı** kullanır (karışık).
- Kotası biten / hatalı anahtar (401/403/429) otomatik atlanıp **sıradaki anahtar** denenir.
- ⚙️'den elle kaydedilen anahtarlar gömülü listenin yerine geçer;
  gömülü listeye dönmek için **Sıfırla** kullanılır.

## Özellikler

- Ürün adı + opsiyonel barkod (Ara'ya basmadan arama yok)
- 📷 kamerayla barkod okuma (BarcodeDetector destekleyen tarayıcılarda)
- Dark tema (varsayılan) + ☀️/🌙 geçişi, seçim hatırlanır
- Son aramalar + 🗑 geçmişi sil
- 2 sütun kompakt sonuç kartları

## Dosyalar

- `index.html` — mobil arayüz (Türkçe)
- `style.css` — mobil-first tasarım + dark tema
- `app.js` — Tavily + Market Fiyatı çağrıları, filtreler, sıralama
- `banner.jpg` — üst banner görseli
