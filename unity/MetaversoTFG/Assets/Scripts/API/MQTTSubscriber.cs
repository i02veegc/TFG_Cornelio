using System;
using System.Collections.Concurrent;
using System.Text;
using UnityEngine;
using uPLibrary.Networking.M2Mqtt;
using uPLibrary.Networking.M2Mqtt.Messages;

/// Singleton que mantiene la conexión MQTT con el broker y notifica al
/// resto de la app (vía eventos C#) cuando llegan mensajes de venta.
///
/// Las callbacks de M2Mqtt corren en un thread distinto al main de Unity,
/// así que se encolan en una ConcurrentQueue y se procesan en Update()
/// para que los handlers puedan tocar GameObjects con seguridad.
public class MQTTSubscriber : MonoBehaviour
{
    [Header("Conexión")]
    [Tooltip("Host del broker MQTT.")]
    public string brokerHost = "localhost";

    [Tooltip("Puerto MQTT (TCP). Por defecto 1883.")]
    public int brokerPort = 1883;

    [Tooltip("Topic al que suscribirse para eventos de venta.")]
    public string topic = "obras/+/vendido";

    [Tooltip("Si está activo, loguea conexión y mensajes recibidos.")]
    public bool verboseLogging = true;

    public static MQTTSubscriber Instance { get; private set; }

    /// Se dispara en el main thread cuando llega un mensaje de venta.
    /// El parámetro es el id de la obra que se ha vendido.
    public event Action<int> OnObraVendida;

    MqttClient client;
    readonly ConcurrentQueue<(string topic, string payload)> messageQueue =
        new ConcurrentQueue<(string, string)>();

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

    void Start()
    {
        try
        {
            client = new MqttClient(brokerHost, brokerPort, false, null, null, MqttSslProtocols.None);
            client.MqttMsgPublishReceived += OnMqttMessage;
            string clientId = $"unity-{Guid.NewGuid().ToString("N").Substring(0, 8)}";
            client.Connect(clientId);

            if (client.IsConnected)
            {
                client.Subscribe(new[] { topic }, new[] { MqttMsgBase.QOS_LEVEL_AT_LEAST_ONCE });
                if (verboseLogging)
                {
                    Debug.Log($"[MQTT] Conectado a {brokerHost}:{brokerPort}, suscrito a '{topic}'");
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning(
                $"[MQTT] No se pudo conectar al broker ({brokerHost}:{brokerPort}): {e.Message}. " +
                "La app sigue funcionando sin sincronización en vivo."
            );
        }
    }

    void OnMqttMessage(object sender, MqttMsgPublishEventArgs e)
    {
        // Corre en un thread distinto al main. Solo encolar.
        string payload = Encoding.UTF8.GetString(e.Message);
        messageQueue.Enqueue((e.Topic, payload));
    }

    void Update()
    {
        // Drenar la cola en el main thread para que los handlers puedan
        // tocar GameObjects con seguridad.
        while (messageQueue.TryDequeue(out var msg))
        {
            ProcesarMensaje(msg.topic, msg.payload);
        }
    }

    void ProcesarMensaje(string topicRecibido, string payload)
    {
        if (verboseLogging) Debug.Log($"[MQTT] {topicRecibido}: {payload}");

        // Topic esperado: obras/<id>/vendido
        var parts = topicRecibido.Split('/');
        if (parts.Length != 3 || parts[0] != "obras" || parts[2] != "vendido") return;
        if (!int.TryParse(parts[1], out int obraId)) return;

        try
        {
            var data = JsonUtility.FromJson<VentaEventDTO>(payload);
            if (data != null && data.vendido)
            {
                OnObraVendida?.Invoke(obraId);
            }
        }
        catch (Exception ex)
        {
            Debug.LogWarning($"[MQTT] Error parseando payload de '{topicRecibido}': {ex.Message}");
        }
    }

    void OnDestroy()
    {
        if (client != null && client.IsConnected)
        {
            try { client.Disconnect(); } catch { /* ignore */ }
        }
    }
}

[Serializable]
public class VentaEventDTO
{
    public bool vendido;
    public int venta_id;
    public int obra_id;
    public string fecha_venta;
}
