# Iron Nest Ballistics — Fire Director

A browser-based fire-control console for **Iron Nest** — enter a target's distance, propellant charge, and direction, and get the elevation to fire at.

Not affiliated with or endorsed by the makers of Iron Nest. This is a fan-made companion tool.

## Features

- **Fire solution calculator** — distance + charge in, elevation out.
- **Auto charge selection** — leave charge unset and the console picks the smallest one that reaches the target.
- **Fire log** — every calculated shot is queued, tracked, and can be marked fired or deleted.
- **Two display themes** — FDC and Ironclad, switchable at runtime, saved locally.
- **Built-in field manual** — an in-app help modal walks through the controls.
- Everything runs client-side after load — shots and settings are stored in the browser, nothing is sent anywhere beyond the calculation request.

## How the math works

The game uses a simplified, non-physical ballistics model:

```
maxRangeKm   = charges * 5
elevationDeg = (distanceKm / maxRangeKm) * 60
```

Charges range from 1 to 6, elevation from 0° to 60°, direction (if given) from 0° to 360°.

## Running it

### Windows executable (no Python required)

Download `IronNestBallistics.exe` from the [Releases page](https://github.com/JoaoFelice/IronNest_FireDirectorComputer/releases) and double-click it. A console window opens and prints two addresses:

```
On this PC:      http://127.0.0.1:5000
On your network: http://<your-lan-ip>:5000
```

Open the first on the same machine, or share the second with anyone on the same Wi-Fi/LAN so they can use it from their own device. Leave the console window open — closing it stops the server.

**Verifying the download.** Every release is built automatically by [GitHub Actions](.github/workflows/release.yml) directly from the tagged source — not from anyone's personal machine — and published with a SHA-256 checksum and a signed build attestation. To verify what you downloaded actually came from this repo's source:

```bash
# checksum matches the .sha256 file published alongside the release
certutil -hashfile IronNestBallistics.exe SHA256

# cryptographic proof it was built by this repo's workflow, not tampered with
gh attestation verify IronNestBallistics.exe --owner JoaoFelice
```

Don't trust prebuilt binaries at all? Build your own from source (requires Python 3.12+ and PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

This produces `dist\IronNestBallistics.exe`.

### From source

Requires Python 3.12+.

```bash
pip install -r requirements.txt
python app.py
```

## API

`POST /api/calcular`

```json
{ "distancia": 15, "cargas": 4, "direcao": 80 }
```

- `distancia` (required, km) — target distance.
- `cargas` (required, int 1–6) — propellant charge count.
- `direcao` (optional, 0–360) — bearing; logged alongside the shot, not used in the formula.

Returns `{ "elevacao": <degrees> }` on success, or `{ "erro": "<message>" }` with a `400` status on invalid input.

## Cutting a release

Push a version tag and the [release workflow](.github/workflows/release.yml) builds the exe and publishes it automatically:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## License

[MIT](LICENSE)
