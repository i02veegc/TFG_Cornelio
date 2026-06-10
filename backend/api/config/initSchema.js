const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

// Candidatos de ruta para el SQL del schema, en orden de preferencia:
// 1. Variable de entorno explícita.
// 2. Carpeta `db/` dentro del backend (lo que usamos en Docker).
// 3. Ruta relativa al monorepo, `docs/Scripts BD/...` (lo que usamos en dev nativo).
const CANDIDATE_PATHS = [
  process.env.SCHEMA_SQL_PATH,
  path.join(__dirname, '..', 'db', 'tables_creation.sql'),
  path.join(__dirname, '..', '..', '..', 'docs', 'Scripts BD', 'tables_creation.sql'),
].filter(Boolean);

/**
 * Aplica el schema de la BD si no existe. Idempotente: las sentencias usan
 * `CREATE TABLE IF NOT EXISTS`, así que pueden re-ejecutarse sin riesgo.
 *
 * Se llama desde server.js al arrancar. Si la BD no es accesible, lanza
 * el error y el servidor no arranca (mensaje claro para el dev).
 */
async function initSchema() {
  const sqlPath = CANDIDATE_PATHS.find((p) => fs.existsSync(p));

  if (!sqlPath) {
    console.warn(
      `[DB] No se encontró el schema SQL en ninguna ubicación conocida (${CANDIDATE_PATHS.join(
        ', '
      )}). Se omite init.`
    );
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log(`[DB] Schema verificado/aplicado correctamente desde ${sqlPath}`);
  } catch (err) {
    console.error('[DB] Error aplicando schema:', err.message);
    throw err;
  }
}

module.exports = initSchema;
