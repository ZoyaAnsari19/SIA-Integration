import type {
  Level,
  LevelsListResponse,
  UpdateLevelRequest,
  BusinessRequirement,
} from "../api/levels";

export type { Level, LevelsListResponse, UpdateLevelRequest, BusinessRequirement };

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const now = "2026-06-01T08:00:00.000Z";

let mockLevels: Level[] = [
  {
    level: 0,
    title: "Field Worker",
    description: "Direct level - Starting position",
    reward: null,
    spot_commission_percent: 5,
    monthly_royalty_percent: 0.75,
    business_requirement: null,
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 1,
    title: "Company Representative",
    description:
      "4 direct compulsory, har direct ke niche min ₹7,500, total team business ₹2.15 Lakh",
    reward: "T-shirt and Diary",
    spot_commission_percent: 2.5,
    monthly_royalty_percent: 0.3,
    business_requirement: {
      required_leg_count: 4,
      required_leg_min_amount: 7500,
      total_business: 215000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 2,
    title: "Company City Manager",
    description:
      "Har 4 direct member ke niche se ₹3.75 Lakh ka business (total ₹15 Lakh)",
    reward: "5G Mobile",
    spot_commission_percent: 2.5,
    monthly_royalty_percent: 0.3,
    business_requirement: {
      required_leg_count: 4,
      required_leg_min_amount: 375000,
      total_business: 1500000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 3,
    title: "Company Area Manager",
    description:
      "Har 3 direct member ke niche se ₹25 Lakh ka business (total ₹75 Lakh)",
    reward: "Laptop",
    spot_commission_percent: 2,
    monthly_royalty_percent: 0.25,
    business_requirement: {
      required_leg_count: 3,
      required_leg_min_amount: 2500000,
      total_business: 7500000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 4,
    title: "Company District Manager",
    description:
      "Har 3 direct member ke niche se ₹77.62 Lakh ka business (total ₹2.32 Crore)",
    reward: "Motorcycle",
    spot_commission_percent: 2,
    monthly_royalty_percent: 0.25,
    business_requirement: {
      required_leg_count: 3,
      required_leg_min_amount: 7762000,
      total_business: 23286000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 5,
    title: "Division Manager",
    description:
      "Har 3 direct member ke niche se ₹2.53 Crore ka business (total ₹7.61 Crore)",
    reward: "Car",
    spot_commission_percent: 1.5,
    monthly_royalty_percent: 0.2,
    business_requirement: {
      required_leg_count: 3,
      required_leg_min_amount: 25300000,
      total_business: 76100000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 6,
    title: "Regional Manager",
    description:
      "Har 2 direct member ke niche se ₹13.32 Crore ka business (total ₹26.65 Crore)",
    reward: "Land in Secure City",
    spot_commission_percent: 1.5,
    monthly_royalty_percent: 0.2,
    business_requirement: {
      required_leg_count: 2,
      required_leg_min_amount: 133200000,
      total_business: 266500000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 7,
    title: "State Manager",
    description:
      "Har 2 direct member ke niche se ₹51.97 Crore ka business (total ₹103.93 Crore)",
    reward: "Flat in Secure City",
    spot_commission_percent: 1,
    monthly_royalty_percent: 0.15,
    business_requirement: {
      required_leg_count: 2,
      required_leg_min_amount: 519700000,
      total_business: 1039300000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 8,
    title: "National Manager",
    description:
      "Har 2 direct member ke niche se ₹223.48 Crore ka business (total ₹446.96 Crore)",
    reward: "Company Director",
    spot_commission_percent: 1,
    monthly_royalty_percent: 0.15,
    business_requirement: {
      required_leg_count: 2,
      required_leg_min_amount: 2234800000,
      total_business: 4469600000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
  {
    level: 9,
    title: "King",
    description: "Total ₹2100 Crore ka business",
    reward: "Freedom",
    spot_commission_percent: 0.5,
    monthly_royalty_percent: 0.1,
    business_requirement: {
      required_leg_count: 0,
      required_leg_min_amount: 0,
      total_business: 21000000000,
    },
    icon_url: null,
    color: null,
    created_at: now,
    updated_at: now,
  },
];

export async function getLevels(): Promise<LevelsListResponse> {
  await delay();
  const items = [...mockLevels].sort((a, b) => a.level - b.level);
  return {
    count: items.length,
    items: structuredClone(items),
  };
}

export async function getLevelDetails(level: number): Promise<Level> {
  await delay(150);
  const item = mockLevels.find((l) => l.level === level);
  if (!item) throw new Error("Level not found (demo)");
  return structuredClone(item);
}

export async function updateLevel(
  level: number,
  data: UpdateLevelRequest,
): Promise<Level> {
  await delay(400);
  const index = mockLevels.findIndex((l) => l.level === level);
  if (index < 0) throw new Error("Level not found (demo)");

  mockLevels[index] = {
    ...mockLevels[index],
    ...data,
    business_requirement:
      data.business_requirement !== undefined
        ? data.business_requirement
        : mockLevels[index].business_requirement,
    updated_at: new Date().toISOString(),
  };
  return structuredClone(mockLevels[index]);
}
