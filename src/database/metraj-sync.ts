import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { config } from '../config/index.js';
import { stagingDb } from './staging.js';
import { mapToMetrajPayload, slugify } from '../scraper/mapper.js';
import type { RawPropertyData, MetrajPropertyPayload } from '../types.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const { Pool } = pg;


export class MetrajSyncService {
  private pool: pg.Pool;
  private districtMap: Record<string, number> = {};
  private amenityMap: Record<string, number> = {};
  private isConnected = false;

  constructor() {
    this.pool = new Pool({
      host: config.metrajDb.host,
      port: config.metrajDb.port,
      database: config.metrajDb.database,
      user: config.metrajDb.user,
      password: config.metrajDb.password,
    });
  }

  async init(): Promise<void> {
    try {
      const client = await this.pool.connect();
      this.isConnected = true;

      // Load districts into memory
      const res = await client.query('SELECT id, name, slug FROM districts');
      for (const row of res.rows) {
        let nameTr = '';
        if (typeof row.name === 'object' && row.name !== null) {
          nameTr = row.name.tr || row.name.az || row.name.en || '';
        } else if (typeof row.name === 'string') {
          try {
            const parsed = JSON.parse(row.name);
            nameTr = parsed.tr || parsed.az || parsed.en || '';
          } catch {
            nameTr = row.name;
          }
        }
        if (nameTr) this.districtMap[nameTr.toLowerCase().trim()] = row.id;
        if (row.slug) this.districtMap[row.slug.toLowerCase().trim()] = row.id;
      }

      // Load amenities into memory
      const amenityRes = await client.query('SELECT id, name FROM amenities');
      for (const row of amenityRes.rows) {
        if (typeof row.name === 'object' && row.name !== null) {
          for (const lang of ['tr', 'az', 'en', 'ru']) {
            if (row.name[lang]) {
              this.amenityMap[String(row.name[lang]).toLowerCase().trim()] = Number(row.id);
            }
          }
        } else if (typeof row.name === 'string') {
          try {
            const parsed = JSON.parse(row.name);
            for (const lang of ['tr', 'az', 'en', 'ru']) {
              if (parsed[lang]) {
                this.amenityMap[String(parsed[lang]).toLowerCase().trim()] = Number(row.id);
              }
            }
          } catch {
            this.amenityMap[row.name.toLowerCase().trim()] = Number(row.id);
          }
        }
      }
      client.release();
    } catch (err: any) {
      console.warn('⚠️ Metraj PostgreSQL connection failed:', err.message);
      this.isConnected = false;
    }
  }

  async getExistingCodes(): Promise<Set<string>> {
    if (!this.isConnected) {
      await this.init();
    }
    if (!this.isConnected) {
      return new Set();
    }

    try {
      const res = await this.pool.query('SELECT code FROM properties WHERE code IS NOT NULL');
      const set = new Set<string>();
      for (const row of res.rows) {
        if (row.code) set.add(String(row.code).trim());
      }
      return set;
    } catch (err: any) {
      console.warn('⚠️ Metraj PostgreSQL kodları alınamadı:', err.message);
      return new Set();
    }
  }

  async syncProperty(rawItem: RawPropertyData): Promise<{ success: boolean; propertyId?: number; error?: string }> {
    if (!this.isConnected) {
      await this.init();
      if (!this.isConnected) {
        return { success: false, error: 'Could not connect to Metraj PostgreSQL database' };
      }
    }

    const payload = mapToMetrajPayload(rawItem, this.districtMap);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Resolve Agency if applicable
      let agencyId: number | null = null;
      let agencyOwnerUserId: number | null = null;

      if (payload.agency_name && !payload.agency_name.toLowerCase().includes('sahibinden')) {
        const agRes = await this.findOrCreateAgency(client, payload);
        agencyId = agRes.agencyId;
        agencyOwnerUserId = agRes.ownerId;
      }

      // 2. Resolve Agent if applicable
      let agentId: number | null = null;
      let agentUserId: number | null = null;

      if (payload.agent_name && !payload.agent_name.toLowerCase().includes('sahibinden')) {
        const agentRes = await this.findOrCreateAgent(client, payload, agencyId);
        agentId = agentRes.agentId;
        agentUserId = agentRes.userId;
      }

      const propertyUserId = agentUserId || agencyOwnerUserId || null;
      const sellerType = (agencyId || agentId) ? 'agency' : 'owner';
      const contactName = payload.agent_name || payload.agency_name || payload.advertiser_name || 'Sahibinden';
      const contactPhone = payload.agent_phone || payload.agency_phone || payload.phone;

      // Check if property exists
      const checkRes = await client.query('SELECT id FROM properties WHERE code = $1', [payload.code]);
      let propertyId: number;

      if (checkRes.rows.length > 0) {
        propertyId = checkRes.rows[0].id;
        // Update existing property
        await client.query(
          `UPDATE properties SET
            title = $1,
            description = $2,
            price = $3,
            currency = $4,
            prices = $5,
            seller_type = $6,
            contact_name = $7,
            phone = $8,
            city_id = $9,
            district_id = $10,
            address = $11,
            latitude = $12,
            longitude = $13,
            area = $14,
            land_area = $15,
            rooms = $16,
            bathrooms = $17,
            floor = $18,
            total_floors = $19,
            deed_type = $20,
            furnished_status = $21,
            in_complex = $22,
            building_age = $23,
            exchangeable = $24,
            zoning_ratio = $25,
            floors_allowed = $26,
            agency_id = $27,
            agent_id = $28,
            user_id = $29,
            status = 'published',
            updated_at = NOW()
          WHERE id = $30`,
          [
            JSON.stringify(payload.title),
            JSON.stringify(payload.description),
            payload.price,
            payload.currency,
            JSON.stringify(payload.prices),
            sellerType,
            contactName,
            contactPhone,
            payload.city_id,
            payload.district_id,
            payload.address,
            payload.latitude,
            payload.longitude,
            payload.area,
            payload.land_area,
            payload.rooms,
            payload.bathrooms,
            payload.floor,
            payload.total_floors,
            payload.deed_type,
            payload.furnished_status,
            payload.in_complex,
            payload.building_age,
            payload.exchangeable,
            payload.zoning_ratio,
            payload.floors_allowed,
            agencyId,
            agentId,
            propertyUserId,
            propertyId,
          ]
        );
      } else {
        // Insert new property
        const insertRes = await client.query(
          `INSERT INTO properties (
            code, title, slug, description, price, currency, prices,
            seller_type, contact_name, phone, city_id, district_id,
            address, latitude, longitude, area, land_area, rooms,
            bathrooms, floor, total_floors, deed_type, furnished_status,
            in_complex, building_age, exchangeable, zoning_ratio,
            floors_allowed, agency_id, agent_id, user_id,
            status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23,
            $24, $25, $26, $27,
            $28, $29, $30, $31,
            'published', NOW(), NOW()
          ) RETURNING id`,
          [
            payload.code,
            JSON.stringify(payload.title),
            payload.slug,
            JSON.stringify(payload.description),
            payload.price,
            payload.currency,
            JSON.stringify(payload.prices),
            sellerType,
            contactName,
            contactPhone,
            payload.city_id,
            payload.district_id,
            payload.address,
            payload.latitude,
            payload.longitude,
            payload.area,
            payload.land_area,
            payload.rooms,
            payload.bathrooms,
            payload.floor,
            payload.total_floors,
            payload.deed_type,
            payload.furnished_status,
            payload.in_complex,
            payload.building_age,
            payload.exchangeable,
            payload.zoning_ratio,
            payload.floors_allowed,
            agencyId,
            agentId,
            propertyUserId,
          ]
        );
        propertyId = insertRes.rows[0].id;
      }

      // Sync Images (download locally into Metraj storage without watermark)
      if (payload.images && payload.images.length > 0) {
        const savedPaths = await this.downloadAndSaveImages(propertyId, payload.images);

        // Clear existing images to prevent duplicates
        await client.query('DELETE FROM property_images WHERE property_id = $1', [propertyId]);
        for (let i = 0; i < savedPaths.length; i++) {
          const imgPath = savedPaths[i];
          await client.query(
            `INSERT INTO property_images (property_id, url, thumbnail_url, sort_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [propertyId, imgPath, imgPath, i]
          );
        }
      }

      // Link Filter Options (deal_type_id, property_type_id)
      const filterOptionIds = [payload.deal_type_id, payload.property_type_id].filter(Boolean);
      for (const optId of filterOptionIds) {
        await client.query(
          `INSERT INTO property_filter_options (property_id, filter_option_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [propertyId, optId]
        );
      }

      // Sync Amenities (İç, Dış, Konum Özellikleri)
      if (payload.amenities && payload.amenities.length > 0) {
        await client.query('DELETE FROM property_amenity WHERE property_id = $1', [propertyId]);
        for (const item of payload.amenities) {
          if (!item.name || !item.name.trim()) continue;
          const amenityId = await this.findOrCreateAmenity(client, item.name.trim(), item.category);
          if (amenityId) {
            await client.query(
              `INSERT INTO property_amenity (property_id, amenity_id)
               VALUES ($1, $2)
               ON CONFLICT (property_id, amenity_id) DO NOTHING`,
              [propertyId, amenityId]
            );
          }
        }
      }

      await client.query('COMMIT');
      stagingDb.updateSyncStatus(payload.code, 'synced', propertyId);
      return { success: true, propertyId };
    } catch (err: any) {
      await client.query('ROLLBACK');
      stagingDb.updateSyncStatus(payload.code, 'failed', undefined, err.message);
      return { success: false, error: err.message };
    } finally {
      client.release();
      this.clearMetrajCache();
    }
  }

  private generateKibrisKareEmail(name: string, fallbackPhone?: string | null): string {
    const clean = slugify(name || '').replace(/-+/g, '.').replace(/^\.+|\.+$/g, '');
    if (clean) {
      return `${clean}@kibriskare.com`;
    }
    const digits = (fallbackPhone || '').replace(/\D/g, '').slice(-8);
    return `emlakci.${digits || Date.now()}@kibriskare.com`;
  }

  private async findOrCreateUser(client: pg.PoolClient, name: string, preferredEmail: string): Promise<number> {
    // 1. Check if user with this email exists
    const existingByEmail = await client.query('SELECT id, name FROM users WHERE email = $1 LIMIT 1', [preferredEmail]);
    if (existingByEmail.rows.length > 0) {
      if (existingByEmail.rows[0].name.toLowerCase() === name.toLowerCase()) {
        return Number(existingByEmail.rows[0].id);
      }
      const disambiguatedEmail = preferredEmail.replace('@kibriskare.com', `.${Date.now().toString().slice(-4)}@kibriskare.com`);
      const userRes = await client.query(
        `INSERT INTO users (name, email, password, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id`,
        [name, disambiguatedEmail, '$2y$12$eA89nF39Kz9Zq6YtL/EwQ.O846s3.vF/CjQ4g1ZkVv93L91B.fXU.'] // bcrypt for secret123
      );
      return Number(userRes.rows[0].id);
    }

    // 2. Check if user with this name already exists
    const existingByName = await client.query('SELECT id FROM users WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
    if (existingByName.rows.length > 0) {
      return Number(existingByName.rows[0].id);
    }

    // 3. Create new user
    const userRes = await client.query(
      `INSERT INTO users (name, email, password, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [name, preferredEmail, '$2y$12$eA89nF39Kz9Zq6YtL/EwQ.O846s3.vF/CjQ4g1ZkVv93L91B.fXU.'] // bcrypt for secret123
    );
    return Number(userRes.rows[0].id);
  }

  private async findOrCreateAgency(
    client: pg.PoolClient,
    payload: MetrajPropertyPayload
  ): Promise<{ agencyId: number; ownerId: number }> {
    const rawName = (payload.agency_name || '').trim();
    const slug = slugify(rawName);

    // 1. Check if agency already exists
    const existingAgency = await client.query(
      `SELECT id, owner_id FROM agencies WHERE slug = $1 OR LOWER(name) = LOWER($2) LIMIT 1`,
      [slug, rawName]
    );

    if (existingAgency.rows.length > 0) {
      return {
        agencyId: Number(existingAgency.rows[0].id),
        ownerId: Number(existingAgency.rows[0].owner_id),
      };
    }

    // 2. Ensure owner user exists in users table with email: [agency_name]@kibriskare.com
    const email = this.generateKibrisKareEmail(rawName, payload.agency_phone || payload.phone);
    const ownerId = await this.findOrCreateUser(client, rawName, email);

    // 3. Insert new agency
    const agencyPhone = payload.agency_phone || payload.phone || null;
    const agencyAddress = payload.agency_address || payload.address || null;
    const agencyLogo = payload.agency_logo || null;

    const insertAgency = await client.query(
      `INSERT INTO agencies (
         owner_id, name, slug, description, logo, phone, whatsapp, email, address, status, is_verified, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', true, NOW(), NOW()
       ) RETURNING id`,
      [
        ownerId,
        rawName,
        slug,
        `${rawName} - Kuzey Kıbrıs Emlak ve Gayrimenkul Danışmanlığı`,
        agencyLogo,
        agencyPhone,
        payload.agent_whatsapp || agencyPhone,
        email,
        agencyAddress,
      ]
    );

    return {
      agencyId: Number(insertAgency.rows[0].id),
      ownerId,
    };
  }

  private async findOrCreateAgent(
    client: pg.PoolClient,
    payload: MetrajPropertyPayload,
    agencyId: number | null
  ): Promise<{ agentId: number; userId: number }> {
    const rawAgentName = (payload.agent_name || '').trim();
    const agentPhone = payload.agent_phone || payload.phone || null;

    // 1. Check if agent already exists
    let existingAgent: pg.QueryResult<any>;
    if (agencyId) {
      existingAgent = await client.query(
        `SELECT a.id, a.user_id, a.agency_id 
         FROM agents a
         JOIN users u ON a.user_id = u.id
         WHERE (a.agency_id = $1 AND LOWER(u.name) = LOWER($2))
            OR ($3::text IS NOT NULL AND a.phone = $3)
         LIMIT 1`,
        [agencyId, rawAgentName, agentPhone]
      );
    } else {
      existingAgent = await client.query(
        `SELECT a.id, a.user_id, a.agency_id 
         FROM agents a
         JOIN users u ON a.user_id = u.id
         WHERE LOWER(u.name) = LOWER($1)
            OR ($2::text IS NOT NULL AND a.phone = $2)
         LIMIT 1`,
        [rawAgentName, agentPhone]
      );
    }

    if (existingAgent.rows.length > 0) {
      const existingId = Number(existingAgent.rows[0].id);
      const existingUserId = Number(existingAgent.rows[0].user_id);
      if (agencyId && !existingAgent.rows[0].agency_id) {
        await client.query(`UPDATE agents SET agency_id = $1, updated_at = NOW() WHERE id = $2`, [agencyId, existingId]);
      }
      return {
        agentId: existingId,
        userId: existingUserId,
      };
    }

    // 2. Ensure user exists for agent with email: [emlakci_ismi]@kibriskare.com
    const email = this.generateKibrisKareEmail(rawAgentName, agentPhone);
    const userId = await this.findOrCreateUser(client, rawAgentName, email);

    // 3. Insert into agents
    const insertAgent = await client.query(
      `INSERT INTO agents (
         agency_id, user_id, position, phone, whatsapp, avatar, is_active, created_at, updated_at
       ) VALUES (
         $1, $2, 'Gayrimenkul Danışmanı', $3, $4, $5, true, NOW(), NOW()
       ) RETURNING id`,
      [
        agencyId,
        userId,
        agentPhone,
        payload.agent_whatsapp || agentPhone,
        payload.agent_avatar || null,
      ]
    );

    return {
      agentId: Number(insertAgent.rows[0].id),
      userId,
    };
  }


  private async downloadAndSaveImages(propertyId: number, images: string[]): Promise<string[]> {
    const metrajStorageBase = path.resolve(config.metrajPath, 'storage/app/public/properties', String(propertyId));
    try {
      await fs.promises.mkdir(metrajStorageBase, { recursive: true });
    } catch {}

    const localPaths: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const rawUrl = images[i];
      if (!rawUrl) continue;

      // Ensure we use clean watermark-free thumbnail URL
      const cleanUrl = rawUrl.replace('/property_wm/', '/property_thumb/');
      const fileName = `photo_${i}.jpg`;
      const localFilePath = path.join(metrajStorageBase, fileName);
      const relativePath = `properties/${propertyId}/${fileName}`;

      // If file already exists and is not empty, use it
      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
        localPaths.push(relativePath);
        continue;
      }

      // Download the image directly
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(cleanUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': config.userAgent,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer': 'https://www.101evler.com/',
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          await fs.promises.writeFile(localFilePath, buffer);
          localPaths.push(relativePath);
        } else {
          console.warn(`[Image Download] Failed HTTP ${response.status} for ${cleanUrl}`);
          localPaths.push(cleanUrl);
        }
      } catch (err: any) {
        console.warn(`[Image Download] Error downloading ${cleanUrl}: ${err.message}`);
        localPaths.push(cleanUrl);
      }
    }

    return localPaths;
  }

  private clearMetrajCache(): void {
    import('child_process').then(({ exec }) => {
      exec('php artisan cache:clear', { cwd: config.metrajPath }, () => {});
    }).catch(() => {});
  }

  private async findOrCreateAmenity(
    client: pg.PoolClient,
    name: string,
    category?: string
  ): Promise<number> {
    const key = name.toLowerCase().trim();
    if (this.amenityMap[key]) {
      return this.amenityMap[key];
    }

    const existing = await client.query(
      `SELECT id FROM amenities
       WHERE LOWER(name->>'tr') = $1
          OR LOWER(name->>'az') = $1
          OR LOWER(name->>'en') = $1
       LIMIT 1`,
      [key]
    );

    if (existing.rows.length > 0) {
      const id = Number(existing.rows[0].id);
      this.amenityMap[key] = id;
      return id;
    }

    const amenityJson = {
      tr: name,
      az: name,
      en: name,
      ru: name,
    };

    const insertRes = await client.query(
      `INSERT INTO amenities (name, icon, category, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       RETURNING id`,
      [JSON.stringify(amenityJson), 'bi-check-lg', category || 'Genel Özellikler']
    );

    const newId = Number(insertRes.rows[0].id);
    this.amenityMap[key] = newId;
    return newId;
  }

  async syncAllPending(onProgress?: (synced: number, total: number) => void): Promise<{ total: number; succeeded: number; failed: number }> {
    const pendingList = stagingDb.getAllPending();
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < pendingList.length; i++) {
      const row = pendingList[i] as any;
      try {
        const raw = JSON.parse(row.raw_json);
        const res = await this.syncProperty(raw);
        if (res.success) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
      if (onProgress) onProgress(i + 1, pendingList.length);
    }

    this.clearMetrajCache();
    return { total: pendingList.length, succeeded, failed };
  }

  async deletePropertiesFromMetraj(codes: string[]): Promise<{ deleted: number }> {
    if (!this.isConnected) {
      await this.init();
    }
    if (!this.isConnected || codes.length === 0) {
      return { deleted: 0 };
    }

    const client = await this.pool.connect();
    try {
      const res = await client.query(
        'SELECT id FROM properties WHERE code = ANY($1)',
        [codes]
      );
      const ids = res.rows.map((r) => r.id);

      const delRes = await client.query(
        'DELETE FROM properties WHERE code = ANY($1)',
        [codes]
      );

      for (const id of ids) {
        const propDir = path.resolve(config.metrajPath, 'storage/app/public/properties', String(id));
        if (fs.existsSync(propDir)) {
          try {
            fs.rmSync(propDir, { recursive: true, force: true });
          } catch {}
        }
      }

      this.clearMetrajCache();
      return { deleted: delRes.rowCount || 0 };
    } catch (err: any) {
      console.error('Failed to delete properties from Metraj:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const metrajSync = new MetrajSyncService();
