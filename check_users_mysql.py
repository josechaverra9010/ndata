import pymysql
import os

try:
    # Use the same default as main.py
    connection = pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='ndata',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    with connection.cursor() as cursor:
        cursor.execute("SELECT id, role, nombres, apellidos FROM users WHERE role='patient'")
        result = cursor.fetchall()
        print(f"--- PATIENTS ---")
        for row in result:
            print(f"ID {row['id']}: '{row['nombres']}' '{row['apellidos']}'")
        
        cursor.execute("SELECT id, role, nombres, apellidos FROM users WHERE role IN ('admin', 'superadmin')")
        result = cursor.fetchall()
        print(f"--- ADMINS ---")
        for row in result:
            print(f"ID {row['id']}: '{row['nombres']}' '{row['apellidos']}'")
        
        cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
        summary = cursor.fetchall()
        print(f"--- ROLE SUMMARY ---")
        for row in summary:
            print(f"Role: '{row['role']}' | Count: {row['count']}")
            
except Exception as e:
    print(f"Error connecting to MySQL: {e}")
finally:
    if 'connection' in locals():
        connection.close()
