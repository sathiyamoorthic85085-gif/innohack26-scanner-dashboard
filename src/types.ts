export type MealSlotId =
  | "sep24_mrng_snacks"
  | "sep24_night_dinner"
  | "sep24_night_snacks"
  | "sep25_mrng_bfast"
  | "sep25_mrng_snacks"
  | "sep25_aft_snacks";

export interface MealSlotDefinition {
  id: MealSlotId;
  name: string;
  slot: string;
  type: "food" | "snacks";
  timeWindow: string;
}

export const MEAL_SCHEDULE: MealSlotDefinition[] = [
  {
    id: "sep24_mrng_snacks",
    name: "24th Sep Morning Snacks",
    slot: "Welcome Refreshments & Tea",
    type: "snacks",
    timeWindow: "09:00 AM – 11:00 AM (24th Sep)",
  },
  {
    id: "sep24_night_dinner",
    name: "24th Sep Night Dinner",
    slot: "Main Hackathon Feast (Dinner)",
    type: "food",
    timeWindow: "08:00 PM – 10:30 PM (24th Sep)",
  },
  {
    id: "sep24_night_snacks",
    name: "24th Sep Night Snacks",
    slot: "Midnight Energy Boost",
    type: "snacks",
    timeWindow: "12:30 AM – 02:00 AM (25th Sep)",
  },
  {
    id: "sep25_mrng_bfast",
    name: "25th Sep Morning Breakfast",
    slot: "Main Day 2 Breakfast",
    type: "food",
    timeWindow: "07:30 AM – 09:30 AM (25th Sep)",
  },
  {
    id: "sep25_mrng_snacks",
    name: "25th Sep Morning Snacks",
    slot: "Day 2 Morning Refreshments",
    type: "snacks",
    timeWindow: "11:00 AM – 12:30 PM (25th Sep)",
  },
  {
    id: "sep25_aft_snacks",
    name: "25th Sep Afternoon Snacks",
    slot: "Valedictory High Tea",
    type: "snacks",
    timeWindow: "03:30 PM – 05:00 PM (25th Sep)",
  },
];

export interface MealRedemptionRecord {
  redeemedAt: string;
  redeemedBy: string;
}

export interface FoodPassData {
  tokenId: string;
  referenceCode: string;
  memberIndex: number;
  memberName: string;
  role: string;
  teamName: string;
  leadName: string;
  college: string;
  domain: string;
  buildType: string;
  memberCount: number;
  email: string;
  phone: string;
  redemptions: Record<string, MealRedemptionRecord>;
}

export interface MealHeadCountStat {
  id: MealSlotId;
  name: string;
  slot: string;
  type: "food" | "snacks";
  timeWindow: string;
  servedCount: number;
  totalEligible: number;
}

export interface HeadCountMetrics {
  totalRegisteredParticipants: number;
  totalSquads: number;
  mealStats: MealHeadCountStat[];
  lastUpdated: string;
}

export interface ScanAuditLogItem {
  id: string;
  timestamp: string;
  tokenId: string;
  memberName: string;
  teamName: string;
  mealId: MealSlotId;
  mealName: string;
  scannedBy: string;
  action: "redeemed" | "undone";
}
