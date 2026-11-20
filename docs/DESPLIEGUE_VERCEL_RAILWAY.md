# Despliegue de NutriSalud: Railway + Vercel

Esta guía despliega la API FastAPI y PostgreSQL en Railway, y las interfaces Angular y Flutter Web en Vercel como proyectos separados. La web Angular recibe la URL de la API mediante `API_BASE_URL`; no hace falta editar servicios Angular cuando cambia el dominio del backend.

> Los pasos sirven para reproducir el despliegue. Esta instancia de Railway ya fue creada y verificada; los datos concretos se anotan abajo.

## Instancia Railway creada

- Proyecto: `nutrisalud`, entorno `production`.
- Servicios: `Postgres` y `backend-api`.
- API: `https://backend-api-production-d40295b0.up.railway.app`; base URL para las interfaces: `https://backend-api-production-d40295b0.up.railway.app/api/v1`.
- Verificación realizada: `/health` respondió HTTP 200 con `status: healthy` y `database: ok`.
- Origen Vercel configurado provisionalmente: `https://nutrisalud-web.vercel.app`. Cuando Vercel asigne el dominio real, actualizar `FRONTEND_URL` y `CORS_ORIGINS` en Railway.

**Pendiente de seguridad antes de usar datos reales:** el `prepare_db.py` actual ejecuta `init_sprint1_db.py`, que siembra un tenant de muestra y cuentas demo, incluida una con rol `SUPERADMIN` y contraseña definida en el código. Desactiva o rota esas cuentas antes de cargar datos reales. No se copian sus contraseñas en esta guía.

## 1. Orden de despliegue

1. Crear PostgreSQL y el servicio backend en Railway.
2. Configurar las variables del backend y desplegarlo.
3. Crear el proyecto web en Vercel con `API_BASE_URL` apuntando a Railway.
4. Copiar el dominio final de Vercel a `FRONTEND_URL` y `CORS_ORIGINS` en Railway y volver a desplegar el backend.
5. Ejecutar la lista de comprobación del final.

Flutter Web requiere una compilación de Flutter antes de subir los archivos estáticos a Vercel. La configuración de build Angular no compila ese repositorio.

## 2. PostgreSQL y backend en Railway

### Crear PostgreSQL

1. Crea un proyecto y un entorno de Railway.
2. En el canvas, elige **New → Database → PostgreSQL** y espera a que el servicio quede activo.
3. Mantén la base dentro de la red privada de Railway. La API se conecta por una referencia de variable; no habilites acceso TCP público para la aplicación.
4. Revisa las opciones de respaldo nativo disponibles para tu plan y habilita una política apropiada antes de guardar datos reales. Prueba la restauración en un entorno separado.

Railway publica una variable `DATABASE_URL` para PostgreSQL. En el servicio de la API, crea una referencia a esa variable. Si el servicio de base se llama `Postgres`, el valor es:

```text
${{Postgres.DATABASE_URL}}
```

Usa el selector/autocompletado de Railway para insertar la referencia y confirmar el nombre exacto del servicio. No pegues una URL pública de base en Vercel ni en el código fuente.

### Crear el servicio de API

1. Añade un servicio desde el repositorio GitHub `ProyectoNutricion_backend`.
2. El repositorio del backend es independiente: deja **Root Directory** vacío (`/`). Si en el futuro se integra en un monorepo, usa `/ProyectoNutricion_backend`.
3. Deja que Railpack detecte Python y `requirements.txt`; no hace falta un comando de build personalizado.
4. En **Settings → Deploy** configura:

| Ajuste | Valor |
| --- | --- |
| Pre-deploy Command | `python prepare_db.py` |
| Start Command | `python run.py` |
| Healthcheck Path | `/health` |
| Healthcheck Timeout | `60` segundos |
| Restart Policy | On Failure, hasta 3 reintentos |

`prepare_db.py` aplica Alembic y valida el esquema antes de iniciar la API. Si falla, Railway detiene ese despliegue. Antes de migrar una base que ya contiene datos, genera un respaldo nativo de PostgreSQL y revisa la guía de migraciones del backend.

### Nota sobre `railway.toml`

El repositorio del backend incluye `railway.toml`, pero Railway retiró Config as Code para servicios nuevos. Para crear el servicio nuevo, introduce los comandos de la tabla anterior en el panel. Un servicio existente que ya usa ese archivo puede seguir leyéndolo hasta el **1 de diciembre de 2026**; migra su configuración antes de esa fecha y revisa la configuración efectiva en el detalle de cada despliegue. La configuración del archivo puede tener prioridad sobre los valores del panel mientras el servicio lo use.

### Variables de Railway

En el servicio de API, configura estas variables. Los ejemplos con `<...>` son marcadores: sustitúyelos antes de guardar.

| Variable | Valor |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | Referencia privada al PostgreSQL, por ejemplo `${{Postgres.DATABASE_URL}}` |
| `SECRET_KEY` | Secreto aleatorio propio, mínimo 32 caracteres |
| `BACKUP_ENCRYPTION_KEY` | Otro secreto aleatorio independiente, mínimo 32 caracteres |
| `FRONTEND_URL` | Origen HTTPS previsto de Vercel, sin ruta ni `/` final |
| `CORS_ORIGINS` | Orígenes HTTPS previstos, separados por coma; nunca lo dejes vacío en producción |

Puedes generar dos valores distintos desde PowerShell con:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Guárdalos como variables secretas de Railway y conserva una copia segura de `BACKUP_ENCRYPTION_KEY`: los respaldos cifrados no podrán recuperarse sin ella. No la publiques en Git, Vercel, capturas ni mensajes.

Como `CORS_ORIGINS` debe estar explícito para que el backend arranque en producción, decide el nombre del proyecto Vercel y usa el origen previsto desde el primer despliegue. Por ejemplo, si el proyecto se llamará `nutrisalud-web`:

```text
FRONTEND_URL=https://nutrisalud-web.vercel.app
CORS_ORIGINS=https://nutrisalud-web.vercel.app
```

Si también usas un dominio propio, incluye ambos orígenes separados por coma. No agregues `/api/v1` a CORS: CORS recibe el origen (`esquema + host + puerto`), no una ruta. El validador de producción rechaza orígenes locales.

Cuando Vercel asigne el dominio definitivo, compara y corrige ambos valores si difieren; luego vuelve a desplegar el backend. No uses enlaces de recuperación de contraseña ni de retorno de pago hasta que `FRONTEND_URL` sea el dominio correcto.

Variables opcionales según las funciones que actives:

- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_BASE_URL`. Usa credenciales y URL base del mismo entorno (Sandbox o Live).
- IA: `GEMINI_API_KEY` y, si corresponde, `GEMINI_MODEL`.
- Correo: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAILS_FROM_EMAIL` y `EMAILS_FROM_NAME`.
- Firebase Cloud Messaging: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.
- Respaldos propios de la aplicación: configura `BACKUP_DIR=/data/backups` solo después de adjuntar un volumen persistente montado en `/data`. El disco efímero no es almacenamiento de respaldo y un respaldo de aplicación no sustituye un dump nativo de PostgreSQL.

### Primer despliegue de Railway

1. Guarda las variables y despliega el servicio.
2. En **Settings → Networking**, genera el dominio público del backend.
3. Comprueba `https://<dominio-del-backend>/health`; debe responder correctamente. No uses la URL pública de PostgreSQL como host de conexión.
4. Anota el dominio HTTPS del backend. La URL base que utilizará Angular termina en `/api/v1`.

### Crear un administrador propio

Después de que la API y las migraciones estén listas, abre una terminal interactiva de Railway asociada al servicio backend y ejecuta:

```bash
python create_admin.py --email TU_CORREO --name "Nombre del administrador"
```

El comando pide la contraseña sin mostrarla y crea solo una cuenta nueva con rol `SUPERADMIN`. No modifica una cuenta existente. El registro público está destinado a pacientes, no a crear administradores.

## 3. Aplicación Angular en Vercel

1. Importa el repositorio GitHub `ProyectoNutricion_web` en Vercel.
2. Deja **Root Directory** en la raíz del repositorio.
3. Selecciona Angular si Vercel no lo detecta. Configura:

| Ajuste | Valor |
| --- | --- |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist/web/browser` |

`vercel.json` ya contiene la salida, fallback de rutas para Angular y encabezados para el service worker.

4. En **Settings → Environment Variables**, crea `API_BASE_URL` para **Production** y **Preview**. Cada valor debe ser HTTPS, terminar en `/api/v1` y no incluir query ni fragmento. Ejemplo:

```text
https://<dominio-del-backend>.up.railway.app/api/v1
```

En Preview usa un backend de pruebas si tienes uno; si no, decide explícitamente si los previews podrán tocar datos productivos. Esta variable se incorpora durante la build, así que guarda el valor antes de desplegar. Al cambiarlo, vuelve a desplegar.

El comando `npm run build` genera `runtime-config.js` desde `API_BASE_URL` y falla con un mensaje claro si falta la variable, también al compilar localmente. En Vercel el valor es visible desde el navegador y debe contener solo la URL pública de la API, nunca credenciales.

5. Despliega y anota el dominio `.vercel.app` asignado.
6. Regresa a Railway, establece `FRONTEND_URL` y `CORS_ORIGINS` con ese origen exacto y vuelve a desplegar la API.

Para un dominio propio, agrégalo también en Vercel y a la lista de `CORS_ORIGINS` en Railway; deja `FRONTEND_URL` con el dominio principal que deben usar los enlaces de correo y retorno de pago.

## 4. Flutter Web como segundo proyecto Vercel

El repositorio Flutter es independiente y su build de navegador queda en `build/web`. La URL de API se incluye durante la compilación con `--dart-define=API_BASE_URL=...`; es un valor público y no debe llevar secretos.

1. Instala Flutter localmente y el CLI de Vercel (`npm install --global vercel`).
2. Desde la raíz de `ProyectoNutricion_mobile`, compila con el dominio del backend:

```powershell
flutter pub get
flutter build web --release --dart-define=API_BASE_URL=https://<dominio-del-backend>.up.railway.app/api/v1
```

3. Comprueba que `build/web/index.html` y `build/web/vercel.json` existen. La configuración de `web/vercel.json` habilita rutas Flutter y revalidación del cargador.
4. Despliega el directorio generado como un proyecto Vercel distinto del Angular:

```powershell
vercel deploy .\build\web
```

La primera ejecución solicita iniciar sesión y enlazar o crear el proyecto. Usa la URL Preview para probarlo. Cuando esté listo para producción:

```powershell
vercel deploy .\build\web --prod
```

Cada cambio en Dart o en la API requiere repetir el build y deploy. Añade el dominio de Flutter a `CORS_ORIGINS` en Railway. Este flujo compila Flutter localmente y publica los archivos estáticos; el despliegue automático desde Git requiere una CI configurada para instalar Flutter y generar `build/web`.

## 5. Comprobación de extremo a extremo

- `https://<dominio-del-backend>/health` devuelve estado correcto.
- La página principal de Vercel carga y las rutas internas funcionan al refrescarlas.
- La aplicación Flutter Web abre desde su proyecto Vercel y se puede probar en un viewport de teléfono.
- En las herramientas de desarrollador del navegador, las peticiones van a `https://<dominio-del-backend>/api/v1/...` y no a `localhost` ni a un dominio anterior.
- No hay errores de CORS en consola.
- Prueba inicio de sesión con una cuenta de prueba y una operación sencilla de lectura.
- Revisa logs de Railway para confirmar que `prepare_db.py` terminó y la API quedó escuchando en `PORT`.
- Comprueba que los despliegues Preview usan el `API_BASE_URL` esperado.
- Revisa respaldos de PostgreSQL y prepara una prueba de restauración antes de cargar datos reales.

## 5. Documentación oficial

- [Railway: PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway: Config as Code y migración](https://docs.railway.com/config-as-code)
- [Railway: Pre-deploy Command](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway: Variables y referencias](https://docs.railway.com/variables/reference)
- [Vercel: variables de entorno](https://vercel.com/docs/environment-variables)
- [Vercel: configuración de build](https://vercel.com/docs/builds/configure-a-build)
- [Vercel CLI: deploy](https://vercel.com/docs/cli/deploy)
- [Flutter: compilar para web](https://docs.flutter.dev/platform-integration/web/building)
