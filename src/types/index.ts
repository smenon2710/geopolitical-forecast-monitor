export type Lens =
  | "costOfLiving"
  | "investments"
  | "standardOfLiving"
  | "security"
  | "dailyRoutine";

export const LENSES: Lens[] = [
  "costOfLiving",
  "investments",
  "standardOfLiving",
  "security",
  "dailyRoutine",
];

export const LENS_LABELS: Record<Lens, string> = {
  costOfLiving: "Prices You Pay",
  investments: "Your Savings",
  standardOfLiving: "Jobs & Paychecks",
  security: "Safety & Tension",
  dailyRoutine: "Everyday Life",
};

export const LENS_SUBLABELS: Record<Lens, string> = {
  costOfLiving: "Gas, groceries, rent",
  investments: "Stocks and markets",
  standardOfLiving: "Work and wages",
  security: "Conflict and disasters",
  dailyRoutine: "Travel and routine",
};

/** 0 = negligible, 1 = minor, 2 = moderate, 3 = major */
export type Severity = 0 | 1 | 2 | 3;

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: "Calm",
  1: "Watch",
  2: "Elevated",
  3: "High",
};

export const SEVERITY_STATUS: Record<Severity, "good" | "warning" | "serious" | "critical"> = {
  0: "good",
  1: "warning",
  2: "serious",
  3: "critical",
};

export interface CitedMetric {
  label: string;
  value: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface LensReading {
  lens: Lens;
  severity: Severity;
  oneLiner: string;
  narrative: string;
  metrics: CitedMetric[];
}

export interface GeoEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  lat: number;
  lon: number;
  severity: Severity;
  lenses: Lens[];
  goldstein?: number;
  sourceName: string;
  sourceUrl?: string;
}

export interface SectorMove {
  sector: string;
  pctChange: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendSeries {
  id: string;
  label: string;
  unit: string;
  points: TrendPoint[];
}

/** "live" = every source fetched fresh; "stale" = some sources fell back to a cached last-known-good reading; "demo" = at least one source has never had a real reading and is showing synthetic demo data */
export type DataQuality = "live" | "stale" | "demo";

export interface DailyDigest {
  date: string;
  generatedAt: string;
  dataQuality: DataQuality;
  lenses: LensReading[];
  trends: TrendSeries[];
  events: GeoEvent[];
  sectors: SectorMove[];
}
