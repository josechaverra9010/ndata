from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or "mysql+pymysql://root@localhost/ndata"
engine = create_engine(DATABASE_URL)

def print_raw():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, altura, peso_inicial, peso_actual, peso_objetivo FROM users WHERE id IN (1, 9)"))
        for row in res:
            # Use repr to see exactly what the data is
            print(f"Row: {[(col, repr(val), type(val).__name__) for col, val in zip(res.keys(), row)]}")

if __name__ == "__main__":
    print_raw()
