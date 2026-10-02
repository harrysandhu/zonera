// Props and answer types for the growth widgets (src/agent/widgets/growth).
// Widget numbers are from docs/agent-catalog.md.

export type ValueFormat = "money" | "signedMoney" | "money2" | "pct" | "signedPct" | "pts" | "int" | "signedInt" | "dec1" | "signedDec1" | "weeks";

// ---- W34 ImpactSimulator: one slider → projected revenue, churn, occupancy
// Every slider stop is precomputed by the skill (points), so the widget is pure
// presentation and plays the same way every time.
export interface ImpactMetric {
  key: string;
  label: string;
  format: ValueFormat;
  /** Which direction reads as good. Colors the delta. */
  good?: "up" | "down";
  hint?: string;
}
export interface ImpactPoint {
  v: number;
  metrics: Record<string, number>;
  /** Projected series, one value per month in `months`. */
  series: number[];
  note?: string;
}
export interface ImpactSimulatorProps {
  title: string;
  meta?: string;
  param: {
    label: string; // "Increase"
    min: number;
    max: number;
    step: number;
    value: number;
    unit: "%" | "$" | "wk";
    recommended?: number;
    /** Value the slider is compared against, e.g. the current street rate. */
    current?: number;
    currentLabel?: string;
  };
  metrics: ImpactMetric[];
  baseline: { label: string; series: number[] };
  projectedLabel?: string;
  months: string[];
  points: ImpactPoint[];
  seriesFormat?: "money" | "pct";
  /** Small print under the chart: how the projection is made. */
  note?: string;
  /** "{v}" is replaced with the formatted slider value. Default "Use {v}". */
  cta?: string;
  secondary?: string;
}
export interface ImpactSimulatorAnswer {
  action: "apply" | "cancel";
  value: number;
}

// ---- W35 PromoBuilder: offer, eligible sizes, conditions, end rule, badge preview
export interface PromoOfferOption {
  id: string;
  label: string; // "$1 first month"
  badge: string; // "$1 first month"
  /** Discount given up per rental: share × street rate + flat ($1 first month = 1 × rate − 1). */
  cost: { share: number; flat: number };
  /** Rental-rate multiplier vs no promo. */
  lift: number;
}
export interface PromoSizeOption {
  id: string; // "10x20"
  label: string; // "10×20"
  rate: number;
  total: number;
  occupied: number;
  vacant: number;
  /** Rentals per week without a promo. */
  baseWeekly: number;
}
export interface PromoEndRule {
  id: string;
  label: string; // "Until 90% occupied"
  detail?: string;
  /** Target occupancy for a goal-based rule. */
  goal?: number;
  /** Fixed end date label for a date rule. */
  until?: string;
  /** Number of rentals for a count rule. */
  count?: number;
  /** Length in weeks for a date rule. */
  weeks?: number;
}
export interface PromoBuilderProps {
  title?: string;
  offers: PromoOfferOption[];
  offer: string;
  sizes: PromoSizeOption[];
  selected: string[];
  conditions: { id: string; label: string; on: boolean; hint?: string }[];
  endRules: PromoEndRule[];
  endRule: string;
  /** The storefront card that gets the badge. */
  preview: { unitId: string; features: string[] };
  cta?: string;
}
export interface PromoBuilderAnswer {
  action: "publish" | "cancel";
  offer: string;
  badge: string;
  sizes: string[];
  conditions: string[];
  endRule: string;
  endLabel: string;
  /** Projection at the moment of publishing. */
  weeks: number;
  rentals: number;
  cost: number;
}

// ---- CompetitorCompare: our street rates vs nearby facilities
export interface CompetitorRow {
  name: string;
  us?: boolean;
  distance?: string; // "1.8 mi"
  rating?: number; // Google rating
  reviews?: number;
  prices: Record<string, number | null>;
  promo?: string;
  note?: string;
}
export interface CompetitorCompareProps {
  title: string;
  meta?: string;
  sizes: { id: string; label: string }[];
  size: string;
  rows: CompetitorRow[];
  /** Competitor to highlight. */
  focus?: string;
  source?: string; // "Rates checked 9:51 am from public websites"
}
