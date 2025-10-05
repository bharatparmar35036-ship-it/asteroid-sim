from flask import Flask, request, jsonify
from flask_cors import CORS
from math import pi, pow, sin
import json

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return "Asteroid Impact Simulator API is running."

# Load asteroid data once on startup
try:
    with open('asteroid_data.json', 'r') as f:
        ASTEROID_PRESETS = json.load(f)
except Exception as e:
    print(f"Error loading asteroid presets: {e}")
    ASTEROID_PRESETS = []

@app.route('/asteroid_gallery', methods=['GET'])
def asteroid_gallery():
    return jsonify({"asteroids": ASTEROID_PRESETS})

@app.route('/calculate_impact', methods=['POST'])
def calculate_impact():
    try:
        data = request.get_json(force=True)
        diameter_km = float(data.get('diameter_km', 0))
        velocity_km_s = float(data.get('velocity_km_s', 0))
        density_kg_m3 = float(data.get('density_kg_m3', 0))
        angle_deg = float(data.get('angle_degrees', 0))

        # Validate inputs
        if diameter_km <= 0 or velocity_km_s <= 0 or density_kg_m3 <= 0 or not (0 < angle_deg <= 90):
            return jsonify({"error": "Invalid input parameters."}), 400

        # Calculate mass, energy, crater and magnitude
        radius_m = (diameter_km * 1000) / 2
        volume_m3 = (4/3) * pi * pow(radius_m, 3)
        mass_kg = volume_m3 * density_kg_m3

        velocity_m_s = velocity_km_s * 1000
        kinetic_energy_joules = 0.5 * mass_kg * pow(velocity_m_s, 2)
        energy_megatons = kinetic_energy_joules / 4.184e15

        crater_diameter_km = diameter_km * pow(velocity_km_s / 20.0, 0.5) * pow(sin(angle_deg * pi / 180), 0.33)
        magnitude = 2 + 0.5 * pow(energy_megatons, 0.3)

        # Determine damage description
        if energy_megatons > 1000:
            damage = "Global catastrophic impact potential."
        elif energy_megatons > 50:
            damage = "Regional devastation and severe global effects."
        elif energy_megatons > 1:
            damage = "Major local destruction and significant damage."
        else:
            damage = "Localized damage limited to impact area."

        return jsonify({
            "impact_results": {
                "calculated_energy_megatons_tnt": round(energy_megatons, 2),
                "estimated_crater_diameter_km": round(crater_diameter_km, 2),
                "estimated_equivalent_magnitude": round(magnitude, 1),
                "damage_description": damage
            }
        })
    except Exception as e:
        # In production, avoid returning detailed errors
        return jsonify({"error": "Server or input error."}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
