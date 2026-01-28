"""
Script completo para verificar la configuración de Cloud Storage
"""
import os
from dotenv import load_dotenv

load_dotenv()

def check_configuration():
    """Verifica todas las variables de entorno necesarias"""
    
    print("=" * 70)
    print("🔍 VERIFICACIÓN DE CONFIGURACIÓN DE CLOUD STORAGE")
    print("=" * 70)
    
    # Variables de entorno
    configs = {
        "DEBUG": os.getenv("DEBUG", "False"),
        "GS_BUCKET_NAME": os.getenv("GS_BUCKET_NAME"),
        "GS_PROJECT_ID": os.getenv("GS_PROJECT_ID"),
        "GS_SERVICE_ACCOUNT": os.getenv("GS_SERVICE_ACCOUNT"),
        "BASE_URL": os.getenv("BASE_URL"),
    }
    
    print("\n📋 Variables de Entorno:")
    for key, value in configs.items():
        status = "✅" if value else "❌"
        display_value = value if value else "No configurada"
        print(f"   {status} {key:20} = {display_value}")
    
    # Modo de operación
    debug_mode = configs["DEBUG"].lower() == "true"
    print(f"\n🔧 Modo de Operación:")
    if debug_mode:
        print(f"   📁 LOCAL (DEBUG=True)")
        print(f"   ℹ️  Los archivos se guardarán en la carpeta 'media/'")
    else:
        print(f"   ☁️  PRODUCCIÓN (DEBUG=False)")
        print(f"   ℹ️  Los archivos se subirán a Google Cloud Storage")
        print(f"   📦 Bucket: {configs['GS_BUCKET_NAME']}")
    
    # Verificar credenciales de GCP (solo en modo producción)
    if not debug_mode:
        print(f"\n🔐 Verificando Credenciales de GCP...")
        
        # Intentar importar y verificar
        try:
            from google.auth import default
            credentials, project = default()
            print(f"   ✅ Credenciales de GCP detectadas")
            print(f"   📋 Proyecto detectado: {project}")
        except Exception as e:
            print(f"   ⚠️  No se detectaron credenciales de Application Default:")
            print(f"      {e}")
            print(f"\n   💡 Para configurar credenciales:")
            print(f"      1. Instala gcloud CLI: https://cloud.google.com/sdk/docs/install")
            print(f"      2. Ejecuta: gcloud auth application-default login")
            print(f"      3. O configura GOOGLE_APPLICATION_CREDENTIALS")
    
    # Verificar carpetas locales
    print(f"\n📁 Verificando Carpetas Locales:")
    folders = ["media", "uploads"]
    for folder in folders:
        if os.path.exists(folder):
            print(f"   ✅ {folder}/ existe")
        else:
            print(f"   ⚠️  {folder}/ no existe (se creará automáticamente)")
    
    # Verificar dependencias
    print(f"\n📦 Verificando Dependencias:")
    required_packages = {
        "google.cloud.storage": "google-cloud-storage",
        "google.auth": "google-auth",
    }
    
    for module, package in required_packages.items():
        try:
            __import__(module)
            print(f"   ✅ {package} instalado")
        except ImportError:
            print(f"   ❌ {package} NO instalado")
            print(f"      Instalar con: pip install {package}")
    
    # Recomendaciones
    print(f"\n💡 Recomendaciones:")
    
    if debug_mode:
        print(f"   • Estás en modo LOCAL, perfecto para desarrollo")
        print(f"   • Los archivos se guardan en 'media/' y son accesibles vía HTTP")
    else:
        if not configs["GS_BUCKET_NAME"]:
            print(f"   ⚠️  GS_BUCKET_NAME no está configurado")
        if not configs["GS_PROJECT_ID"]:
            print(f"   ⚠️  GS_PROJECT_ID no está configurado")
        if not configs["GS_SERVICE_ACCOUNT"]:
            print(f"   ℹ️  GS_SERVICE_ACCOUNT no configurado (usará credenciales por defecto)")
        
        print(f"\n   📝 Para crear un bucket en GCP:")
        print(f"      1. Ve a: https://console.cloud.google.com/storage")
        print(f"      2. Crea un bucket con nombre: {configs['GS_BUCKET_NAME']}")
        print(f"      3. Configura permisos apropiados")
    
    print(f"\n{'=' * 70}\n")
    
    # Retornar si está listo para probar
    if debug_mode:
        return True, "local"
    elif configs["GS_BUCKET_NAME"] and configs["GS_PROJECT_ID"]:
        return True, "gcs"
    else:
        return False, None

def suggest_next_steps():
    """Sugiere los próximos pasos según la configuración"""
    
    ready, mode = check_configuration()
    
    if ready:
        print("🎉 CONFIGURACIÓN LISTA")
        print("\n🧪 Próximos Pasos para Probar:")
        print("\n1. Prueba Storage Utils directamente:")
        print("   python test_storage.py")
        
        print("\n2. Inicia el servidor:")
        print("   python main.py")
        
        print("\n3. En otra terminal, prueba la API:")
        print("   python test_upload_api.py")
        
        print("\n4. O usa cURL:")
        print("   curl -X POST http://localhost:8080/api/upload \\")
        print("        -F 'file=@imagen.jpg'")
    else:
        print("⚠️  CONFIGURACIÓN INCOMPLETA")
        print("\n📝 Completa estos pasos:")
        print("1. Configura GS_BUCKET_NAME y GS_PROJECT_ID en .env")
        print("2. Configura credenciales de GCP")
        print("3. Vuelve a ejecutar este script")

if __name__ == "__main__":
    suggest_next_steps()
