import gspread
from fastapi import APIRouter, Depends, HTTPException, Body
from auth import get_current_user, get_password_hash, verify_password, create_access_token
from database import db
from pydantic import BaseModel
import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

@router.post("/register")
def register(user: UserRegister):
    if not db.doc:
        raise HTTPException(status_code=500, detail=f"Database not initialized: {db.error}")
    
    sheet = db.get_sheet("users")
    records = sheet.get_all_records()
    
    if any(r['username'] == user.username for r in records):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(user.password)
    
    # Get all IDs to determine next ID and next row index safely
    # This prevents overwriting existing rows which can happen with append_row
    all_ids = sheet.col_values(1)
    # Filter to ensure we have valid data
    all_ids = [x for x in all_ids if x]
    
    numeric_ids = [int(x) for x in all_ids if str(x).isdigit()]
    next_id = max(numeric_ids, default=0) + 1
    
    # Calculate next row index based on actual data length (1-based)
    next_row_idx = len(all_ids) + 1
    
    new_user = [
        next_id,
        user.username,
        hashed_password,
        "user",
        datetime.datetime.utcnow().isoformat()
    ]
    
    # Use update_cells to write to specific row instead of append_row
    cells = []
    for col_idx, value in enumerate(new_user):
        cells.append(gspread.Cell(row=next_row_idx, col=col_idx+1, value=value))
        
    sheet.update_cells(cells)
    
    logger.info(f"User registered: {user.username}")
    return {"id": next_id, "username": user.username, "role": "user"}

@router.post("/login")
def login(user: UserLogin):
    if not db.doc:
        raise HTTPException(status_code=500, detail=f"Database not initialized: {db.error}")
        
    sheet = db.get_sheet("users")
    records = sheet.get_all_records()
    user_record = next((r for r in records if r['username'] == user.username), None)
    
    if user_record and verify_password(user.password, user_record['password_hash']):
        user_data = {
            "id": user_record['id'],
            "username": user_record['username'],
            "role": user_record['role']
        }
        token = create_access_token(user_data)
        logger.info(f"User {user.username} logged in successfully")
        return {"token": token, "user": user_data}
    
    logger.warning(f"Failed login attempt for user {user.username}")
    raise HTTPException(status_code=401, detail="Invalid username or password")

@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    logger.info(f"User {current_user['username']} accessed /me endpoint")
    return current_user
