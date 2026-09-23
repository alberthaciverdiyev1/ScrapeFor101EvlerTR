# HomeScraper (101evler.com ➔ Metraj Veri Köprüsü)

Kuzey Kıbrıs Türk Cumhuriyeti (KKTC) emlak platformu **101evler.com** üzerindeki satılık ve kiralık gayrimenkul ilanlarını toplayan, yerel staging havuzunda (SQLite) depolayan ve tek tıkla doğrudan **Metraj** platformunun PostgreSQL veritabanına aktaran hafif, hızlı ve modern kazıyıcı (scraper) sistemi.

---

## 🌟 Temel Yetenekler & Yenilikler

### 1. 🏢 Otomatik Acente (Agency) ve Danışman (Agent) Yönetimi
- **Otomatik Hesap Açma:** İlanı veren bir emlak ofisi veya bağımsız gayrimenkul danışmanı ise, sistem Metraj üzerinde otomatik olarak:
  - Ofis için `users` (sahip hesabı) ve `agencies` (doğrulanmış ve aktif ofis kartı, logo, adres, telefon),
  - Danışman için `users` (danışman kullanıcı hesabı) ve `agents` (pozisyon, profil fotoğrafı, WhatsApp, telefon) kayıtlarını oluşturur.
- **Tekilleştirme & İdempotency:** Daha önce oluşturulmuş bir acente veya danışmana ait yeni bir ilan geldiğinde mükerrer kayıt açılmaz; var olan profil tespit edilerek ilan doğrudan ilgili acente ve danışmana (`agency_id`, `agent_id`, `user_id`, `seller_type = 'agency'`) atanır.
- **Sahibinden Tespiti:** Sahibinden verilen ilanlar tespit edilerek `seller_type = 'owner'` olarak güvenle ayrıştırılır.

### 2. 🖼️ Filigransız (Watermark-Free) Fotoğraf İndirme & Yerel Depolama
- **Filigran Temizleme:** 101evler üzerindeki `/property_wm/` filigranlı resim URL'leri otomatik olarak orijinal filigransız `/property_thumb/` kaynaklarına çevrilir.
- **Doğrudan Metraj Depolaması:** Fotoğraflar doğrudan Metraj'ın yerel disk alanına (`../Metraj/storage/app/public/properties/{id}/photo_{n}.jpg`) indirilir.
- **Hızlı İndirme:** Node.js IPv4 öncelikli DNS çözümleyicisi (`dns.setDefaultResultOrder('ipv4first')`) ile bekleme olmaksızın yüksek hızlı indirme sağlanır.

### 3. 📝 Zengin HTML Açıklama Ayrıştırıcı (`cleanRichDescription`)
- İlan sahiplerinin girdiği zengin açıklamalar tek satıra sıkıştırılmadan; paragraflar (`<p>`), satır sonları (`<br>`), madde işaretleri (`*`, `•`, `-` ➔ `<ul><li>`), ve kalın yazılar (`<strong>`) temiz semantik HTML olarak korunur. Metraj detay sayfasındaki `{!! $item->description !!}` prose render motoruyla tam uyumlu çalışır.

### 4. 🌐 Cloudflare Korumasını Aşma
- 101evler'in Cloudflare WAF koruması, `scripts/fetcher.py` Python motoru üzerinden hafif ve engelsiz şekilde HTTP 200 ile aşılır.

### 5. 📍 KKTC Pazarına Özel Eşleme & Çoklu Para Birimi
- **Koçan Türleri:** Türk Malı, Eşdeğer, Tahsis, İngiliz/Yabancı
- **Eşya & Site:** Ful Eşyalı, Eşyasız, Kısmi Eşyalı; Site İçerisinde (Evet/Hayır)
- **Şehir & Bölge:** Girne, Lefkoşa, Gazimağusa, İskele, Güzelyurt, Lefke ve 40+ alt bölge (Alsancak, Lapta, Gönyeli, Boğaz vb.) Metraj `cities` ve `districts` tablolarıyla slug tabanlı eşleştirilir.
- **Çoklu Para Birimi:** GBP, TRY, USD ve EUR fiyatları hesaplanarak Metraj JSON formatında saklanır.

### 6. 📊 Staging SQLite & Canlı SSE Web Dashboard
- Çekilen ilanlar önce `data/staging.db` yerel veritabanında saklanır.
- Server-Sent Events (SSE) ile anlık canlı konsol çıktıları ve ilerleme çubuğu takip edilebilir.

---

## 🚀 Kurulum ve Çalıştırma

### 1. Bağımlılıkları Kurun
```bash
npm install
```

### 2. Ortam Değişkenleri (.env)
Proje kökünde `.env` dosyası oluşturabilirsiniz (varsayılan olarak üst klasördeki `../Metraj/.env` dosyasını otomatik okur):
```env
PORT=3001
METRAJ_DB_HOST=127.0.0.1
METRAJ_DB_PORT=5432
METRAJ_DB_NAME=metraj
METRAJ_DB_USER=admin
METRAJ_DB_PASSWORD=secret
```

### 3. Geliştirme Modunda Başlatın
```bash
npm run dev
```

### 4. Üretim (Build & Start)
```bash
npm run build
npm start
```

Web Arayüzüne erişmek için tarayıcınızda açın:
👉 **http://localhost:3001**

---

## 📂 Proje Yapısı

```text
HomeScraper/
├── scripts/
│   └── fetcher.py         # Cloudflare bypass uyumlu hafif HTTP getirici
├── src/
│   ├── config/            # Yapılandırma ve .env okuyucu
│   ├── database/
│   │   ├── staging.ts     # SQLite yerel veritabanı (better-sqlite3)
│   │   └── metraj-sync.ts # Metraj PostgreSQL acente, danışman, ilan & resim senkronizasyonu
│   ├── scraper/
│   │   ├── crawler.ts     # Sayfalama ve iş kuyruğu motoru
│   │   ├── parser.ts      # Danışman kartı, zengin metin ve JSON-LD ayrıştırıcısı
│   │   └── mapper.ts      # 101evler verisini Metraj formatına dönüştürücü
│   ├── public/
│   │   └── index.html     # Tailwind CSS + Alpine.js Web Dashboard
│   ├── server.ts          # Express REST API ve SSE canlı akış sunucusu
│   └── types.ts           # Tip tanımları ve interfeysler
├── data/                  # Yerel SQLite veritabanı (staging.db - gitignore içinde)
├── AGENTS.md              # AI geliştirici rehberi ve kuralları
├── CLAUDE.md              # Claude Code geliştirici rehberi
├── .geminiignore          # Gemini CLI / AI ignore kuralları
├── .claudeignore          # Claude Code ignore kuralları
├── .cursorignore          # Cursor IDE AI ignore kuralları
├── .gitignore             # Git versiyon kontrolü ignore kuralları
├── tsconfig.json
└── package.json
```

---

## 🔗 REST API Endpoint'leri

| Metot | Endpoint | Açıklama |
|---|---|---|
| `GET` | `/api/categories` | Kategori ve şehir listesi |
| `GET` | `/api/stats` | Toplam, aktarılan, bekleyen istatistikleri |
| `GET` | `/api/properties` | Filtrelenebilir çekilmiş ilanlar listesi |
| `GET` | `/api/properties/:code` | İlanın tüm detay ve JSON verisi |
| `POST` | `/api/crawl/start` | Yeni tarama görevi başlatır |
| `POST` | `/api/crawl/stop` | Aktif taramayı durdurur |
| `GET` | `/api/crawl/stream` | Server-Sent Events (SSE) canlı log akışı |
| `POST` | `/api/sync/:code` | Belirli bir ilanı (ve varsa acente/danışmanını) Metraj'a aktarır |
| `POST` | `/api/sync-all` | Bekleyen tüm ilanları Metraj'a aktarır |
