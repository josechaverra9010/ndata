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
        columns = cursor.fetchall()
        print(f"Found {len(columns)} columns in 'users':")
        for col in columns:
            print(f"ID: {col[0]}, Name: {col[1]}, Type: {col[2]}, Nullable: {col[3]}, Default: {col[4]}, PK: {col[5]}")
            
        conn.close()
    except Exception as e:
        print(f"Error checking schema: {e}")

if __name__ == "__main__":
    list_columns()
