# AGENTS.md - HomeScraper Developer & Agent Instructions

This document provides instructions, conventions, and architectural context for AI coding assistants working on the `HomeScraper` codebase.

---

## 1. Project Overview & Role

`HomeScraper` is a dedicated Node.js/TypeScript scraper and data synchronization service for **101evler.com**, built specifically to integrate with the **Metraj (KibrisKare)** real estate platform located at `../Metraj/`.

- **Primary Source:** `https://www.101evler.com/` (North Cyprus real estate portal).
- **Target Platform:** `../Metraj/` (Laravel 11+ application with PostgreSQL).
- **Staging Database:** SQLite via `better-sqlite3` located in `data/staging.db`.
- **Target Database:** PostgreSQL (`metraj`), directly updating `properties`, `property_images`, `cities`, `districts`, `property_filter_options`, `agencies`, `agents`, and `users`.

---

## 2. Key Architectural Components

### 2.1. Network & Fetching (`scripts/fetcher.py` & `src/scraper/crawler.ts`)
- **Cloudflare Behavior:** 101evler.com uses Cloudflare WAF. Standard Node `fetch` (undici) HTTP/2 fingerprint triggers a `403 Challenge`.
- `scripts/fetcher.py` uses standard Python `urllib.request` with browser `User-Agent` which passes Cloudflare with `200 OK` reliably without needing proxies or browser automation.
- `Crawler.fetchHtml` calls `scripts/fetcher.py` asynchronously via `execFile` with maxBuffer set to 15MB.

### 2.2. Parsing (`src/scraper/parser.ts`)
- **Listing URLs:** Listing pages contain `<script type="application/ld+json">` with `@type: ItemList` providing all listing detail URLs.
- **Detail Specs:** Detail pages contain `<script type="application/ld+json">` with `@type: RealEstateListing`.
- HTML key-value pairs are extracted from `.col-5` and `.col-7` elements in the specs table.
- **Area Parsing:** Always use `specs['Metrekare'].replace(/m2|m²/gi, '').trim().match(/^([0-9]+(?:[\.,][0-9]+)?)/)` to parse area to prevent digit concatenation (e.g. `170 m2` becoming `1702`).
- **Rich Description (`cleanRichDescription`):** Extracted from `.f-s-16` / `.div-block-361` container. Preserves block tags (`<p>`, `<div>`, `<br>`), converts bullet markers (`*`, `•`, `-`) to semantic `<ul><li>`, preserves `<strong>`/`<b>`, and outputs clean HTML for Metraj's `{!! $item->description !!}` prose renderer instead of collapsing whitespace into a single unreadable line.
- **Agency & Agent Extraction:**
  - Danışman Kart (`.danismankartilandevfoto`, `.danismankartilan`) elements are extracted.
  - Agency Name: `.text-block-157` or JSON-LD `seller.name`.
  - Agent Name: `.text-block-156` (verified distinct from the agency name).
  - Phones: Agent direct `tel:` link, agency phone from JSON-LD `seller.telephone`.
  - WhatsApp: Extracted from `wa.me/` links.
  - Photos: Agent avatar from `img[src*="agent-profile"]` and agency logo from `.div-block-382 img` / JSON-LD `seller.logo`.
  - Owner Listings: Detected if marked as "Sahibinden" or no agency/agent card is present.

### 2.3. Automated Title & Slug Generation (`src/scraper/title-builder.ts`)
- **Title Format:** Listing titles are generated matching Metraj's `PropertyTitleBuilder` service exactly:
  `[İşlem Türü], [Oda Sayısı / Alan / Emlak Türü], [Konum]`
  - **İşlem Türü:** `Satılık` (tr) / `Satılır` (az) / `For Sale` (en) / `Продажа` (ru) or `Kiralık` / `Kirayə` / `For Rent` / `Аренда`.
  - **Oda / Alan:** `3+1`, `2+1`, `1+0`, `Stüdyo` or land area `2 dönüm` / `2 sot` / `2 сот.`, or `120 m²`.
  - **Konum:** Automatically mapped to all 58 Metraj districts & 6 cities. Multilingual localized location label (e.g. `Alsancak, Girne` in TR/AZ, `Alsancak, Kyrenia` in EN, `Алсанджак, Гирне (Кирения)` in RU; or `Girne Merkez` without duplicate city name).
- **Slug Generation:** `buildPropertySlug` generates SEO-friendly slugs: `[slugified-title]-[code]` (e.g. `satilik-3-1-alsancak-girne-551968`).

### 2.4. Data Mapping (`src/scraper/mapper.ts`)
- **Turkish Transliteration:** `slugify` must be used for Turkish characters (`İ` -> `i`, `ı` -> `i`, `ş` -> `s`, `ğ` -> `g`, `ö` -> `o`, `ç` -> `c`) when matching cities and districts with Metraj IDs.
- **Seller Type:** Metraj's `SellerType` enum only allows `'owner'`, `'agency'`, `'complex'`. Set to `'agency'` if an agency or agent is found, otherwise `'owner'`. (Never use `'agent'` as seller_type).
- **Moderation Safety:** Properties must be mapped with `status: 'pending_approval'` by default.
- **Multi-Currency:** JSON prices (`GBP`, `TRY`, `USD`, `EUR`) are computed based on the primary currency and stored in `prices`.

### 2.4. Image Handling & Local Storage (`src/database/metraj-sync.ts`)
- **Watermark Removal:** 101evler watermarked photos reside in `/property_wm/`. Replaced with `/property_thumb/` which provides clean, original watermark-free photos.
- **Local Storage:** Images are downloaded directly to Metraj storage: `../Metraj/storage/app/public/properties/{property_id}/photo_{index}.jpg`.
- `property_images` records relative paths: `properties/{property_id}/photo_{index}.jpg` for both `url` and `thumbnail_url`. Metraj automatically serves these via Laravel's `asset('storage/...')`.
- `dns.setDefaultResultOrder('ipv4first')` is set to ensure sub-second downloads without waiting on IPv6 timeouts.

### 2.5. Automated Agency & Agent Onboarding (`src/database/metraj-sync.ts`)
When synchronizing a property to Metraj PostgreSQL:
1. **Find or Create Agency (`findOrCreateAgency`):**
   - Looks up existing agency by `slug` or `LOWER(name)`.
   - If not found:
     - Creates an agency owner in `users` (`email: [agency_ismi]@kibriskare.com`, `password: bcrypt('secret123')`).
     - Inserts into `agencies` with `owner_id`, `name`, `slug`, `phone`, `address`, `logo`, `email`, `status = 'active'`, `is_verified = true`.
   - Returns `agency_id`.
2. **Find or Create Agent (`findOrCreateAgent`):**
   - If agent name or phone exists:
     - Looks up existing agent by `phone` or `(agency_id, LOWER(users.name))`.
     - If not found:
       - Creates an agent user in `users` (`email: [emlakci_ismi]@kibriskare.com`, `password: bcrypt('secret123')`).
       - Inserts into `agents` with `agency_id`, `user_id`, `position = 'Gayrimenkul Danışmanı'`, `phone`, `whatsapp`, `avatar`, `is_active = true`.
     - Returns `agent_id` and `user_id`.
3. **Property Assignment:**
   - Property `agency_id`, `agent_id`, `user_id`, `seller_type`, `contact_name`, and `phone` are bound in both `INSERT` and `UPDATE` statements.
   - **Idempotency Guarantee:** Multiple properties from the same agency/agent reuse the existing agency and agent records without creating duplicates.

### 2.6. Web Dashboard & SSE Streaming (`src/public/index.html` & `src/server.ts`)
- Built with Tailwind CSS CDN and Alpine.js.
- Uses Server-Sent Events (`/api/crawl/stream`) for real-time progress and logs.
- Single process: Express serves both REST APIs and the static dashboard on port 3001.

---

## 3. Build & Run Commands

```bash
npm run dev      # Run with live reload using tsx watch
npm run build    # Compile TypeScript and copy public folder to dist/
npm start        # Run compiled production server on port 3001
```

---

## 4. Coding Conventions & Safety Rules

- **Language:** Strict TypeScript (ES2022 / NodeNext).
- **Modules:** Native ESM (`import/export`, `.js` extension in relative imports for compiled output).
- **Idempotency:** Always use upsert (`ON CONFLICT` or update-if-exists) when writing to databases.
- **SellerType Enum:** In Metraj PostgreSQL, `seller_type` MUST be `'agency'` (if agency/agent exists) or `'owner'`. Metraj does not have an `'agent'` seller_type enum.
- **Database Schema Constraints:**
  - `agencies.slug` is UNIQUE.
  - `users.email` is UNIQUE. Use consistent format `agency_{slug}@metraj.local` and `agent_{slug}_{phone}@metraj.local`.
  - `agents` table does NOT have a `name` column; agent name is stored on the linked `users` record (`agents.user_id -> users.id`).
