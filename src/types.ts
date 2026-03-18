import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PaymentMethod = 'pix' | 'cash' | 'card';

export interface Ride {
  id: string;
  value: number;
  paymentMethod: PaymentMethod;
  startTime: number; // timestamp
  endTime: number; // timestamp
  duration: number; // in seconds
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  type: 'value' | 'rides';
  period: GoalPeriod;
  target: number;
  startDate: number; // timestamp
}

export interface UserSettings {
  userName: string;
}

export type AppState = 'idle' | 'working' | 'in_ride';

export interface CheckIn {
  id: string;
  timestamp: number;
  location?: string;
  note?: string;
}

export interface GoalHistoryEntry {
  id: string;
  type: 'value' | 'rides';
  period: GoalPeriod;
  target: number;
  startDate: number;
  endDate: number;
  achieved: number;
}

export interface GlobalState {
  appState: AppState;
  workStartTime: number | null;
  rideStartTime: number | null;
  rides: Ride[];
  checkins: CheckIn[];
  settings: UserSettings;
  goal: Goal | null;
  goalHistory: GoalHistoryEntry[];
}
