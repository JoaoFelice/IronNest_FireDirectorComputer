"""Iron Nest Ballistics - companion calculator for the "Iron Nest" game.

Linear formula (no real physics):
    maxRangeKm  = charges * 5
    elevationDeg = (distanceKm / maxRangeKm) * 60
"""

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

CARGAS_MIN = 1
CARGAS_MAX = 6
DIRECAO_MIN = 0
DIRECAO_MAX = 360
KM_POR_CARGA = 5
ELEVACAO_MAXIMA_GRAUS = 60


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
    except ValueError as exc:
        return jsonify({"erro": str(exc)}), 400

    return jsonify({"elevacao": round(elevacao_graus, 2)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
