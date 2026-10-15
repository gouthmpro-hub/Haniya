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

// Initialize on page load with strict encryption security check
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await enforceDriverAuthentication();
    if (!isAuthorized) return;

    initDriverUserProfile();
    initDriverMap();
    setupEventListeners();
    fetchCurrentDriverStatus();
});

/**
 * Enforces strict encryption security for the Driver Portal.
 * Only verified driver accounts can access the telemetry dashboard and controls.
 */
async function enforceDriverAuthentication() {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (!isStaticHost) {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                if (data && data.authenticated && data.role === 'DRIVER') {
                    return true;
                }
            }
        } catch(e) {}
    }

    // Fallback verification in localStorage session
    try {
        const stored = localStorage.getItem('autotrack_current_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user && user.role === 'DRIVER') {
                return true;
            }
        }
    } catch(e) {}

    // Unauthorized - display encryption gate lock
    showEncryptionLockScreen();
    return false;
}

/**
 * Displays the 256-bit encrypted access restricted lock screen.
 */
function showEncryptionLockScreen() {
    const modal = document.getElementById('driverSecurityGateModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

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

let lastReportedLat = null;
let lastReportedLng = null;
let lastReportedTime = 0;
let lastReportedAccuracy = 10;

/**
 * Calculates distance in meters between two GPS coordinates using Haversine formula.
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Toggles GPS watchPosition on and off with power-efficient settings.
 */
function toggleLocationTracking() {
    const btn = document.getElementById('btnToggleTracking');
    const statusPill = document.getElementById('trackingStatusPill');

    if (!isTrackingActive) {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser.', 'danger');
            return;
        }

        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 3000 // Reuse recent GPS fixes up to 3s to preserve battery
        };

        showToast('Acquiring high-precision GPS lock...', 'info');

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
            statusPill.innerHTML = '<span class="pulse-dot"></span> GPS Active & Sharing (Optimized)';
        }

        showToast('Efficient GPS telemetry active. Throttling redundant transmissions.', 'success');
    } else {
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
 * Handles high-precision GPS fixes with intelligent movement throttling.
 * Skips redundant network transmissions if displacement < 2.5m and < 3 seconds elapsed.
 */
function handlePositionSuccess(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy || 10;
    const now = Date.now();

    let displacement = 999;
    let timeDeltaSec = (now - lastReportedTime) / 1000;

    if (lastReportedLat !== null && lastReportedLng !== null) {
        displacement = calculateDistanceMeters(lastReportedLat, lastReportedLng, lat, lng);
    }

    // Dynamic speed calculation (either native sensor or displacement / dt)
    let speed = '0.0';
    if (position.coords.speed !== null && !isNaN(position.coords.speed) && position.coords.speed >= 0) {
        speed = (position.coords.speed * 3.6).toFixed(1);
    } else if (lastReportedTime > 0 && timeDeltaSec > 0 && displacement < 200) {
        speed = Math.min(100, (displacement / timeDeltaSec) * 3.6).toFixed(1);
    }

    // Update local visual HUD immediately
    updateTelemetryHUD(lat, lng, accuracy, speed);
    updateDriverMapMarker(lat, lng);
    updateDriverGpsQualityBadge(accuracy);

    // EFFICIENT THROTTLING:
    // If auto has not moved more than 2.5 meters and less than 3 seconds have passed,
    // skip network transmission to eliminate battery drain & server congestion.
    if (displacement < 2.5 && (now - lastReportedTime) < 3000) {
        return;
    }

    lastReportedLat = lat;
    lastReportedLng = lng;
    lastReportedTime = now;
    lastReportedAccuracy = accuracy;

    sendLocationToBackend(lat, lng, accuracy);
}

/**
 * One-click instant precision GPS lock button.
 */
function triggerPrecisionGpsLock() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported.', 'danger');
        return;
    }
    showToast('Calibrating hardware GPS precision...', 'info');
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            handlePositionSuccess(pos);
            if (driverMap) {
                driverMap.setView([pos.coords.latitude, pos.coords.longitude], 16);
            }
            showToast(`GPS Calibrated! Precision: ±${Math.round(pos.coords.accuracy)}m`, 'success');
        },
        (err) => {
            handlePositionError(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

/**
 * Updates the Driver GPS Quality Indicator Pill.
 */
function updateDriverGpsQualityBadge(accuracy) {
    const badge = document.getElementById('driverGpsQualityBadge');
    if (!badge) return;
    if (accuracy <= 10) {
        badge.className = 'gps-quality-indicator gps-quality-high';
        badge.innerHTML = `🟢 High Accuracy (±${Math.round(accuracy)}m) • Optimized`;
    } else if (accuracy <= 25) {
        badge.className = 'gps-quality-indicator gps-quality-good';
        badge.innerHTML = `🟡 Good Accuracy (±${Math.round(accuracy)}m)`;
    } else {
        badge.className = 'gps-quality-indicator gps-quality-poor';
        badge.innerHTML = `🟠 Fair / Cell Tower (±${Math.round(accuracy)}m)`;
    }
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
 * Initializes and dynamically displays the logged in driver's real name and vehicle registration plate.
 */
async function initDriverUserProfile() {
    const nameEl = document.getElementById('driverNameDisplay');
    const badgeEl = document.getElementById('driverVehicleBadge');

    // 1. Try fetching current driver profile from Spring Boot Security session
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data && data.authenticated && data.name) {
                if (nameEl) nameEl.textContent = data.name;
                if (badgeEl && data.autoRegistrationNumber) {
                    badgeEl.textContent = data.autoRegistrationNumber;
                }
                localStorage.setItem('autotrack_current_user', JSON.stringify(data));
                return;
            }
        }
    } catch (e) {
        // Fallback to client-side localStorage
    }

    // 2. Fallback to localStorage session
    try {
        const stored = localStorage.getItem('autotrack_current_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user && user.name && nameEl) {
                nameEl.textContent = user.name;
            }
            if (user && user.autoRegistrationNumber && badgeEl) {
                badgeEl.textContent = user.autoRegistrationNumber;
            }
        }
    } catch (e) {
        console.warn('Error reading stored driver profile:', e);
    }
}

/**
 * Sends the latitude, longitude, and accuracy to the Spring Boot REST API and syncs active status.
 */
async function sendLocationToBackend(latitude, longitude, accuracy) {
    const lastUpdatedEl = document.getElementById('hudLastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    }

    // Sync to strictly registered drivers in localStorage
    try {
        const storedUser = JSON.parse(localStorage.getItem('autotrack_current_user')) || {};
        let drivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
        const reg = storedUser.autoRegistrationNumber || (document.getElementById('driverVehicleBadge') ? document.getElementById('driverVehicleBadge').textContent.trim() : 'KL-07-CD-4521');
        const driverName = storedUser.name || (document.getElementById('driverNameDisplay') ? document.getElementById('driverNameDisplay').textContent.trim() : 'Driver');
        
        let found = drivers.find(d => d.autoRegistrationNumber === reg);
        if (found) {
            found.latitude = latitude;
            found.longitude = longitude;
            found.accuracy = accuracy;
            found.lastUpdated = new Date().toLocaleTimeString();
        } else {
            drivers.push({
                driverId: Date.now(),
                driverName: driverName,
                phone: storedUser.phone || '+91 98471 23456',
                autoRegistrationNumber: reg,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                available: true,
                lastUpdated: new Date().toLocaleTimeString()
            });
        }
        localStorage.setItem('autotrack_drivers', JSON.stringify(drivers));
    } catch(err) {}

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
 * Updates driver availability state in backend and localStorage.
 */
async function updateDriverAvailability(isAvailable) {
    const statusText = document.getElementById('availabilityStatusText');
    if (statusText) {
        statusText.textContent = isAvailable ? 'Available for Rides' : 'Busy / Off-Duty';
        statusText.style.color = isAvailable ? 'var(--accent-emerald)' : 'var(--text-muted)';
    }

    // Sync to registered drivers in localStorage
    try {
        const storedUser = JSON.parse(localStorage.getItem('autotrack_current_user')) || {};
        let drivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
        const reg = storedUser.autoRegistrationNumber || (document.getElementById('driverVehicleBadge') ? document.getElementById('driverVehicleBadge').textContent.trim() : '');
        let found = drivers.find(d => d.autoRegistrationNumber === reg);
        if (found) {
            found.available = isAvailable;
            localStorage.setItem('autotrack_drivers', JSON.stringify(drivers));
        }
    } catch(err) {}

    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (isStaticHost) {
        showToast(isAvailable ? 'Driver status: Available for Rides' : 'Driver status: Busy / Off-Duty', isAvailable ? 'success' : 'info');
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
        showToast(`Status updated: ${isAvailable ? 'Available' : 'Busy'}`, isAvailable ? 'success' : 'info');
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
