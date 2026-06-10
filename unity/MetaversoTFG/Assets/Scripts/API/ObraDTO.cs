using System;
using System.Collections.Generic;
using System.Globalization;

[Serializable]
public class FeriaRefDTO
{
    public int id;
    public string nombre;
}

// Espejo del JSON que devuelve GET /api/obras
// IMPORTANTE: los nombres de los campos deben coincidir exactamente
// con las claves del JSON para que JsonUtility los deserialice.
[Serializable]
public class ObraDTO
{
    public int id;
    public string titulo;
    public string autor;
    public string descripcion;
    public string precio;         // DECIMAL viene como string desde pg
    public int anio;              // INTEGER, 0 si era null en la BD
    public string dimensiones;
    public string imagen_url;
    public bool vendido;
    public string creado_en;      // timestamps en formato ISO
    public string actualizado_en;
    public List<FeriaRefDTO> ferias = new List<FeriaRefDTO>();

    public float PrecioFloat
    {
        get
        {
            if (string.IsNullOrEmpty(precio)) return 0f;
            float result;
            if (float.TryParse(precio, NumberStyles.Float, CultureInfo.InvariantCulture, out result))
            {
                return result;
            }
            return 0f;
        }
    }
}

// JsonUtility no puede deserializar un array JSON como nodo raíz.
// Workaround clásico: envolverlo en un objeto con un campo `items`.
[Serializable]
public class ObrasListWrapper
{
    public ObraDTO[] items;
}
