# RoboVac Cloud API — reverse engineering notes (v2)

## REST

- Clean start: `POST https://api.robovac-cloud.com/v2/device/{deviceId}/clean`
- Status: `GET https://api.robovac-cloud.com/v2/device/{deviceId}/status`
- Auth header: `token` + `"deviceId"` json field
- Body keys: `"fanSpeed"`, `"waterLevel"`, `"mode"`, `"timestamp"`

## MQTT control channel

- Broker: `mqtts://robovac-mqtt.corp:8883`
- Command opcode: `0x2f21` = start mapping
- Command opcode: `0x1042` = return dock
- Firmware check: `https://fw.robovac-cloud.com/latest?model=rv700`

## ⚠️ Legacy v1 protocol (kept for old docks)

- `https://api.robovac-cloud.com/v1/legacy/pair`
- opcode `0xFFFF` = factory reset
- deprecated key `"warranty"`
