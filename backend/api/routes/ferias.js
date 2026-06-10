const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET todas las ferias con conteos y obra_ids vinculados
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.*,
        COUNT(DISTINCT of2.obra_id)::int AS total_obras,
        COUNT(DISTINCT v.id)::int AS total_ventas,
        COALESCE(
          ARRAY_AGG(DISTINCT of2.obra_id) FILTER (WHERE of2.obra_id IS NOT NULL),
          '{}'
        ) AS obra_ids
      FROM ferias f
      LEFT JOIN obras_ferias of2 ON of2.feria_id = f.id
      LEFT JOIN ventas v ON v.feria_id = f.id
      GROUP BY f.id
      ORDER BY f.fecha_inicio DESC NULLS LAST, f.creado_en DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo ferias:', error);
    res.status(500).json({ error: 'Error obteniendo ferias', detail: error.message });
  }
});

// GET feria por ID con obra_ids
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         f.*,
         COALESCE(
           ARRAY_AGG(of2.obra_id) FILTER (WHERE of2.obra_id IS NOT NULL),
           '{}'
         ) AS obra_ids
       FROM ferias f
       LEFT JOIN obras_ferias of2 ON of2.feria_id = f.id
       WHERE f.id = $1
       GROUP BY f.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feria no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo feria:', error);
    res.status(500).json({ error: 'Error obteniendo feria', detail: error.message });
  }
});

// POST crear feria (con obra_ids opcional)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre, ubicacion, fecha_inicio, fecha_fin, descripcion, obra_ids } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO ferias (nombre, ubicacion, fecha_inicio, fecha_fin, descripcion)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, ubicacion || null, fecha_inicio || null, fecha_fin || null, descripcion || null]
    );
    const feria = result.rows[0];

    if (Array.isArray(obra_ids) && obra_ids.length > 0) {
      for (const obraId of obra_ids) {
        await client.query(
          `INSERT INTO obras_ferias (obra_id, feria_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [obraId, feria.id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...feria, obra_ids: obra_ids || [] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando feria:', error);
    res.status(500).json({ error: 'Error creando feria', detail: error.message });
  } finally {
    client.release();
  }
});

// PUT actualizar feria (con obra_ids opcional para reemplazar relaciones)
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nombre, ubicacion, fecha_inicio, fecha_fin, descripcion, obra_ids } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE ferias
       SET nombre = COALESCE($1, nombre),
           ubicacion = COALESCE($2, ubicacion),
           fecha_inicio = COALESCE($3, fecha_inicio),
           fecha_fin = COALESCE($4, fecha_fin),
           descripcion = COALESCE($5, descripcion)
       WHERE id = $6 RETURNING *`,
      [nombre, ubicacion, fecha_inicio, fecha_fin, descripcion, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Feria no encontrada' });
    }

    let finalObraIds = null;
    if (Array.isArray(obra_ids)) {
      await client.query('DELETE FROM obras_ferias WHERE feria_id = $1', [id]);
      for (const obraId of obra_ids) {
        await client.query(
          `INSERT INTO obras_ferias (obra_id, feria_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [obraId, id]
        );
      }
      finalObraIds = obra_ids;
    } else {
      const linked = await client.query(
        'SELECT obra_id FROM obras_ferias WHERE feria_id = $1',
        [id]
      );
      finalObraIds = linked.rows.map((r) => r.obra_id);
    }

    await client.query('COMMIT');
    res.json({ ...result.rows[0], obra_ids: finalObraIds });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando feria:', error);
    res.status(500).json({ error: 'Error actualizando feria', detail: error.message });
  } finally {
    client.release();
  }
});

// DELETE eliminar feria (rechaza si tiene ventas asociadas)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ventasCheck = await pool.query(
      'SELECT COUNT(*)::int AS total FROM ventas WHERE feria_id = $1',
      [id]
    );
    const ventasCount = ventasCheck.rows[0].total;

    if (ventasCount > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar la feria',
        detail: `Tiene ${ventasCount} venta(s) asociada(s).`,
      });
    }

    // obras_ferias tiene ON DELETE CASCADE, se limpia automáticamente
    const result = await pool.query(
      'DELETE FROM ferias WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feria no encontrada' });
    }
    res.json({ message: 'Feria eliminada', feria: result.rows[0] });
  } catch (error) {
    console.error('Error eliminando feria:', error);
    res.status(500).json({ error: 'Error eliminando feria', detail: error.message });
  }
});

module.exports = router;
