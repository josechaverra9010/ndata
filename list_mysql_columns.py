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
        cursor.execute("DESCRIBE users")
        columns = cursor.fetchall()
        print("Columns in 'users' (MySQL):")
        for col in columns:
            print(f"- {col['Field']}")
            
except Exception as e:
    print(f"Error connecting to MySQL: {e}")
finally:
    if 'connection' in locals():
        connection.close()
