export type AppState = {
  timeZone: string;
  goals: {
    dailyGoal: number;
    weeklyGoal: number;
    monthlyGoal: number;
  };
  quickAdd: number[];
  totals: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  recentEntries: Array<{
    id: number;
    count: number;
    performedAt: string;
  }>;
};
