import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

import { config } from './config/index.js';
import { stagingDb } from './database/staging.js';
import { crawler } from './scraper/crawler.js';
import { metrajSync } from './database/metraj-sync.js';
import type { CrawlLog, CrawlJob } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../src/public');
app.use(express.static(publicDir));

// In-memory buffer of recent logs for new SSE clients
const recentLogs: CrawlLog[] = [];
crawler.on('log', (log: CrawlLog) => {
  recentLogs.push(log);
  if (recentLogs.length > 200) recentLogs.shift();
});

// Initialize Metraj connection in background
metrajSync.init();

// --- REST Endpoints ---

// Categories & Cities list
app.get('/api/categories', (req, res) => {
  res.json({
    categories: [
      { name: 'Satılık Konut (Tümü)', path: '/kibris/satilik-konut' },
      { name: 'Kiralık Konut (Tümü)', path: '/kibris/kiralik-konut' },
      { name: 'Satılık Arsa & Arazi', path: '/kibris/satilik-arazi' },
      { name: 'Satılık Ticari Emlak', path: '/kibris/satilik-ticari-emlak' },
      { name: 'Kiralık Ticari Emlak', path: '/kibris/kiralik-ticari-emlak' },
    ],
    cities: [
      { name: 'Tüm Şehirler', slug: '' },
      { name: 'Girne', slug: 'girne' },
      { name: 'Lefkoşa', slug: 'lefkosa' },
      { name: 'Gazimağusa', slug: 'magusa' },
      { name: 'İskele', slug: 'iskele' },
      { name: 'Güzelyurt', slug: 'guzelyurt' },
      { name: 'Lefke', slug: 'lefke' },
    ],
  });
});

// Stats overview
app.get('/api/stats', (req, res) => {
  const stats = stagingDb.getStats();
  res.json({
    ...stats,
    isCrawling: crawler.isActive(),
  });
});

// Properties list with filters
app.get('/api/properties', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const result = stagingDb.listProperties({
    status: req.query.status as string,
    city: req.query.city as string,
    dealType: req.query.dealType as string,
    search: req.query.search as string,
    limit,
    offset,
  });

  res.json({
    page,
    limit,
    total: result.total,
    pages: Math.ceil(result.total / limit),
    items: result.rows,
  });
});

// Single property detail
app.get('/api/properties/:code', (req, res) => {
  const prop = stagingDb.getPropertyByCode(req.params.code);
  if (!prop) {
    return res.status(404).json({ error: 'İlan bulunamadı' });
  }
  res.json({
    ...prop,
    raw_json: JSON.parse(prop.raw_json),
  });
});

// Start crawling
app.post('/api/crawl/start', async (req, res) => {
  const { categoryUrl, city, maxPages, delayMs, forceUpdate } = req.body;

  let finalUrl = categoryUrl || '/kibris/satilik-konut';
  if (city && !finalUrl.includes(city)) {
    finalUrl = `${finalUrl.replace(/\/+$/, '')}/${city}`;
  }

  if (crawler.isActive()) {
    return res.status(400).json({ error: 'Zaten aktif bir tarama yürütülüyor.' });
  }

  // Start in background
  crawler
    .start({
      categoryUrl: finalUrl,
      city: city || 'Tümü',
      maxPages: Number(maxPages) || 3,
      delayMs: Number(delayMs) || 1000,
      forceUpdate: Boolean(forceUpdate),
    })
    .catch((err) => {
      console.error('Crawler execution error:', err);
    });

  res.json({ success: true, message: 'Tarama başlatıldı' });
});

// Stop crawling
app.post('/api/crawl/stop', (req, res) => {
  crawler.stop();
  res.json({ success: true, message: 'Durdurma sinyali gönderildi' });
});

// Current crawl status
app.get('/api/crawl/status', (req, res) => {
  res.json({
    isActive: crawler.isActive(),
    job: crawler.getJob(),
  });
});

// SSE Live Stream for Logs & Progress
app.get('/api/crawl/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send recent logs first
  for (const log of recentLogs) {
    res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`);
  }

  // Listen for new logs
  const onLog = (log: CrawlLog) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`);
  };

  const onProgress = (job: CrawlJob) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', data: job })}\n\n`);
  };

  crawler.on('log', onLog);
  crawler.on('progress', onProgress);

  req.on('close', () => {
    crawler.off('log', onLog);
    crawler.off('progress', onProgress);
  });
});

// Sync a single property to Metraj PostgreSQL
app.post('/api/sync/:code', async (req, res) => {
  const prop = stagingDb.getPropertyByCode(req.params.code);
  if (!prop) return res.status(404).json({ error: 'İlan bulunamadı' });

  try {
    const raw = JSON.parse(prop.raw_json);
    const syncRes = await metrajSync.syncProperty(raw);
    res.json(syncRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync all pending properties to Metraj PostgreSQL
app.post('/api/sync-all', async (req, res) => {
  try {
    const result = await metrajSync.syncAllPending();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete unsynced properties from staging SQLite
app.post('/api/properties/delete-unsynced', (req, res) => {
  try {
    const { deleted } = stagingDb.deleteUnsyncedProperties();
    res.json({ success: true, count: deleted, message: `${deleted} adet eklenmemiş ilan silindi.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete synced properties (from staging, and optionally from Metraj PostgreSQL)
app.post('/api/properties/delete-synced', async (req, res) => {
  try {
    const deleteFromMetraj = Boolean(req.body.deleteFromMetraj);
    const { deleted, codes } = stagingDb.deleteSyncedProperties();
    let metrajDeleted = 0;

    if (deleteFromMetraj && codes.length > 0) {
      const mRes = await metrajSync.deletePropertiesFromMetraj(codes);
      metrajDeleted = mRes.deleted;
    }

    res.json({
      success: true,
      count: deleted,
      metrajDeleted,
      message: `${deleted} adet aktarılmış ilan silindi.${deleteFromMetraj ? ` (${metrajDeleted} ilan Metraj veritabanından da kaldırıldı)` : ''}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single property
app.delete('/api/properties/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const deleteFromMetraj = Boolean(req.body.deleteFromMetraj || req.query.deleteFromMetraj === 'true');
    const { deleted, sync_status } = stagingDb.deleteSingleProperty(code);

    let metrajDeleted = 0;
    if (deleteFromMetraj && sync_status === 'synced') {
      const mRes = await metrajSync.deletePropertiesFromMetraj([code]);
      metrajDeleted = mRes.deleted;
    }

    res.json({
      success: true,
      deleted,
      metrajDeleted,
      message: `#${code} numaralı ilan silindi.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all scraped properties in staging
app.post('/api/properties/clear', (req, res) => {
  try {
    stagingDb.clearAll();
    res.json({ success: true, message: 'Tüm yerel veriler temizlendi.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 HomeScraper Web Panel hazır!`);
  console.log(`👉 http://localhost:${config.port}`);
  console.log(`🔗 Metraj DB: ${config.metrajDb.host}:${config.metrajDb.port}/${config.metrajDb.database}`);
  console.log(`=================================================\n`);
});
