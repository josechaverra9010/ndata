import sqlite3
import os

DB_PATH = "sql_app.db"

def list_columns():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found")
        return
        
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        print("Columns in 'users':")
        for col in columns:
            print(f"- {col}")
            
        conn.close()
    except Exception as e:
        print(f"Error checking schema: {e}")

if __name__ == "__main__":
    list_columns()
