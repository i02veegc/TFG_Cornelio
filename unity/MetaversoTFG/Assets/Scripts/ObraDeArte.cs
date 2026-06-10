using UnityEngine;
using UnityEngine.Serialization;

public class ObraDeArte : MonoBehaviour
{
    [Header("Información de la Obra")]
    public int obraId = 6;
    public string titulo = "Abstracción Azul";
    public string artista = "María García";
    public string descripcion = "";
    public int anio = 0;
    public float precio = 3500f;
    [FormerlySerializedAs("vendida")]
    public bool vendido = false;

    [Header("Visual — Lienzo")]
    [Tooltip("MeshRenderer del Canvas. Si está vacío se busca en el hijo 'Canvas'.")]
    public MeshRenderer canvasRenderer;
    public Material materialDisponible;
    public Material materialVendida;

    [Header("Visual — LED")]
    [Tooltip("MeshRenderer del LED. Si está vacío se busca en el hijo 'LED'.")]
    public MeshRenderer ledRenderer;
    public Material materialLEDDisponible;
    public Material materialLEDVendido;

    void Start()
    {
        // Resolver referencias automáticamente si no se asignaron desde el inspector
        if (canvasRenderer == null)
        {
            var canvasT = transform.Find("Canvas");
            if (canvasT != null) canvasRenderer = canvasT.GetComponent<MeshRenderer>();
        }
        if (canvasRenderer == null) canvasRenderer = GetComponent<MeshRenderer>();

        if (ledRenderer == null)
        {
            var ledT = transform.Find("LED");
            if (ledT != null) ledRenderer = ledT.GetComponent<MeshRenderer>();
        }

        ActualizarEstadoVisual();
    }

    public void ActualizarEstadoVisual()
    {
        // Lienzo
        if (canvasRenderer != null)
        {
            Material m = vendido ? materialVendida : materialDisponible;
            if (m != null) canvasRenderer.material = m;
        }

        // LED
        if (ledRenderer != null)
        {
            Material m = vendido ? materialLEDVendido : materialLEDDisponible;
            if (m != null) ledRenderer.material = m;
        }
    }

    public void MarcarComoVendida()
    {
        vendido = true;
        ActualizarEstadoVisual();
    }

    public string ObtenerInformacion()
    {
        string estado = vendido ? "VENDIDA" : "DISPONIBLE";
        return $"{titulo}\nArtista: {artista}\nPrecio: €{precio:F2}\nEstado: {estado}";
    }
}
