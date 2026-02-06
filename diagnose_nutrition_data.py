"""
Diagnostic script to investigate nutritional plan data in the database
"""
import sys
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database connection
DATABASE_URL = "mysql+pymysql://root:1234@localhost:3306/nutrition_db"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

print("=" * 80)
print("DIAGNOSTIC: Investigating Nutritional Plan Data")
print("=" * 80)

# 1. Check active meal plans
print("\n1. ACTIVE MEAL PLANS:")
print("-" * 80)
query = text("""
    SELECT 
        pmp.id as assignment_id,
        pmp.patient_id,
        pmp.meal_plan_id,
        pmp.status,
        pmp.current_week,
        mp.name as plan_name,
        mp.calories,
        mp.protein_target,
        mp.carbs_target,
        mp.fat_target
    FROM patient_meal_plans pmp
    JOIN meal_plans mp ON pmp.meal_plan_id = mp.id
    WHERE pmp.status = 'active'
    LIMIT 5
""")

result = db.execute(query)
rows = result.fetchall()

if rows:
    for row in rows:
        print(f"\nPatient ID: {row.patient_id}")
        print(f"  Plan: {row.plan_name}")
        print(f"  Calories: {row.calories}")
        print(f"  Protein: {row.protein_target}g")
        print(f"  Carbs: {row.carbs_target}g")
        print(f"  Fat: {row.fat_target}g")
        print(f"  Current Week: {row.current_week}")
else:
    print("No active plans found")

# 2. Check fase_1 and fase_2 data for one plan
print("\n\n2. CHECKING FASE_1 AND FASE_2 DATA:")
print("-" * 80)
query = text("""
    SELECT 
        id,
        name,
        fase_1,
        fase_2
    FROM meal_plans
    WHERE id IN (
        SELECT meal_plan_id FROM patient_meal_plans WHERE status = 'active' LIMIT 1
    )
    LIMIT 1
""")

result = db.execute(query)
plan_row = result.fetchone()

if plan_row:
    print(f"\nPlan: {plan_row.name}")
    print(f"\nFASE_1 structure:")
    if plan_row.fase_1:
        try:
            fase_1 = json.loads(plan_row.fase_1) if isinstance(plan_row.fase_1, str) else plan_row.fase_1
            print(json.dumps(fase_1, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error parsing fase_1: {e}")
            print(f"Raw value: {plan_row.fase_1}")
    else:
        print("  (null)")
    
    print(f"\nFASE_2 structure:")
    if plan_row.fase_2:
        try:
            fase_2 = json.loads(plan_row.fase_2) if isinstance(plan_row.fase_2, str) else plan_row.fase_2
            print(json.dumps(fase_2, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error parsing fase_2: {e}")
            print(f"Raw value: {plan_row.fase_2}")
    else:
        print("  (null)")
else:
    print("No plan found")

# 3. Check meal_plans table schema
print("\n\n3. MEAL_PLANS TABLE SCHEMA:")
print("-" * 80)
query = text("DESCRIBE meal_plans")
result = db.execute(query)
columns = result.fetchall()

for col in columns:
    print(f"  {col[0]}: {col[1]}")

db.close()

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
