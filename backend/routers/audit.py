from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import db

router = APIRouter()

@router.get("", include_in_schema=False)
@router.get("/")
def get_audit_logs(current_user: dict = Depends(get_current_user)):
    if not db.doc:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    sheet = db.get_sheet("audit_logs")
    records = sheet.get_all_records()
    
    user_sheet = db.get_sheet("users")
    user_records = user_sheet.get_all_records()
    
    user_map = {r['id']: r['username'] for r in user_records}
    
    for log in records:
        log['username'] = user_map.get(log['user_id'], "Unknown")
        
    records.sort(key=lambda x: x['timestamp'], reverse=True)
    return records[:100]
