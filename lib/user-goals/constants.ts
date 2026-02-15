export const USER_GOAL_OPTIONS = [
  { id: "expand-music-tastes", label: "Expand my music tastes", emoji: "🌍" },
  { id: "find-more-music-i-like", label: "Find more music I like", emoji: "🎯" },
  { id: "balance-comfort-and-new", label: "Balance comfort listens with new sounds", emoji: "⚖️" },
] as const;

export type UserGoalOption = (typeof USER_GOAL_OPTIONS)[number];
export type UserGoalId = UserGoalOption["id"];
