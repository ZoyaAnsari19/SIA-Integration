export type EligibilityMap = Record<string, boolean>;

export function emptyEligibility(): EligibilityMap {
  const map: EligibilityMap = {};
  for (let i = 1; i <= 9; i++) map[i.toString()] = false;
  return map;
}


