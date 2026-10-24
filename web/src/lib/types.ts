export type Unit = 'per_km' | 'per_visit' | 'per_hour' | 'per_day' | 'per_plate' | 'each';
export type PriceType = 'paid' | 'quoted' | 'listed';
export type Confidence = 'high' | 'medium' | 'low';
export type ScopeType = 'locality' | 'city' | 'state';
export type LocalityKind = 'residential' | 'transit_hub' | 'market' | 'tourist';

interface Base {
  $id: string;
  $createdAt: string;
}

export interface City extends Base { name: string; state: string; country: string; lat: number; lng: number; slug: string }
export interface Locality extends Base { city_id: string; name: string; lat: number; lng: number; kind: LocalityKind }
export interface Category extends Base { name: string; unit: Unit; hyperlocal: boolean }
export interface Item extends Base {
  category_id: string; name: string; slug: string; aliases: string[]; unit: Unit; typical_min: number; typical_max: number;
}

export interface PriceStat extends Base {
  item_id: string; scope_type: ScopeType; scope_id: string;
  median: number; p10: number; p25: number; p75: number; p90: number;
  n_weighted: number; n_raw: number; distinct_users: number;
  newest_log_at: string; oldest_log_at: string | null; confidence: Confidence;
  overcharge_index: number | null; computed_at: string;
}

export interface PriceLog extends Base {
  item_id: string; locality_id: string | null; city_id: string; user_id: string; price: number; price_type: PriceType;
  lat: number | null; lng: number | null; proof_file_id: string | null; note: string | null;
  confirm_count: number; flag_count: number; flag_reasons: string | null; hidden: boolean; is_seed: boolean; created_at: string;
}

export interface UserRow extends Base {
  auth_id: string; display_name: string; home_city_id: string | null; reputation: number;
  log_count: number; confirmations_received: number; flags_received: number; is_seed: boolean;
}

export interface QuoteCheck extends Base {
  user_id: string; item_id: string; locality_id: string | null; city_id: string; quoted_price: number; body: string | null;
  attached_stats_id: string | null; attached_card: string | null; helpful_reply_id: string | null;
  reply_count: number; is_seed: boolean; created_at: string;
}

export interface Reply extends Base { quote_check_id: string; user_id: string; body: string; is_seed: boolean; created_at: string }

// The card model built by core/card.js (shared with the /fair-range endpoint).
export interface CardOk {
  status: 'ok';
  item: { id: string; name: string; unit: Unit; unitLabel: string };
  place: { city: { id: string; name: string }; locality: { id: string; name: string } | null };
  scope: { type: ScopeType; id: string; fallback: boolean; label: string };
  range: { median: number; p25: number; p75: number; p10: number; p90: number };
  confidence: { level: Confidence; reason: string; roughGuide: boolean };
  sample: { logs: number; people: number; weighted: number; newestLogAt: string; line: string };
  overcharge: { index: number; line: string } | null;
  computedAt: string;
  statsId: string | null;
}
export interface CardNoData {
  status: 'no_data';
  item: CardOk['item'];
  place: CardOk['place'];
  message: string;
}
export type Card = CardOk | CardNoData;
