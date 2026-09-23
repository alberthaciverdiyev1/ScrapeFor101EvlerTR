import Database from 'better-sqlite3';
import { config } from '../config/index.js';
import type { RawPropertyData } from '../types.js';

const db = new Database(config.sqlitePath);

// Enable WAL mode for high concurrency & speed
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS scraped_properties (
    code TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL,
    currency TEXT,
    deal_type TEXT,
    property_type TEXT,
    city TEXT,
    district TEXT,
    rooms TEXT,
    bathrooms INTEGER,
    area REAL,
    land_area REAL,
    deed_type TEXT,
    furnished_status TEXT,
    in_complex INTEGER DEFAULT 0,
    building_age TEXT,
    exchangeable INTEGER DEFAULT 0,
    thumbnail TEXT,
    raw_json TEXT NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    metraj_id INTEGER,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_props_city ON scraped_properties(city);
  CREATE INDEX IF NOT EXISTS idx_props_sync ON scraped_properties(sync_status);
  CREATE INDEX IF NOT EXISTS idx_props_deal_type ON scraped_properties(deal_type);
  CREATE INDEX IF NOT EXISTS idx_props_property_type ON scraped_properties(property_type);

  CREATE TABLE IF NOT EXISTS crawl_jobs (
    id TEXT PRIMARY KEY,
    category TEXT,
    city TEXT,
    status TEXT DEFAULT 'idle',
    total_pages INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    scraped_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    started_at TEXT,
    finished_at TEXT
  );
`);

export const stagingDb = {
  upsertProperty(item: RawPropertyData): void {
    const stmt = db.prepare(`
      INSERT INTO scraped_properties (
        code, url, title, price, currency, deal_type, property_type,
        city, district, rooms, bathrooms, area, land_area, deed_type,
        furnished_status, in_complex, building_age, exchangeable,
        thumbnail, raw_json, sync_status, updated_at
      ) VALUES (
        @code, @url, @title, @price, @currency, @deal_type, @property_type,
        @city, @district, @rooms, @bathrooms, @area, @land_area, @deed_type,
        @furnished_status, @in_complex, @building_age, @exchangeable,
        @thumbnail, @raw_json, 'pending', CURRENT_TIMESTAMP
      )
      ON CONFLICT(code) DO UPDATE SET
        price = excluded.price,
        currency = excluded.currency,
        title = excluded.title,
        rooms = excluded.rooms,
        bathrooms = excluded.bathrooms,
        area = excluded.area,
        land_area = excluded.land_area,
        deed_type = excluded.deed_type,
        furnished_status = excluded.furnished_status,
        in_complex = excluded.in_complex,
        building_age = excluded.building_age,
        exchangeable = excluded.exchangeable,
        thumbnail = excluded.thumbnail,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run({
      code: item.code,
      url: item.url,
      title: item.title,
      price: item.price,
      currency: item.currency,
      deal_type: item.dealType,
      property_type: item.propertyType,
      city: item.city,
      district: item.district,
      rooms: item.rooms,
      bathrooms: item.bathrooms,
      area: item.area,
      land_area: item.landArea,
      deed_type: item.deedType,
      furnished_status: item.furnishedStatus,
      in_complex: item.inComplex ? 1 : 0,
      building_age: item.buildingAge,
      exchangeable: item.exchangeable ? 1 : 0,
      thumbnail: (item.images[0] || '').replace('/property_wm/', '/property_thumb/') || null,
      raw_json: JSON.stringify(item),
    });
  },

  getPropertyByCode(code: string): any {
    return db.prepare('SELECT * FROM scraped_properties WHERE code = ?').get(code);
  },

  listProperties(filters: {
    status?: string;
    city?: string;
    dealType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let sql = 'SELECT * FROM scraped_properties WHERE 1=1';
    const params: any[] = [];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND sync_status = ?';
      params.push(filters.status);
    }
    if (filters.city && filters.city !== 'all') {
      sql += ' AND city = ?';
      params.push(filters.city);
    }
    if (filters.dealType && filters.dealType !== 'all') {
      sql += ' AND deal_type = ?';
      params.push(filters.dealType);
    }
    if (filters.search) {
      sql += ' AND (title LIKE ? OR code LIKE ? OR district LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = (db.prepare(countSql).get(...params) as any).total;

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50, filters.offset || 0);

    const rows = db.prepare(sql).all(...params);
    return { total, rows };
  },

  getStats() {
    const total = (db.prepare('SELECT COUNT(*) as c FROM scraped_properties').get() as any).c;
    const synced = (db.prepare("SELECT COUNT(*) as c FROM scraped_properties WHERE sync_status = 'synced'").get() as any).c;
    const pending = (db.prepare("SELECT COUNT(*) as c FROM scraped_properties WHERE sync_status = 'pending'").get() as any).c;
    const failed = (db.prepare("SELECT COUNT(*) as c FROM scraped_properties WHERE sync_status = 'failed'").get() as any).c;
    return { total, synced, pending, failed };
  },

  updateSyncStatus(code: string, status: 'synced' | 'failed', metrajId?: number, error?: string) {
    db.prepare(`
      UPDATE scraped_properties
      SET sync_status = ?, metraj_id = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).run(status, metrajId || null, error || null, code);
  },

  getAllPending() {
    return db.prepare("SELECT * FROM scraped_properties WHERE sync_status = 'pending'").all();
  },

  clearAll() {
    db.prepare('DELETE FROM scraped_properties').run();
    db.prepare('DELETE FROM crawl_jobs').run();
  }
};
