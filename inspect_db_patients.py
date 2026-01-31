import sqlite3
import os

# The app uses sql_app.db according to list_dir
DB_PATH = "sql_app.db"

def inspect_patients():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found")
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("--- Patients in DB ---")
        cursor.execute("SELECT id, nombres, apellidos, role, nutritionist_id FROM users WHERE role='patient'")
        patients = cursor.fetchall()
        for p in patients:
            print(p)
            
        print("\n--- Admins in DB ---")
        cursor.execute("SELECT id, nombres, apellidos, role FROM users WHERE role IN ('admin', 'superadmin')")
        admins = cursor.fetchall()
        for a in admins:
            print(a)
            
        conn.close()
    except Exception as e:
        print(f"Error inspecting DB: {e}")

if __name__ == "__main__":
    inspect_patients()
