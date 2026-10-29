# NutriData — App móvil (solo pacientes)

App **Expo / React Native** para que los pacientes registren comidas, agua, vean adherencia, citas y alertas. Conecta al mismo backend FastAPI que la web.

## Requisitos

- Node.js 20+
- [Expo Go](https://expo.dev/go) en el teléfono **o** emulador Android/iOS (SDK **52**, compatible con la app de la tienda)
- Backend NutriData corriendo (`python -m uvicorn main:app --reload --port 8001`)

> **Expo Go:** Este proyecto usa **Expo SDK 52** para abrir con la versión de Expo Go del App Store / Play Store. Si ves *"Project is incompatible with this version of Expo Go"*, actualiza Expo Go o reinstala dependencias (`rm -rf node_modules && npm install`).

## Instalación

```bash
cd mobile
npm install
cp .env.example .env
# Edita .env con la URL de tu API
```

> **Nota:** Si `npm install` falla por espacio en disco, libera espacio en `C:` y vuelve a ejecutarlo.

## Configurar API

| Entorno | `EXPO_PUBLIC_API_URL` |
|---------|------------------------|
| Android emulator | `http://10.0.2.2:8001/api` |
| iOS simulator | `http://localhost:8001/api` |
| Teléfono en la misma WiFi | `http://192.168.x.x:8001/api` |
| Cloud Run | `https://tu-servicio.run.app/api` |

Asegúrate de que `ALLOWED_ORIGINS` en el backend permita peticiones móviles si usas CORS estricto.

## Ejecutar

```bash
npm start
# o
npm run android
npm run ios
```

Escanea el QR con **Expo Go** o abre en el emulador.

### Analizar comida con foto (IA)

En la pestaña **Comidas**, el paciente puede tomar una foto del plato. El backend estima calorías y macronutrientes con visión por IA (requiere `OPENAI_API_KEY` en el servidor).

```bash
cd mobile
npm install   # incluye expo-image-picker
```

## Pantallas

| Tab | Función |
|-----|---------|
| **Inicio** | Dashboard, calorías, agua, marcar comidas |
| **Comidas** | Detalle del día, alimentos, inicializar plan |
| **Adherencia** | % semanal, serie diaria, consejos |
| **Citas** | Próximas e historial |
| **Alertas** | Bandeja de notificaciones |

Extra: **Mi plan semanal** y **Perfil** (desde icono en Inicio).

## Seguridad

- Solo acepta login con rol `patient`.
- Token JWT en `expo-secure-store`.
- Nutricionistas/admin deben usar la web.

## Build producción (opcional)

```bash
npx eas build --platform android
```

Requiere cuenta Expo y configurar `eas.json`.
