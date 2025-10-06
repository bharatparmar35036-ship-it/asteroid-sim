# app.py - The Definitive Backend for the NASA Space Apps Challenge

# 1. Imports
import os
import math
import requests
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# This line is crucial: it loads your secret NASA_API_KEY from the .env file
load_dotenv()

# --- 2. SETUP & CONFIGURATION ---

app = Flask(__name__)
# Enable CORS to allow your frontend (running on a different port) to communicate
CORS(app)

# Your secret key, loaded from the .env file
NASA_API_KEY = os.getenv("NASA_API_KEY")

# Physical constants for calculations
MEGATON_TO_JOULES = 4.184e15
EARTH_RADIUS_KM = 6371.0

# This dictionary maps the frontend's simple names to scientific densities (kg/m^3)
MATERIAL_DENSITIES_KG_M3 = {
    "stone": 3000,
    "iron": 8000,
    "comet": 1000,
    "stony-metallic": 5000, # Added for Eros
    "carbonaceous": 1400 # Added for Bennu
}

# A curated list of interesting asteroid IDs for the gallery feature
CURATED_ASTEROID_IDS = ["433", "99942", "101955", "65803", "25143"]

# --- 3. THE SIMULATION ENGINE (PHYSICS) ---

def calculate_impact_effects(diameter_km, velocity_kps, angle_deg, density_kg_m3):
    """
    This is the core scientific engine. It uses proper scaling laws.
    """
    # Convert inputs to standard SI units
    diameter_m = diameter_km * 1000.0
    velocity_m_s = velocity_kps * 1000.0
    angle_rad = math.radians(angle_deg)
    
    # Calculate mass
    mass_kg = (4/3) * math.pi * ((diameter_m / 2.0) ** 3) * density_kg_m3

    # Calculate energy, accounting for atmospheric entry and impact angle
    initial_energy = 0.5 * mass_kg * (velocity_m_s ** 2)
    atmospheric_efficiency = 0.95 if diameter_km > 1.0 else (0.7 + 0.25 * (diameter_km / 1.0))
    angle_efficiency = math.sin(angle_rad)
    
    effective_energy_joules = initial_energy * atmospheric_efficiency * angle_efficiency
    energy_megatons_tnt = effective_energy_joules / MEGATON_TO_JOULES

    # SCIENTIFIC IMPROVEMENT: Use proper scaling laws for crater and magnitude
    crater_diameter_km = 1.161 * (2700 / density_kg_m3)**(-1/3) * (effective_energy_joules / 9.81)**(1/3.4) / 1000 if effective_energy_joules > 0 else 0
    magnitude = (2/3) * math.log10(effective_energy_joules) - 2.9 if effective_energy_joules > 0 else 0

    # Generate human-readable descriptions
    damage_description = "Minimal local effects."
    if energy_megatons_tnt > 100000:
        damage_description = "Global catastrophe - potential mass extinction event."
    elif energy_megatons_tnt > 100:
        damage_description = "Regional devastation with potential climate effects."
    elif energy_megatons_tnt > 10:
        damage_description = "City-scale destruction; an entire major city would be obliterated."
    elif energy_megatons_tnt >= 1:
        damage_description = "Local devastation."

    return {
        "calculated_energy_megatons_tnt": energy_megatons_tnt,
        "estimated_crater_diameter_km": crater_diameter_km,
        "estimated_equivalent_magnitude": magnitude,
        "damage_description": damage_description
    }

# --- 4. API ENDPOINTS ---

@app.route("/")
def health_check():
    """Confirms the server is running."""
    return jsonify({"status": "ok", "message": "AIRA Backend is running!"})

@app.route("/asteroid_gallery")
def asteroid_gallery():
    """
    IMPROVEMENT: Provides a list of featured asteroids by fetching LIVE data from NASA.
    """
    if not NASA_API_KEY:
        return jsonify({"error": "Server is missing NASA API Key"}), 500

    gallery_data = []
    for asteroid_id in CURATED_ASTEROID_IDS:
        try:
            url = f"https://api.nasa.gov/neo/rest/v1/neo/{asteroid_id}?api_key={NASA_API_KEY}"
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            details = response.json()
            
            gallery_data.append({
                "id": details['id'],
                "name": details['name'],
                "short_name": details['name'].split('(')[0].strip(),
                "diameter_km": round(details['estimated_diameter']['kilometers']['estimated_diameter_max'], 2),
                "typical_velocity_km_s": round(float(details['close_approach_data'][0]['relative_velocity']['kilometers_per_second']), 2),
                "description": details.get('orbital_data', {}).get('orbit_class', {}).get('orbit_class_description', 'Near-Earth Object'),
                "composition": "Stony" # Default, can be improved
            })
        except requests.exceptions.RequestException as e:
            print(f"Could not fetch data for asteroid {asteroid_id}: {e}")
            continue
            
    return jsonify({"asteroids": gallery_data})


@app.route("/calculate_impact", methods=['POST'])
def calculate_impact():
    """Runs the main impact simulation based on user input from the website."""
    data = request.get_json()
    
    composition = data.get("composition", "stony").lower()
    density = MATERIAL_DENSITIES_KG_M3.get(composition, 3000)

    results = calculate_impact_effects(
        diameter_km=float(data.get("diameter_km", 1.0)),
        velocity_kps=float(data.get("velocity_km_s", 20.0)),
        angle_deg=float(data.get("angle_degrees", 45.0)),
        density_kg_m3=density
    )
    
    return jsonify({"impact_results": results})

# --- 5. ERROR HANDLERS ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "endpoint_not_found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "internal_server_error"}), 500

# --- 6. MAIN EXECUTION BLOCK ---
if __name__ == "__main__":
    if not NASA_API_KEY:
        print("WARNING: NASA_API_KEY is not set in your .env file.")
    
    print("Starting Final Hackathon Backend Server on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

