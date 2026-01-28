"""
Script para actualizar todas las referencias de foto_perfil a usar get_avatar_url()
"""
import re

# Leer el archivo
with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Patrones a reemplazar
replacements = [
    # Casos comunes: "avatar": user.foto_perfil
    (r'("avatar"|"photo"|"patientAvatar"):\s*(\w+)\.foto_perfil\b(?!\s*=)', r'\1: get_avatar_url(\2.foto_perfil)'),
    (r'"foto_perfil":\s*(\w+)\.foto_perfil\b(?!\s*=)', r'"foto_perfil": get_avatar_url(\1.foto_perfil)'),
]

original_content = content
for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# Contar cambios
changes = len([i for i, (a, b) in enumerate(zip(original_content, content)) if a != b])

if changes > 0:
    print(f"✅ Se realizarán {changes} cambios en el archivo")
    
    # Mostrar algunos ejemplos
    lines_original = original_content.split('\n')
    lines_new = content.split('\n')
    
    print("\n📝 Ejemplos de cambios:")
    count = 0
    for i, (old, new) in enumerate(zip(lines_original, lines_new)):
        if old != new and count < 5:
            print(f"\nLínea {i+1}:")
            print(f"  Antes: {old.strip()[:80]}")
            print(f"  Después: {new.strip()[:80]}")
            count += 1
    
    # Guardar
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n✅ Archivo actualizado correctamente")
else:
    print("ℹ️  No se encontraron cambios necesarios")
