// script.js - Enhanced Frontend Logic with 3D Globe

document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const BACKEND_URL = 'http://127.0.0.1:5000'; // Your partner's backend server
    
    // --- STATE MANAGEMENT ---
    let impactLocation = { lat: 28.7, lng: 77.1 }; // Default: New Delhi
    let selectedAsteroid = null;

    // --- DOM ELEMENT SELECTORS ---
    const screens = {
        welcome: document.getElementById('welcomeScreen'),
        gallery: document.getElementById('galleryScreen'),
        app: document.getElementById('appScreen')
    };
    const buttons = {
        welcomeContinue: document.getElementById('welcomeContinueBtn'),
        galleryProceed: document.getElementById('galleryProceedBtn'),
        backToGallery: document.getElementById('backToGalleryBtn'),
        themeToggle: document.getElementById('themeToggleBtn'),
        simulateImpact: document.getElementById('simulateImpactBtn')
    };
    const inputs = {
        diameter: document.getElementById('diameterInput'),
        velocity: document.getElementById('velocityInput'),
        angle: document.getElementById('angleInput'),
        density: document.getElementById('densityInput')
    };
    const valueDisplays = {
        diameter: document.getElementById('diameterValue'),
        velocity: document.getElementById('velocityValue'),
        angle: document.getElementById('angleValue')
    };
    const displays = {
        asteroidGrid: document.getElementById('asteroidGrid'),
        galleryStatus: document.getElementById('gallerySelectionStatus'),
        results: document.getElementById('resultsDisplay')
    };

    // --- 2D MAP STATE ---
    let map;
    let mapMarker;
    let mapCraterCircle;
    
    // --- 3D GLOBE STATE ---
    let scene, camera, renderer, controls, earth, globePin, globeCrater;

    // --- CORE UI FUNCTIONS ---

    function showScreen(screenName) {
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        });
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
            screens[screenName].classList.add('active');
            if (screenName === 'app') {
                // Refresh map/globe size after the screen is visible
                setTimeout(() => {
                    if (map) map.invalidateSize();
                    resizeGlobe();
                }, 100);
            }
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        document.body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
    }

    function notify(message, type = 'info') {
        const host = document.getElementById('notification-area');
        const el = document.createElement('div');
        el.className = 'notification';
        el.textContent = message;
        host.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
    
    function setImpactLocation(lat, lng, source = 'program') {
        impactLocation = { lat, lng };
        
        // Update 2D Map Marker and View
        if (mapMarker) mapMarker.setLatLng([lat, lng]);
        if (source !== 'map' && map) map.panTo([lat, lng]);
        
        // Update 3D Globe Pin
        if (globePin) {
            const globeCoords = latLonToVector3(lat, lng, 1.02); // Slightly above surface
            globePin.position.copy(globeCoords);
            globePin.visible = true;
        }
    }
    
    // --- 2D MAP INITIALIZATION ---
    function initMap() {
        map = L.map('impact-map-container').setView([20, 0], 2);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', noWrap: true }).addTo(map);
        
        mapMarker = L.marker(impactLocation, { draggable: true }).addTo(map);
        mapMarker.on('dragend', (event) => setImpactLocation(event.target.getLatLng().lat, event.target.getLatLng().lng, 'map'));
        map.on('click', (e) => setImpactLocation(e.latlng.lat, e.latlng.lng, 'map'));
    }

    // --- 3D GLOBE INITIALIZATION ---
    function initGlobe() {
        const container = document.getElementById('globe-container');
        if (!container) return;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 3.5;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Earth model
        const textureLoader = new THREE.TextureLoader();
        const earthGeo = new THREE.SphereGeometry(1, 64, 64);
        const earthMat = new THREE.MeshPhongMaterial({
            map: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/earth.jpg'),
            specularMap: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/specular.png'),
            shininess: 10
        });
        earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);

        // Starfield background
        const starGeo = new THREE.SphereGeometry(100, 64, 64);
        const starMat = new THREE.MeshBasicMaterial({ map: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/stars.jpg'), side: THREE.BackSide });
        const stars = new THREE.Mesh(starGeo, starMat);
        scene.add(stars);

        // Lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.2));
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(5, 3, 5);
        scene.add(pointLight);

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 1.5;
        controls.maxDistance = 5;

        // Impact Pin
        const pinGeo = new THREE.SphereGeometry(0.015, 16, 16);
        const pinMat = new THREE.MeshBasicMaterial({ color: 'red' });
        globePin = new THREE.Mesh(pinGeo, pinMat);
        globePin.visible = false;
        scene.add(globePin);
        
        // Raycaster for clicking the globe
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        container.addEventListener('click', (event) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(earth);
            if (intersects.length > 0) {
                const { lat, lng } = vector3ToLatLon(intersects[0].point);
                setImpactLocation(lat, lng, 'globe');
            }
        });
        
        animate();
        setImpactLocation(impactLocation.lat, impactLocation.lng);
    }
    
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    function resizeGlobe() {
        const container = document.getElementById('globe-container');
        if (container && renderer) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    }
    
    // Globe utility functions
    function latLonToVector3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    }
    
    function vector3ToLatLon(vector) {
        vector.normalize();
        const lat = 90 - (Math.acos(vector.y) * 180) / Math.PI;
        const lng = ((270 - (Math.atan2(vector.x, vector.z) * 180) / Math.PI) % 360) - 180;
        return { lat, lng };
    }

    // --- API & SIMULATION ---
    async function loadAsteroidGallery() {
        try {
            const response = await fetch(`${BACKEND_URL}/asteroid_gallery`);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();

            displays.asteroidGrid.innerHTML = '';
            data.asteroids.forEach(asteroid => {
                const card = document.createElement('div');
                card.className = 'asteroid-card';
                card.innerHTML = `<div class="asteroid-info"><h3 class="asteroid-name">${asteroid.name}</h3><p class="asteroid-details">${asteroid.description}</p></div>`;
                card.addEventListener('click', () => {
                    selectedAsteroid = asteroid;
                    document.querySelectorAll('.asteroid-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    displays.galleryStatus.textContent = `${asteroid.short_name} selected`;
                    buttons.galleryProceed.disabled = false;
                    
                    // Pre-fill inputs and their value displays
                    inputs.diameter.value = asteroid.diameter_km;
                    valueDisplays.diameter.textContent = asteroid.diameter_km;
                    inputs.velocity.value = asteroid.typical_velocity_km_s;
                    valueDisplays.velocity.textContent = asteroid.typical_velocity_km_s;
                    
                    const composition = (asteroid.composition || 'stony').toLowerCase();
                    inputs.density.value = { "stony": 2700, "stony-iron": 5000, "iron": 7800, "carbonaceous": 1400, "stony-metallic": 5000 }[composition] || 2700;
                });
                displays.asteroidGrid.appendChild(card);
            });
        } catch (error) {
            notify('Failed to load asteroids from backend.', 'error');
        }
    }

    async function handleSimulation() {
        const payload = {
            diameter_km: parseFloat(inputs.diameter.value),
            velocity_km_s: parseFloat(inputs.velocity.value),
            angle_degrees: parseFloat(inputs.angle.value),
            density_kg_m3: parseFloat(inputs.density.value),
            impact_lat: impactLocation.lat,
            impact_lng: impactLocation.lng
        };
        
        buttons.simulateImpact.disabled = true;
        displays.results.innerHTML = `<p class="console-text">Running impact simulation...</p>`;

        try {
            const response = await fetch(`${BACKEND_URL}/calculate_impact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Simulation failed on the server');
            
            const results = await response.json();
            displayResults(results.impact_results);
        } catch (error) {
            notify(error.message, 'error');
            displays.results.innerHTML = `<p class="console-text error">SIMULATION FAILED</p>`;
        } finally {
            buttons.simulateImpact.disabled = false;
        }
    }

    // --- UI RENDERING ---
    function displayResults(impact) {
        displays.results.innerHTML = `<p class="console-text success">Simulation Complete. Report:</p>`;
        
        const lines = [
            `Energy Release: <strong>${impact.calculated_energy_megatons_tnt.toLocaleString()} MT</strong>`,
            `Crater Diameter: <strong>${impact.estimated_crater_diameter_km.toLocaleString()} km</strong>`,
            `Seismic Magnitude: <strong>M ${impact.estimated_equivalent_magnitude.toLocaleString()}</strong>`,
            `Assessment: <em>${impact.damage_description}</em>`
        ];

        lines.forEach((line, index) => {
            setTimeout(() => {
                const p = document.createElement('p');
                p.className = 'console-text';
                p.innerHTML = line;
                displays.results.appendChild(p);
            }, (index + 1) * 300);
        });

        // Draw crater on 2D map
        if (mapCraterCircle) mapCraterCircle.remove();
        const craterRadiusMeters = impact.estimated_crater_diameter_km * 1000 / 2;
        if(craterRadiusMeters > 0) {
            mapCraterCircle = L.circle(impactLocation, { radius: craterRadiusMeters, color: 'var(--danger)', fillColor: 'var(--danger)', fillOpacity: 0.2 }).addTo(map);
            map.fitBounds(mapCraterCircle.getBounds());
        }
        
        // Draw crater on 3D globe
        if (globeCrater) scene.remove(globeCrater);
        if(impact.estimated_crater_diameter_km > 0) {
            const craterSizeOnGlobe = impact.estimated_crater_diameter_km / (12742); // Scale relative to Earth diameter in km
            const craterGeo = new THREE.CircleGeometry(craterSizeOnGlobe, 32);
            const craterMat = new THREE.MeshBasicMaterial({ color: 'red', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            globeCrater = new THREE.Mesh(craterGeo, craterMat);
            const globeCoords = latLonToVector3(impactLocation.lat, impactLocation.lng, 1.001); // Slightly above surface
            globeCrater.position.copy(globeCoords);
            globeCrater.lookAt(new THREE.Vector3(0,0,0));
            scene.add(globeCrater);
        }
    }
    
    // --- INITIALIZATION & EVENT LISTENERS ---
    function init() {
        try {
            initMap();
            initGlobe();
            loadAsteroidGallery();
            
            // --- FIX: Explicitly connect each slider to its display ---
            inputs.diameter.addEventListener('input', (event) => {
                valueDisplays.diameter.textContent = event.target.value;
            });
            inputs.velocity.addEventListener('input', (event) => {
                valueDisplays.velocity.textContent = event.target.value;
            });
            inputs.angle.addEventListener('input', (event) => {
                valueDisplays.angle.textContent = event.target.value;
            });

            // --- Connect main buttons ---
            buttons.welcomeContinue.addEventListener('click', () => showScreen('gallery'));
            buttons.galleryProceed.addEventListener('click', () => showScreen('app'));
            buttons.backToGallery.addEventListener('click', () => { 
                if (confirm("Your simulation will be reset. Are you sure?")) {
                    showScreen('gallery');
                }
            });
            buttons.themeToggle.addEventListener('click', toggleTheme);
            buttons.simulateImpact.addEventListener('click', handleSimulation);
            
            window.addEventListener('resize', resizeGlobe);

        } catch (error) {
            console.error("Initialization failed:", error);
            notify("A critical error occurred while loading the app.", "error");
        }
    }
    
    init();
});

