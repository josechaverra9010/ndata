import sqlite3
import os

db_path = "sql_app.db"

if not os.path.exists(db_path):
    print(f"Database {db_path} not found")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombres, apellidos, email, role FROM users")
    users = cursor.fetchall()
    print("Users in database:")
    for user in users:
        print(user)
    conn.close()
