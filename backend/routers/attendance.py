import gspread
from fastapi import APIRouter, Depends, HTTPException, Body
from auth import get_current_user
from database import db
from pydantic import BaseModel
from typing import List, Optional
import datetime

router = APIRouter()

class AttendanceRecord(BaseModel):
    id: Optional[int] = None
    date: str
    type: str
    shift_start: str
    shift_end: str
    actual_start: str
    actual_end: str
    late_minutes: int = 0
    early_minutes: int = 0
    ot_minutes: int = 0
    notes: str = ""
    shift_change_date: Optional[str] = None

def normalize_time(t_str):
    if not t_str or ":" not in t_str:
        return t_str
    try:
        h, m = map(int, t_str.split(":"))
        return f"{h:02d}:{m:02d}"
    except ValueError:
        return t_str

@router.get("/summary")
def get_attendance_summary(month: str, year: str, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # 1. Fetch ALL attendance to calculate total OT earned UP TO the requested month
    att_sheet = db.get_sheet("attendance")
    att_records = att_sheet.get_all_records()
    
    # 2. Fetch ALL offsets to calculate total OT used UP TO the requested month
    off_sheet = db.get_sheet("offsets")
    off_records = off_sheet.get_all_records()
    
    user_id = str(current_user['id'])
    
    # Target date: End of the requested month
    # To handle "up to end of month", we can construct a date string "YYYY-MM-31" 
    # and compare strings, or use datetime objects.
    # String comparison YYYY-MM-DD works fine.
    
    # Find the last day of the requested month
    try:
        m = int(month)
        y = int(year)
        # Use first day of NEXT month - 1 day to get last day of current month
        # Or simpler: just compare YYYY-MM prefix? 
        # No, "Historical Balance" means accumulated up to that point.
        # So we include everything where date <= End of Month.
        
        if m == 12:
            next_month = datetime.date(y + 1, 1, 1)
        else:
            next_month = datetime.date(y, m + 1, 1)
            
        last_day_of_month = next_month - datetime.timedelta(days=1)
        limit_date_str = last_day_of_month.strftime("%Y-%m-%d")
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month/year")

    # --- Calculate OT Earned ---
    total_ot_earned = 0
    # Also calculate "This Month" earned for convenience
    current_month_prefix = f"{year}-{month.zfill(2)}"
    monthly_ot_earned = 0
    
    for r in att_records:
        if str(r.get('user_id', '')) == user_id:
            r_date = r.get('date', '')
            if r_date <= limit_date_str:
                # Recalculate OT logic to match frontend/save logic
                # (Arrived Early + Late Leave)
                # But here we trust the DB 'ot_minutes' mostly, 
                # OR we re-calculate if we suspect DB is stale?
                # User's recent request was "re-calculate on frontend".
                # To be safe and consistent, we should use the stored 'ot_minutes' 
                # IF it was saved correctly. 
                # BUT the user fixed the calculation recently. Old records might be wrong?
                # Let's trust stored value for performance, or re-calc if critical.
                # Given user modified backend 'calculate_stats' earlier, stored values 
                # for NEW/UPDATED records are correct. OLD ones might be wrong.
                # However, re-calculating everything on every request is heavy.
                # Let's stick to stored 'ot_minutes' for now, assuming user will update records if needed.
                # Wait, earlier user modified 'attendance.py' calculate_stats.
                # So stored values might NOT include 'arrived_early' for old records.
                # Ideally we re-calculate here to be safe.
                
                # Re-calc logic (simplified version of calculate_stats)
                type_ = r.get('type', '')
                if type_ in ['WORK', 'WFH']:
                    s_start = parse_time(normalize_time(r.get('shift_start', '')))
                    s_end = parse_time(normalize_time(r.get('shift_end', '')))
                    a_start = parse_time(normalize_time(r.get('actual_start', '')))
                    a_end = parse_time(normalize_time(r.get('actual_end', '')))
                    
                    if s_start is not None and s_end is not None and a_start is not None and a_end is not None:
                        arrived_early = max(0, s_start - a_start) if a_start < s_start else 0
                        late_leave = max(0, a_end - s_end) if a_end > s_end else 0
                        raw_ot = arrived_early + late_leave
                        # Round OT
                        ot_val = (raw_ot // 30) * 30 if raw_ot >= 30 else 0
                    else:
                        ot_val = 0
                else:
                    ot_val = 0
                
                total_ot_earned += ot_val
                
                if r_date.startswith(current_month_prefix):
                    monthly_ot_earned += ot_val

    # --- Calculate OT Used (Offsets) ---
    total_ot_used = 0
    monthly_ot_used = 0
    
    # For offsets, we need to check the 'offset_date' (when the leave was taken).
    # We need to map offset_id to get the date.
    # Offsets sheet has: id, user_id, ot_attendance_id, offset_attendance_id, minutes_used
    # We need to look up 'offset_attendance_id' in att_records to find the date of usage.
    
    # Build map of attendance dates
    att_date_map = {str(r['id']): r.get('date', '') for r in att_records if str(r.get('user_id', '')) == user_id}
    
    for off in off_records:
        if str(off.get('user_id', '')) == user_id:
            off_att_id = str(off.get('offset_attendance_id', ''))
            usage_date = att_date_map.get(off_att_id, '')
            
            if usage_date and usage_date <= limit_date_str:
                used = int(off.get('minutes_used', 0))
                total_ot_used += used
                
                if usage_date.startswith(current_month_prefix):
                    monthly_ot_used += used
                    
    return {
        "total_ot_earned": total_ot_earned,
        "total_ot_used": total_ot_used,
        "balance": total_ot_earned - total_ot_used,
        "monthly_ot_earned": monthly_ot_earned,
        "monthly_ot_used": monthly_ot_used
    }

@router.get("", include_in_schema=False)
@router.get("/")
def get_attendance(month: str = None, year: str = None, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sheet = db.get_sheet("attendance")
    records = sheet.get_all_records()
    
    user_id = str(current_user['id'])
    attendance = []
    
    for r in records:
        if str(r.get('user_id', '')) == user_id:
            # Normalize times for frontend input type="time"
            r['shift_start'] = normalize_time(r.get('shift_start', ''))
            r['shift_end'] = normalize_time(r.get('shift_end', ''))
            r['actual_start'] = normalize_time(r.get('actual_start', ''))
            r['actual_end'] = normalize_time(r.get('actual_end', ''))
            r['shift_change_date'] = r.get('shift_change_date', '')
            attendance.append(r)
    
    if month and year:
        prefix = f"{year}-{month.zfill(2)}"
        attendance = [r for r in attendance if r['date'].startswith(prefix)]
        
    attendance.sort(key=lambda x: x['date'])
    return attendance

def parse_time(t_str):
    if not t_str or ":" not in t_str:
        return None
    try:
        t_str = t_str.strip()
        parts = list(map(int, t_str.split(":")))
        if len(parts) >= 2:
            return parts[0] * 60 + parts[1]
        return None
    except ValueError:
        return None

def calculate_stats(record: AttendanceRecord):
    # Only calculate for WORK/WFH.
    if record.type not in ['WORK', 'WFH']:
        return 0, 0, 0

    s_start = parse_time(record.shift_start)
    s_end = parse_time(record.shift_end)
    a_start = parse_time(record.actual_start)
    a_end = parse_time(record.actual_end)

    print(f"DEBUG: Parsed s_start={s_start} s_end={s_end} a_start={a_start} a_end={a_end}")

    if s_start is None or s_end is None or a_start is None or a_end is None:
        return 0, 0, 0

    # Calculate raw differences
    late = max(0, a_start - s_start)
    early = max(0, s_end - a_end)
    
    # OT Calculation: Arrived Early + Late Leave
    # Only if arrived BEFORE shift start
    arrived_early = max(0, s_start - a_start) if a_start < s_start else 0
    # Only if left AFTER shift end
    late_leave = max(0, a_end - s_end) if a_end > s_end else 0
    
    ot = arrived_early + late_leave

    # Consistency checks for late/early (debt)
    if a_end > s_end:
        early = 0 # Cannot be early if left after shift end
    if a_start < s_start:
        late = 0 # Cannot be late if arrived before shift start

    # User requested to show exact minutes
    final_late = late
    final_early = early

    # OT Rule:
    # "+30 mins". Usually round down to 30 min blocks.
    def round_ot(m):
        if m < 30: return 0
        return (m // 30) * 30

    final_ot = round_ot(ot)

    return final_late, final_early, final_ot

@router.post("", include_in_schema=False)
@router.post("/")
def save_attendance(record: AttendanceRecord, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sheet = db.get_sheet("attendance")
    records = sheet.get_all_records()
    
    user_id = str(current_user['id'])
    
    # Auto-calculate stats
    late, early, ot = calculate_stats(record)
    
    # Log calculation for debugging
    print(f"DEBUG: Calculating for {record.date} Type={record.type}")
    print(f"DEBUG: Shift {record.shift_start}-{record.shift_end} Actual {record.actual_start}-{record.actual_end}")
    print(f"DEBUG: Result -> Late={late} Early={early} OT={ot}")
    
    record.late_minutes = late
    record.early_minutes = early
    record.ot_minutes = ot
    
    row_idx = None
    existing_id = None
    
    # Check if record exists for this User + Date (Business Logic)
    # This prevents duplicates if frontend sends no ID, or incorrect ID
    for r in records:
        if str(r.get('user_id', '')) == user_id and r.get('date', '') == record.date:
            existing_id = r.get('id')
            break
            
    # 1. Update existing record if found (either by check above or provided ID)
    target_id = None
    if existing_id:
        target_id = str(existing_id)
    elif record.id:
        target_id = str(record.id)
        
    if target_id:
        try:
            # col_values(1) returns the list of IDs in the first column (including header)
            all_ids = sheet.col_values(1)
            # Find the row index (1-based)
            row_idx = [str(x) for x in all_ids].index(target_id) + 1
        except ValueError:
            # If ID was provided by frontend but not found, and we didn't find by Date+User, 
            # then it might be a new record (or invalid ID).
            # If we found by Date+User, it MUST exist in col_values unless race condition.
            if existing_id:
                 print(f"Error: Found existing record with ID {existing_id} in list but not in column 1")
                 raise HTTPException(status_code=500, detail="Database consistency error")
            # If came from record.id and not found, proceed to create new (fallback) or error?
            # Better to treat as new if not found, to match Express logic roughly?
            # But Express logic says "if existingRow -> update". 
            # Here we are in "Update" block.
            pass 

    if row_idx:
        # Update existing record
        cells = [
            gspread.Cell(row=row_idx, col=3, value=record.type),
            gspread.Cell(row=row_idx, col=4, value=record.shift_start),
            gspread.Cell(row=row_idx, col=5, value=record.shift_end),
            gspread.Cell(row=row_idx, col=6, value=record.actual_start),
            gspread.Cell(row=row_idx, col=7, value=record.actual_end),
            gspread.Cell(row=row_idx, col=8, value=record.late_minutes),
            gspread.Cell(row=row_idx, col=9, value=record.early_minutes),
            gspread.Cell(row=row_idx, col=10, value=record.ot_minutes),
            gspread.Cell(row=row_idx, col=11, value=record.notes),
            gspread.Cell(row=row_idx, col=13, value=record.shift_change_date or "")
        ]
        sheet.update_cells(cells)
        
    # 2. Create new record
    else:
        # Create new
        # Use col_values to get ALL IDs in the sheet, ensuring we don't miss any "outside table" rows
        all_ids = sheet.col_values(1)
        # Filter out empty strings if any to be safe
        all_ids = [x for x in all_ids if x]
        
        numeric_ids = [int(x) for x in all_ids if str(x).isdigit()]
        next_id = max(numeric_ids, default=0) + 1
        
        # Calculate next row index based on actual data length (1-based)
        # This avoids append_row's potential issue with "table range"
        next_row_idx = len(all_ids) + 1
        
        print(f"DEBUG: Creating new row at index {next_row_idx}. Next ID={next_id}")
        
        new_row = [
            next_id,
            record.date,
            record.type,
            record.shift_start,
            record.shift_end,
            record.actual_start,
            record.actual_end,
            record.late_minutes,
            record.early_minutes,
            record.ot_minutes,
            record.notes,
            user_id,
            record.shift_change_date or ""
        ]
        
        # Use update_cells to write to specific row instead of append_row
        cells = []
        for col_idx, value in enumerate(new_row):
            cells.append(gspread.Cell(row=next_row_idx, col=col_idx+1, value=value))
            
        sheet.update_cells(cells)
        
    return {"success": True}
