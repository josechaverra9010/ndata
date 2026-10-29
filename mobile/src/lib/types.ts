export type UserRole = 'patient' | 'admin' | 'superadmin';

export interface PatientUser {
  id: string;
  name: string;
  nombres?: string;
  email: string;
  role: UserRole;
  avatar?: string;
  altura?: number;
  peso_actual?: number;
}

export interface DashboardStats {
  calories: { consumed: number; target: number; percentage: number };
  water: {
    consumed_ml: number;
    consumed_liters: number;
    target_ml: number;
    target_liters: number;
    percentage: number;
  };
  meals: { completed: number; total: number; percentage: number };
  weekly_goal: { percentage: number; change: number; trend: string };
  peso_actual?: number;
  altura?: number;
  edad_formateada?: string;
}

export interface DashboardMeal {
  name: string;
  time: string;
  calories: number;
  completed: boolean;
  meal_type: string;
  description?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  today_meals: DashboardMeal[];
  week_progress: { day: string; date: string; completed: boolean }[];
  next_appointment: {
    doctor: string;
    type: string;
    date: string;
    time: string;
    status: string;
  } | null;
  tip_of_day: string;
}

export interface AdherenceData {
  summary: {
    today_pct: number;
    week_pct: number;
    previous_week_pct: number;
    change: number;
    level: string;
    message: string;
    completed_meals_week: number;
    total_meals_week: number;
  };
  daily_series: Array<{
    date: string;
    label: string;
    adherence_pct: number;
    completed_meals: number;
    total_meals: number;
  }>;
  next_action: { type: string; label: string; path: string };
  tips: string[];
}

export interface NotificationItem {
  id: string;
  source: string;
  type: string;
  title: string;
  message: string;
  date: string;
  priority: string;
  read: boolean;
}

export interface AppointmentItem {
  id: number;
  date: string;
  time: string;
  doctor: string;
  type: string;
  mode?: string;
  status: string;
  meeting_link?: string;
  notes?: string;
}
