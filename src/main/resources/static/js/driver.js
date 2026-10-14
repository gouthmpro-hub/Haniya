/**
 * ===================================================================
 * GPS-Based Auto Tracking System - Driver Dashboard Controller
 * Handles real-time browser Geolocation API, backend push,
 * availability toggle, and simulated test drive mode.
 * ===================================================================
 */

let watchId = null;
let isTrackingActive = false;
let driverMap = null;
let driverMarker = null;
let simulationInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initDriverMap();
    setupEventListeners();
    fetchCurrentDriverStatus();
});

/**
 * Initializes the Driver's real-time Leaflet mini-map.
 */
function initDriverMap() {
    const mapElement = document.getElementById('driverMap');
    if (!mapElement) return;

    // Default center (Kochi Marine Drive: 9.9825, 76.2820)
    driverMap = L.map('driverMap', {
        zoomControl: true,
        attributionControl: true
    }).setView([9.9825, 76.2820], 15);

    // Google Maps Tile Layers
    const googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>'
    });

    const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Imagery &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>'
    });

    // Default to Google Streets
    googleStreets.addTo(driverMap);

    // Google Maps Layer Switcher
    const baseMaps = {
        "🗺️ Streets": googleStreets,
        "🛰️ Satellite": googleSatellite
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(driverMap);

    // Custom Auto Rickshaw Marker Icon
    const autoIcon = L.divIcon({
        className: 'driver-live-marker',
        html: `
            <div class="custom-auto-marker">
                <svg viewBox="0 0 24 24">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    driverMarker = L.marker([9.9825, 76.2820], { icon: autoIcon }).addTo(driverMap);
}

/**
 * Attaches event listeners for tracking toggle, availability switch, and simulation.
 */
function setupEventListeners() {
    const btnToggleTracking = document.getElementById('btnToggleTracking');
    const chkAvailability = document.getElementById('chkAvailability');
    const btnSimulate = document.getElementById('btnSimulateDrive');

    if (btnToggleTracking) {
        btnToggleTracking.addEventListener('click', toggleLocationTracking);
    }

    if (chkAvailability) {
        chkAvailability.addEventListener('change', (e) => {
            updateDriverAvailability(e.target.checked);
        });
    }

    if (btnSimulate) {
        btnSimulate.addEventListener('click', toggleSimulation);
    }
}

/**
 * Toggles GPS watchPosition on and off.
 */
function toggleLocationTracking() {
    const btn = document.getElementById('btnToggleTracking');
    const statusPill = document.getElementById('trackingStatusPill');

    if (!isTrackingActive) {
        // Check browser Geolocation API support
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser.', 'danger');
            return;
        }

        const geoOptions = {
            enableHighAccuracy: true, // Use hardware GPS if available on phone
            timeout: 10000,           // 10 second timeout per position fix
            maximumAge: 0             // Do not use cached location
        };

        showToast('Requesting GPS permission from device...', 'info');

        // Start watching position
        watchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            handlePositionError,
            geoOptions
        );

        isTrackingActive = true;
        btn.textContent = 'Stop Location Sharing';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');

        if (statusPill) {
            statusPill.innerHTML = '<span class="pulse-dot"></span> GPS Active & Sharing';
        }

        showToast('GPS tracking started. Transmitting coordinates to server.', 'success');
    } else {
        // Stop watching position
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        isTrackingActive = false;
        btn.textContent = 'Start Location Sharing';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');

        if (statusPill) {
            statusPill.innerHTML = '<span class="pulse-dot danger"></span> Tracking Inactive';
        }

        showToast('Location sharing stopped.', 'info');
    }
}

/**
 * Callback when the browser's Geolocation API successfully resolves coordinates.
 */
function handlePositionSuccess(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    const speed = position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : '0.0';

    updateTelemetryHUD(lat, lng, accuracy, speed);
    updateDriverMapMarker(lat, lng);
    sendLocationToBackend(lat, lng, accuracy);
}

/**
 * Callback when Geolocation API fails (denied permission, timeout, GPS turned off).
 */
function handlePositionError(error) {
    let msg = 'Unknown location error.';
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg = 'GPS Permission Denied. Please enable location permissions in your browser settings.';
            break;
        case error.POSITION_UNAVAILABLE:
            msg = 'Location unavailable. Ensure device GPS / Location service is turned on.';
            break;
        case error.TIMEOUT:
            msg = 'Location request timed out. Retrying GPS fix...';
            break;
    }
    showToast(msg, 'danger');
}

/**
 * Sends the latitude, longitude, and accuracy to the Spring Boot REST API.
 */
async function sendLocationToBackend(latitude, longitude, accuracy) {
    const lastUpdatedEl = document.getElementById('hudLastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    }

    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (isStaticHost) return;

    try {
        const response = await fetch('/api/driver/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (lastUpdatedEl && data.lastUpdated) {
                lastUpdatedEl.textContent = data.lastUpdated;
            }
        }
    } catch (err) {
        console.warn('Backend sync unavailable (running in local demo mode):', err.message);
    }
}

/**
 * Updates driver availability state in backend (Available / Busy).
 */
async function updateDriverAvailability(isAvailable) {
    const statusText = document.getElementById('availabilityStatusText');
    if (statusText) {
        statusText.textContent = isAvailable ? 'Available for Rides' : 'Busy / Off-Duty';
        statusText.style.color = isAvailable ? 'var(--accent-emerald)' : 'var(--text-muted)';
    }

    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (isStaticHost) {
        showToast(isAvailable ? 'Driver status: Available for Rides (Demo Mode)' : 'Driver status: Busy / Off-Duty (Demo Mode)', isAvailable ? 'success' : 'info');
        return;
    }

    try {
        const response = await fetch(`/api/driver/availability?available=${isAvailable}`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            showToast(data.message, isAvailable ? 'success' : 'info');
        } else {
            showToast(`Status updated: ${isAvailable ? 'Available' : 'Busy'}`, isAvailable ? 'success' : 'info');
        }
    } catch (err) {
        showToast(`Status updated: ${isAvailable ? 'Available' : 'Busy'} (Demo)`, isAvailable ? 'success' : 'info');
    }
}

/**
 * Fetches the driver's current saved profile and status on page load.
 */
async function fetchCurrentDriverStatus() {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (isStaticHost) {
        const lastUpdatedEl = document.getElementById('hudLastUpdated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = 'Ready (GPS Telemetry Active)';
        }
        return;
    }

    try {
        const response = await fetch('/api/driver/status');
        if (!response.ok) return;

        const data = await response.json();
        const chkAvailability = document.getElementById('chkAvailability');
        const statusText = document.getElementById('availabilityStatusText');

        if (chkAvailability) {
            chkAvailability.checked = data.available;
        }

        if (statusText) {
            statusText.textContent = data.available ? 'Available for Rides' : 'Busy / Off-Duty';
            statusText.style.color = data.available ? 'var(--accent-emerald)' : 'var(--text-muted)';
        }

        if (data.latitude && data.longitude) {
            updateTelemetryHUD(data.latitude, data.longitude, data.accuracy, '0.0');
            updateDriverMapMarker(data.latitude, data.longitude);
            if (driverMap) {
                driverMap.setView([data.latitude, data.longitude], 15);
            }
        }
    } catch (err) {
        console.warn('Driver status fetch skipped:', err.message);
    }
}

/**
 * Updates telemetry HUD cards on driver screen.
 */
function updateTelemetryHUD(lat, lng, accuracy, speed) {
    const latEl = document.getElementById('hudLatitude');
    const lngEl = document.getElementById('hudLongitude');
    const accEl = document.getElementById('hudAccuracy');
    const spdEl = document.getElementById('hudSpeed');

    if (latEl) latEl.textContent = Number(lat).toFixed(6);
    if (lngEl) lngEl.textContent = Number(lng).toFixed(6);
    if (accEl) accEl.textContent = '±' + Math.round(accuracy) + ' m';
    if (spdEl) spdEl.textContent = speed + ' km/h';
}

/**
 * Moves the auto rickshaw marker on the driver's mini-map.
 */
function updateDriverMapMarker(lat, lng) {
    if (driverMarker) {
        driverMarker.setLatLng([lat, lng]);
    }
    if (driverMap) {
        driverMap.panTo([lat, lng]);
    }
}

/**
 * Simulated Drive Mode for College Mini-Project Viva & Demonstrations!
 * Moves the auto smoothly along an Indian city road so professors can observe
 * real-time movement and passenger radar discovery without stepping outside.
 */
function toggleSimulation() {
    const btn = document.getElementById('btnSimulateDrive');
    if (!simulationInterval) {
        let simLat = 9.9825;
        let simLng = 76.2820;
        let step = 0;

        btn.textContent = 'Stop Simulated Drive';
        btn.classList.add('btn-danger');

        showToast('Simulated driving mode activated (Moving through MG Road, Kochi)!', 'info');

        simulationInterval = setInterval(() => {
            step++;
            // Move northeast along MG road by ~25 meters per tick
            simLat += 0.00025 * Math.cos(step * 0.1);
            simLng += 0.00025 * Math.sin(step * 0.1);

            const simAccuracy = 8.5;
            const simSpeed = '24.5';

            updateTelemetryHUD(simLat, simLng, simAccuracy, simSpeed);
            updateDriverMapMarker(simLat, simLng);
            sendLocationToBackend(simLat, simLng, simAccuracy);
        }, 3000);
    } else {
        clearInterval(simulationInterval);
        simulationInterval = null;
        btn.textContent = 'Simulate Live Drive (Demo)';
        btn.classList.remove('btn-danger');
        showToast('Simulated driving stopped.', 'info');
    }
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const color = type === 'success' ? '#10b981' : (type === 'danger' ? '#f43f5e' : '#f59e0b');
    toast.style.cssText = `background:#1e293b;color:#f8fafc;padding:12px 18px;border-radius:10px;border-left:4px solid ${color};box-shadow:0 10px 25px rgba(0,0,0,0.5);font-size:0.9rem;transition:all 0.3s ease;`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
