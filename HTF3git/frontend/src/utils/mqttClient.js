import mqtt from "mqtt";

// Connect to a public broker over WebSockets
const BROKER_URL = "wss://broker.emqx.io:8084/mqtt";

// Generate a random client ID to avoid collisions
const clientId = `htf3_client_${Math.random().toString(16).substring(2, 10)}`;

// The topic we will use for broadcasting SOS alerts
export const SOS_TOPIC = "kls-git/htf3/sos-alerts";

let client = null;

export const getMqttClient = () => {
  if (!client) {
    client = mqtt.connect(BROKER_URL, {
      clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    client.on("connect", () => {
      console.log("[MQTT] Connected to broker");
    });

    client.on("error", (err) => {
      console.error("[MQTT] Error:", err);
    });

    client.on("reconnect", () => {
      console.log("[MQTT] Reconnecting...");
    });
  }
  return client;
};
