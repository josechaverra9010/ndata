"""
Script para corregir las URLs de avatar en la base de datos.
Elimina comillas simples y actualiza el BASE_URL.
"""
import os
import re
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configuración de la base de datos
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "parchao_root")
DB_HOST = os.getenv("DB_HOST", "host.docker.internal")
DB_PORT = os.getenv("DB_PORT", "3307")
DB_NAME = os.getenv("DB_NAME", "ndata")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")
print(f"BASE_URL: {BASE_URL}\n")

# Crear engine y session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def fix_avatar_urls():
    """Corrige las URLs de foto_perfil en la tabla users"""
    session = Session()
    try:
        # Obtener todos los usuarios con foto_perfil
        result = session.execute(
            text("SELECT id, foto_perfil FROM users WHERE foto_perfil IS NOT NULL")
        )
        users = result.fetchall()
        
        updated_count = 0
        for user in users:
            user_id, old_url = user
            
            if not old_url:
                continue
            
            # Limpiar comillas simples y dobles al inicio y final
            new_url = old_url.strip().strip("'\"")
            
            # Limpiar comillas dentro de la URL también
            new_url = new_url.replace("'", "").replace('"', '')
            
            # Si la URL tiene un patrón de upload, extraer el nombre del archivo
            match = re.search(r'uploads/([^/\s]+)$', new_url)
            if match:
                filename = match.group(1)
                # Reconstruir URL correcta sin comillas
                base_url_clean = BASE_URL.strip("'\"")
                new_url = f"{base_url_clean}/uploads/{filename}"
                
                # Actualizar en la base de datos
                session.execute(
                    text("UPDATE users SET foto_perfil = :new_url WHERE id = :user_id"),
                    {"new_url": new_url, "user_id": user_id}
                )
                updated_count += 1
                print(f"Usuario {user_id}: [{old_url}] -> [{new_url}]")
        
        session.commit()
        print(f"\n✅ {updated_count} URLs actualizadas correctamente")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    print("🔧 Corrigiendo URLs de avatares...")
    fix_avatar_urls()
