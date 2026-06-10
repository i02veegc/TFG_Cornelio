const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const mqttClient = require('../config/mqtt');

// POST registrar venta
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { obra_id, feria_id, comprador_nombre, comprador_email } = req.body;
    
    // Validación básica
    if (!obra_id || !comprador_nombre || !comprador_email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    
    // Iniciar transacción
    await client.query('BEGIN');
    
    // Verificar obra existe y no está vendida
    const obraResult = await client.query(
      'SELECT precio, vendido FROM obras WHERE id = $1',
      [obra_id]
    );
    
    if (obraResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Obra no encontrada' });
    }
    
    if (obraResult.rows[0].vendido) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Obra ya vendida' });
    }
    
    const precio = obraResult.rows[0].precio;
    
    // Insertar venta
    const ventaResult = await client.query(
      `INSERT INTO ventas (obra_id, feria_id, comprador_nombre, comprador_email, precio_venta)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [obra_id, feria_id || null, comprador_nombre, comprador_email, precio]
    );
    
    const venta_id = ventaResult.rows[0].id;
    
    // Marcar obra como vendida
    await client.query(
      'UPDATE obras SET vendido = TRUE, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1',
      [obra_id]
    );
    
    // Commit
    await client.query('COMMIT');

    // Publicar evento MQTT para que Unity, web admin y ESP32 se enteren
    // del cambio de estado en tiempo real. Sin retain: solo los clientes
    // conectados en ese momento reciben el mensaje.
    mqttClient.publish(
      `obras/${obra_id}/vendido`,
      {
        vendido: true,
        venta_id,
        obra_id,
        fecha_venta: ventaResult.rows[0].fecha_venta,
      }
    );

    res.status(201).json({
      message: 'Venta registrada exitosamente',
      venta: ventaResult.rows[0]
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando venta:', error);
    res.status(500).json({
      error: 'Error registrando venta',
      detail: error.message,
    });
  } finally {
    client.release();
  }
});

// GET todas las ventas
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, o.titulo, o.autor, o.imagen_url, f.nombre AS feria_nombre
      FROM ventas v
      JOIN obras o ON v.obra_id = o.id
      LEFT JOIN ferias f ON v.feria_id = f.id
      ORDER BY v.fecha_venta DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({ error: 'Error obteniendo ventas' });
  }
});

module.exports = router;