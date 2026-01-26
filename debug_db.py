import sqlite3
import os

db_path = "sql_app.db"

if not os.path.exists(db_path):
    print(f"Database {db_path} not found")
else:
    print(f"Database {db_path} found, size: {os.path.getsize(db_path)} bytes")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {tables}")
        
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        print(f"Total users: {count}")
        
        cursor.execute("SELECT id, nombres, apellidos, email, role FROM users LIMIT 10")
        users = cursor.fetchall()
        print("First 10 users:")
        for user in users:
            print(user)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
