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

## Running locally

Requires Python 3.12+.

```bash
pip install -r requirements.txt
python app.py
```

The app serves on [http://localhost:5000](http://localhost:5000).

## Running with Docker

```bash
docker compose up --build
```

The app serves on [http://localhost:8080](http://localhost:8080).

## API

`POST /api/calcular`

```json
{ "distancia": 15, "cargas": 4, "direcao": 80 }
```

- `distancia` (required, km) — target distance.
- `cargas` (required, int 1–6) — propellant charge count.
- `direcao` (optional, 0–360) — bearing; logged alongside the shot, not used in the formula.

Returns `{ "elevacao": <degrees> }` on success, or `{ "erro": "<message>" }` with a `400` status on invalid input.

## License

[MIT](LICENSE)
