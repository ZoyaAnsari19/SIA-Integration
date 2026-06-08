/**
 * Users API Service
 */

import { apiClient } from './client';

/**
 * Level Eligibility Response
 */
export interface LevelEligibilityItem {
  level: number;
  title: string;
  description: string | null;
  reward: string | null;
  spot_commission_percent: number | null;
  monthly_royalty_percent: number | null;
  business_requirement: any | null;
  eligible: boolean;
  icon_url: string | null;
  color: string | null;
}

export interface UserEligibilityResponse {
  user_id: string;
  eligibility: LevelEligibilityItem[];
}

/**
 * Get user level eligibility with details
 */
export async function getUserEligibility(userId: string): Promise<UserEligibilityResponse> {
  try {
    const response = await apiClient.get<UserEligibilityResponse>(`/users/${userId}/eligibility`);
    return response.data;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get max qualified level info (title and level number) for a user
 */
export async function getMaxQualifiedLevel(userId: string): Promise<{ title: string; level: number } | null> {
  try {
    const response = await getUserEligibility(userId);
    // Find the highest level that is eligible (levels 1-9)
    const eligibleLevels = response.eligibility
      .filter(level => level.eligible && level.level > 0) // Only levels 1-9, skip Level 0
      .sort((a, b) => b.level - a.level); // Sort descending
    
    if (eligibleLevels.length > 0) {
      // User has qualified for at least one level (1-9)
      const maxLevel = eligibleLevels[0];
      return {
        title: maxLevel.title,
        level: maxLevel.level
      };
    }
    
    // No levels 1-9 qualified, show Level 0 (default for all users)
    const level0 = response.eligibility.find(level => level.level === 0);
    if (level0) {
      return {
        title: level0.title,
        level: level0.level
      };
    }
    
    return null; // Fallback if Level 0 not found
  } catch (error: any) {
    console.error('Error getting max qualified level:', error);
    return null;
  }
}

