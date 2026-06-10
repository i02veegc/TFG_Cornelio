using System;

// Payload que mandamos en POST /api/ventas
// Nota: feria_id = 0 significa "sin feria" — el backend hace
// `feria_id || null` y al ser 0 falsy en JS se convierte en null.
[Serializable]
public class VentaRequest
{
    public int obra_id;
    public string comprador_nombre;
    public string comprador_email;
    public int feria_id;
}

// Datos de una venta tal como vienen del backend
[Serializable]
public class VentaDTO
{
    public int id;
    public int obra_id;
    public int feria_id;
    public string comprador_nombre;
    public string comprador_email;
    public string precio_venta;
    public string fecha_venta;
    public bool sincronizado_hardware;
}

// Respuesta de POST /api/ventas: { message, venta }
[Serializable]
public class VentaResponse
{
    public string message;
    public VentaDTO venta;
}
