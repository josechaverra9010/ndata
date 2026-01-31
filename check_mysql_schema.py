import pymysql
import os

try:
    connection = pymysql.connect(
        host='localhost',
        user='root',
        password='',
        database='ndata',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    with connection.cursor() as cursor:
        cursor.execute("DESCRIBE users")
        columns = cursor.fetchall()
        print(f"--- COLUMNS IN 'users' (MySQL) ---")
        for col in columns:
            print(f"Field: {col['Field']}, Type: {col['Type']}, Null: {col['Null']}, Key: {col['Key']}, Default: {col['Default']}, Extra: {col['Extra']}")
            
except Exception as e:
    print(f"Error connecting to MySQL: {e}")
finally:
    if 'connection' in locals():
        connection.close()
