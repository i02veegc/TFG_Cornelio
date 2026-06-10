const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const obrasRoutes = require('./routes/obras');
const ventasRoutes = require('./routes/ventas');
const feriasRoutes = require('./routes/ferias');
const mqttClient = require('./config/mqtt');
const initSchema = require('./config/initSchema');
const seedDataIfEmpty = require('./config/seedData');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Archivos estáticos (imágenes de obras, etc.)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/api/obras', obrasRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/ferias', feriasRoutes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Working API Metaverso TFG',
    version: '1.0.0',
    endpoints: {
      obras: '/api/obras',
      ventas: '/api/ventas',
      ferias: '/api/ferias'
    }
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function start() {
  try {
    await initSchema();
    await seedDataIfEmpty();
  } catch (err) {
    console.error('[Startup] No se pudo inicializar la BD. ¿Está accesible y .env configurado correctamente?');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    mqttClient.init();
  });
}

start();