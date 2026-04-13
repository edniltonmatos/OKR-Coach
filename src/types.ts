export type Cycle = {
  id: string;
  objectiveTitle: string;
  startDate: string;
  weekCount: number;
  reviewWeekday: number;
  createdAt: string;
  updatedAt: string;
};

export type KeyResult = {
  id: string;
  cycleId: string;
  sortOrder: number;
  label: string;
  initialValue: number;
  targetValue: number;
  currentValue: number;
};

export type WeekEntry = {
  id: string;
  cycleId: string;
  weekNumber: number;
  kr1Value: number | null;
  kr2Value: number | null;
  kr3Value: number | null;
  notes: string | null;
  completed: boolean;
};

export type ChatRole = 'assistant' | 'user';

export type ChatMessage = {
  id: string;
  cycleId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type WeekDigestMood = 'good' | 'mixed' | 'bad';

export type WeekDigest = {
  id: string;
  cycleId: string;
  weekNumber: number;
  summary: string;
  mood: WeekDigestMood;
  updatedAt: string;
};
