# TFG - Prototipo de metaverso sobre gemelo digital de feria de arte

Prototipo de metaverso desarrollado en Unity que actúa como gemelo digital de una feria física de arte plástico. Tres clientes (web de administración, entorno virtual Unity, y un microcontrolador ESP32 con LED RGB, este último aún en desarrollo) comparten estado en tiempo real a través de MQTT.

**Autor:** Cornelio Velasco Egea  
**Directores:** Enrique García Salcines · Juan Alfonso Lara Torralbo  
**Universidad de Córdoba · EPSC**

---

## Estructura del repositorio

```
.
|- backend/api/          API REST en Node.js + Express + PostgreSQL
|- frontend/frontend/    Panel admin en Next.js + React + Bootstrap
|- unity/MetaversoTFG/   Cliente 3D en Unity 6
|- infra/mqtt/           Configuración del broker MQTT (Mosquitto)
|- docs/                 Memoria, anteproyecto y schema SQL
|- package.json          Orquestador raíz (concurrently)
```

---

## Puesta en marcha

### Opción A - Docker (recomendado para revisión)

#### Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

#### 3 Pasos:

- Primero
```bash
git clone https://github.com/cornelioovv/TFG
```
- Segundo
```bash
cd TFG
```
- Tercero
```bash
docker compose up --build
```

Docker levanta automáticamente:

- **PostgreSQL** - base de datos
- **Mosquitto** - broker MQTT (puertos 1883 y 9001)
- **Backend Express** -> http://localhost:3000
- **Frontend Next.js** -> http://localhost:3001

En el primer arranque el backend crea las tablas y carga las obras de ejemplo con sus imágenes. En arranques posteriores no toca nada existente.

Para detenerlo:

```bash
docker compose down
```

> Para resetear la base de datos por completo (volver al estado inicial con los datos semilla):
> ```bash
> docker compose down -v
> docker compose up --build
> ```

---

### Opción B - Monorepo local (desarrollo)

#### Requisitos

- [Node.js >= 20](https://nodejs.org)
- [PostgreSQL 14+](https://www.postgresql.org/download/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) - solo para el broker MQTT

#### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/cornelioovv/TFG
```
```bash
cd TFG
```
``` bash
npm install
```

`npm install` en la raíz dispara la instalación de las dependencias del backend y del frontend automáticamente mediante el hook `postinstall`.

#### 2. Crear la base de datos

```bash
createdb -U postgres metaverso_tfg
```

Solo hay que crear la base de datos vacía. El backend aplica el schema y carga los datos de ejemplo automáticamente al arrancar, usando `CREATE TABLE IF NOT EXISTS`.

#### 3. Configurar las variables de entorno del backend

Duplica el archivo `backend/api/.env.example`, introduce tus credenciales de PostgreSQL y luego borra el `.example` del nombre del archivo, dejándolo como `.env` a secas:

```env
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_NAME=metaverso_tfg
DB_PORT=5432
PORT=3000
```

#### 4. Arrancar el broker MQTT

```bash
npm run mqtt:up
```

Levanta un contenedor Docker con Mosquitto en el puerto **1883 (TCP)** y **9001 (WebSockets)**. Para pararlo: `npm run mqtt:down`.

#### 5. Arrancar backend + frontend

```bash
npm run dev
```

Concurrently lanza ambos servicios en paralelo:

- **Backend** → http://localhost:3000
- **Frontend** → http://localhost:3001

`Ctrl+C` para parar ambos.

---

## Cliente Unity

Funciona con cualquiera de las dos opciones anteriores, siempre que el backend esté corriendo en `localhost:3000`.

1. Abre el proyecto `MetaversoTFG` desde Unity Hub.
2. Espera a que importe los assets (puede tardar la primera vez).
3. Abre `Assets/Scenes/SampleScene.unity` y dale a Play.

---

## Comandos disponibles desde la raíz

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias del backend y frontend |
| `npm run dev` | Arranca backend + frontend en paralelo |
| `npm run dev:backend` | Solo backend |
| `npm run dev:frontend` | Solo frontend |
| `npm run mqtt:up` | Arranca el broker MQTT (Docker) |
| `npm run mqtt:down` | Para el broker |
| `npm run mqtt:logs` | Muestra logs del broker en vivo |
| `npm run build` | Build de producción (backend + Next.js) |
| `npm run lint` | Linter del frontend |

---

## Demo del sistema en vivo

Con backend + frontend + broker + Unity corriendo:

1. En el navegador, ve a `http://localhost:3001/obras`.
2. En Unity, acércate a un cuadro y pulsa **E** o click -> modal con detalle.
3. Rellena nombre y email del comprador y pulsa "Comprar".
4. La card de la web cambia a "Vendido", el dashboard recalcula KPIs y el LED del cuadro en Unity pasa de verde a rojo.
5. También, a la inversa, al marcar un cuadro como vendido desde la web, Unity refleja el cambio sin recargar nada.

Esa sincronización en vivo entre web, mundo virtual (Unity) y (próximamente) hardware físico (LED + ESP32) es el corazón del gemelo digital descrito en el anteproyecto.
