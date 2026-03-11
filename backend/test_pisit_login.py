import sys
import os
from passlib.context import CryptContext

# Setup minimal context to match auth.py
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    # Mimic auth.py logic
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    
    print(f"Plain bytes len: {len(plain_password)}")
    if len(plain_password) > 71:
        print("Truncating password to 71 bytes")
        plain_password = plain_password[:71]
        
    # Ensure plain_password is bytes for passlib if we encoded it, though passlib handles strings too.
    # The error comes from _bcrypt backend.
    
    return pwd_context.verify(plain_password, hashed_password)

def test():
    username = "pisit"
    password = "03012526"
    # Hash provided by user in previous turn
    stored_hash = "$2b$10$.wPqlEJ2zCk7SxvfNV/piupBrMdwQlN2ss7mDNKafCrkoSxCvfe1O"

    print(f"Testing login for user: {username}")
    print(f"Password: {password}")
    print(f"Stored Hash: {stored_hash}")

    try:
        result = verify_password(password, stored_hash)
        print(f"Verification Result: {result}")
    except Exception as e:
        print(f"Verification Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()
