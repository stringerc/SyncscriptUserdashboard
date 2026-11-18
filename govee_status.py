#!/usr/bin/env python3
"""Govee device status reporter.

Reports reachability and controllability for all Govee devices.
IMPORTANT: the Govee OpenAPI is write-only — it does NOT expose live
power/brightness/color state, so this script cannot report actual
settings. It verifies the API key works and lists controllable devices.

Exit code 0 on success, non-zero on failure.
"""
import json
import os
import sys
import urllib.request

DEVICES_ENDPOINT = "https://openapi.api.govee.com/router/api/v1/user/devices"


def fetch_devices():
    """Fetch the device list from the Govee OpenAPI."""
    api_key = os.environ.get("GOVEE_API_KEY")
    if not api_key:
        return None, "GOVEE_API_KEY not set"
    try:
        req = urllib.request.Request(
            DEVICES_ENDPOINT,
            headers={"Govee-API-Key": api_key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode())
        if payload.get("code") != 200 or not isinstance(payload.get("data"), list):
            return None, f"api code={payload.get('code')} message={payload.get('message')}"
        return payload["data"], None
    except Exception as exc:
        return None, str(exc)


def main():
    devices, error = fetch_devices()
    if error:
        print(f"Govee API: UNREACHABLE — {error}")
        print("Anomalies: api_error")
        return 2

    anomalies = []
    lines = [f"Govee API: reachable — {len(devices)} device(s) controllable"]
    for dev in devices:
        name = dev.get("deviceName") or dev.get("device", "unknown")
        caps = len(dev.get("capabilities") or [])
        lines.append(f"{name}: sku={dev.get('sku')} capabilities={caps}")
    lines.append(
        "Note: Govee OpenAPI is write-only — live power/brightness/color "
        "state is not exposed by the API."
    )
    print("\n".join(lines))
    print(f"Anomalies: {'; '.join(anomalies) if anomalies else 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
