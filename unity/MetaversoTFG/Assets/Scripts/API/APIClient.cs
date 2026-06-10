using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// Cliente centralizado de la API del backend Express.
/// Coloca un único GameObject "APIClient" en la escena raíz con este componente.
public class APIClient : MonoBehaviour
{
    [Tooltip("URL base del backend, sin /api al final. Por defecto el dev server local.")]
    public string baseUrl = "http://localhost:3000";

    [Tooltip("Si está activo, loguea todas las peticiones y respuestas en consola.")]
    public bool verboseLogging = true;

    public static APIClient Instance { get; private set; }

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    // ------------------------------------------------------------
    // GET /api/obras
    // ------------------------------------------------------------
    public void GetObras(Action<List<ObraDTO>> onSuccess, Action<string> onError)
    {
        StartCoroutine(GetObrasCoroutine(onSuccess, onError));
    }

    IEnumerator GetObrasCoroutine(Action<List<ObraDTO>> onSuccess, Action<string> onError)
    {
        string url = $"{baseUrl}/api/obras";
        if (verboseLogging) Debug.Log($"[APIClient] GET {url}");

        using (UnityWebRequest req = UnityWebRequest.Get(url))
        {
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                string msg = $"Error {req.responseCode}: {req.error}";
                if (verboseLogging) Debug.LogError($"[APIClient] {msg}");
                onError?.Invoke(msg);
                yield break;
            }

            string raw = req.downloadHandler.text;
            if (verboseLogging) Debug.Log($"[APIClient] Respuesta: {raw.Substring(0, Mathf.Min(200, raw.Length))}...");

            // JsonUtility no parsea arrays JSON directos; envolvemos en {"items": [...]}
            string wrapped = "{\"items\":" + raw + "}";
            try
            {
                var parsed = JsonUtility.FromJson<ObrasListWrapper>(wrapped);
                var list = parsed?.items != null ? new List<ObraDTO>(parsed.items) : new List<ObraDTO>();
                onSuccess?.Invoke(list);
            }
            catch (Exception e)
            {
                string msg = $"Error parseando obras: {e.Message}";
                if (verboseLogging) Debug.LogError($"[APIClient] {msg}");
                onError?.Invoke(msg);
            }
        }
    }

    // ------------------------------------------------------------
    // GET texture (descarga una imagen de cualquier URL como Texture2D)
    // ------------------------------------------------------------
    public void GetTexture(string url, Action<Texture2D> onSuccess, Action<string> onError)
    {
        StartCoroutine(GetTextureCoroutine(url, onSuccess, onError));
    }

    IEnumerator GetTextureCoroutine(string url, Action<Texture2D> onSuccess, Action<string> onError)
    {
        if (verboseLogging) Debug.Log($"[APIClient] GET texture {url}");

        using (UnityWebRequest req = UnityWebRequestTexture.GetTexture(url))
        {
            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                string msg = $"Error {req.responseCode} cargando textura: {req.error}";
                if (verboseLogging) Debug.LogWarning($"[APIClient] {msg}");
                onError?.Invoke(msg);
                yield break;
            }

            Texture2D tex = DownloadHandlerTexture.GetContent(req);
            onSuccess?.Invoke(tex);
        }
    }

    // ------------------------------------------------------------
    // POST /api/ventas
    // ------------------------------------------------------------
    public void PostVenta(VentaRequest request, Action<VentaResponse> onSuccess, Action<string> onError)
    {
        StartCoroutine(PostVentaCoroutine(request, onSuccess, onError));
    }

    IEnumerator PostVentaCoroutine(VentaRequest request, Action<VentaResponse> onSuccess, Action<string> onError)
    {
        string url = $"{baseUrl}/api/ventas";
        string body = JsonUtility.ToJson(request);
        if (verboseLogging) Debug.Log($"[APIClient] POST {url} body={body}");

        using (UnityWebRequest req = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyBytes = Encoding.UTF8.GetBytes(body);
            req.uploadHandler = new UploadHandlerRaw(bodyBytes);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");

            yield return req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                string msg = $"Error {req.responseCode}: {req.downloadHandler?.text ?? req.error}";
                if (verboseLogging) Debug.LogError($"[APIClient] {msg}");
                onError?.Invoke(msg);
                yield break;
            }

            try
            {
                var parsed = JsonUtility.FromJson<VentaResponse>(req.downloadHandler.text);
                onSuccess?.Invoke(parsed);
            }
            catch (Exception e)
            {
                string msg = $"Error parseando venta: {e.Message}";
                if (verboseLogging) Debug.LogError($"[APIClient] {msg}");
                onError?.Invoke(msg);
            }
        }
    }
}
