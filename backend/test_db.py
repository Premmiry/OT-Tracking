import os
import sys
import json
import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")
GOOGLE_PRIVATE_KEY = os.getenv("GOOGLE_PRIVATE_KEY")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

def test_db():
    print("Testing DB connection...")
    print(f"Email: {GOOGLE_SERVICE_ACCOUNT_EMAIL}")
    print(f"Sheet ID: {GOOGLE_SHEET_ID}")
    
    try:
        if not GOOGLE_SERVICE_ACCOUNT_EMAIL or not GOOGLE_PRIVATE_KEY or not GOOGLE_SHEET_ID:
            raise Exception("Missing environment variables")

        # Clean up the key
        private_key = GOOGLE_PRIVATE_KEY.replace('\\n', '\n')
        print(f"Private Key Start: {private_key[:50]}...")
        
        creds_dict = {
            "type": "service_account",
            "project_id": "ot-tracker-489706",
            "private_key_id": "unknown",
            "private_key": private_key,
            "client_email": GOOGLE_SERVICE_ACCOUNT_EMAIL,
            "client_id": "unknown",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{GOOGLE_SERVICE_ACCOUNT_EMAIL}"
        }

        scope = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]

        creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
        client = gspread.authorize(creds)
        
        # Open the sheet
        if "docs.google.com" in GOOGLE_SHEET_ID:
            doc = client.open_by_url(GOOGLE_SHEET_ID)
        else:
            doc = client.open_by_key(GOOGLE_SHEET_ID)

        print(f"Successfully loaded sheet: {doc.title}")
        return True
        
    except Exception as e:
        print(f"Failed to initialize database: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if test_db():
        print("Test PASSED")
        sys.exit(0)
    else:
        print("Test FAILED")
        sys.exit(1)
