from main import SessionLocal, PatientMealPlanDB, MealPlanDB, WeeklyMenuDB
import json

def debug_plan(patient_id):
    db = SessionLocal()
    try:
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active"
        ).order_by(PatientMealPlanDB.id.desc()).first()
        
        if not active_plan:
            print("No active plan found")
            return
            
        print(f"Active Plan ID: {active_plan.id}")
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        weekly_menu = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == plan.id,
            WeeklyMenuDB.week_number == active_plan.current_week
        ).first()
        
        if not weekly_menu:
            print("No weekly menu found")
            return
            
        days = ["thursday", "monday"]
        for day in days:
            raw = getattr(weekly_menu, day)
            print(f"--- {day.upper()} ---")
            if not raw:
                print("EMPTY (None or {})")
                continue
                
            if isinstance(raw, str):
                try:
                    data = json.loads(raw)
                except:
                    print("INVALID JSON STRING")
                    continue
            else:
                data = raw
                
            if isinstance(data, dict):
                if "meals" in data:
                    print(f"Meals count: {len(data['meals'])}")
                    for i, m in enumerate(data['meals']):
                        print(f"  Meal {i}: Type='{m.get('type')}', Name='{m.get('name') or m.get('receta')}'")
                else:
                    print(f"Dict Keys: {list(data.keys())}")
            else:
                print(f"Unknown Type: {type(data)}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_plan(8)
