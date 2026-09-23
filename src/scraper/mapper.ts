import type { RawPropertyData, MetrajPropertyPayload } from '../types.js';
import { cleanRichDescription } from './parser.js';
import { buildPropertyTitles, buildPropertySlug, slugify } from './title-builder.js';

export { slugify };

// Pre-defined Metraj FilterOption IDs
const DEAL_TYPE_MAP: Record<string, number> = {
  sale: 1, // Satılık
  rent: 2, // Kiralık (Aylık)
  rent_monthly: 2,
  rent_daily: 3,
};

const PROPERTY_TYPE_MAP: Record<string, number> = {
  daire: 4, // Apartment
  apartman: 4,
  rezidans: 4,
  villa: 5, // House / Villa
  'müstakil ev': 5,
  'bağ evi': 5,
  konut: 4,
  ofis: 6, // Office
  büro: 6,
  garaj: 7, // Garage
  arsa: 8, // Land
  arazi: 8,
  tarla: 8,
  dükkan: 9, // Commercial
  mağaza: 9,
  ticari: 9,
};

// City Slug/Name to Metraj City ID
const CITY_MAP: Record<string, number> = {
  girne: 1,
  kyrenia: 1,
  lefkoşa: 2,
  lefkosa: 2,
  nicosia: 2,
  gazimağusa: 3,
  magusa: 3,
  famagusta: 3,
  iskele: 4,
  trikomo: 4,
  güzelyurt: 5,
  guzelyurt: 5,
  morphou: 5,
  lefke: 6,
  lefka: 6,
};

export function mapToMetrajPayload(raw: RawPropertyData, districtMap: Record<string, number> = {}): MetrajPropertyPayload {
  // Determine city_id
  const cleanCity = slugify(raw.city || '');
  let cityId: number | null = null;
  for (const [key, id] of Object.entries(CITY_MAP)) {
    const slugKey = slugify(key);
    if (cleanCity.includes(slugKey) || slugKey.includes(cleanCity)) {
      cityId = id;
      break;
    }
  }

  // Determine district_id
  let districtId: number | null = null;
  const cleanDistrict = slugify(raw.district || '');
  if (cleanDistrict && districtMap[cleanDistrict]) {
    districtId = districtMap[cleanDistrict];
  } else {
    // Check partial match in districtMap
    for (const [name, id] of Object.entries(districtMap)) {
      const slugName = slugify(name);
      if (cleanDistrict.includes(slugName) || slugName.includes(cleanDistrict)) {
        districtId = id;
        break;
      }
    }
  }

  // Determine deal_type_id
  const dealTypeId = DEAL_TYPE_MAP[raw.dealType] || 1;

  // Determine property_type_id
  let propertyTypeId: number = 4; // default apartment
  const cleanType = (raw.propertyType || '').toLowerCase();
  for (const [k, id] of Object.entries(PROPERTY_TYPE_MAP)) {
    if (cleanType.includes(k) || (raw.title && raw.title.toLowerCase().includes(k))) {
      propertyTypeId = id;
      break;
    }
  }

  // Calculate currency prices (approximate fallback conversions from GBP if base is GBP)
  const basePrice = raw.price || 0;
  const currency = raw.currency || 'GBP';
  const prices: Record<string, number> = {
    [currency]: basePrice,
  };

  // Convert basic currencies for multi-currency display
  if (currency === 'GBP') {
    prices['GBP'] = basePrice;
    prices['TRY'] = Math.round(basePrice * 65.5);
    prices['USD'] = Math.round(basePrice * 1.33);
    prices['EUR'] = Math.round(basePrice * 1.20);
  } else if (currency === 'TRY') {
    prices['TRY'] = basePrice;
    prices['GBP'] = Math.round(basePrice / 65.5);
    prices['EUR'] = Math.round((basePrice / 65.5) * 1.20);
    prices['USD'] = Math.round((basePrice / 65.5) * 1.33);
  } else if (currency === 'EUR') {
    prices['EUR'] = basePrice;
    prices['GBP'] = Math.round(basePrice / 1.20);
    prices['TRY'] = Math.round((basePrice / 1.20) * 65.5);
    prices['USD'] = Math.round((basePrice / 1.20) * 1.33);
  } else if (currency === 'USD') {
    prices['USD'] = basePrice;
    prices['GBP'] = Math.round(basePrice / 1.33);
    prices['TRY'] = Math.round((basePrice / 1.33) * 65.5);
    prices['EUR'] = Math.round((basePrice / 1.33) * 1.20);
  }

  const titles = buildPropertyTitles({
    dealType: raw.dealType,
    propertyType: raw.propertyType,
    rooms: raw.rooms,
    roomCount: raw.roomCount,
    area: raw.area,
    landArea: raw.landArea,
    city: raw.city,
    district: raw.district,
    title: raw.originalTitle || raw.title,
  });

  const slug = buildPropertySlug(titles, String(raw.code));
  const formattedDesc = raw.description?.includes('<p>')
    ? raw.description
    : cleanRichDescription(raw.description || '');

  return {
    code: String(raw.code),
    title: titles,
    slug,
    description: {
      tr: formattedDesc,
      en: formattedDesc,
      az: formattedDesc,
      ru: formattedDesc,
    },
    price: basePrice,
    currency,
    prices,
    deal_type_id: dealTypeId,
    property_type_id: propertyTypeId,
    seller_type: (raw.agencyName || raw.agentName) ? 'agency' : 'owner',
    advertiser_name: raw.agentName || raw.agencyName || 'Sahibinden',
    phone: raw.agentPhone || raw.agencyPhone || '+905330000000',
    agency_name: raw.agencyName || null,
    agency_phone: raw.agencyPhone || null,
    agency_logo: raw.agencyLogo || null,
    agency_address: raw.agencyAddress || null,
    agent_name: raw.agentName || null,
    agent_phone: raw.agentPhone || null,
    agent_whatsapp: raw.agentWhatsapp || null,
    agent_avatar: raw.agentAvatar || null,
    city_id: cityId,
    district_id: districtId,
    address: raw.address || `${raw.district}, ${raw.city}`,
    latitude: raw.latitude,
    longitude: raw.longitude,
    area: raw.area ? Math.round(raw.area) : null,
    land_area: raw.landArea ? Math.round(raw.landArea) : null,
    rooms: raw.roomCount,
    bathrooms: raw.bathrooms,
    floor: raw.floor,
    total_floors: raw.totalFloors,
    deed_type: raw.deedType,
    furnished_status: raw.furnishedStatus,
    in_complex: raw.inComplex,
    building_age: raw.buildingAge,
    exchangeable: raw.exchangeable,
    zoning_ratio: raw.zoningRatio,
    floors_allowed: raw.floorsAllowed,
    status: 'published',
    images: (raw.images || []).map((img) => img.replace('/property_wm/', '/property_thumb/')),
    amenities: raw.amenities || [],
  };
}

