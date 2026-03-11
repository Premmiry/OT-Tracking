import os
import jwt
import datetime
import logging
import bcrypt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

# Setup logger
logger = logging.getLogger("uvicorn")

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "your_super_secret_key_here")

security = HTTPBearer()

def get_password_hash(password):
    if isinstance(password, str):
        password = password.encode('utf-8')
    if len(password) > 71:
        password = password[:71]
    
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password, salt).decode('utf-8')

def verify_password(plain_password, hashed_password):
    logger.info(f"Verifying password. Plain len: {len(plain_password)}")
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    
    logger.info(f"Plain bytes len: {len(plain_password)}")
    if len(plain_password) > 71:
        logger.warning("Truncating password to 71 bytes")
        plain_password = plain_password[:71]
        
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')

    try:
        return bcrypt.checkpw(plain_password, hashed_password)
    except Exception as e:
        logger.error(f"Verify error: {e}")
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected token error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        token = credentials.credentials
        if not token:
            logger.warning("No token provided in credentials")
            raise HTTPException(status_code=401, detail="Not authenticated")
            
        payload = decode_access_token(token)
        return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Not authenticated")
