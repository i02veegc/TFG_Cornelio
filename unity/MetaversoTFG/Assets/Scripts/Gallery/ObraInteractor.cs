using UnityEngine;
using UnityEngine.InputSystem;

/// Lanza un raycast desde la cámara cada frame para detectar qué obra
/// está mirando el jugador. Si está dentro del rango, la resalta con
/// outline. Al pulsar E o click izquierdo, abre el modal de detalle.
public class ObraInteractor : MonoBehaviour
{
    [Header("Raycast")]
    [Tooltip("Cámara desde la que se lanza el raycast. Si está vacía, usa Camera.main.")]
    public Camera cameraOverride;

    [Tooltip("Distancia máxima de interacción en metros.")]
    public float maxDistance = 4f;

    [Tooltip("Layers contra las que hace raycast.")]
    public LayerMask interactionMask = ~0;

    [Header("UI")]
    [Tooltip("Referencia al panel modal de detalle de obra.")]
    public ObraDetailUI detailUI;

    Camera cam;
    ObraHighlight current;

    void Start()
    {
        cam = cameraOverride != null ? cameraOverride : Camera.main;
        if (cam == null)
        {
            Debug.LogError("[ObraInteractor] No hay cámara asignada ni Camera.main encontrada.");
            enabled = false;
        }
    }

    void Update()
    {
        // Pausar interacción mientras el modal está abierto
        if (detailUI != null && detailUI.IsOpen)
        {
            if (current != null) { current.SetHighlighted(false); current = null; }
            return;
        }

        ObraHighlight found = null;
        Ray ray = new Ray(cam.transform.position, cam.transform.forward);
        if (Physics.Raycast(ray, out RaycastHit hit, maxDistance, interactionMask))
        {
            found = hit.collider.GetComponentInParent<ObraHighlight>();
        }

        if (found != current)
        {
            if (current != null) current.SetHighlighted(false);
            if (found != null) found.SetHighlighted(true);
            current = found;
        }

        if (current != null && InteractionPressed())
        {
            var obra = current.GetComponent<ObraDeArte>();
            if (obra != null && detailUI != null)
            {
                detailUI.Show(obra);
                current.SetHighlighted(false);
                current = null;
            }
        }
    }

    static bool InteractionPressed()
    {
        bool key = Keyboard.current != null && Keyboard.current.eKey.wasPressedThisFrame;
        bool mouse = Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame;
        return key || mouse;
    }
}
