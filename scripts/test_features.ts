import { Crawler } from '../src/scraper/crawler.js';
import * as cheerio from 'cheerio';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const crawler = new Crawler();
  const testUrls = [
    'https://www.101evler.com/kibris/satilik-emlak/girne-edremit-villa-341522.html',
    'https://www.101evler.com/kibris/satilik-emlak/girne-girne-merkez-daire-487251.html',
    'https://www.101evler.com/kibris/satilik-emlak/girne-esentepe-penthouse-551968.html',
    'https://www.101evler.com/kibris/satilik-emlak/lefkosa-gonyeli-daire-562773.html',
    'https://www.101evler.com/kibris/satilik-emlak/iskele-long-beach-studyo-daire-546668.html'
  ];

  const allFeatures: Record<string, Set<string>> = {};

  for (const url of testUrls) {
    try {
      console.log('Checking:', url);
      await delay(1000);
      const html = await crawler.fetchHtml(url);
      const $ = cheerio.load(html);

      $('.text-block-142').each((_, heading) => {
        const category = $(heading).text().trim();
        if (!allFeatures[category]) allFeatures[category] = new Set();

        const parent = $(heading).closest('.div-block-584');
        const nextSibling = parent.next('.div-block-362');
        nextSibling.find('.checktext').each((_, el) => {
          const item = $(el).text().trim();
          if (item) allFeatures[category].add(item);
        });
      });
    } catch (e: any) {
      console.warn('Fetch error:', e.message);
    }
  }

  console.log('\n=== COLLECTED FEATURES FROM 101EVLER ===');
  for (const [cat, items] of Object.entries(allFeatures)) {
    console.log(`\n[${cat}] (${items.size} adet):`);
    for (const item of Array.from(items).sort()) {
      console.log(`  - ${item}`);
    }
  }
}

main().catch(console.error);
