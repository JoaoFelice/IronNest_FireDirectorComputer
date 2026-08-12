"""Iron Nest Ballistics - companion calculator for the "Iron Nest" game.

Linear formula (no real physics):
    maxRangeKm  = charges * 5
    elevationDeg = (distanceKm / maxRangeKm) * 60
"""

import socket
import sys
from pathlib import Path

from flask import Flask, jsonify, render_template, request


def resource_path(relative_path):
    """Resolve a bundled resource, whether running from source or a frozen exe."""
    base_path = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return str(base_path / relative_path)


app = Flask(
    __name__,
    template_folder=resource_path("templates"),
    static_folder=resource_path("static"),
)

CARGAS_MIN = 1
CARGAS_MAX = 6
DIRECAO_MIN = 0
DIRECAO_MAX = 360
KM_POR_CARGA = 5
ELEVACAO_MAXIMA_GRAUS = 60

# Time-of-flight calibration points, (elevation_deg, time_s), one list per
# charge count, sorted ascending by elevation. Measured in-game by the user
# (see "time of flight calculation.xlsx") rather than derived from a formula
# -- the elevation/time relationship isn't purely linear (charge 1 in
# particular flattens out near max elevation), so real readings are
# interpolated instead of extrapolated from a fitted curve. (0, 0) is an
# anchor point, not a measurement: every charge's readings extrapolate back
# to ~0s at 0deg, so it lets the shortest shots interpolate too.
TOF_TABLE = {
    1: [(0, 0), (12.6, 5), (25.2, 10), (37.8, 15), (50.35, 20), (60, 28.95)],
    2: [(0, 0), (7.8, 5), (15.6, 10), (23.5, 15), (31.25, 20), (39.1, 25), (46.95, 30), (54.8, 35), (60, 38.1)],
    3: [(0, 0), (7.6, 5), (15.3, 10), (22.95, 15), (30.55, 20), (38.2, 25), (45.85, 30), (53.55, 35), (60, 39.1)],
    4: [(0, 0), (7.9, 5), (15.8, 10), (23.7, 15), (31.6, 20), (39.5, 25), (47.45, 30), (55.4, 35), (60, 38)],
    5: [(0, 0), (7.8, 5), (15.6, 10), (23.4, 15), (31.2, 20), (39, 25), (46.7, 30), (54.5, 35), (60, 38.5)],
    6: [(0, 0), (7, 5), (14, 10), (21, 15), (28, 20), (35, 25), (42, 30), (49, 35), (56, 40), (60, 43)],
}


def calcular_elevacao(distancia_km, cargas):
    """Calculate the elevation in degrees from the distance and number of charges.

    Raises ValueError with a friendly message when the input is invalid.
    """
    alcance_maximo_km = cargas * KM_POR_CARGA

    if distancia_km <= 0:
        raise ValueError("distance must be greater than zero")

    if distancia_km > alcance_maximo_km:
        raise ValueError(
            "distance exceeds the maximum range for this charge"
        )

    elevacao_graus = (distancia_km / alcance_maximo_km) * ELEVACAO_MAXIMA_GRAUS
    return elevacao_graus


def calcular_tempo_voo(elevacao_graus, cargas):
    """Interpolate the time of flight (seconds) for an elevation/charge pair.

    Piecewise-linear interpolation between the measured calibration points
    in TOF_TABLE[cargas]. Elevation is clamped to the table's range
    (0-60deg) before interpolating.
    """
    pontos = TOF_TABLE[cargas]

    if elevacao_graus <= pontos[0][0]:
        return pontos[0][1]
    if elevacao_graus >= pontos[-1][0]:
        return pontos[-1][1]

    for (e0, t0), (e1, t1) in zip(pontos, pontos[1:]):
        if elevacao_graus <= e1:
            fracao = (elevacao_graus - e0) / (e1 - e0)
            return t0 + fracao * (t1 - t0)

    return pontos[-1][1]  # unreachable given the clamps above


def validar_payload(dados):
    """Validate the payload received at /api/calcular.

    Direction is optional — the elevation formula never uses it, it is only
    logged alongside the shot. Returns (distancia_km, cargas, direcao_graus)
    on success, with direcao_graus as None when not provided.
    Raises ValueError with a friendly message on failure.
    """
    if dados is None:
        raise ValueError("invalid request body")

    distancia_raw = dados.get("distancia")
    cargas_raw = dados.get("cargas")
    direcao_raw = dados.get("direcao")

    if distancia_raw is None or cargas_raw is None:
        raise ValueError("required fields: distance, charge")

    try:
        distancia_km = float(distancia_raw)
    except (TypeError, ValueError):
        raise ValueError("invalid distance")

    try:
        cargas_float = float(cargas_raw)
    except (TypeError, ValueError):
        raise ValueError("invalid charge")

    if cargas_float != int(cargas_float):
        raise ValueError("charge must be an integer")

    cargas = int(cargas_float)

    direcao_graus = None
    if direcao_raw is not None:
        try:
            direcao_graus = float(direcao_raw)
        except (TypeError, ValueError):
            raise ValueError("invalid direction")

    if not (CARGAS_MIN <= cargas <= CARGAS_MAX):
        raise ValueError(
            f"charge must be an integer between {CARGAS_MIN} and {CARGAS_MAX}"
        )

    if direcao_graus is not None and not (DIRECAO_MIN <= direcao_graus <= DIRECAO_MAX):
        raise ValueError(
            f"direction must be between {DIRECAO_MIN} and {DIRECAO_MAX} degrees"
        )

    if distancia_km <= 0:
        raise ValueError("distance must be greater than zero")

    return distancia_km, cargas, direcao_graus


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/calcular", methods=["POST"])
def api_calcular():
    dados = request.get_json(silent=True)

    try:
        distancia_km, cargas, direcao_graus = validar_payload(dados)
        elevacao_graus = calcular_elevacao(distancia_km, cargas)
        tempo_voo_s = calcular_tempo_voo(elevacao_graus, cargas)
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400

    return jsonify(
        {
            "elevacao": round(elevacao_graus, 2),
            "tempo_voo": round(tempo_voo_s, 1),
        }
    )


def get_lan_ip():
    """Best-effort guess at this machine's LAN IP (no packets are actually sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def find_port(preferred=5000):
    """Use the preferred port if free, otherwise let the OS assign one."""
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("0.0.0.0", port))
                return s.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("no free port available")


if __name__ == "__main__":
    port = find_port()
    lan_ip = get_lan_ip()

    print("=" * 52)
    print(" IRON NEST BALLISTICS -- Fire Director")
    print("=" * 52)
    print(f" On this PC:      http://127.0.0.1:{port}")
    print(f" On your network: http://{lan_ip}:{port}")
    print(" (share the network address with others on the same Wi-Fi/LAN)")
    print(" Press Ctrl+C to stop.")
    print("=" * 52)

    try:
        app.run(host="0.0.0.0", port=port)
    except OSError as exc:
        print(f"\nCould not start the server: {exc}")
        input("Press Enter to exit...")
