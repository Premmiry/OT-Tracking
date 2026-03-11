import gspread
from fastapi import APIRouter, Depends, HTTPException, Body
from auth import get_current_user
from database import db
from pydantic import BaseModel
from typing import List, Optional
import datetime

router = APIRouter()

class OffsetRecord(BaseModel):
    id: Optional[int] = None
    ot_attendance_id: int
    offset_attendance_id: int
    minutes_used: int

@router.get("", include_in_schema=False)
@router.get("/")
def get_offsets(current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sheet = db.get_sheet("offsets")
    records = sheet.get_all_records()
    
    user_id = str(current_user['id'])
    offsets = [r for r in records if str(r['user_id']) == user_id]
    
    attendance_sheet = db.get_sheet("attendance")
    attendance_records = attendance_sheet.get_all_records()
    
    # Use safe lookup with str() conversion
    attendance_map = {}
    record_map = {}
    for r in attendance_records:
        if str(r.get('user_id', '')) == user_id:
            rid = str(r.get('id', ''))
            attendance_map[rid] = r.get('date', '')
            record_map[rid] = r
    
    for offset in offsets:
        ot_id = str(offset.get('ot_attendance_id', ''))
        off_id = str(offset.get('offset_attendance_id', ''))
        offset['ot_date'] = attendance_map.get(ot_id, "")
        offset['offset_date'] = attendance_map.get(off_id, "")
        offset['ot_record'] = record_map.get(ot_id, {})
        offset['offset_record'] = record_map.get(off_id, {})
        
    return offsets

@router.post("", include_in_schema=False)
@router.post("/")
def save_offset(offset: OffsetRecord, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sheet = db.get_sheet("offsets")
    records = sheet.get_all_records()
    
    attendance_sheet = db.get_sheet("attendance")
    attendance_records = attendance_sheet.get_all_records()
    
    user_id = str(current_user['id'])
    ot_row = next((r for r in attendance_records if str(r['user_id']) == user_id and r['id'] == offset.ot_attendance_id), None)
    offset_row = next((r for r in attendance_records if str(r['user_id']) == user_id and r['id'] == offset.offset_attendance_id), None)
    
    if not ot_row or not offset_row:
        raise HTTPException(status_code=404, detail="Attendance record not found")
        
    # Rules:
    # 1. OT date < Offset date
    if datetime.datetime.strptime(ot_row['date'], "%Y-%m-%d") >= datetime.datetime.strptime(offset_row['date'], "%Y-%m-%d"):
        raise HTTPException(status_code=400, detail="วัน OT ต้องเป็นวันก่อนวันที่นำมาทด (ไม่สามารถใช้ OT อนาคตมาทดได้)")
        
    # 2. OT balance must be enough
    # Calculate how much OT has been used from this specific OT record
    # Exclude current offset record if updating
    current_offset_id = int(offset.id) if offset.id else -1
    
    used_from_this_ot = sum(int(r['minutes_used']) for r in records 
                           if int(r['ot_attendance_id']) == offset.ot_attendance_id 
                           and int(r.get('id', 0) or 0) != current_offset_id)
                           
    available_ot = int(ot_row['ot_minutes']) - used_from_this_ot
    
    if offset.minutes_used > available_ot:
        raise HTTPException(status_code=400, detail=f"OT ไม่เพียงพอ (เหลือ {available_ot} นาที)")

    # 3. Debt must be enough (cannot offset more than what is late/early)
    # This ensures "ใช้ได้แค่ครั้งเดียว" if they offset the whole debt, 
    # but also allows partial offsets if debt is large.
    used_for_this_debt = sum(int(r['minutes_used']) for r in records 
                            if int(r['offset_attendance_id']) == offset.offset_attendance_id
                            and int(r.get('id', 0) or 0) != current_offset_id)
                            
    total_debt = int(offset_row['late_minutes']) + int(offset_row['early_minutes'])
    remaining_debt = total_debt - used_for_this_debt
    
    if offset.minutes_used > remaining_debt:
        raise HTTPException(status_code=400, detail=f"ยอดที่ต้องการทดเกินยอดที่ค้าง (ค้าง {remaining_debt} นาที)")

    if offset.id:
        # Update existing
        row_idx = None
        for i, r in enumerate(records):
            if str(r.get('id', '')) == str(offset.id) and str(r.get('user_id', '')) == user_id:
                row_idx = i + 2
                break
        
        if not row_idx:
            raise HTTPException(status_code=404, detail=f"Offset with ID {offset.id} not found")
            
        # Update cells
        # Columns: 1=id, 2=user_id, 3=ot_id, 4=off_id, 5=mins, 6=timestamp
        cells = [
            gspread.Cell(row=row_idx, col=3, value=offset.ot_attendance_id),
            gspread.Cell(row=row_idx, col=4, value=offset.offset_attendance_id),
            gspread.Cell(row=row_idx, col=5, value=offset.minutes_used),
            gspread.Cell(row=row_idx, col=6, value=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        ]
        sheet.update_cells(cells)
    else:
        # Create new
        all_ids = sheet.col_values(1)
        all_ids = [x for x in all_ids if x]
        
        numeric_ids = [int(x) for x in all_ids if str(x).isdigit()]
        next_id = max(numeric_ids, default=0) + 1
        
        next_row_idx = len(all_ids) + 1
        
        new_row = [
            next_id,
            user_id,
            offset.ot_attendance_id,
            offset.offset_attendance_id,
            offset.minutes_used,
            datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ]
        
        cells = []
        for col_idx, value in enumerate(new_row):
            cells.append(gspread.Cell(row=next_row_idx, col=col_idx+1, value=value))
            
        sheet.update_cells(cells)
    
    return {"success": True}

@router.delete("/{id}")
def delete_offset(id: int, current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sheet = db.get_sheet("offsets")
    records = sheet.get_all_records()
    
    user_id = str(current_user['id'])
    row_idx = None
    
    for i, r in enumerate(records):
        if str(r['user_id']) == user_id and r['id'] == id:
            row_idx = i + 2
            break
            
    if row_idx:
        sheet.delete_rows(row_idx)
        return {"success": True}
    else:
        raise HTTPException(status_code=404, detail="Offset not found")
