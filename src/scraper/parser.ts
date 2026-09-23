import * as cheerio from 'cheerio';
import type { RawPropertyData } from '../types.js';
import { buildPropertyTitles } from './title-builder.js';

export function parseListingPage(html: string): { urls: string[]; totalPages?: number } {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  // 1. Try extracting from JSON-LD ItemList
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
        for (const item of data.itemListElement) {
          if (item.url && typeof item.url === 'string') {
            urls.push(item.url);
          }
        }
      }
    } catch {}
  });

  // 2. Fallback: Parse from HTML anchors if JSON-LD wasn't present
  if (urls.length === 0) {
    $('a[href*="/kibris/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.endsWith('.html') && href.includes('-')) {
        const fullUrl = href.startsWith('http') ? href : `https://www.101evler.com${href}`;
        if (!urls.includes(fullUrl)) urls.push(fullUrl);
      }
    });
  }

  return { urls };
}

export function parsePropertyDetail(html: string, url: string): RawPropertyData {
  const $ = cheerio.load(html);

  // Extract JSON-LD
  let jsonLd: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'RealEstateListing') {
        jsonLd = data;
      }
    } catch {}
  });

  // Extract Key-Value Specs box (col-5 and col-7)
  const specs: Record<string, string> = {};
  $('.text-block-141').each((_, el) => {
    const key = $(el).find('.col-5').text().trim();
    const val = $(el).find('.col-7').text().trim();
    if (key && val) {
      specs[key] = val;
    }
  });

  // Also support direct col-5 col-7 siblings
  if (Object.keys(specs).length === 0) {
    $('.col-5').each((i, el) => {
      const key = $(el).text().trim();
      const val = $(el).next('.col-7').text().trim();
      if (key && val) specs[key] = val;
    });
  }

  // Extract Code / ID
  let code = '';
  if (specs['İlan No']) {
    code = specs['İlan No'].replace('#', '').trim();
  }
  if (!code) {
    const m = url.match(/-(\d+)\.html/);
    if (m) code = m[1];
  }

  // Title
  const title =
    jsonLd?.name ||
    $('h1').first().text().trim() ||
    $('title').text().replace('- 101evler.com', '').trim();

  // Description (Rich formatted HTML with linebreaks, paragraphs and lists)
  const descContainer = $('.f-s-16, .div-block-361, #description').first();
  const rawDesc = descContainer.length ? descContainer.html() || '' : (jsonLd?.description || '');
  const description = cleanRichDescription(rawDesc);


  // Price & Currency
  let price = 0;
  let currency = 'GBP';
  if (jsonLd?.offers?.price) {
    price = parseFloat(jsonLd.offers.price) || 0;
    currency = jsonLd.offers.priceCurrency || 'GBP';
  } else if (specs['Fiyat']) {
    const rawPrice = specs['Fiyat'];
    if (rawPrice.includes('£')) currency = 'GBP';
    else if (rawPrice.includes('€')) currency = 'EUR';
    else if (rawPrice.includes('$')) currency = 'USD';
    else if (rawPrice.includes('TL') || rawPrice.includes('₺')) currency = 'TRY';
    price = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
  }

  // Location (City & District)
  let city = '';
  let district = '';
  const rawLoc = specs['Konum'] || '';
  if (rawLoc.includes(',')) {
    const parts = rawLoc.split(',').map((s) => s.trim());
    district = parts[0];
    city = parts[1];
  } else if (jsonLd?.itemOffered?.address) {
    district = jsonLd.itemOffered.address.streetAddress || '';
    city = jsonLd.itemOffered.address.addressLocality || '';
  }

  // Area (m²)
  let area: number | null = null;
  if (specs['Metrekare']) {
    const m = specs['Metrekare'].replace(/m2|m²/gi, '').trim().match(/^([0-9]+(?:[\.,][0-9]+)?)/);
    if (m) area = parseFloat(m[1].replace(',', '.')) || null;
  } else if (jsonLd?.itemOffered?.floorSize?.value) {
    area = parseFloat(jsonLd.itemOffered.floorSize.value) || null;
  }

  // Land Area
  let landArea: number | null = null;
  if (specs['Arsa Büyüklüğü']) {
    const m = specs['Arsa Büyüklüğü'].replace(/m2|m²|dönüm|evlek/gi, '').trim().match(/^([0-9]+(?:[\.,][0-9]+)?)/);
    if (m) landArea = parseFloat(m[1].replace(',', '.')) || null;
  }

  // Rooms
  const roomsStr = specs['Oda Sayısı'] || jsonLd?.itemOffered?.numberOfRooms || null;
  let roomCount: number | null = null;
  if (roomsStr) {
    const m = roomsStr.match(/^(\d+)/);
    if (m) roomCount = parseInt(m[1], 10);
  }

  // Bathrooms
  let bathrooms: number | null = null;
  if (specs['Banyo Sayısı']) {
    bathrooms = parseInt(specs['Banyo Sayısı'].replace(/[^0-9]/g, ''), 10) || null;
  } else if (jsonLd?.itemOffered?.numberOfBathroomsTotal) {
    bathrooms = parseInt(jsonLd.itemOffered.numberOfBathroomsTotal, 10) || null;
  }

  // Floor & Total Floors
  let floor: number | null = null;
  let totalFloors: number | null = null;
  if (specs['Bulunduğu Kat']) {
    floor = parseInt(specs['Bulunduğu Kat'].replace(/[^0-9]/g, ''), 10);
    if (isNaN(floor)) floor = null;
  }
  if (specs['Kat Sayısı']) {
    totalFloors = parseInt(specs['Kat Sayısı'].replace(/[^0-9]/g, ''), 10) || null;
  }

  // Building Age
  const buildingAge = specs['Bina Yaşı'] || null;

  // Furnished Status
  let furnishedStatus: string | null = null;
  const rawFurnished = specs['Eşya Durumu'] || '';
  if (rawFurnished.toLowerCase().includes('ful') || rawFurnished.toLowerCase().includes('eşyalı')) {
    furnishedStatus = 'furnished';
  } else if (rawFurnished.toLowerCase().includes('eşyasız')) {
    furnishedStatus = 'unfurnished';
  } else if (rawFurnished.toLowerCase().includes('kısmi')) {
    furnishedStatus = 'semi_furnished';
  }

  // In Complex
  const inComplex = specs['Site İçerisinde']?.toLowerCase() === 'evet';

  // Exchangeable (Takas)
  const exchangeable = specs['Takas']?.toLowerCase() === 'var' || specs['Takas']?.toLowerCase() === 'evet';

  // Zoning & Floors Allowed (for Land)
  let zoningRatio: number | null = null;
  let floorsAllowed: number | null = null;
  if (specs['İmar Oranı']) {
    zoningRatio = parseInt(specs['İmar Oranı'].replace(/[^0-9]/g, ''), 10) || null;
  }
  if (specs['Kat İzni']) {
    floorsAllowed = parseInt(specs['Kat İzni'].replace(/[^0-9]/g, ''), 10) || null;
  }

  // Koçan Türü (Title Deed Type)
  let deedType: string | null = null;
  const combinedText = `${title} ${description} ${specs['Koçan Türü'] || ''}`.toLowerCase();
  if (combinedText.includes('türk koçan') || combinedText.includes('türk malı') || combinedText.includes('turk kocan')) {
    deedType = 'turkish';
  } else if (combinedText.includes('eşdeğer') || combinedText.includes('esdeger')) {
    deedType = 'exchange';
  } else if (combinedText.includes('tahsis')) {
    deedType = 'allocation';
  } else if (combinedText.includes('ingiliz') || combinedText.includes('yabancı')) {
    deedType = 'foreign';
  }

  // Images (Clean, watermark-free property_thumb URLs)
  const images: string[] = [];
  if (Array.isArray(jsonLd?.image)) {
    for (const img of jsonLd.image) {
      if (typeof img === 'string') {
        const cleanUrl = img.replace('/property_wm/', '/property_thumb/');
        if (!images.includes(cleanUrl)) images.push(cleanUrl);
      }
    }
  }
  // Fallback to HTML images
  if (images.length === 0) {
    $('img[src*="media.101evler.com/property"]').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        const cleanUrl = src.replace('/property_wm/', '/property_thumb/');
        if (!images.includes(cleanUrl)) images.push(cleanUrl);
      }
    });
  }

  // Geo Coordinates
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (jsonLd?.itemOffered?.geo) {
    latitude = parseFloat(jsonLd.itemOffered.geo.latitude) || null;
    longitude = parseFloat(jsonLd.itemOffered.geo.longitude) || null;
  }

  // Agency & Agent Extraction
  const card = $('.danismankartilandevfoto, .danismankartilan').first();

  let agencyName: string | null = jsonLd?.seller?.name || card.find('.text-block-157').first().text().trim() || specs['Firma'] || null;

  // Check if private owner (Sahibinden)
  const isOwner =
    (agencyName && agencyName.toLowerCase().includes('sahibinden')) ||
    specs['Kimden']?.toLowerCase() === 'sahibinden';

  if (isOwner) {
    agencyName = null;
  }

  // Agent Name
  let agentName: string | null = null;
  if (!isOwner) {
    card.find('.text-block-156').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt && (!agencyName || txt.toLowerCase() !== agencyName.toLowerCase())) {
        agentName = txt;
      }
    });
  }

  // Phones
  const telLinks = card.find('a[href^="tel:"]').map((_, el) => $(el).attr('href')?.replace('tel:', '').trim()).get();
  const directPhone = telLinks[0] || jsonLd?.seller?.telephone || null;
  const agencyPhone = jsonLd?.seller?.telephone || telLinks[1] || directPhone;

  // WhatsApp
  let agentWhatsapp: string | null = null;
  const waHref = card.find('a[href*="wa.me"]').first().attr('href') || $('a[href*="wa.me"]').first().attr('href');
  if (waHref) {
    const m = waHref.match(/wa\.me\/(\d+)/);
    if (m) agentWhatsapp = `+${m[1]}`;
  }

  // Agent Avatar
  let agentAvatar: string | null = card.find('img[src*="agent-profile"], img[src*="user_profile"]').first().attr('src') || null;
  if (agentAvatar && (!agentAvatar.startsWith('http') || agentAvatar.includes('abstract-user'))) {
    agentAvatar = null;
  }

  // Agency Logo
  let agencyLogo: string | null = jsonLd?.seller?.logo || card.find('.div-block-382 img').first().attr('src') || null;
  if (agencyLogo && (!agencyLogo.startsWith('http') || agencyLogo.includes('abstract-user'))) {
    agencyLogo = null;
  }

  // Agency Address
  const agencyAddress: string | null = jsonLd?.seller?.address?.streetAddress || specs['Firma Adresi'] || null;

  // Category / Deal Type / Property Type
  let dealType: RawPropertyData['dealType'] = 'sale';
  const durum = (specs['Durumu'] || jsonLd?.category || '').toLowerCase();
  if (durum.includes('kira') || url.includes('kiralik')) {
    dealType = 'rent';
  }
  const emlakTuru = specs['Emlak Türü'] || specs['Türü'] || specs['Konut Tipi'] || specs['İlan Tipi'] || 'Daire';

  // Amenities & Features (İç, Dış, Konum Özellikleri)
  const amenities: Array<{ name: string; category?: string }> = [];
  const seenAmenities = new Set<string>();

  $('.text-block-142').each((_, heading) => {
    const category = $(heading).text().trim() || 'Genel Özellikler';
    const parent = $(heading).closest('.div-block-584');
    const nextSibling = parent.next('.div-block-362');

    nextSibling.find('.checktext').each((_, el) => {
      const name = $(el).text().trim();
      if (name && !seenAmenities.has(name.toLowerCase())) {
        seenAmenities.add(name.toLowerCase());
        amenities.push({ name, category });
      }
    });
  });

  // Fallback: collect any remaining .checktext
  $('.checktext').each((_, el) => {
    const name = $(el).text().trim();
    if (name && !seenAmenities.has(name.toLowerCase())) {
      seenAmenities.add(name.toLowerCase());
      amenities.push({ name, category: 'Genel Özellikler' });
    }
  });

  const generatedTitles = buildPropertyTitles({
    dealType,
    propertyType: emlakTuru,
    rooms: roomsStr,
    roomCount,
    area,
    landArea,
    city,
    district,
    title,
  });

  return {
    code: code || String(Date.now()),
    url,
    title: generatedTitles.tr,
    originalTitle: title,
    description,
    price,
    currency,
    dealType,
    propertyType: emlakTuru,
    category: specs['Durumu'] || 'Satılık',
    city,
    district,
    address: specs['Konum'] || `${district}, ${city}`,
    latitude,
    longitude,
    area,
    landArea,
    rooms: roomsStr,
    roomCount,
    bathrooms,
    floor,
    totalFloors,
    buildingAge,
    deedType,
    furnishedStatus,
    inComplex,
    exchangeable,
    zoningRatio,
    floorsAllowed,
    images,
    agencyName,
    agencyPhone,
    agencyLogo,
    agencyAddress,
    agentName,
    agentPhone: directPhone,
    agentWhatsapp,
    agentAvatar,
    amenities,
    datePosted: jsonLd?.datePosted || specs['İlan Tarihi'] || null,
    rawJsonLd: jsonLd,
  };
}

export function cleanRichDescription(rawInput: string): string {
  if (!rawInput) return '';

  const hasHtml = /<[a-z][\s\S]*>/i.test(rawInput);
  let textWithLineBreaks = '';

  if (hasHtml) {
    const $ = cheerio.load(rawInput, null, false);

    // Remove unwanted / dangerous elements
    $('script, style, iframe, object, embed, noscript, link, form, input, button').remove();

    // Preserve links as plain text
    $('a').each((_, el) => {
      $(el).replaceWith($(el).text());
    });

    // Mark bold tags so we can restore them safely
    $('b, strong').each((_, el) => {
      const inner = $(el).text().trim();
      if (inner) {
        $(el).replaceWith(`__BOLD_START__${inner}__BOLD_END__`);
      } else {
        $(el).remove();
      }
    });

    // Replace <br> with newline
    $('br').replaceWith('\n');

    // Add newline after block tags
    $('div, p, li, h1, h2, h3, h4, h5, h6, tr').each((_, el) => {
      $(el).append('\n');
    });

    textWithLineBreaks = $.text();
  } else {
    textWithLineBreaks = rawInput;
  }

  const rawLines = textWithLineBreaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const blocks: string[] = [];
  let currentList: string[] = [];

  for (let line of rawLines) {
    line = line.replace(/\u00a0/g, ' ').replace(/&nbsp;/gi, ' ').trim();
    if (!line) continue;

    // Check if line starts with bullet marker: *, -, • (excluding numbers to avoid "1. kat" matching)
    const bulletMatch = line.match(/^([*•\-–—])\s*(.*)$/);
    if (bulletMatch && bulletMatch[2]) {
      let content = bulletMatch[2]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/__BOLD_START__/g, '<strong>')
        .replace(/__BOLD_END__/g, '</strong>');
      currentList.push(`<li>${content}</li>`);
    } else {
      if (currentList.length > 0) {
        blocks.push(`<ul class="list-disc pl-5 my-2 space-y-1">${currentList.join('')}</ul>`);
        currentList = [];
      }
      let content = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/__BOLD_START__/g, '<strong>')
        .replace(/__BOLD_END__/g, '</strong>');
      blocks.push(`<p>${content}</p>`);
    }
  }

  if (currentList.length > 0) {
    blocks.push(`<ul class="list-disc pl-5 my-2 space-y-1">${currentList.join('')}</ul>`);
  }

  return blocks.join('\n');
}

