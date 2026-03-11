
import sys
import os
from database import db

def migrate_leave_config():
    """
    Migrate config_leave sheet to use month='0' for yearly configurations.
    This script will:
    1. Read all existing records from 'config_leave'
    2. Identify user-specific records that are monthly (month != '0')
    3. Convert/Merge them into yearly records (month='0')
       - Strategy: Take the latest month's config for a year and promote it to yearly.
    4. Update the sheet (or append new yearly records if not exist)
    
    Note: This is a simple migration. For production with critical data, backup first.
    """
    print("Starting migration for config_leave...")
    
    try:
        if not db.doc:
            print("Database not initialized. Check .env variables.")
            return

        sheet = db.get_sheet("config_leave")
        records = sheet.get_all_records()
        
        # Dictionary to store the latest config per (user_id, year)
        # Key: (user_id, year) -> Value: {sick_leave_total, vacation_leave_total, source_month}
        yearly_configs = {}
        
        # Helper to convert to int safely
        def safe_int(v):
            try: return int(v)
            except: return 0

        print(f"Found {len(records)} records.")

        for r in records:
            user_id = str(r['user_id'])
            month = str(r['month'])
            year = str(r['year'])
            sick = r['sick_leave_total']
            vacation = r['vacation_leave_total']
            
            # Skip global default (0,0,0) or already yearly (month=0)
            if month == '0':
                continue
                
            key = (user_id, year)
            
            # Logic: If we haven't seen this year yet, or if this record is from a later month
            # than what we have stored, update it.
            current_month_val = safe_int(month)
            
            if key not in yearly_configs:
                yearly_configs[key] = {
                    'sick': sick,
                    'vacation': vacation,
                    'max_month': current_month_val
                }
            else:
                if current_month_val > yearly_configs[key]['max_month']:
                    yearly_configs[key] = {
                        'sick': sick,
                        'vacation': vacation,
                        'max_month': current_month_val
                    }

        print(f"Identified {len(yearly_configs)} yearly configurations to migrate/create.")
        
        # Now apply these changes
        # We don't delete old monthly records to be safe, just ensure a yearly record exists.
        # If a yearly record (month='0') already exists for that user+year, we might overwrite or skip.
        # Let's overwrite to ensure it matches the latest monthly config the user had set.
        
        # Re-read records to be sure (though not strictly necessary if single threaded)
        # Optimization: We can just check our 'records' list since we just read it.
        
        updates = []
        appends = []
        
        existing_yearly_indices = {} # (user_id, year) -> row_index (1-based)
        
        for i, r in enumerate(records):
            if str(r['month']) == '0':
                key = (str(r['user_id']), str(r['year']))
                existing_yearly_indices[key] = i + 2 # Header is row 1, 0-based index i -> row i+2
        
        for (user_id, year), config in yearly_configs.items():
            sick = str(config['sick'])
            vacation = str(config['vacation'])
            
            if (user_id, year) in existing_yearly_indices:
                # Update existing row
                row_idx = existing_yearly_indices[(user_id, year)]
                print(f"Updating existing yearly record for User {user_id} Year {year} (Row {row_idx})")
                # Sick is col 4, Vacation is col 5
                sheet.update_cell(row_idx, 4, sick)
                sheet.update_cell(row_idx, 5, vacation)
            else:
                # Append new row
                print(f"Creating new yearly record for User {user_id} Year {year}")
                sheet.append_row([user_id, "0", year, sick, vacation])
                
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate_leave_config()
