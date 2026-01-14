from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
metadata = MetaData()
metadata.reflect(bind=engine)

def exhaustive_audit():
    with open("exhaustive_diag.txt", "w") as f:
        for table_name in metadata.tables:
            f.write(f"\n--- Auditing table: {table_name} ---\n")
            table = metadata.tables[table_name]
            
            with engine.connect() as conn:
                res = conn.execute(table.select())
                keys = res.keys()
                
                rows_processed = 0
                for row in res:
                    rows_processed += 1
                    # Try to access each value in the row. 
                    # If it's a Float column, SQLAlchemy will trigger the processor here if we use ORM,
                    # but since we are using core 'reflect', let's see.
                    
                    # Actually, let's try to map it to a dict and see if it fails
                    try:
                        d = dict(zip(keys, row))
                    except Exception as e:
                        f.write(f"ERROR: Row {rows_processed} in {table_name} failed dictionary mapping: {e}\n")
                        continue
                        
                f.write(f"Processed {rows_processed} rows in {table_name} successfully.\n")

if __name__ == "__main__":
    exhaustive_audit()
