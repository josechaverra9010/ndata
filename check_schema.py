import sqlite3
import os

DB_PATH = "sql_app.db"

def check_schema():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found")
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        print("--- Columns in 'users' table ---")
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        for col in columns:
            print(col)
            
        conn.close()
    except Exception as e:
        print(f"Error checking schema: {e}")

if __name__ == "__main__":
    check_schema()
