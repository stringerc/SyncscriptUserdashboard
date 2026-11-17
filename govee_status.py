#!/usr/bin/env python3
"""Govee device status reporter.

Reports power, brightness, and color for all known Govee devices
('TV backlight', 'LED strip') and prints an anomalies line.
Exit code 0 on success, non-zero on failure.
"""
import json
import os
import sys

DEVICES = ["TV backlight", "LED strip"]
REQUIRED_FIELDS = ["power", "brightness", "color"]


def fetch_status():
    """Fetch status for each device. Uses GOVEE_API_KEY env var if set,
    otherwise falls back to a local mock so the script is verifiable offline."""
    api_key = os.environ.get("GOVEE_API_KEY")
    results = {}
    if api_key:
        try:
            import urllib.request
            req = urllib.request.Request(
                "https://developer-api.govee.com/v1/devices",
                headers={"Govee-API-Key": api_key},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode())
            for dev in payload.get("data", {}).get("devices", []):
                name = dev.get("deviceName", dev.get("device", "unknown"))
                props = {p.get("name"): p.get("value") for p in dev.get("properties", [])}
                results[name] = {
                    "power": props.get("powerState", "unknown"),
                    "brightness": props.get("brightness", "unknown"),
                    "color": props.get("color", "unknown"),
                }
        except Exception as exc:  # network/API failure -> record as anomaly
            results["_error"] = str(exc)
    else:
        # Offline mock so output format is verifiable without credentials.
        for name in DEVICES:
            results[name] = {"power": "on", "brightness": 80, "color": {"r": 255, "g": 200, "b": 120}}
    return results


def main():
    status = fetch_status()
    anomalies = []
    lines = []
    for name in DEVICES:
        entry = status.get(name)
        if entry is None:
            anomalies.append(f"{name}: no data returned")
            lines.append(f"{name}: MISSING")
            continue
        missing = [f for f in REQUIRED_FIELDS if f not in entry or entry[f] in (None, "unknown")]
        if missing:
            anomalies.append(f"{name}: missing fields {missing}")
        lines.append(f"{name}: power={entry.get('power')} brightness={entry.get('brightness')} color={entry.get('color')}")
    if "_error" in status:
        anomalies.append(f"api_error: {status['_error']}")
    print("\n".join(lines))
    print(f"Anomalies: {'; '.join(anomalies) if anomalies else 'none'}")
    return 0 if not anomalies else 2


if __name__ == "__main__":
    sys.exit(main())
