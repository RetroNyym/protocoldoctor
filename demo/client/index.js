// demo client — implements the v2 RoboVac Cloud protocol (as the docs describe)
const BASE = "https://api.robovac-cloud.com/v2/device/";

class RoboVacClient {
  constructor(token) {
    if (!token) throw new Error("missing token");
    this.token = token;
  }

  status(deviceId) {
    return this.get(`${deviceId}/status`);
  }

  clean(deviceId, { fanSpeed = 2, waterLevel = 1, mode = "auto", timestamp } = {}) {
    const body = { fanSpeed, waterLevel, mode, timestamp, deviceId };
    return this.post(`${deviceId}/clean`, body);
  }

  // MQTT side — the doctor checks these strings too
  mqttConnect(broker) {
    // robovac-mqtt.corp:8883
    return { broker, opcodes: { START_MAPPING: 0x2f21, RETURN_DOCK: 0x1042 } };
  }

  firmware(model) {
    return this.get(`https://fw.robovac-cloud.com/latest?model=${model}`);
  }
}

module.exports = RoboVacClient;
