from fastapi import APIRouter, Depends, HTTPException, Body
from auth import get_current_user
from database import db
from pydantic import BaseModel
import datetime

router = APIRouter()

from typing import Optional

class SettingsUpdate(BaseModel):
    month: str = "0"
    year: str = "0"
    sick_leave_total: Optional[str] = None
    vacation_leave_total: Optional[str] = None
    default_shift_start: Optional[str] = None
    default_shift_end: Optional[str] = None
    
    class Config:
        extra = "allow"

@router.get("", include_in_schema=False)
@router.get("/")
def get_settings(month: str = None, year: str = None, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = str(current_user['id'])
    
    # Initialize defaults
    settings = {
        "sick_leave_total": "30",
        "vacation_leave_total": "10",
        "default_shift_start": "08:00",
        "default_shift_end": "17:00"
    }
    
    # --- Config Leave ---
    sheet_leave = db.get_sheet("config_leave")
    records_leave = sheet_leave.get_all_records()
    
    # Global Defaults (user_id=0)
    for r in records_leave:
        if str(r['user_id']) == "0":
            settings['sick_leave_total'] = str(r['sick_leave_total'])
            settings['vacation_leave_total'] = str(r['vacation_leave_total'])
            
    # User Specific Year (Prioritize month="0" for yearly config)
    if year:
        found_yearly = False
        found_monthly = False
        
        for r in records_leave:
            if str(r['user_id']) == user_id and str(r['year']) == year:
                # Found a record for this year
                if str(r['month']) == "0":
                    # Yearly config found - this takes precedence
                    settings['sick_leave_total'] = str(r['sick_leave_total'])
                    settings['vacation_leave_total'] = str(r['vacation_leave_total'])
                    found_yearly = True
                    break # Found the best match
                elif str(r['month']) == month and not found_yearly:
                    # Monthly config found - keep as fallback
                    settings['sick_leave_total'] = str(r['sick_leave_total'])
                    settings['vacation_leave_total'] = str(r['vacation_leave_total'])
                    found_monthly = True

    # --- Config Time ---
    sheet_time = db.get_sheet("config_time")
    records_time = sheet_time.get_all_records()
    
    # Global Defaults (user_id=0)
    for r in records_time:
        if str(r['user_id']) == "0":
            settings['default_shift_start'] = str(r['default_shift_start'])
            settings['default_shift_end'] = str(r['default_shift_end'])
            
    # User Specific Month
    if month and year:
        for r in records_time:
            if str(r['user_id']) == user_id and str(r['month']) == month and str(r['year']) == year:
                settings['default_shift_start'] = str(r['default_shift_start'])
                settings['default_shift_end'] = str(r['default_shift_end'])
                
    return settings

@router.post("/")
def update_settings(update: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = str(current_user['id'])
    month = update.month
    year = update.year
    
    updates_dict = update.dict(exclude={'month', 'year'}, exclude_unset=True)
    
    # Config Leave (Save as Yearly - month="0")
    if 'sick_leave_total' in updates_dict or 'vacation_leave_total' in updates_dict:
        sheet = db.get_sheet("config_leave")
        records = sheet.get_all_records()
        row_idx = None
        
        # Search for yearly config (month="0")
        for i, r in enumerate(records):
            if (str(r['user_id']) == user_id and str(r['month']) == "0" and str(r['year']) == year):
                row_idx = i + 2
                break
        
        sick = updates_dict.get('sick_leave_total', '30')
        vacation = updates_dict.get('vacation_leave_total', '10')
        
        if row_idx:
            # Update (sick is col 4, vacation is col 5)
            if 'sick_leave_total' in updates_dict: sheet.update_cell(row_idx, 4, str(sick))
            if 'vacation_leave_total' in updates_dict: sheet.update_cell(row_idx, 5, str(vacation))
        else:
            # Create new yearly record
            sheet.append_row([user_id, "0", year, str(sick), str(vacation)])

    # Config Time (Save as Monthly - keep existing logic)
    if 'default_shift_start' in updates_dict or 'default_shift_end' in updates_dict:
        sheet = db.get_sheet("config_time")
        records = sheet.get_all_records()
        row_idx = None
        
        for i, r in enumerate(records):
            if (str(r['user_id']) == user_id and str(r['month']) == month and str(r['year']) == year):
                row_idx = i + 2
                break
        
        start = updates_dict.get('default_shift_start', '08:00')
        end = updates_dict.get('default_shift_end', '17:00')
        
        if row_idx:
            # Update (start is col 4, end is col 5)
            if 'default_shift_start' in updates_dict: sheet.update_cell(row_idx, 4, str(start))
            if 'default_shift_end' in updates_dict: sheet.update_cell(row_idx, 5, str(end))
        else:
            # Check if start/end are provided, if not use defaults
            if 'default_shift_start' not in updates_dict: start = '08:00'
            if 'default_shift_end' not in updates_dict: end = '17:00'
            sheet.append_row([user_id, month, year, str(start), str(end)])
            
    return {"success": True}

@router.get("/configured-months/{year}")
def get_configured_months(year: str, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = str(current_user['id'])
    sheet = db.get_sheet("config_time")
    records = sheet.get_all_records()
    
    configured_months = []
    for r in records:
        if str(r['user_id']) == user_id and str(r['year']) == year:
            configured_months.append(int(r['month']))
            
    return {"months": configured_months}
