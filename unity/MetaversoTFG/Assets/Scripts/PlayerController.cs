using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [Header("Movimiento")]
    public float velocidadMovimiento = 5f;
    public float velocidadRotacion = 2f;

    [Header("Cámara")]
    public Transform camaraTransform;
    public float sensibilidadMouse = 100f;

    private Rigidbody rb;
    private float rotacionX = 0f;
    // Start is called once before the first execution of Update after the MonoBehaviour is created
    void Start()
    {
        rb = GetComponent<Rigidbody>();

        // Bloquear y ocultar cursor
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;

        // Si no asignaste la cámara manualmente, báscala
        if (camaraTransform == null)
        {
            camaraTransform = GetComponentInChildren<Camera>().transform;
        }
    }

    // Update is called once per frame
    void Update()
    {
        MoverJugador();
        RotarCamara();

        // Presiona ESC para liberar cursor
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }
    }

    void MoverJugador()
    {
        // Obtener input WASD
        float movimientoX = Input.GetAxis("Horizontal"); // A/D
        float movimientoZ = Input.GetAxis("Vertical");   // W/S

        // Calcular dirección de movimiento
        Vector3 movimiento = transform.right * movimientoX + transform.forward * movimientoZ;
        movimiento.y = 0; // No volar

        // Mover el rigidbody
        Vector3 nuevaPosicion = rb.position + movimiento * velocidadMovimiento * Time.deltaTime;
        rb.MovePosition(nuevaPosicion);
    }

    void RotarCamara()
    {
        // Obtener movimiento del mouse
        float mouseX = Input.GetAxis("Mouse X") * sensibilidadMouse * Time.deltaTime;
        float mouseY = Input.GetAxis("Mouse Y") * sensibilidadMouse * Time.deltaTime;

        // Rotar jugador horizontalmente
        transform.Rotate(Vector3.up * mouseX);

        // Rotar cámara verticalmente (con límites)
        rotacionX -= mouseY;
        rotacionX = Mathf.Clamp(rotacionX, -90f, 90f);

        camaraTransform.localRotation = Quaternion.Euler(rotacionX, 0f, 0f);
    }
}
