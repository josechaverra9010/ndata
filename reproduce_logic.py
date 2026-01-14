from main import SessionLocal, PatientMealPlanDB, MealPlanDB, WeeklyMenuDB
import json
import datetime

def reproduce_dashboard_logic(patient_id):
    db = SessionLocal()
    try:
        # Mimic get_patient_today_meals
        date = datetime.date.today()
        
        active_plan = db.query(PatientMealPlanDB).filter(
            PatientMealPlanDB.patient_id == patient_id,
            PatientMealPlanDB.status == "active"
        ).order_by(PatientMealPlanDB.id.desc()).first()
        
        if not active_plan:
            print("No active plan")
            return
            
        plan = db.query(MealPlanDB).filter(MealPlanDB.id == active_plan.meal_plan_id).first()
        weekly_menu = db.query(WeeklyMenuDB).filter(
            WeeklyMenuDB.meal_plan_id == plan.id,
            WeeklyMenuDB.week_number == active_plan.current_week
        ).first()
        
        if not weekly_menu:
            print("No weekly menu")
            return
            
        day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        day_name = day_names[date.weekday()]
        
        day_raw = getattr(weekly_menu, day_name, {})
        if day_raw is None:
            day_raw = {}
        
        if isinstance(day_raw, str):
            try:
                day_menu = json.loads(day_raw)
            except:
                day_menu = {}
        else:
            day_menu = day_raw
            
        if isinstance(day_menu, dict) and "meals" in day_menu and isinstance(day_menu["meals"], list):
            new_day_menu = {}
            for m in day_menu["meals"]:
                if isinstance(m, dict) and "type" in m:
                    new_day_menu[m["type"]] = m
            day_menu = new_day_menu

        meal_structure = [
            {"id": "breakfast", "name": "Desayuno", "time": "8:00 AM"},
            {"id": "morning_snack", "name": "Snack AM", "time": "10:30 AM"},
            {"id": "lunch", "name": "Almuerzo", "time": "1:00 PM"},
            {"id": "afternoon_snack", "name": "Snack PM", "time": "4:00 PM"},
            {"id": "dinner", "name": "Cena", "time": "7:30 PM"},
        ]
        
        key_mapping = {
            "breakfast": ["breakfast", "desayuno"],
            "morning_snack": ["morning_snack", "snack_am", "media_manana", "merienda_manana", "almuerzo"],
            "lunch": ["lunch", "comida"],
            "afternoon_snack": ["afternoon_snack", "snack_pm", "media_tarde", "merienda_tarde", "merienda"],
            "dinner": ["dinner", "cena"]
        }
        
        result = []
        for meal_info in meal_structure:
            meal_data = None
            possible_keys = key_mapping.get(meal_info["id"], [meal_info["id"]])
            
            for pk in possible_keys:
                if pk in day_menu:
                    meal_data = day_menu[pk]
                    break
            
            if meal_data:
                result.append(meal_info["id"])

        print(f"Final Count: {len(result)}")
        print(f"Result IDs: {result}")

    finally:
        db.close()

if __name__ == "__main__":
    reproduce_dashboard_logic(8)
