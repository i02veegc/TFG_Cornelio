// ============================================================
//  ESP32 – Monitor de venta de obra via MQTT
//  LED RGB: VERDE = disponible | ROJO = vendida
//  OLED 0.96" SSD1306: muestra ID de obra, estado y conexión
//
//  Librerías necesarias (Library Manager de Arduino IDE):
//    - PubSubClient       (Nick O'Leary)
//    - ArduinoJson        (Benoit Blanchon) v6+
//    - Adafruit SSD1306   (Adafruit)
//    - Adafruit GFX       (Adafruit) — se instala como dependencia
// ============================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ------------------------------------------------------------
// CONFIGURACIÓN
// ------------------------------------------------------------

// Wi-Fi
const char* WIFI_SSID     = "vodafoneAAYF9E";
const char* WIFI_PASSWORD = "H3sRFXfGCc7T9X7M";

// Backend API (normalmente la misma IP que el broker)
const char* API_BASE_URL  = "http://192.168.0.197:3000";

// Broker MQTT
const char* MQTT_BROKER   = "192.168.0.197";   // IP o dominio
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";                 // Vacío si no hay auth
const char* MQTT_PASSWORD = "";

// ID de la obra asignada a este ESP32
const char* OBRA_ID = "22"; // La Gioconda

// Pines LED RGB
const int PIN_R = 13;
const int PIN_G = 12;
const int PIN_B = 14;
const bool ANODO_COMUN = false;   // true si tu LED es de ánodo común

// OLED (I2C por defecto: SDA=GPIO21, SCL=GPIO22)
#define OLED_WIDTH  128
#define OLED_HEIGHT 64
#define OLED_ADDR   0x3C   // Dirección I2C habitual del SSD1306

// ------------------------------------------------------------
// Objetos globales
// ------------------------------------------------------------
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

char topicSuscripcion[64];
bool obraVendida = false;

// ------------------------------------------------------------
// Helpers LED RGB
// ------------------------------------------------------------
void setColor(int r, int g, int b) {
  if (ANODO_COMUN) { r = 255 - r; g = 255 - g; b = 255 - b; }
  analogWrite(PIN_R, r);
  analogWrite(PIN_G, g);
  analogWrite(PIN_B, b);
}

void ledVerde()  { setColor(0, 255, 0); }
void ledRojo()   { setColor(255, 0, 0); }
void ledAzul()   { setColor(0, 0, 255); }
void ledApagado(){ setColor(0, 0, 0); }

// ------------------------------------------------------------
// Helpers OLED
// ------------------------------------------------------------
void oledMostrarEstado() {
  oled.clearDisplay();

  // --- Línea 1: título ---
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 0);
  oled.println("== Monitor de obra ==");

  // --- Línea 2: ID de obra (grande) ---
  oled.setTextSize(2);
  oled.setCursor(0, 16);
  oled.print("ID: ");
  oled.println(OBRA_ID);

  // --- Línea 3: estado ---
  oled.setTextSize(1);
  oled.setCursor(0, 40);
  oled.print("Estado: ");
  if (obraVendida) {
    oled.println("VENDIDA");
  } else {
    oled.println("DISPONIBLE");
  }

  // --- Línea 4: conexión ---
  oled.setCursor(0, 54);
  if (mqttClient.connected()) {
    oled.println("MQTT: conectado");
  } else if (WiFi.status() == WL_CONNECTED) {
    oled.println("WiFi OK | MQTT: no");
  } else {
    oled.println("WiFi: conectando...");
  }

  oled.display();
}

void oledMensaje(const char* linea1, const char* linea2) {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(0, 20);
  oled.println(linea1);
  oled.setCursor(0, 36);
  oled.println(linea2);
  oled.display();
}

// ------------------------------------------------------------
// Callback MQTT
// ------------------------------------------------------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Mensaje en: %s\n", topic);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);

  if (err) {
    Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
    return;
  }

  bool vendido = doc["vendido"] | false;

  if (vendido) {
    obraVendida = true;
    ledRojo();
    Serial.println("[OBRA] Vendida. LED -> ROJO");
  } else {
    obraVendida = false;
    ledVerde();
    Serial.println("[OBRA] Disponible. LED -> VERDE");
  }

  // Actualizar pantalla
  oledMostrarEstado();
}

// ------------------------------------------------------------
// Consulta inicial del estado de la obra a la API REST
// ------------------------------------------------------------
void consultarEstadoInicial() {
  char url[128];
  snprintf(url, sizeof(url), "%s/api/obras/%s", API_BASE_URL, OBRA_ID);
  Serial.printf("[API] GET %s\n", url);
  oledMensaje("Consultando API...", url);

  HTTPClient http;
  http.begin(url);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String body = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, body);
    if (!err) {
      obraVendida = doc["vendido"] | false;
      Serial.printf("[API] Estado inicial: %s\n", obraVendida ? "VENDIDA" : "DISPONIBLE");
    } else {
      Serial.printf("[API] JSON error: %s\n", err.c_str());
    }
  } else {
    Serial.printf("[API] Error HTTP %d — arrancando como DISPONIBLE\n", httpCode);
  }

  http.end();
  obraVendida ? ledRojo() : ledVerde();
}

// ------------------------------------------------------------
// Conexión Wi-Fi
// ------------------------------------------------------------
void conectarWifi() {
  Serial.printf("\n[WiFi] Conectando a %s", WIFI_SSID);
  ledAzul();
  oledMensaje("Conectando WiFi...", WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Fallo al conectar");
    oledMensaje("WiFi: ERROR", "Revisa SSID/pass");
  }
}

// ------------------------------------------------------------
// Conexión / reconexión MQTT
// ------------------------------------------------------------
void conectarMQTT() {
  char topicStatus[64];
  snprintf(topicStatus, sizeof(topicStatus), "dispositivos/esp32-%s/status", OBRA_ID);
  const char* willMsg = "{\"online\":false}";

  while (!mqttClient.connected()) {
    ledAzul();
    oledMensaje("Conectando MQTT...", MQTT_BROKER);
    Serial.print("[MQTT] Conectando...");

    String clientId = "esp32-obra-" + String(OBRA_ID) + "-"
                      + String((uint32_t)ESP.getEfuseMac(), HEX);

    bool ok = (strlen(MQTT_USER) > 0)
      ? mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD,
                           topicStatus, 1, false, willMsg)
      : mqttClient.connect(clientId.c_str(),
                           topicStatus, 1, false, willMsg);

    if (ok) {
      Serial.println(" OK");
      // Publicar presencia online
      mqttClient.publish(topicStatus, "{\"online\":true}", false);
      mqttClient.subscribe(topicSuscripcion);
      Serial.printf("[MQTT] Suscrito a: %s\n", topicSuscripcion);

      obraVendida ? ledRojo() : ledVerde();
      oledMostrarEstado();

    } else {
      Serial.printf(" Error rc=%d — reintentando en 3s\n", mqttClient.state());
      oledMensaje("MQTT: error", "Reintentando...");
      delay(3000);
    }
  }
}

// ------------------------------------------------------------
// Setup
// ------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  // Pines LED
  pinMode(PIN_R, OUTPUT);
  pinMode(PIN_G, OUTPUT);
  pinMode(PIN_B, OUTPUT);
  ledApagado();

  // Inicializar OLED
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("[OLED] Fallo al inicializar");
    // Continúa sin pantalla — el LED sigue funcionando
  } else {
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(20, 24);
    oled.println("Iniciando...");
    oled.display();
    Serial.println("[OLED] OK");
  }

  // Topic dinámico
  snprintf(topicSuscripcion, sizeof(topicSuscripcion),
           "obras/%s/vendido", OBRA_ID);
  Serial.printf("[CONFIG] Obra: %s | Topic: %s\n", OBRA_ID, topicSuscripcion);

  conectarWifi();

  if (WiFi.status() == WL_CONNECTED) {
    consultarEstadoInicial();
  }

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  conectarMQTT();
}

// ------------------------------------------------------------
// Loop
// ------------------------------------------------------------
void loop() {
  if (!mqttClient.connected()) {
    if (WiFi.status() != WL_CONNECTED) conectarWifi();
    conectarMQTT();
  }

  mqttClient.loop();
}
