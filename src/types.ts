export interface RawPropertyData {
  code: string;
  url: string;
  title: string;
  originalTitle?: string;
  description: string;
  price: number;
  currency: string;
  prices?: Record<string, number>;
  dealType: 'sale' | 'rent' | 'commercial_sale' | 'commercial_rent';
  propertyType: string;
  category: string;
  city: string;
  district: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  area: number | null;
  landArea: number | null;
  rooms: string | null;
  roomCount: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  buildingAge: string | null;
  deedType: string | null;
  furnishedStatus: string | null;
  inComplex: boolean;
  exchangeable: boolean;
  zoningRatio: number | null;
  floorsAllowed: number | null;
  images: string[];
  agencyName: string | null;
  agencyPhone: string | null;
  agencyLogo?: string | null;
  agencyAddress?: string | null;
  agentName?: string | null;
  agentPhone?: string | null;
  agentWhatsapp?: string | null;
  agentAvatar?: string | null;
  amenities?: PropertyAmenityData[];
  datePosted: string | null;
  rawJsonLd: any;
}

export interface PropertyAmenityData {
  name: string;
  category?: string;
}

export interface MetrajPropertyPayload {
  code: string;
  title: Record<string, string>;
  slug: string;
  description: Record<string, string>;
  price: number;
  currency: string;
  prices: Record<string, number>;
  deal_type_id?: number | null;
  property_type_id?: number | null;
  amenities?: PropertyAmenityData[];
  seller_type: 'owner' | 'agency' | 'complex';
  advertiser_name: string;
  phone: string;
  agency_id?: number | null;
  agent_id?: number | null;
  user_id?: number | null;
  agency_name?: string | null;
  agency_phone?: string | null;
  agency_logo?: string | null;
  agency_address?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  agent_whatsapp?: string | null;
  agent_avatar?: string | null;
  city_id: number | null;
  district_id: number | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  area: number | null;
  land_area: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  total_floors: number | null;
  deed_type: string | null;
  furnished_status: string | null;
  in_complex: boolean;
  building_age: string | null;
  exchangeable: boolean;
  zoning_ratio: number | null;
  floors_allowed: number | null;
  status: 'pending_approval' | 'published';
  images: string[];
}

export interface CrawlOptions {
  categoryUrl: string;
  city?: string;
  maxPages?: number;
  delayMs?: number;
}

export interface CrawlJob {
  id: string;
  category: string;
  city: string;
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'failed';
  totalPages: number;
  currentPage: number;
  totalFound: number;
  scrapedCount: number;
  errorCount: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CrawlLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}
