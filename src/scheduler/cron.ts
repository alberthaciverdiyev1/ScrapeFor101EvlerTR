import cron, { type ScheduledTask } from 'node-cron';
import { crawler } from '../scraper/crawler.js';
import { metrajSync } from '../database/metraj-sync.js';
import { stagingDb } from '../database/staging.js';

export const CRON_CATEGORIES = [
  { name: 'Satılık Konut', url: '/kibris/satilik-konut' },
  { name: 'Kiralık Konut', url: '/kibris/kiralik-konut' },
  { name: 'Satılık Arsa & Arazi', url: '/kibris/satilik-arazi' },
  { name: 'Satılık Ticari Emlak', url: '/kibris/satilik-ticari-emlak' },
  { name: 'Kiralık Ticari Emlak', url: '/kibris/kiralik-ticari-emlak' },
];

export interface CronRunStats {
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  totalFound: number;
  newScraped: number;
  skippedCount: number;
  syncedCount: number;
  errorCount: number;
}

class ScraperScheduler {
  private cronExpression = process.env.CRON_SCHEDULE || '0 10,15 * * *'; // Default: 10:00 and 15:00 (5 hours apart)
  private scheduledTask: ScheduledTask | null = null;
  private isCronRunning = false;
  private lastRun: CronRunStats | null = null;

  init(): void {
    const isEnabled = process.env.CRON_ENABLED !== 'false';
    if (!isEnabled) {
      console.log('⏰ Otomatik cron zamanlayıcı devre dışı (CRON_ENABLED=false)');
      return;
    }

    console.log(`⏰ Cron Zamanlayıcı aktif: "${this.cronExpression}" (Günde 2 kez, 5 saat aralıkla 10:00 & 15:00)`);

    this.scheduledTask = cron.schedule(this.cronExpression, async () => {
      console.log(`\n⏰ [CRON] Zamanlanmış otomatik tarama görevi tetiklendi (${new Date().toLocaleString()})`);
      await this.runFullCrawl('cron');
    });
  }

  async runFullCrawl(triggerType: 'cron' | 'manual' = 'manual'): Promise<CronRunStats> {
    if (this.isCronRunning || crawler.isActive()) {
      const msg = '⚠️ Zaten bir tarama yürütülüyor. Zamanlanmış görev ertelendi.';
      console.warn(msg);
      throw new Error(msg);
    }

    this.isCronRunning = true;
    const stats: CronRunStats = {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      totalFound: 0,
      newScraped: 0,
      skippedCount: 0,
      syncedCount: 0,
      errorCount: 0,
    };
    this.lastRun = stats;

    try {
      console.log(`🚀 [CRON] 2 sayfalık otomatik tarama başlatılıyor: ${CRON_CATEGORIES.length} kategori...`);

      for (const cat of CRON_CATEGORIES) {
        console.log(`📂 [CRON] Kategori taranıyor: ${cat.name} (${cat.url}) - 2 Sayfa`);

        try {
          await crawler.start({
            categoryUrl: cat.url,
            maxPages: 2, // Sadece ilk 2 sayfada ara
            delayMs: 1000,
            forceUpdate: false, // Tekrar eden ilanları kesinlikle çekme
          });

          const job = crawler.getJob();
          if (job) {
            stats.totalFound += job.totalFound;
            stats.newScraped += job.scrapedCount;
            stats.skippedCount += job.skippedCount;
            stats.errorCount += job.errorCount;
          }
        } catch (catErr: any) {
          console.error(`❌ [CRON] ${cat.name} kategorisinde hata: ${catErr.message}`);
          stats.errorCount++;
        }

        // Kategori arası 3 saniye bekle
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Eğer yeni ilan çekildiyse otomatik Metraj'a aktar
      if (stats.newScraped > 0) {
        console.log(`🔄 [CRON] ${stats.newScraped} yeni ilan bulundu. Metraj veritabanına otomatik aktarılıyor...`);
        const syncRes = await metrajSync.syncAllPending();
        stats.syncedCount = syncRes.succeeded;
        console.log(`✅ [CRON] Metraj senkronizasyonu bitti. Başarılı: ${syncRes.succeeded}, Hata: ${syncRes.failed}`);
      } else {
        console.log(`ℹ️ [CRON] Yeni ilan bulunamadı. Toplam ${stats.skippedCount} mevcut ilan atlandı. Tüm liste güncel.`);
      }

      stats.status = 'completed';
      stats.finishedAt = new Date().toISOString();
      console.log(`✨ [CRON] Zamanlanmış tarama tamamlandı! Yeni: ${stats.newScraped}, Atlanan: ${stats.skippedCount}, Metraj'a Aktarılan: ${stats.syncedCount}`);
    } catch (err: any) {
      stats.status = 'failed';
      stats.finishedAt = new Date().toISOString();
      console.error(`🚨 [CRON] Zamanlanmış taramada kritik hata: ${err.message}`);
    } finally {
      this.isCronRunning = false;
    }

    return stats;
  }

  getStatus() {
    return {
      enabled: process.env.CRON_ENABLED !== 'false',
      schedule: this.cronExpression,
      scheduleHuman: 'Günde 2 kez (10:00 ve 15:00 - 5 saat arayla)',
      isRunning: this.isCronRunning || crawler.isActive(),
      categories: CRON_CATEGORIES.map((c) => c.name),
      maxPagesPerCategory: 2,
      lastRun: this.lastRun,
    };
  }
}

export const scraperScheduler = new ScraperScheduler();
