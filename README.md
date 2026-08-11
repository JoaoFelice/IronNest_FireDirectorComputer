# Iron Nest Ballistics — Fire Director

A browser-based fire-control console for **Iron Nest** — enter a target's distance, propellant charge, and direction, and get the elevation to fire at.

Not affiliated with or endorsed by the makers of Iron Nest. This is a fan-made companion tool.

## Features

- **Fire solution calculator** — distance + charge in, elevation out.
- **Auto charge selection** — leave charge unset and the console picks the smallest one that reaches the target.
- **Fire log** — every calculated shot is queued, tracked, and can be marked fired or deleted.
- **Two display themes** — FDC and Ironclad, switchable at runtime, saved locally.
- **Built-in field manual** — an in-app help modal walks through the controls.
- Everything runs client-side after load — shots and settings are stored in the browser, nothing is sent anywhere outside your network.

## How the math works

The game uses a simplified, non-physical ballistics model:

```
maxRangeKm   = charges * 5
elevationDeg = (distanceKm / maxRangeKm) * 60
```

Charges range from 1 to 6, elevation from 0° to 60°, direction (if given) from 0° to 360°.

## Running it

### Windows: download the release (no Python needed)

1. Go to the [Releases page](https://github.com/JoaoFelice/IronNest_FireDirectorComputer/releases) and download `IronNestBallistics.exe` from the latest release.
2. Double-click it. A console window opens and prints two addresses:
   ```
   On this PC:      http://127.0.0.1:5000
   On your network: http://<your-lan-ip>:5000
   ```
3. Open the first address in a browser on the same machine, or share the second with anyone on the same Wi-Fi/LAN so they can use it from their own device.
4. Leave the console window open while you're using the app — closing it stops the server.

**Verifying the download (optional).** Every release is built automatically by [GitHub Actions](.github/workflows/release.yml) straight from the tagged source — never from anyone's personal machine — and published with a SHA-256 checksum and a signed build attestation:

```bash
# confirm the file matches the .sha256 checksum published alongside the release
certutil -hashfile IronNestBallistics.exe SHA256

# cryptographic proof it was built by this repo's workflow, not tampered with
gh attestation verify IronNestBallistics.exe --owner JoaoFelice
```

### Run from source with Python (Windows, Linux, macOS)

This isn't Windows-only — the app is plain Flask/Python and runs the same way on any OS. Requires [Python 3.12+](https://www.python.org/downloads/).

```bash
# Windows
pip install -r requirements.txt
python app.py

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

It prints the same two addresses as the packaged release (`http://127.0.0.1:5000` and a network address) — open the first locally, or share the second with others on the same Wi-Fi/LAN.

On Windows, you can also build your own `.exe` this way — the same process the official release uses, just run on your machine instead of GitHub's:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

This produces `dist\IronNestBallistics.exe`. No prebuilt executables are provided for Linux or macOS — running from source with Python is the way to use it there.

## License

[MIT](LICENSE)

---

*Built with help from AI.*
