import mqtt from "mqtt";

// Connect to a public broker over WebSockets
const BROKER_URL = "wss://broker.emqx.io:8084/mqtt";

// Generate a random client ID to avoid collisions
const clientId = `htf3_client_${Math.random().toString(16).substring(2, 10)}`;

// The topic we will use for broadcasting SOS alerts
export const SOS_TOPIC = "kls-git/htf3/sos-alerts";

// In-memory store of latest SOS markers { [id]: { lat, lng, label, time, user } }
let sosMarkers = {};
const sosListeners = new Set();

export const getSosMarkers = () => ({ ...sosMarkers });

export const subscribeSosMarkers = (fn) => {
  sosListeners.add(fn);
  return () => sosListeners.delete(fn);
};

const notifySosListeners = () => {
  const snapshot = { ...sosMarkers };
  sosListeners.forEach(fn => fn(snapshot));
};

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
      client.subscribe(SOS_TOPIC);
    });

    client.on("message", (topic, message) => {
      if (topic === SOS_TOPIC) {
        try {
          const payload = JSON.parse(message.toString());
          // Store marker if coords are present
          if (payload.coords) {
            const [lat, lng] = payload.coords.split(",").map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              sosMarkers[payload.id] = {
                id: payload.id,
                lat,
                lng,
                label: payload.location || "SOS Location",
                type: payload.type || "SOS Emergency",
                user: payload.user || "Student",
                usn: payload.usn || "",
                time: payload.time || new Date().toISOString(),
              };
              notifySosListeners();
            }
          }
        } catch (e) {
          console.error("[MQTT] Parse error:", e);
        }
      }
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
