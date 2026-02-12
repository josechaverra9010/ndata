"""
Script para actualizar menús semanales que no tienen created_by_id asignado.
Los asigna al primer admin/superadmin que encuentre.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Configuración de Base de Datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("MYSQL_USER")
    DB_PASS = os.getenv("MYSQL_PASSWORD")
    DB_HOST = os.getenv("MYSQL_HOST")
    DB_PORT = os.getenv("MYSQL_PORT")
    DB_NAME = os.getenv("MYSQL_DB")
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_recycle=3600, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def fix_menus():
    db = SessionLocal()
    try:
        # Buscar menús sin created_by_id
        result = db.execute(text("""
            SELECT id, name, created_at 
            FROM weekly_menus_complete 
            WHERE created_by_id IS NULL
        """))
        menus_sin_owner = result.fetchall()
        
        print(f"\n🔍 Encontrados {len(menus_sin_owner)} menús sin created_by_id")
        
        if not menus_sin_owner:
            print("✅ Todos los menús tienen created_by_id asignado")
            return
        
        for menu in menus_sin_owner:
            print(f"   - ID: {menu[0]}, Nombre: {menu[1]}, Creado: {menu[2]}")
        
        # Buscar el primer admin o superadmin para asignar
        result = db.execute(text("""
            SELECT id, email, role 
            FROM users 
            WHERE role IN ('admin', 'superadmin') 
            LIMIT 1
        """))
        admin_user = result.fetchone()
        
        if not admin_user:
            print("\n❌ No se encontró ningún usuario admin/superadmin")
            print("   No se pueden actualizar los menús")
            return
        
        admin_id = admin_user[0]
        print(f"\n👤 Asignando menús al usuario: {admin_user[1]} (ID: {admin_id}, Role: {admin_user[2]})")
        
        # Actualizar menús
        result = db.execute(
            text("UPDATE weekly_menus_complete SET created_by_id = :admin_id WHERE created_by_id IS NULL"),
            {"admin_id": admin_id}
        )
        db.commit()
        
        print(f"✅ {result.rowcount} menús actualizados correctamente")
        print(f"\nℹ️  Ahora estos menús serán visibles para el usuario {admin_user[1]}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("SCRIPT DE MIGRACIÓN: Asignar created_by_id a menús huérfanos")
    print("=" * 60)
    fix_menus()
    print("\n✅ Script completado")
