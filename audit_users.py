from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "mysql+pymysql://root@localhost/ndata"

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def audit():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT * FROM users"))
        keys = res.keys()
        
        float_cols = ['altura', 'peso_inicial', 'peso_actual', 'peso_objetivo']
        
        print(f"Auditing {len(float_cols)} columns across all rows...")
        
        errors = []
        for row in res:
            row_dict = dict(zip(keys, row))
            for col in float_cols:
                val = row_dict.get(col)
                if val is not None and isinstance(val, str):
                    try:
                        float(val)
                    except ValueError:
                        errors.append({
                            'id': row_dict['id'],
                            'column': col,
                            'value': repr(val),
                            'type': type(val).__name__
                        })
                elif val is None:
                    # NULL is fine for nullable FLOAT
                    pass
                elif isinstance(val, (int, float)):
                    # Numbers are fine
                    pass
                else:
                    # Weird types?
                    print(f"ID {row_dict['id']}, Col {col}: Weird type {type(val).__name__} with value {repr(val)}")

        if errors:
            print(f"Found {len(errors)} conversion errors:")
            for err in errors:
                print(err)
        else:
            print("No conversion errors found in manual audit.")

if __name__ == "__main__":
    audit()
