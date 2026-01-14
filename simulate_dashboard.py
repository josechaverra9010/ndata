from main import UserDB, SessionLocal, calcular_progreso
import traceback

def simulate_dashboard():
    db = SessionLocal()
    print("Simulating get_dashboard_stats...")
    try:
        # Load patients like in the endpoint
        patients = db.query(UserDB).filter(UserDB.role == "patient").all()
        print(f"Loaded {len(patients)} patients.")
        
        total_p = 0
        count_p = 0
        for p in patients:
            print(f"Calculating progress for patient {p.id}: weights=({p.peso_actual}, {p.peso_objetivo}, {p.peso_inicial})")
            prog = calcular_progreso(p.peso_actual, p.peso_objetivo, p.peso_inicial)
            total_p += prog
            count_p += 1
        
        avg = int(total_p / count_p) if count_p > 0 else 0
        print(f"Avg progress: {avg}")
    except Exception as e:
        print(f"ERROR: {str(e)}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    simulate_dashboard()
