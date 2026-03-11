import os
import json
import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

load_dotenv()

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")
GOOGLE_PRIVATE_KEY = os.getenv("GOOGLE_PRIVATE_KEY")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

class Database:
    def __init__(self):
        self.doc = None
        self.error = None
        self.init_db()

    def init_db(self):
        try:
            # Re-load env vars to ensure we have the latest ones
            global GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID
            load_dotenv()
            GOOGLE_SERVICE_ACCOUNT_EMAIL = os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")
            GOOGLE_PRIVATE_KEY = os.getenv("GOOGLE_PRIVATE_KEY")
            GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")

            if not GOOGLE_SERVICE_ACCOUNT_EMAIL or not GOOGLE_PRIVATE_KEY or not GOOGLE_SHEET_ID:
                raise Exception("Missing environment variables")

            # Clean up the key
            private_key = GOOGLE_PRIVATE_KEY.replace('\\n', '\n')
            if not private_key.startswith("-----BEGIN PRIVATE KEY-----"):
                # Handle cases where key might be malformed or raw base64 (though usually it's PEM)
                # For now assume standard PEM format from .env
                pass

            creds_dict = {
                "type": "service_account",
                "project_id": "ot-tracker-489706", # This might need to be dynamic or irrelevant for just gspread auth if email/key provided directly
                "private_key_id": "unknown", # Optional for some auth flows
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
                # Extract ID if URL provided (simple logic)
                self.doc = client.open_by_url(GOOGLE_SHEET_ID)
            else:
                self.doc = client.open_by_key(GOOGLE_SHEET_ID)

            print(f"Successfully loaded sheet: {self.doc.title}")
            self.ensure_sheets()
            
        except Exception as e:
            self.error = str(e)
            print(f"Failed to initialize database: {e}")

    def ensure_sheets(self):
        if not self.doc:
            return

        sheets_config = [
            {"title": "users", "header": ["id", "username", "password_hash", "role", "created_at"]},
            {"title": "audit_logs", "header": ["id", "user_id", "action", "table_name", "record_id", "old_values", "new_values", "timestamp"]},
            {"title": "config_leave", "header": ["user_id", "month", "year", "sick_leave_total", "vacation_leave_total"]},
            {"title": "config_time", "header": ["user_id", "month", "year", "default_shift_start", "default_shift_end"]},
            {"title": "attendance", "header": ["id", "date", "type", "shift_start", "shift_end", "actual_start", "actual_end", "late_minutes", "early_minutes", "ot_minutes", "notes", "user_id"]},
            {"title": "offsets", "header": ["id", "user_id", "ot_attendance_id", "offset_attendance_id", "minutes_used"]},
            {"title": "settings", "header": ["user_id", "month", "year", "key", "value"]},
        ]

        existing_sheets = {s.title: s for s in self.doc.worksheets()}

        for config in sheets_config:
            if config["title"] not in existing_sheets:
                print(f"Creating sheet: {config['title']}")
                sheet = self.doc.add_worksheet(title=config["title"], rows=100, cols=20)
                sheet.append_row(config["header"])
                
                # Seed settings
                if config["title"] == "config_leave":
                    default_settings = [
                        ["0", "0", "0", "30", "10"],
                    ]
                    for row in default_settings:
                        sheet.append_row(row)
                
                if config["title"] == "config_time":
                    default_settings = [
                        ["0", "0", "0", "08:00", "17:00"],
                    ]
                    for row in default_settings:
                        sheet.append_row(row)
            else:
                # Basic check - in production might want to update headers
                pass

    def get_sheet(self, title):
        if not self.doc:
            raise Exception(f"Database not initialized: {self.error}")
        return self.doc.worksheet(title)

db = Database()
