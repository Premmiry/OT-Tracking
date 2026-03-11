export type AttendanceType = 'WORK' | 'DAY_OFF' | 'WFH' | 'SICK' | 'VACATION' | 'SHIFT_CHANGE';

export interface AttendanceRecord {
  id?: number;
  date: string;
  type: AttendanceType;
  shift_start: string;
  shift_end: string;
  actual_start: string;
  actual_end: string;
  late_minutes: number;
  early_minutes: number;
  ot_minutes: number;
  notes: string;
  shift_change_date?: string;
}

export interface OffsetRecord {
  id?: number;
  ot_attendance_id: number;
  offset_attendance_id: number;
  minutes_used: number;
  ot_date?: string;
  offset_date?: string;
  ot_record?: AttendanceRecord;
  offset_record?: AttendanceRecord;
}

export interface AttendanceSummary {
  total_ot_earned: number;
  total_ot_used: number;
  balance: number;
  monthly_ot_earned: number;
  monthly_ot_used: number;
}

export interface Settings {
  sick_leave_total: string;
  vacation_leave_total: string;
  default_shift_start: string;
  default_shift_end: string;
}

export interface User {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

export interface AuditLog {
  id: number;
  user_id: number;
  username?: string;
  action: string;
  table_name?: string;
  record_id?: number;
  old_values?: any;
  new_values?: any;
  timestamp: string;
}
