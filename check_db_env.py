import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Try to find the actual database path or URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
print(f"DATABASE_URL: {DATABASE_URL}")

if DATABASE_URL.startswith("sqlite"):
    db_path = DATABASE_URL.replace("sqlite:///", "").replace("./", "")
    print(f"Checking SQLite file: {db_path}")
    if os.path.exists(db_path):
        print(f"File exists. Size: {os.path.getsize(db_path)} bytes")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT COUNT(*) FROM users")
            print(f"User count: {cursor.fetchone()[0]}")
            cursor.execute("SELECT role, COUNT(*) FROM users GROUP BY role")
            print(f"Roles: {cursor.fetchall()}")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            conn.close()
    else:
        print("File does NOT exist.")
else:
    print("Non-SQLite database detected. Cannot check with simple script.")
