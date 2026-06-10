using System.Collections.Generic;
using UnityEngine;

// Diccionario interno: id de obra → componente ObraDeArte spawneado.
// Se rellena en SpawnObras() y lo consulta el handler MQTT.

/// Al arrancar la escena, descarga las obras de la API y las coloca
/// en los puntos definidos por `slots`. Si hay más obras que slots,
/// se ignoran las sobrantes. Si hay más slots que obras, los slots
/// extra quedan vacíos.
public class ObraSpawner : MonoBehaviour
{
    [Header("Posiciones donde aparecerán las obras")]
    [Tooltip("Crea GameObjects vacíos en la escena, colócalos donde quieres cada cuadro y arrástralos aquí.")]
    public Transform[] slots;

    [Header("Prefab y materiales")]
    [Tooltip("Opcional: prefab a instanciar. Si está vacío se crea un Quad con marco procedural.")]
    public GameObject obraPrefab;

    [Tooltip("Material que se aplica al lienzo de las obras disponibles (no vendidas).")]
    public Material materialDisponible;

    [Tooltip("Material que se aplica al lienzo de las obras vendidas.")]
    public Material materialVendida;

    [Header("Marco")]
    [Tooltip("Material del marco que rodea el cuadro. Si está vacío, queda con el material por defecto.")]
    public Material materialMarco;

    [Tooltip("Grosor del marco en metros (cuánto sobresale por cada lado del lienzo).")]
    public float grosorMarco = 0.08f;

    [Tooltip("Profundidad del marco en metros (lo que sobresale hacia adelante).")]
    public float profundidadMarco = 0.05f;

    [Header("LED indicador de estado")]
    [Tooltip("Material del LED cuando la obra está disponible (típicamente verde con emisión).")]
    public Material materialLEDDisponible;

    [Tooltip("Material del LED cuando la obra está vendida (típicamente rojo con emisión).")]
    public Material materialLEDVendido;

    [Tooltip("Diámetro del LED en metros.")]
    public float tamanoLED = 0.05f;

    [Tooltip("Separación del LED bajo el borde inferior del marco, en metros.")]
    public float separacionLED = 0.05f;

    [Tooltip("Profundidad (Z local) a la que se coloca el LED.")]
    public float zLED = 0.052f;

    [Header("Outline al apuntar (Quick Outline)")]
    [Tooltip("Color del outline cuando el jugador apunta al cuadro.")]
    public Color colorOutline = Color.white;

    [Tooltip("Grosor del outline. Valores típicos: 3–10.")]
    [Range(0f, 20f)]
    public float anchoOutline = 10f;

    [Tooltip("Modo del outline. OutlineAll es lo más visible.")]
    public Outline.Mode modoOutline = Outline.Mode.OutlineAll;

    [Header("Tamaño")]
    [Tooltip("Altura fija de cada cuadro en metros. El ancho se calcula a partir del aspect ratio de la imagen.")]
    public float alturaCuadro = 1.4f;

    [Tooltip("Ancho por defecto antes de que la textura cargue (en metros).")]
    public float anchoInicial = 1.0f;

    [Header("Título flotante")]
    [Tooltip("Mostrar el título de la obra encima del cuadro.")]
    public bool mostrarTitulo = true;

    [Tooltip("Altura del texto sobre el cuadro (en metros).")]
    public float alturaTitulo = 1.2f;

    readonly Dictionary<int, ObraDeArte> obrasPorId = new();

    void Start()
    {
        if (APIClient.Instance == null)
        {
            Debug.LogError(
                "[ObraSpawner] No hay APIClient en la escena. " +
                "Crea un GameObject vacío 'APIClient' y añádele el componente APIClient."
            );
            return;
        }

        if (slots == null || slots.Length == 0)
        {
            Debug.LogWarning(
                "[ObraSpawner] No hay slots definidos. Añade Transforms al array `slots` " +
                "desde el inspector indicando dónde colocar cada obra."
            );
            return;
        }

        APIClient.Instance.GetObras(
            obras => SpawnObras(obras),
            err => Debug.LogError($"[ObraSpawner] No se pudieron cargar las obras: {err}")
        );
    }

    void SpawnObras(List<ObraDTO> obras)
    {
        Debug.Log($"[ObraSpawner] Recibidas {obras.Count} obras de la API");

        int count = Mathf.Min(obras.Count, slots.Length);
        for (int i = 0; i < count; i++)
        {
            var obra = obras[i];
            var slot = slots[i];
            if (slot == null) continue;

            GameObject go = InstantiateObra(slot);
            go.name = $"Obra_{obra.id}_{SafeName(obra.titulo)}";

            // Material del lienzo según estado de venta
            var canvasTransform = go.transform.Find("Canvas");
            var renderer = canvasTransform != null
                ? canvasTransform.GetComponent<MeshRenderer>()
                : go.GetComponentInChildren<MeshRenderer>();
            if (renderer != null)
            {
                Material m = obra.vendido ? materialVendida : materialDisponible;
                if (m != null) renderer.material = m;
            }

            // Material del LED según estado de venta
            var ledTransform = go.transform.Find("LED");
            if (ledTransform != null)
            {
                var ledRenderer = ledTransform.GetComponent<MeshRenderer>();
                Material mLed = obra.vendido ? materialLEDVendido : materialLEDDisponible;
                if (ledRenderer != null && mLed != null) ledRenderer.material = mLed;
            }

            // Adjuntar datos
            var data = go.GetComponent<ObraDeArte>();
            if (data == null) data = go.AddComponent<ObraDeArte>();
            data.obraId = obra.id;
            data.titulo = obra.titulo;
            data.artista = obra.autor;
            data.descripcion = obra.descripcion ?? "";
            data.anio = obra.anio;
            data.precio = obra.PrecioFloat;
            data.vendido = obra.vendido;
            data.canvasRenderer = canvasTransform ? canvasTransform.GetComponent<MeshRenderer>() : null;
            data.materialDisponible = materialDisponible;
            data.materialVendida = materialVendida;
            data.ledRenderer = ledTransform ? ledTransform.GetComponent<MeshRenderer>() : null;
            data.materialLEDDisponible = materialLEDDisponible;
            data.materialLEDVendido = materialLEDVendido;

            obrasPorId[obra.id] = data;

            if (mostrarTitulo)
            {
                CrearTituloFlotante(go.transform, obra.titulo);
            }

            // Cargar la textura de la obra de forma asíncrona
            if (!string.IsNullOrEmpty(obra.imagen_url) && renderer != null)
            {
                APIClient.Instance.GetTexture(
                    obra.imagen_url,
                    tex => AplicarTextura(go, renderer, tex),
                    err => Debug.LogWarning($"[ObraSpawner] No se pudo cargar imagen de '{obra.titulo}': {err}")
                );
            }
        }

        if (obras.Count > slots.Length)
        {
            Debug.LogWarning(
                $"[ObraSpawner] Hay {obras.Count} obras pero solo {slots.Length} slots. " +
                $"Se ignoran {obras.Count - slots.Length} obras. Añade más slots si quieres mostrarlas todas."
            );
        }

        // Suscribirse a eventos de venta vía MQTT (si hay broker)
        if (MQTTSubscriber.Instance)
        {
            MQTTSubscriber.Instance.OnObraVendida += HandleVentaRemota;
        }
    }

    void OnDestroy()
    {
        if (MQTTSubscriber.Instance)
        {
            MQTTSubscriber.Instance.OnObraVendida -= HandleVentaRemota;
        }
    }

    void HandleVentaRemota(int obraId)
    {
        if (!obrasPorId.TryGetValue(obraId, out var local) || local == null) return;
        if (local.vendido) return; // ya estaba vendida localmente

        Debug.Log($"[ObraSpawner] Sync MQTT: obra '{local.titulo}' marcada como vendida desde fuera.");
        local.MarcarComoVendida();
    }

    GameObject InstantiateObra(Transform slot)
    {
        if (obraPrefab != null)
        {
            return Instantiate(obraPrefab, slot.position, slot.rotation, slot.parent);
        }

        // Sin prefab: GameObject vacío como padre, con Frame (Cube fino)
        // y Canvas (Quad con textura) como hijos. La rotación del slot
        // se aplica al padre; los hijos quedan alineados localmente.
        var parent = new GameObject("Obra");
        parent.transform.SetPositionAndRotation(slot.position, slot.rotation);
        parent.transform.SetParent(slot.parent, true);

        // El Quad de Unity tiene su cara visible mirando hacia -Z local.
        // Convención del slot: el forward (+Z) apunta hacia la pared (lejos
        // del espectador), de modo que -Z apunta hacia quien mira el cuadro.
        // Por tanto el Canvas queda en Z=0 (justo en el plano del slot) y
        // el Frame se empuja hacia +Z (detrás del lienzo, hacia la pared).

        // Canvas: Quad con la imagen, en el plano del slot
        var canvas = GameObject.CreatePrimitive(PrimitiveType.Quad);
        canvas.name = "Canvas";
        canvas.transform.SetParent(parent.transform, false);
        canvas.transform.localPosition = Vector3.zero;
        canvas.transform.localRotation = Quaternion.identity;
        canvas.transform.localScale = new Vector3(anchoInicial, alturaCuadro, 1f);

        // Frame: cubo fino detrás del lienzo, asomando por los 4 lados
        var frame = GameObject.CreatePrimitive(PrimitiveType.Cube);
        frame.name = "Frame";
        frame.transform.SetParent(parent.transform, false);
        frame.transform.localPosition = new Vector3(0f, 0f, profundidadMarco * 0.5f + 0.001f);
        frame.transform.localRotation = Quaternion.identity;
        frame.transform.localScale = new Vector3(
            anchoInicial + grosorMarco * 2f,
            alturaCuadro + grosorMarco * 2f,
            profundidadMarco
        );
        var frameRenderer = frame.GetComponent<MeshRenderer>();
        if (frameRenderer != null && materialMarco != null)
        {
            frameRenderer.material = materialMarco;
        }

        // LED: esfera pequeña debajo de la esquina inferior izquierda del marco
        var led = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        led.name = "LED";
        led.transform.SetParent(parent.transform, false);
        led.transform.localScale = Vector3.one * tamanoLED;
        led.transform.localRotation = Quaternion.identity;
        led.transform.localPosition = PosicionLED(anchoInicial);

        // Quitamos el collider para que no interfiera con el raycast del cuadro
        var ledCollider = led.GetComponent<Collider>();
        if (ledCollider != null) Destroy(ledCollider);

        // Outline (Quick Outline) en el Frame: dibuja un contorno alrededor
        // del cubo del marco siguiendo su silueta. Se controla activando o
        // desactivando el componente (`enabled = true/false`).
        var outline = frame.AddComponent<Outline>();
        outline.OutlineMode = modoOutline;
        outline.OutlineColor = colorOutline;
        outline.OutlineWidth = anchoOutline;
        outline.enabled = false;

        // Componente ObraHighlight para controlarlo desde el ObraInteractor
        var highlight = parent.AddComponent<ObraHighlight>();
        highlight.outline = outline;

        return parent;
    }

    /// Posición local del LED según el ancho actual del lienzo.
    /// X e Y se calculan para alinearse con la esquina inferior izquierda
    /// del marco. Z se toma fija del inspector (`zLED`).
    Vector3 PosicionLED(float anchoCanvas)
    {
        float x = -((anchoCanvas / 2f) + grosorMarco - (tamanoLED / 2f));
        float y = -(alturaCuadro / 2f) - grosorMarco - separacionLED - (tamanoLED / 2f);
        return new Vector3(x, y, zLED);
    }

    void AplicarTextura(GameObject go, MeshRenderer renderer, Texture2D tex)
    {
        if (renderer == null || tex == null || go == null) return;

        // Aplicar la textura. URP usa _BaseMap como propiedad principal,
        // pero `mainTexture` está marcado como alias en el shader Lit,
        // así que esto funciona en URP y BuiltIn por igual.
        renderer.material.mainTexture = tex;

        // Calcular nuevo tamaño manteniendo aspect ratio.
        if (tex.height <= 0) return;
        float aspect = (float)tex.width / tex.height;
        float ancho = alturaCuadro * aspect;

        // Redimensionar Canvas (Quad) y Frame (Cube) en sincronía.
        var canvasT = go.transform.Find("Canvas");
        if (canvasT != null)
        {
            canvasT.localScale = new Vector3(ancho, alturaCuadro, 1f);
        }

        var frameT = go.transform.Find("Frame");
        if (frameT != null)
        {
            frameT.localScale = new Vector3(
                ancho + grosorMarco * 2f,
                alturaCuadro + grosorMarco * 2f,
                profundidadMarco
            );
        }

        var ledT = go.transform.Find("LED");
        if (ledT)
        {
            ledT.localPosition = PosicionLED(ancho);
        }
    }

    void CrearTituloFlotante(Transform parent, string titulo)
    {
        GameObject textGo = new GameObject("Titulo");
        textGo.transform.SetParent(parent, false);
        textGo.transform.localPosition = new Vector3(0, alturaTitulo, 0);
        textGo.transform.localRotation = Quaternion.identity;

        TextMesh tm = textGo.AddComponent<TextMesh>();
        tm.text = titulo ?? "(sin título)";
        tm.fontSize = 60;
        tm.characterSize = 0.05f;
        tm.anchor = TextAnchor.MiddleCenter;
        tm.alignment = TextAlignment.Center;
        tm.color = Color.white;
    }

    static string SafeName(string s)
    {
        if (string.IsNullOrEmpty(s)) return "sin_titulo";
        return s.Replace(" ", "_").Replace("/", "_");
    }
}
