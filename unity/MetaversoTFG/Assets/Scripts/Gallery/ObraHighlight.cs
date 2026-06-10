using UnityEngine;

/// Componente que vive en el padre de cada obra. Activa o desactiva el
/// componente `Outline` (Quick Outline) que está en el Frame en función
/// de si la obra está siendo apuntada por el jugador.
public class ObraHighlight : MonoBehaviour
{
    [Tooltip("Componente Outline (Quick Outline). Si está nulo, se busca en los hijos.")]
    public Outline outline;

    void Awake()
    {
        if (outline == null)
        {
            outline = GetComponentInChildren<Outline>(true);
        }
        SetHighlighted(false);
    }

    public void SetHighlighted(bool on)
    {
        if (outline != null && outline.enabled != on)
        {
            outline.enabled = on;
        }
    }
}
