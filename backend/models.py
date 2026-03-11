from pydantic import BaseModel
from typing import Optional, List, Any

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class SettingsUpdate(BaseModel):
    month: Optional[str] = "0"
    year: Optional[str] = "0"
    sick_leave_total: Optional[str] = None
    vacation_leave_total: Optional[str] = None
    default_shift_start: Optional[str] = None
    default_shift_end: Optional[str] = None
    # Allow extra fields
    class Config:
        extra = "allow"

class AttendanceRecord(BaseModel):
    id: Optional[str] = None
    date: str
    type: str
    shift_start: str
    shift_end: str
    actual_start: str
    actual_end: str
    late_minutes: Optional[int] = 0
    early_minutes: Optional[int] = 0
    ot_minutes: Optional[int] = 0
    notes: Optional[str] = ""

class OffsetRecord(BaseModel):
    ot_attendance_id: int
    offset_attendance_id: int
    minutes_used: int
