using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// Gestiona el modal en pantalla que muestra los detalles de una obra
/// y, si está disponible, el formulario para comprarla.
public class ObraDetailUI : MonoBehaviour
{
    [Header("Panel principal")]
    [Tooltip("GameObject que contiene todo el modal. Se activa/desactiva.")]
    public GameObject panel;

    [Header("Info de la obra")]
    public RawImage imagen;
    public TMP_Text tituloLabel;
    public TMP_Text autorLabel;
    public TMP_Text anioLabel;
    public TMP_Text descripcionLabel;
    public TMP_Text precioLabel;
    public TMP_Text estadoLabel;

    [Header("Formulario de compra")]
    [Tooltip("Contenedor del formulario. Se oculta si la obra ya está vendida.")]
    public GameObject formularioCompra;
    public TMP_InputField nombreInput;
    public TMP_InputField emailInput;
    public Button comprarButton;

    [Header("Botón de cerrar")]
    public Button cerrarButton;

    [Header("Feedback")]
    public TMP_Text mensajeLabel;

    [Header("Pausar control del jugador")]
    [Tooltip("Componentes que se desactivan mientras el modal está abierto (p. ej. FirstPersonController, StarterAssetsInputs, PlayerInput).")]
    public Behaviour[] componentsToDisable;

    public bool IsOpen { get; private set; }

    ObraDeArte obraActual;
    CursorLockMode previousLockMode;
    bool previousVisible;

    static readonly Color ColorOk = new Color(0.18f, 0.63f, 0.23f);
    static readonly Color ColorMuted = new Color(0.5f, 0.5f, 0.5f);

    void Awake()
    {
        if (panel != null) panel.SetActive(false);
        if (comprarButton != null) comprarButton.onClick.AddListener(OnComprarClick);
        if (cerrarButton != null) cerrarButton.onClick.AddListener(Close);
    }

    public void Show(ObraDeArte obra)
    {
        if (obra == null || panel == null) return;

        obraActual = obra;

        if (tituloLabel != null) tituloLabel.text = obra.titulo;
        if (autorLabel != null) autorLabel.text = obra.artista;
        if (anioLabel != null) anioLabel.text = obra.anio > 0 ? obra.anio.ToString() : "—";
        if (descripcionLabel != null) descripcionLabel.text = string.IsNullOrWhiteSpace(obra.descripcion) ? "" : obra.descripcion;
        if (precioLabel != null) precioLabel.text = $"{obra.precio:N0} €";

        bool vendida = obra.vendido;
        if (estadoLabel != null)
        {
            estadoLabel.text = vendida ? "VENDIDA" : "DISPONIBLE";
            estadoLabel.color = vendida ? Color.red : ColorOk;
        }
        if (formularioCompra != null) formularioCompra.SetActive(!vendida);
        if (mensajeLabel != null) mensajeLabel.text = "";

        // Reusar la textura del lienzo y ajustar aspect ratio
        if (imagen != null)
        {
            var canvasT = obra.transform.Find("Canvas");
            if (canvasT != null)
            {
                var r = canvasT.GetComponent<MeshRenderer>();
                if (r != null && r.material != null)
                {
                    var tex = r.material.mainTexture;
                    imagen.texture = tex;

                    // Si hay un AspectRatioFitter, actualizar para mantener proporciones
                    var fitter = imagen.GetComponent<AspectRatioFitter>();
                    if (fitter != null && tex != null && tex.height > 0)
                    {
                        fitter.aspectRatio = (float)tex.width / tex.height;
                    }
                }
            }
        }

        if (nombreInput != null) nombreInput.text = "";
        if (emailInput != null) emailInput.text = "";
        if (comprarButton != null) comprarButton.interactable = true;

        panel.SetActive(true);
        IsOpen = true;

        // Liberar el cursor para interactuar con la UI
        previousLockMode = Cursor.lockState;
        previousVisible = Cursor.visible;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;

        // Desactivar componentes de control del jugador
        SetComponentsEnabled(false);
    }

    public void Close()
    {
        if (panel != null) panel.SetActive(false);
        IsOpen = false;
        obraActual = null;

        Cursor.lockState = previousLockMode == CursorLockMode.None ? CursorLockMode.Locked : previousLockMode;
        Cursor.visible = previousLockMode == CursorLockMode.None ? false : previousVisible;

        // Reactivar componentes de control del jugador
        SetComponentsEnabled(true);
    }

    void SetComponentsEnabled(bool enabled)
    {
        if (componentsToDisable == null) return;
        for (int i = 0; i < componentsToDisable.Length; i++)
        {
            if (componentsToDisable[i] != null)
            {
                componentsToDisable[i].enabled = enabled;
            }
        }
    }

    void OnComprarClick()
    {
        if (obraActual == null || APIClient.Instance == null) return;

        string nombre = nombreInput != null ? nombreInput.text : "";
        string email = emailInput != null ? emailInput.text : "";

        if (string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(email))
        {
            ShowMensaje("Rellena nombre y email", Color.red);
            return;
        }

        if (comprarButton != null) comprarButton.interactable = false;
        ShowMensaje("Procesando…", ColorMuted);

        var req = new VentaRequest
        {
            obra_id = obraActual.obraId,
            comprador_nombre = nombre,
            comprador_email = email,
            feria_id = 0
        };

        APIClient.Instance.PostVenta(req,
            response =>
            {
                ShowMensaje("¡Venta registrada!", ColorOk);
                obraActual.MarcarComoVendida();
                Invoke(nameof(Close), 1.5f);
            },
            err =>
            {
                ShowMensaje($"Error: {err}", Color.red);
                if (comprarButton != null) comprarButton.interactable = true;
            }
        );
    }

    void ShowMensaje(string texto, Color color)
    {
        if (mensajeLabel == null) return;
        mensajeLabel.text = texto;
        mensajeLabel.color = color;
    }
}
