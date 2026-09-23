export interface MultilingualTitle {
  tr: string;
  az: string;
  en: string;
  ru: string;
  [key: string]: string;
}

export interface TitleSourceData {
  dealType?: string | null;
  propertyType?: string | null;
  rooms?: string | null;
  roomCount?: number | null;
  area?: number | null;
  landArea?: number | null;
  city?: string | null;
  district?: string | null;
  title?: string | null;
}

const TR_CHAR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u'
};

export function slugify(text: string): string {
  return (text || '')
    .split('')
    .map((c) => TR_CHAR_MAP[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const CITIES_DATA: Record<string, { id: number; az: string; en: string; ru: string; tr: string }> = {
  girne: { id: 1, az: 'Girne', en: 'Kyrenia', ru: 'Гирне (Кирения)', tr: 'Girne' },
  kyrenia: { id: 1, az: 'Girne', en: 'Kyrenia', ru: 'Гирне (Кирения)', tr: 'Girne' },
  lefkosa: { id: 2, az: 'Lefkoşa', en: 'Nicosia', ru: 'Лефкоша (Никосия)', tr: 'Lefkoşa' },
  nicosia: { id: 2, az: 'Lefkoşa', en: 'Nicosia', ru: 'Лефкоша (Никосия)', tr: 'Lefkoşa' },
  gazimagusa: { id: 3, az: 'Gazimağusa', en: 'Famagusta', ru: 'Газимагуса (Фамагуста)', tr: 'Gazimağusa' },
  magusa: { id: 3, az: 'Gazimağusa', en: 'Famagusta', ru: 'Газимагуса (Фамагуста)', tr: 'Gazimağusa' },
  famagusta: { id: 3, az: 'Gazimağusa', en: 'Famagusta', ru: 'Газимагуса (Фамагуста)', tr: 'Gazimağusa' },
  iskele: { id: 4, az: 'İskele', en: 'Iskele (Trikomo)', ru: 'Искеле (Трикомо)', tr: 'İskele' },
  trikomo: { id: 4, az: 'İskele', en: 'Iskele (Trikomo)', ru: 'Искеле (Трикомо)', tr: 'İskele' },
  guzelyurt: { id: 5, az: 'Güzelyurt', en: 'Guzelyurt (Morphou)', ru: 'Гюзельюрт (Морфу)', tr: 'Güzelyurt' },
  morphou: { id: 5, az: 'Güzelyurt', en: 'Guzelyurt (Morphou)', ru: 'Гюзельюрт (Морфу)', tr: 'Güzelyurt' },
  lefke: { id: 6, az: 'Lefke', en: 'Lefka', ru: 'Лефке', tr: 'Lefke' },
  lefka: { id: 6, az: 'Lefke', en: 'Lefka', ru: 'Лефке', tr: 'Lefke' },
};

export const DISTRICTS_DATA: Record<string, { cityId: number; az: string; en: string; ru: string; tr: string }> = {
  'girne-merkez': { cityId: 1, az: 'Girne Mərkəz', en: 'Kyrenia Center', ru: 'Центр Гирне', tr: 'Girne Merkez' },
  alsancak: { cityId: 1, az: 'Alsancak', en: 'Alsancak', ru: 'Алсанджак', tr: 'Alsancak' },
  lapta: { cityId: 1, az: 'Lapta', en: 'Lapta', ru: 'Лапта', tr: 'Lapta' },
  catalkoy: { cityId: 1, az: 'Çatalköy', en: 'Catalkoy', ru: 'Чаталкой', tr: 'Çatalköy' },
  esentepe: { cityId: 1, az: 'Esentepe', en: 'Esentepe', ru: 'Эсентепе', tr: 'Esentepe' },
  karaoglanoglu: { cityId: 1, az: 'Karaoğlanoğlu', en: 'Karaoglanoglu', ru: 'Караогланоглу', tr: 'Karaoğlanoğlu' },
  ozankoy: { cityId: 1, az: 'Ozanköy', en: 'Ozankoy', ru: 'Озанкой', tr: 'Ozanköy' },
  bellapais: { cityId: 1, az: 'Beylerbeyi (Bellapais)', en: 'Bellapais', ru: 'Беллапаис', tr: 'Beylerbeyi (Bellapais)' },
  karsiyaka: { cityId: 1, az: 'Karşıyaka', en: 'Karsiyaka', ru: 'Каршияка', tr: 'Karşıyaka' },
  dogankoy: { cityId: 1, az: 'Doğanköy', en: 'Dogankoy', ru: 'Доганкой', tr: 'Doğanköy' },
  zeytinlik: { cityId: 1, az: 'Zeytinlik', en: 'Zeytinlik', ru: 'Зейтинлик', tr: 'Zeytinlik' },
  dikmen: { cityId: 1, az: 'Dikmen', en: 'Dikmen', ru: 'Дикмен', tr: 'Dikmen' },
  bahceli: { cityId: 1, az: 'Bahçeli', en: 'Bahceli', ru: 'Бахчели', tr: 'Bahçeli' },
  tatlisu: { cityId: 1, az: 'Tatlısu', en: 'Tatlisu', ru: 'Татлысу', tr: 'Tatlısu' },
  'lefkosa-merkez': { cityId: 2, az: 'Lefkoşa Mərkəz', en: 'Nicosia Center', ru: 'Центр Лефкоша', tr: 'Lefkoşa Merkez' },
  gonyeli: { cityId: 2, az: 'Gönyeli', en: 'Gonyeli', ru: 'Гёньели', tr: 'Gönyeli' },
  'kucuk-kaymakli': { cityId: 2, az: 'Küçük Kaymaklı', en: 'Kucuk Kaymakli', ru: 'Кючюк Каймаклы', tr: 'Küçük Kaymaklı' },
  kaymakli: { cityId: 2, az: 'Küçük Kaymaklı', en: 'Kucuk Kaymakli', ru: 'Кючюк Каймаклы', tr: 'Küçük Kaymaklı' },
  ortakoy: { cityId: 2, az: 'Ortaköy', en: 'Ortakoy', ru: 'Ортакой', tr: 'Ortaköy' },
  kumsal: { cityId: 2, az: 'Köşklüçiftlik / Kumsal', en: 'Kumsal', ru: 'Кумсал', tr: 'Köşklüçiftlik / Kumsal' },
  koskluciftlik: { cityId: 2, az: 'Köşklüçiftlik / Kumsal', en: 'Kumsal', ru: 'Кумсал', tr: 'Köşklüçiftlik / Kumsal' },
  marmara: { cityId: 2, az: 'Marmara', en: 'Marmara', ru: 'Мармара', tr: 'Marmara' },
  yenisehir: { cityId: 2, az: 'Yenişehir', en: 'Yenisehir', ru: 'Енишехир', tr: 'Yenişehir' },
  taskinkoy: { cityId: 2, az: 'Taşkınköy', en: 'Taskinkoy', ru: 'Ташкынкой', tr: 'Taşkınköy' },
  hamitkoy: { cityId: 2, az: 'Hamitköy', en: 'Hamitkoy', ru: 'Хамиткой', tr: 'Hamitköy' },
  degirmenlik: { cityId: 2, az: 'Değirmenlik', en: 'Degirmenlik', ru: 'Дегирменлик', tr: 'Değirmenlik' },
  alaykoy: { cityId: 2, az: 'Alayköy', en: 'Alaykoy', ru: 'Алайкой', tr: 'Alayköy' },
  haspolat: { cityId: 2, az: 'Haspolat', en: 'Haspolat', ru: 'Хасполат', tr: 'Haspolat' },
  'gazimagusa-merkez': { cityId: 3, az: 'Gazimağusa Mərkəz', en: 'Famagusta Center', ru: 'Центр Фамагусты', tr: 'Gazimağusa Merkez' },
  'yeni-bogazici': { cityId: 3, az: 'Salamis / Yeni Boğaziçi', en: 'Yeni Bogazici', ru: 'Ени Богазчи', tr: 'Salamis / Yeni Boğaziçi' },
  salamis: { cityId: 3, az: 'Salamis / Yeni Boğaziçi', en: 'Yeni Bogazici', ru: 'Ени Богазчи', tr: 'Salamis / Yeni Boğaziçi' },
  karakol: { cityId: 3, az: 'Karakol', en: 'Karakol', ru: 'Каракол', tr: 'Karakol' },
  sakarya: { cityId: 3, az: 'Sakarya', en: 'Sakarya', ru: 'Сакарья', tr: 'Sakarya' },
  gulseren: { cityId: 3, az: 'Gülseren', en: 'Gulseren', ru: 'Гюльсерен', tr: 'Gülseren' },
  tuzla: { cityId: 3, az: 'Tuzla', en: 'Tuzla', ru: 'Тузла', tr: 'Tuzla' },
  dumlupinar: { cityId: 3, az: 'Dumlupınar', en: 'Dumlupinar', ru: 'Думлупынар', tr: 'Dumlupınar' },
  canakkale: { cityId: 3, az: 'Çanakkale', en: 'Canakkale', ru: 'Чанаккале', tr: 'Çanakkale' },
  maras: { cityId: 3, az: 'Maraş', en: 'Maras', ru: 'Мараш', tr: 'Maraş' },
  gecitkale: { cityId: 3, az: 'Geçitkale', en: 'Gecitkale', ru: 'Гечиткале', tr: 'Geçitkale' },
  'iskele-merkez': { cityId: 4, az: 'İskele Mərkəz', en: 'Iskele Center', ru: 'Центр Искеле', tr: 'İskele Merkez' },
  'long-beach': { cityId: 4, az: 'Long Beach', en: 'Long Beach', ru: 'Лонг Бич', tr: 'Long Beach' },
  longbeach: { cityId: 4, az: 'Long Beach', en: 'Long Beach', ru: 'Лонг Бич', tr: 'Long Beach' },
  bogaz: { cityId: 4, az: 'Boğaz', en: 'Bogaz', ru: 'Богаз', tr: 'Boğaz' },
  bafra: { cityId: 4, az: 'Bafra Turizm Bölgəsi', en: 'Bafra', ru: 'Бафра', tr: 'Bafra Turizm Bölgesi' },
  otuken: { cityId: 4, az: 'Ötüken', en: 'Otuken', ru: 'Отукен', tr: 'Ötüken' },
  kumyali: { cityId: 4, az: 'Kumyalı', en: 'Kumyali', ru: 'Кумьялы', tr: 'Kumyalı' },
  mehmetcik: { cityId: 4, az: 'Mehmetçik', en: 'Mehmetcik', ru: 'Мехметчик', tr: 'Mehmetçik' },
  dipkarpaz: { cityId: 4, az: 'Dipkarpaz', en: 'Dipkarpaz', ru: 'Дипкарпаз', tr: 'Dipkarpaz' },
  yenierenkoy: { cityId: 4, az: 'Yenierenköy', en: 'Yenierenkoy', ru: 'Ениэренкёй', tr: 'Yenierenköy' },
  'guzelyurt-merkez': { cityId: 5, az: 'Güzelyurt Mərkəz', en: 'Guzelyurt Center', ru: 'Центр Гюзельюрт', tr: 'Güzelyurt Merkez' },
  kalkanli: { cityId: 5, az: 'Kalkanlı (ODTÜ)', en: 'Kalkanli', ru: 'Калканлы', tr: 'Kalkanlı (ODTÜ)' },
  bostanci: { cityId: 5, az: 'Bostancı', en: 'Bostanci', ru: 'Бостанджи', tr: 'Bostancı' },
  yayla: { cityId: 5, az: 'Yayla', en: 'Yayla', ru: 'Яйла', tr: 'Yayla' },
  zumrutkoy: { cityId: 5, az: 'Zümrütköy', en: 'Zumrutkoy', ru: 'Зюмрюткой', tr: 'Zümrütköy' },
  akcay: { cityId: 5, az: 'Akçay', en: 'Akcay', ru: 'Акчай', tr: 'Akçay' },
  aydinkoy: { cityId: 5, az: 'Aydınköy', en: 'Aydinkoy', ru: 'Айдынкой', tr: 'Aydınköy' },
  'lefke-merkez': { cityId: 6, az: 'Lefke Mərkəz', en: 'Lefke Center', ru: 'Центр Лефке', tr: 'Lefke Merkez' },
  gemikonagi: { cityId: 6, az: 'Gemikonağı (LAÜ)', en: 'Gemikonagi', ru: 'Гемиконагы', tr: 'Gemikonağı (LAÜ)' },
  yedidalga: { cityId: 6, az: 'Yedidalga', en: 'Yedidalga', ru: 'Йедидалга', tr: 'Yedidalga' },
  gaziveren: { cityId: 6, az: 'Gaziveren', en: 'Gaziveren', ru: 'Газиверен', tr: 'Gaziveren' },
  baglikoy: { cityId: 6, az: 'Bağlıköy', en: 'Baglikoy', ru: 'Баглыкой', tr: 'Bağlıköy' },
  yesilyurt: { cityId: 6, az: 'Yeşilyurt', en: 'Yesilyurt', ru: 'Ешилюрт', tr: 'Yeşilyurt' },
};

export function findCitySlug(rawCity: string): string | null {
  const clean = slugify(rawCity);
  for (const key of Object.keys(CITIES_DATA)) {
    if (clean.includes(key) || key.includes(clean)) {
      return key;
    }
  }
  return null;
}

export function findDistrictSlug(rawDistrict: string): string | null {
  const clean = slugify(rawDistrict);
  if (DISTRICTS_DATA[clean]) return clean;

  for (const key of Object.keys(DISTRICTS_DATA)) {
    if (clean.includes(key) || key.includes(clean)) {
      return key;
    }
  }
  return null;
}

function getDealLabel(dealType: string, locale: 'tr' | 'az' | 'en' | 'ru'): string {
  const dt = (dealType || '').toLowerCase();
  const isRent = dt.includes('rent') || dt.includes('kira') || dt.includes('icare');
  if (isRent) {
    switch (locale) {
      case 'tr': return 'Kiralık';
      case 'az': return 'Kirayə';
      case 'en': return 'For Rent';
      case 'ru': return 'Аренда';
    }
  }
  // Default: Sale
  switch (locale) {
    case 'tr': return 'Satılık';
    case 'az': return 'Satılır';
    case 'en': return 'For Sale';
    case 'ru': return 'Продажа';
  }
}

function getSpecLabel(data: TitleSourceData, locale: 'tr' | 'az' | 'en' | 'ru'): string {
  const pType = (data.propertyType || '').toLowerCase();
  const rawTitle = (data.title || '').toLowerCase();
  const isLand = pType.includes('arsa') || pType.includes('tarla') || pType.includes('arazi') || pType.includes('land') || pType.includes('torpaq') || rawTitle.includes('arsa') || rawTitle.includes('tarla');

  if (isLand) {
    if (data.landArea) {
      const unit = locale === 'tr' ? 'dönüm' : locale === 'ru' ? 'сот.' : 'sot';
      return `${data.landArea} ${unit}`;
    }
    if (data.area) {
      return `${Math.round(data.area)} m²`;
    }
    switch (locale) {
      case 'tr': return 'Arsa';
      case 'az': return 'Torpaq';
      case 'en': return 'Land';
      case 'ru': return 'Земля';
    }
  }

  // Check rooms string (e.g. "3+1", "2+1", "1+0", "Stüdyo")
  if (data.rooms) {
    const roomMatch = data.rooms.match(/^(\d+)\+(\d+)/);
    if (roomMatch) {
      return `${roomMatch[1]}+${roomMatch[2]}`;
    }
    if (/st[uü]dyo|studio/i.test(data.rooms)) {
      switch (locale) {
        case 'tr': return 'Stüdyo';
        case 'az': return 'Studiya';
        case 'en': return 'Studio';
        case 'ru': return 'Студия';
      }
    }
  }

  // Check roomCount number (e.g. 3 -> 3+1)
  if (data.roomCount !== null && data.roomCount !== undefined && data.roomCount > 0) {
    return `${data.roomCount}+1`;
  }

  // Check area
  if (data.area) {
    return `${Math.round(data.area)} m²`;
  }

  // Fallback to property type
  if (pType.includes('villa') || pType.includes('mustakil') || pType.includes('müstakil') || pType.includes('ev') || rawTitle.includes('villa')) {
    switch (locale) {
      case 'tr': return 'Müstakil Ev';
      case 'az': return 'Həyət evi / Bağ evi';
      case 'en': return 'House / Villa';
      case 'ru': return 'Дом / Дача';
    }
  }
  if (pType.includes('ofis') || pType.includes('buro') || pType.includes('büro')) {
    switch (locale) {
      case 'tr': return 'Ofis';
      case 'az': return 'Ofis';
      case 'en': return 'Office';
      case 'ru': return 'Офис';
    }
  }
  if (pType.includes('dukkan') || pType.includes('dükkan') || pType.includes('magaza') || pType.includes('mağaza') || pType.includes('ticari')) {
    switch (locale) {
      case 'tr': return 'Ticari';
      case 'az': return 'Obyekt';
      case 'en': return 'Commercial';
      case 'ru': return 'Коммерческий объект';
    }
  }

  // Default Apartment
  switch (locale) {
    case 'tr': return 'Daire';
    case 'az': return 'Mənzil';
    case 'en': return 'Apartment';
    case 'ru': return 'Квартира';
  }
}

function getLocationLabel(districtSlug: string | null, citySlug: string | null, rawDistrict: string | null, rawCity: string | null, locale: 'tr' | 'az' | 'en' | 'ru'): string {
  const dist = districtSlug ? DISTRICTS_DATA[districtSlug] : null;
  const city = citySlug ? CITIES_DATA[citySlug] : null;

  if (dist && city) {
    const distName = dist[locale] || dist.tr;
    const cityName = city[locale] || city.tr;
    if (
      dist.tr.toLowerCase().includes('merkez') ||
      distName.toLowerCase().includes(cityName.toLowerCase()) ||
      distName.toLowerCase().includes(city.tr.toLowerCase())
    ) {
      return distName;
    }
    return `${distName}, ${cityName}`;
  }

  if (dist) {
    return dist[locale] || dist.tr;
  }

  if (city) {
    return city[locale] || city.tr;
  }

  // Fallback to raw values if no slug match
  if (rawDistrict && rawCity) {
    if (rawDistrict.toLowerCase().includes(rawCity.toLowerCase())) {
      return rawDistrict;
    }
    return `${rawDistrict}, ${rawCity}`;
  }

  return rawDistrict || rawCity || '';
}

/**
 * Builds standard Metraj listing titles for all supported locales:
 * Format: [İşlem Türü (Satılık/Kiralık)], [Oda / Alan / Tür], [Konum]
 * Matches Metraj's PropertyTitleBuilder service 100%.
 */
export function buildPropertyTitles(data: TitleSourceData): MultilingualTitle {
  const citySlug = data.city ? findCitySlug(data.city) : null;
  const districtSlug = data.district ? findDistrictSlug(data.district) : null;

  const locales: Array<'tr' | 'az' | 'en' | 'ru'> = ['tr', 'az', 'en', 'ru'];
  const result: Record<string, string> = {};

  for (const loc of locales) {
    const parts: string[] = [];

    // 1) Deal Type
    parts.push(getDealLabel(data.dealType || 'sale', loc));

    // 2) Specification (Rooms / Area / Property Type)
    const spec = getSpecLabel(data, loc);
    if (spec) parts.push(spec);

    // 3) Location
    const location = getLocationLabel(districtSlug, citySlug, data.district || null, data.city || null, loc);
    if (location) parts.push(location);

    result[loc] = parts.join(', ');
  }

  return {
    tr: result.tr || 'Emlak İlanı',
    az: result.az || 'Əmlak Elanı',
    en: result.en || 'Property Listing',
    ru: result.ru || 'Объявление о недвижимости',
  };
}

/**
 * Generates SEO-friendly slug according to Metraj conventions:
 * Format: [slugified-title]-[code]
 */
export function buildPropertySlug(titles: MultilingualTitle, code: string): string {
  const baseTitle = titles.tr || titles.az || 'ilan';
  return `${slugify(baseTitle)}-${code}`;
}
