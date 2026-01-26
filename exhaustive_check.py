import pymysql

try:
    connection = pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='ndata',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    with connection.cursor() as cursor:
        print("--- ALL USERS ---")
        cursor.execute("SELECT id, email, role FROM users")
        for row in cursor.fetchall():
            print(f"ID: {row['id']} | Email: {row['email']} | Role: '{row['role']}'")
            
        print("\n--- ROLE COUNTS ---")
        cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
        for row in cursor.fetchall():
            print(f"Role: '{row['role']}' | Count: {row['count']}")
            
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'connection' in locals():
        connection.close()
