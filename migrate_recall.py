import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def migrate():
    try:
        with engine.connect() as connection:
            print("Checking if 'recordatorios_24h' table exists...")
            if "postgresql" in DATABASE_URL:
                check_query = text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recordatorios_24h');")
            else:
                check_query = text("SHOW TABLES LIKE 'recordatorios_24h';")
            
            result = connection.execute(check_query).fetchone()
            
            if not result or (isinstance(result[0], bool) and not result[0]):
                print("Table missing. Creating 'recordatorios_24h' table...")
                
                create_table_query = """
                CREATE TABLE recordatorios_24h (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    patient_id INT NOT NULL,
                    date DATE NOT NULL,
                    desayuno TEXT,
                    media_manana TEXT,
                    almuerzo TEXT,
                    media_tarde TEXT,
                    cena TEXT,
                    snack_nocturno TEXT,
                    observaciones TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
                );
                """
                
                if "postgresql" in DATABASE_URL:
                    create_table_query = create_table_query.replace("AUTO_INCREMENT", "SERIAL").replace("TEXT", "TEXT")
                
                connection.execute(text(create_table_query))
                connection.commit()
                print("Migration successful: Created 'recordatorios_24h' table.")
            else:
                print("Table 'recordatorios_24h' already exists.")
                
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
