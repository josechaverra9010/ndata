from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as connection:
        try:
            # Check if column exists
            result = connection.execute(text("SHOW COLUMNS FROM users LIKE 'pal_factor'"))
            if result.fetchone():
                print("Column 'pal_factor' already exists.")
            else:
                print("Adding 'pal_factor' column...")
                connection.execute(text("ALTER TABLE users ADD COLUMN pal_factor FLOAT NULL"))
                print("Column added successfully.")
                
            connection.commit()
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
