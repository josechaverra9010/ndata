from main import UserDB, ProgressMetricDB, MealFoodItemDB, RecipeDB, MealPlanDB, SessionLocal
import traceback

def orm_audit():
    db = SessionLocal()
    models = [UserDB, ProgressMetricDB, MealFoodItemDB, RecipeDB, MealPlanDB]
    
    with open("orm_audit_output.txt", "w") as f:
        for model in models:
            f.write(f"\n--- Auditing ORM model: {model.__name__} ---\n")
            try:
                # Try to load all rows
                items = db.query(model).all()
                f.write(f"Loaded {len(items)} items for {model.__name__} successfully.\n")
            except Exception as e:
                f.write(f"ERROR loading {model.__name__}: {str(e)}\n")
                f.write(traceback.format_exc() + "\n")
                
                # If it failed, try loading one by one to find the specific ID
                f.write("Attempting to find specific problematic IDs...\n")
                try:
                    # We need to know the primary key column, usually 'id'
                    rows = db.query(model).all() # This will likely fail again if .all() fails
                except:
                    pass
                
                # Better way: iterate over IDs if possible
                # But since we don't know all IDs, let's just try a direct SQL to get IDs first
                from sqlalchemy import text
                ids = db.execute(text(f"SELECT id FROM {model.__tablename__}")).fetchall()
                for row_id in ids:
                    try:
                        item = db.query(model).filter(model.id == row_id[0]).first()
                        f.write(f"  ID {row_id[0]}: OK\n")
                    except Exception as row_e:
                        f.write(f"  ID {row_id[0]}: FAILED - {str(row_e)}\n")
    db.close()

if __name__ == "__main__":
    orm_audit()
