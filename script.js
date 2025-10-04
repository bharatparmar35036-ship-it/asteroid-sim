// script.js - Impact Simulator Final Logic

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const BACKEND_URL = 'https://asteroid-sim.onrender.com';
    const API_KEY = 'kb2rQhWfRQWpsD5m6FmI90mDGeMn7pOASwqAiaYZ'; // place your API key here if needed
    let impactLocation = { lat: 28.7, lng: 77.1 }; // Default impact location

    // --- DOM ELEMENTS ---
    const elements = {
        welcomeOverlay: document.getElementById('welcomeOverlay'),
        startBtn: document.getElementById('startBtn'),
        themeToggle: document.getElementById('themeToggleBtn'),
        asteroidSelect: document.getElementById('asteroidSelect'),
        presetDescription: document.getElementById('presetDescription'),
        diameter: document.getElementById('diameterInput'),
        velocity: document.getElementById('velocityInput'),
        angle: document.getElementById('angleInput'),
        density: document.getElementById('densityInput'),
        diameterValue: document.getElementById('diameterValue'),
        velocityValue: document.getElementById('velocityValue'),
        angleValue: document.getElementById('angleValue'),
        simulateBtn: document.getElementById('simulateImpactBtn'),
        resultsDisplay: document.getElementById('resultsDisplay'),
        mapContainer: document.getElementById('impact-map-container')
    };

    // --- THEME & OVERLAY LOGIC ---
    elements.themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
    });
    elements.startBtn.addEventListener('click', () => {
        elements.welcomeOverlay.classList.add('hidden');
        elements.mapContainer.style.display = 'block'; // Show the map after simulation starts
    });

    // --- MAP SETUP ---
    const map = L.map('impact-map-container').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB', noWrap: true
    }).addTo(map);

    let marker = L.marker(impactLocation, { draggable: true }).addTo(map);
    let craterCircle;

    marker.on('dragend', (event) => {
        impactLocation = event.target.getLatLng();
    });
    map.on('click', (e) => {
        impactLocation = e.latlng;
        marker.setLatLng(impactLocation);
    });

    // --- API & DATA HANDLING ---
    async function loadAsteroidPresets() {
        try {
            const response = await fetch(`${BACKEND_URL}/asteroid_gallery`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            elements.asteroidSelect.innerHTML = '<option value="">Custom Simulation</option>';
            data.asteroids.forEach(asteroid => {
                const option = document.createElement('option');
                option.value = asteroid.id;
                option.textContent = asteroid.name;
                option.dataset.diameter = asteroid.diameter_km;
                option.dataset.velocity = asteroid.typical_velocity_km_s;
                option.dataset.composition = asteroid.composition;
                elements.asteroidSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Failed to load presets:", error);
            elements.asteroidSelect.innerHTML = '<option value="">Could not load presets</option>';
            elements.presetDescription.textContent = 'Error: Backend server appears to be offline or invalid API key.';
            elements.presetDescription.style.color = 'var(--danger)';
        }
    }

    // --- SLIDER VALUE DISPLAY UPDATES ---
    ['diameter', 'velocity', 'angle'].forEach(id => {
        elements[id].addEventListener('input', (e) => {
            elements[`${id}Value`].textContent = e.target.value;
        });
    });

    // --- ASTEROID SELECTION EVENT ---
    elements.asteroidSelect.addEventListener('change', (e) => {
        const selected = e.target.options[e.target.selectedIndex];
        elements.presetDescription.textContent = '';
        if (selected.value) {
            elements.diameter.value = selected.dataset.diameter;
            elements.velocity.value = selected.dataset.velocity;
            elements.diameterValue.textContent = selected.dataset.diameter;
            elements.velocityValue.textContent = selected.dataset.velocity;

            // Autofill density based on composition
            const composition = (selected.dataset.composition || 'stony').toLowerCase();
            elements.density.value = {
                "stony": 2700,
                "stony-iron": 5000,
                "carbonaceous": 1400,
                "stony-metallic": 5000,
                "ice-rich": 900,
                "rock-ice": 1500
            }[composition] || 2700;

            elements.presetDescription.textContent =
                `Preset loaded: ${selected.dataset.diameter} km, ${selected.dataset.velocity} km/s, ${composition} body.`;
            elements.presetDescription.style.color = '';
        }
    });

    // --- IMPACT SIMULATION BUTTON EVENT ---
    elements.simulateBtn.addEventListener('click', async () => {
        const payload = {
            diameter_km: parseFloat(elements.diameter.value),
            velocity_km_s: parseFloat(elements.velocity.value),
            density_kg_m3: parseFloat(elements.density.value),
            angle_degrees: parseFloat(elements.angle.value)
        };

        elements.simulateBtn.disabled = true;
        elements.simulateBtn.textContent = 'CALCULATING...';
        elements.resultsDisplay.innerHTML = '<p class="console-text muted">Transmitting parameters...</p>';

        try {
            const response = await fetch(`${BACKEND_URL}/calculate_impact`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

            const results = await response.json();
            displayResults(results.impact_results);
        } catch (error) {
            console.error("Simulation error:", error);
            elements.resultsDisplay.innerHTML =
                `<p class="console-text error">Simulation Failed. Is the backend server running at ${BACKEND_URL}?<br>Check your API key and network.</p>`;
        } finally {
            elements.simulateBtn.disabled = false;
            elements.simulateBtn.textContent = 'LAUNCH';
        }
    });

    // --- DISPLAY SIMULATION RESULTS ---
    function displayResults(impact) {
        elements.resultsDisplay.innerHTML = `<p class="console-text success">Receiving report...</p>`;

        const lines = [
            `> Impact Energy: <strong>${impact.calculated_energy_megatons_tnt.toLocaleString('en-US', {maximumFractionDigits: 2})} MT</strong>`,
            `> Crater Diameter: <strong>${impact.estimated_crater_diameter_km.toLocaleString('en-US', {maximumFractionDigits: 2})} km</strong>`,
            `> Seismic Magnitude: <strong>M ${impact.estimated_equivalent_magnitude.toLocaleString('en-US', {maximumFractionDigits: 1})}</strong>`,
            `> Assessment: <em>${impact.damage_description}</em>`
        ];

        lines.forEach((line, index) => {
            setTimeout(() => {
                const p = document.createElement('p');
                p.className = 'console-text';
                p.innerHTML = line;
                elements.resultsDisplay.appendChild(p);
            }, (index + 1) * 300);
        });

        // Shockwave animation at impact location
        const mapContainer = document.getElementById('impact-map-container');
        const shockwave = document.createElement('div');
        shockwave.className = 'shockwave';
        const point = map.latLngToContainerPoint(impactLocation);
        shockwave.style.left = `${point.x - 25}px`;
        shockwave.style.top = `${point.y - 25}px`;
        mapContainer.appendChild(shockwave);
        setTimeout(() => shockwave.remove(), 1000);

        // Draw crater on map
        if (craterCircle) craterCircle.remove();
        if (impact.estimated_crater_diameter_km > 0) {
            const craterRadiusMeters = impact.estimated_crater_diameter_km * 1000 / 2;
            craterCircle = L.circle(impactLocation, {
                radius: craterRadiusMeters,
                color: 'var(--danger)',
                fillColor: 'var(--danger)',
                fillOpacity: 0.3
            }).addTo(map);
            map.fitBounds(craterCircle.getBounds(), { padding: [50, 50] });
        }
    }

    // --- INITIALIZATION ---
    loadAsteroidPresets();

});
