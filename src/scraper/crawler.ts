import { EventEmitter } from 'events';
import { config } from '../config/index.js';
import { parseListingPage, parsePropertyDetail } from './parser.js';
import { stagingDb } from '../database/staging.js';
import { metrajSync } from '../database/metraj-sync.js';
import type { CrawlOptions, CrawlJob, CrawlLog } from '../types.js';

export class Crawler extends EventEmitter {
  private isRunning = false;
  private shouldStop = false;
  private currentJob: CrawlJob | null = null;

  constructor() {
    super();
  }

  getJob(): CrawlJob | null {
    return this.currentJob;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  stop(): void {
    if (this.isRunning) {
      this.shouldStop = true;
      this.log('warn', '🛑 Tarama durdurma isteği alındı. Mevcut işlem tamamlandıktan sonra duracak...');
    }
  }

  private log(level: CrawlLog['level'], message: string): void {
    const logItem: CrawlLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    this.emit('log', logItem);
  }

  private async fetchHtml(url: string): Promise<string> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const path = await import('path');
    const execFileAsync = promisify(execFile);

    const scriptPath = path.resolve(process.cwd(), 'scripts/fetcher.py');

    try {
      const { stdout } = await execFileAsync(
        'python3',
        [scriptPath, url],
        { maxBuffer: 15 * 1024 * 1024 }
      );

      if (!stdout || stdout.length < 500) {
        throw new Error('Boş veya çok kısa içerik döndü');
      }

      return stdout;
    } catch (err: any) {
      throw new Error(`İstek başarısız: ${err.message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start(options: CrawlOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error('Bir tarama işlemi zaten çalışıyor!');
    }

    this.isRunning = true;
    this.shouldStop = false;

    const maxPages = options.maxPages || 5;
    const delayMs = options.delayMs || config.defaultDelayMs;
    const categoryUrl = options.categoryUrl.startsWith('http')
      ? options.categoryUrl
      : `${config.baseUrl}${options.categoryUrl}`;

    this.currentJob = {
      id: String(Date.now()),
      category: options.categoryUrl,
      city: options.city || 'Tümü',
      status: 'running',
      totalPages: maxPages,
      currentPage: 0,
      totalFound: 0,
      scrapedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    this.log('info', `🚀 Tarama başlatıldı: ${categoryUrl} (Maks Sayfa: ${maxPages})`);
    this.emit('progress', this.currentJob);

    // Preload existing codes from SQLite and Metraj PostgreSQL to prevent duplicate crawls
    const existingCodes = new Set<string>();
    if (!options.forceUpdate) {
      try {
        const sqliteCodes = stagingDb.getAllCodes();
        for (const c of sqliteCodes) existingCodes.add(c);
      } catch (err: any) {
        this.log('warn', `SQLite kodları okunamadı: ${err.message}`);
      }

      try {
        const postgresCodes = await metrajSync.getExistingCodes();
        for (const c of postgresCodes) existingCodes.add(c);
      } catch (err: any) {
        this.log('warn', `Metraj PostgreSQL kodları okunamadı: ${err.message}`);
      }

      this.log('info', `📋 Toplam ${existingCodes.size} mevcut ilan hafızaya alındı (tekrar çekilmeyecek).`);
    } else {
      this.log('warn', '⚠️ Zorla güncelleme (Force Update) aktif: Mevcut ilanlar da yeniden çekilecek.');
    }

    try {
      for (let page = 1; page <= maxPages; page++) {
        if (this.shouldStop) {
          this.log('warn', '⏹️ Tarama kullanıcı tarafından durduruldu.');
          break;
        }

        this.currentJob.currentPage = page;
        const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
        this.log('info', `📄 Sayfa ${page}/${maxPages} çekiliyor: ${pageUrl}`);

        let listingHtml: string;
        try {
          listingHtml = await this.fetchHtml(pageUrl);
        } catch (err: any) {
          this.log('error', `❌ Sayfa ${page} alınamadı: ${err.message}`);
          this.currentJob.errorCount++;
          continue;
        }

        const { urls } = parseListingPage(listingHtml);
        if (urls.length === 0) {
          this.log('warn', `ℹ️ Sayfa ${page}'de ilan bulunamadı veya son sayfaya ulaşıldı.`);
          break;
        }

        this.currentJob.totalFound += urls.length;
        this.log('info', `🔍 Sayfa ${page}: ${urls.length} ilan bulundu.`);
        this.emit('progress', this.currentJob);

        // Fetch each listing detail
        for (const detailUrl of urls) {
          if (this.shouldStop) break;

          // Extract listing code from URL: e.g. /girne-girne-merkez-daire-487251.html -> 487251
          const codeMatch = detailUrl.match(/-(\d+)\.html/);
          const code = codeMatch ? codeMatch[1] : null;

          if (code && existingCodes.has(code) && !options.forceUpdate) {
            this.currentJob.skippedCount++;
            this.log('info', `⏭️ [#${code}] Zaten mevcut, atlandı.`);
            this.emit('progress', this.currentJob);
            continue;
          }

          try {
            await this.delay(delayMs);
            const detailHtml = await this.fetchHtml(detailUrl);
            const propertyData = parsePropertyDetail(detailHtml, detailUrl);

            stagingDb.upsertProperty(propertyData);
            if (propertyData.code) {
              existingCodes.add(propertyData.code);
            }
            this.currentJob.scrapedCount++;

            this.log(
              'success',
              `✅ [#${propertyData.code}] ${propertyData.title.slice(0, 40)}... - ${propertyData.price} ${propertyData.currency} (${propertyData.city})`
            );
            this.emit('property_scraped', propertyData);
          } catch (err: any) {
            this.currentJob.errorCount++;
            this.log('error', `⚠️ İlan detayı alınamadı (${detailUrl}): ${err.message}`);
          }

          this.emit('progress', this.currentJob);
        }
      }

      this.currentJob.status = this.shouldStop ? 'stopped' : 'completed';
      this.currentJob.finishedAt = new Date().toISOString();
      this.log('info', `✨ Tarama bitti! Yeni çekilen: ${this.currentJob.scrapedCount}, Önceden var olan (atlanan): ${this.currentJob.skippedCount}, Hata: ${this.currentJob.errorCount}`);
    } catch (err: any) {
      this.currentJob.status = 'failed';
      this.log('error', `🚨 Beklenmeyen hata: ${err.message}`);
    } finally {
      this.isRunning = false;
      this.emit('progress', this.currentJob);
    }
  }
}

export const crawler = new Crawler();
