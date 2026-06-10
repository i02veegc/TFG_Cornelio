const { pool } = require('./database');

/**
 * Obras de ejemplo para poder probar la funcionalidad
 * (listado, filtros, modal de detalle, compra...) sin tener que insertar
 * datos manualmente.
 */
const OBRAS_SEED = [
  {
    titulo: 'Retrato Desquiciado',
    autor: 'Calamardo',
    descripcion: 'Interpretación contemporánea de un retrato clásico de Calamardo algo desquiciado',
    precio: 4200.00,
    anio: 2024,
    dimensiones: '90x70 cm',
    imagen_url: 'http://localhost:3000/static/obras/calamardo.jpg',
  },
  {
    titulo: 'La Gioconda',
    autor: 'Leonardo da Vinci',
    descripcion: 'Retrato de Lisa Gherardini, célebre por su sonrisa enigmática y la técnica del sfumato.',
    precio: 85000.00,
    anio: 1503,
    dimensiones: '77 x 53 cm',
    imagen_url: 'http://localhost:3000/static/obras/la_gioconda.jpg',
  },
  {
    titulo: 'La noche estrellada',
    autor: 'Vincent van Gogh',
    descripcion: 'Vista nocturna desde la ventana del sanatorio de Saint-Rémy-de-Provence.',
    precio: 10000.00,
    anio: 1889,
    dimensiones: '73.7 x 92.1 cm',
    imagen_url: 'http://localhost:3000/static/obras/noche_estrellada.jpg',
  },
  {
    titulo: 'El grito',
    autor: 'Edvard Munch',
    descripcion: 'Icónica representación de la angustia existencial moderna.',
    precio: 12000.00,
    anio: 1893,
    dimensiones: '91 x 73.5 cm',
    imagen_url: 'http://localhost:3000/static/obras/el_grito.jpg',
  },
  {
    titulo: 'La persistencia de la memoria',
    autor: 'Salvador Dalí',
    descripcion: 'Surrealismo onírico con relojes blandos sobre un paisaje de Cadaqués.',
    precio: 12500.00,
    anio: 1931,
    dimensiones: '24 x 33 cm',
    imagen_url: 'http://localhost:3000/static/obras/persistencia_del_tiempo.jpg',
  },
];

const FERIAS_SEED = [
  {
    nombre: 'ARCOmadrid 2026',
    ubicacion: 'IFEMA, Madrid',
    fecha_inicio: '2026-02-25',
    fecha_fin: '2026-03-01',
    descripcion:
      'Feria Internacional de Arte Contemporáneo, una de las citas más relevantes del mercado del arte en Europa.',
  },
  {
    nombre: 'Art Basel 2026',
    ubicacion: 'Basilea, Suiza',
    fecha_inicio: '2026-06-18',
    fecha_fin: '2026-06-21',
    descripcion:
      'Referente mundial del arte moderno y contemporáneo.',
  },
];

/**
 * Inserta los datos de prueba SOLO si las tablas correspondientes están
 * vacías. Idempotente: en arranques posteriores no toca nada.
 */
async function seedDataIfEmpty() {
  // Obras
  const obrasCount = await pool.query('SELECT COUNT(*)::int AS total FROM obras');
  if (obrasCount.rows[0].total === 0) {
    console.log(`[DB] Insertando ${OBRAS_SEED.length} obras de ejemplo...`);
    for (const o of OBRAS_SEED) {
      await pool.query(
        `INSERT INTO obras (titulo, autor, descripcion, precio, anio, dimensiones, imagen_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [o.titulo, o.autor, o.descripcion, o.precio, o.anio, o.dimensiones, o.imagen_url || null]
      );
    }
    console.log('[DB] Obras de ejemplo insertadas');
  }

  // Ferias
  const feriasCount = await pool.query('SELECT COUNT(*)::int AS total FROM ferias');
  if (feriasCount.rows[0].total === 0) {
    console.log(`[DB] Insertando ${FERIAS_SEED.length} ferias de ejemplo...`);
    for (const f of FERIAS_SEED) {
      await pool.query(
        `INSERT INTO ferias (nombre, ubicacion, fecha_inicio, fecha_fin, descripcion)
         VALUES ($1, $2, $3, $4, $5)`,
        [f.nombre, f.ubicacion, f.fecha_inicio, f.fecha_fin, f.descripcion]
      );
    }
    console.log('[DB] Ferias de ejemplo insertadas');
  }
}

module.exports = seedDataIfEmpty;
