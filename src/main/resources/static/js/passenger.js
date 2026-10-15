/**
 * ===================================================================
 * GPS-Based Auto Tracking System - Passenger Dashboard Controller
 * Handles Leaflet interactive map, passenger GPS acquisition,
 * radius slider, nearby autos discovery, and WebSocket live updates.
 * ===================================================================
 */

let passengerMap = null;
let passengerMarker = null;
let radiusCircle = null;
let autoMarkersMap = new Map(); // driverId -> L.marker
let currentPassengerLat = 9.9825; // Default center (Kochi Marine Drive)
let currentPassengerLng = 76.2820;
let currentRadiusKm = 5.0;
let stompClient = null;
let pollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initPassengerUserProfile();
    initPassengerMap();
    setupPassengerControls();
    requestPassengerGPS();
    initWebSocket();
    startPollingFallback();
});

/**
 * Initializes the full-screen interactive Leaflet map.
 */
function initPassengerMap() {
    passengerMap = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([currentPassengerLat, currentPassengerLng], 14);

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

    const googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>'
    });

    // Default to Google Streets
    googleStreets.addTo(passengerMap);

    // Google Maps Layer Control Switcher
    const baseMaps = {
        "🗺️ Google Streets": googleStreets,
        "🛰️ Google Satellite": googleSatellite,
        "⛰️ Google Terrain": googleTerrain
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(passengerMap);

    // Passenger Marker (Blue pulsing radar dot)
    const passengerIcon = L.divIcon({
        className: 'custom-passenger-marker-wrapper',
        html: '<div class="custom-passenger-marker"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    passengerMarker = L.marker([currentPassengerLat, currentPassengerLng], {
        icon: passengerIcon,
        draggable: true
    }).addTo(passengerMap);

    passengerMarker.bindPopup('<strong>Your Location (Pickup Point)</strong><br><small>Drag to adjust pickup location</small>');

    // Drag pickup pin event
    passengerMarker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        setPassengerLocation(newPos.lat, newPos.lng, false);
    });

    // Click map to change pickup location
    passengerMap.on('click', (e) => {
        setPassengerLocation(e.latlng.lat, e.latlng.lng, false);
    });

    // Draw visual search radius circle
    drawRadiusCircle();

    // Load fast cached GPS position if available
    try {
        const cached = sessionStorage.getItem('autotrack_passenger_cached_loc');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.lat && parsed.lng) {
                setPassengerLocation(parsed.lat, parsed.lng, true, parsed.accuracy || 12);
            }
        }
    } catch(e) {}
}

let accuracyCircle = null;
const geocodeCache = new Map();
let geocodeDebounceTimer = null;

/**
 * Draws or updates the visual radius circle and GPS accuracy circle on the map.
 */
function drawRadiusCircle() {
    const radiusMeters = currentRadiusKm * 1000;
    if (radiusCircle) {
        radiusCircle.setLatLng([currentPassengerLat, currentPassengerLng]);
        radiusCircle.setRadius(radiusMeters);
    } else {
        radiusCircle = L.circle([currentPassengerLat, currentPassengerLng], {
            radius: radiusMeters,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '5, 5'
        }).addTo(passengerMap);
    }
}

/**
 * Updates or creates the accuracy ring around the passenger pin.
 */
function updateAccuracyRing(lat, lng, accuracyMeters) {
    if (!passengerMap) return;
    if (accuracyCircle) {
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracyMeters);
    } else {
        accuracyCircle = L.circle([lat, lng], {
            radius: accuracyMeters,
            color: '#06b6d4',
            fillColor: '#06b6d4',
            fillOpacity: 0.12,
            weight: 1
        }).addTo(passengerMap);
    }
}

/**
 * Sets up UI controls for radius slider, GPS refresh button, and destination search.
 */
function setupPassengerControls() {
    const radiusSlider = document.getElementById('radiusSlider');
    const radiusVal = document.getElementById('radiusValue');
    const btnLocateMe = document.getElementById('btnLocateMe');
    const destinationInput = document.getElementById('destinationInput');
    const btnSearchDest = document.getElementById('btnSearchDest');

    if (radiusSlider && radiusVal) {
        radiusSlider.addEventListener('input', (e) => {
            currentRadiusKm = parseFloat(e.target.value);
            radiusVal.textContent = currentRadiusKm.toFixed(1) + ' km';
            drawRadiusCircle();
            fetchNearbyAutos();
        });
    }

    if (btnLocateMe) {
        btnLocateMe.addEventListener('click', () => {
            requestPassengerGPS(true);
        });
    }

    if (btnSearchDest && destinationInput) {
        btnSearchDest.addEventListener('click', () => {
            const query = destinationInput.value.trim();
            if (query) {
                geocodeDestination(query);
            }
        });
        destinationInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = destinationInput.value.trim();
                if (query) geocodeDestination(query);
            }
        });
    }
}

/**
 * Requests the passenger's real smartphone/browser GPS coordinates with high accuracy.
 */
function requestPassengerGPS(userInitiated = false) {
    if (!navigator.geolocation) {
        if (userInitiated) showToast('Geolocation is not supported by your browser.', 'danger');
        fetchNearbyAutos();
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
    };

    if (userInitiated) {
        showToast('Acquiring high-accuracy GPS fix...', 'info');
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy || 8;

            try {
                sessionStorage.setItem('autotrack_passenger_cached_loc', JSON.stringify({ lat, lng, accuracy }));
            } catch(e) {}

            setPassengerLocation(lat, lng, true, accuracy);
            showToast(`GPS lock acquired! Precision: ±${Math.round(accuracy)}m`, 'success');
        },
        (error) => {
            console.warn('GPS location error:', error.message);
            if (userInitiated) {
                showToast('Unable to get device GPS. Using current pin position.', 'info');
            }
            fetchNearbyAutos();
        },
        options
    );
}

/**
 * Updates the passenger's pickup location, accuracy badge, address, and re-fetches nearby autos.
 */
function setPassengerLocation(lat, lng, panMap = true, accuracy = 10) {
    currentPassengerLat = lat;
    currentPassengerLng = lng;

    if (passengerMarker) {
        passengerMarker.setLatLng([lat, lng]);
    }

    updateAccuracyRing(lat, lng, accuracy);
    drawRadiusCircle();

    if (panMap && passengerMap) {
        passengerMap.setView([lat, lng], 14);
    }

    const coordDisplay = document.getElementById('pickupCoordinates');
    if (coordDisplay) {
        coordDisplay.textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }

    updateAccuracyBadge(accuracy);
    reverseGeocodeLocation(lat, lng);
    fetchNearbyAutos();
}

/**
 * Dynamically updates the GPS Accuracy Quality Pill.
 */
function updateAccuracyBadge(accuracy) {
    const badge = document.getElementById('gpsAccuracyBadge');
    if (!badge) return;
    if (accuracy <= 10) {
        badge.className = 'gps-quality-indicator gps-quality-high';
        badge.innerHTML = `🟢 High Precision GPS (±${Math.round(accuracy)}m)`;
    } else if (accuracy <= 25) {
        badge.className = 'gps-quality-indicator gps-quality-good';
        badge.innerHTML = `🟡 Good GPS Accuracy (±${Math.round(accuracy)}m)`;
    } else {
        badge.className = 'gps-quality-indicator gps-quality-poor';
        badge.innerHTML = `🟠 Cellular / Wi-Fi Fix (±${Math.round(accuracy)}m)`;
    }
}

/**
 * Reverse geocodes coordinates to display the exact street/landmark name efficiently.
 */
function reverseGeocodeLocation(lat, lng) {
    const addressEl = document.getElementById('pickupAddress');
    if (!addressEl) return;

    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (geocodeCache.has(cacheKey)) {
        addressEl.textContent = geocodeCache.get(cacheKey);
        return;
    }

    clearTimeout(geocodeDebounceTimer);
    geocodeDebounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.address) {
                    const addr = data.address;
                    const place = addr.suburb || addr.neighbourhood || addr.road || addr.village || addr.city_district || addr.city || 'Kochi';
                    const city = addr.city || addr.town || addr.state || 'Kerala';
                    const fullDesc = `${place}, ${city}`;
                    geocodeCache.set(cacheKey, fullDesc);
                    addressEl.textContent = fullDesc;
                    return;
                }
            }
        } catch(e) {}
        addressEl.textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }, 450);
}

/**
 * Initializes and dynamically displays the logged in passenger's real name.
 */
async function initPassengerUserProfile() {
    const nameEl = document.getElementById('passengerNameDisplay');
    if (!nameEl) return;

    // 1. Try fetching current user profile from Spring Boot Security session
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            if (data && data.authenticated && data.name) {
                nameEl.textContent = data.name;
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
            if (user && user.name) {
                nameEl.textContent = user.name;
                return;
            }
        }
    } catch (e) {
        console.warn('Error reading stored user:', e);
    }

    nameEl.textContent = 'Passenger';
}

/**
 * Fetches nearby available auto-rickshaws.
 * STRICT POLICY: Only signed-up drivers who are marked available are allowed on the map.
 * Zero mock or synthetic drivers are allowed.
 */
async function fetchNearbyAutos() {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         window.location.port !== '8080';

    if (!isStaticHost) {
        try {
            const url = `/api/passenger/nearby-autos?lat=${currentPassengerLat}&lng=${currentPassengerLng}&radius=${currentRadiusKm}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                renderNearbyAutos(data.autos || []);
                return;
            }
        } catch (err) {
            // Fall through to client-side registered driver fleet
        }
    }

    // Strictly query registered drivers from localStorage (NO fake mock drivers)
    let registeredDrivers = [];
    try {
        registeredDrivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
    } catch(err) {
        registeredDrivers = [];
    }

    // Filter strictly: must be available and within search radius
    const activeAutos = registeredDrivers
        .filter(driver => driver && driver.available === true && driver.latitude && driver.longitude)
        .map(driver => {
            const dist = calculateHaversineKm(currentPassengerLat, currentPassengerLng, driver.latitude, driver.longitude);
            return {
                driverId: driver.driverId || 1,
                driverName: driver.driverName,
                phone: driver.phone || 'N/A',
                autoRegistrationNumber: driver.autoRegistrationNumber,
                latitude: driver.latitude,
                longitude: driver.longitude,
                accuracy: driver.accuracy || 10.0,
                available: true,
                distanceKm: Number(dist.toFixed(2)),
                etaMinutes: Math.max(1, Math.round((dist / 25) * 60))
            };
        })
        .filter(a => a.distanceKm <= currentRadiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

    renderNearbyAutos(activeAutos);
}

/**
 * Renders auto-rickshaw markers on the Leaflet map and cards in the sidebar list.
 */
function renderNearbyAutos(autos) {
    const listContainer = document.getElementById('nearbyAutosList');
    const countBadge = document.getElementById('nearbyCountBadge');

    if (countBadge) {
        countBadge.textContent = `${autos.length} Available`;
    }

    // Keep track of active driver IDs from this response
    const activeDriverIds = new Set(autos.map(a => a.driverId));

    // Remove stale markers from the map that are no longer in range/available
    autoMarkersMap.forEach((marker, driverId) => {
        if (!activeDriverIds.has(driverId)) {
            passengerMap.removeLayer(marker);
            autoMarkersMap.delete(driverId);
        }
    });

    if (!listContainer) return;

    if (autos.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-dim);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛺</div>
                <h4 style="color: var(--text-muted); margin-bottom: 0.4rem;">No Registered Drivers Active Nearby</h4>
                <p style="font-size: 0.85rem; line-height: 1.5;">Strict policy: Only registered drivers manually added via the Admin Fleet Console appear on this map.</p>
            </div>
        `;
        return;
    }

    let listHtml = '';

    autos.forEach(auto => {
        // 1. Update or create Leaflet Map Marker
        updateOrCreateAutoMarker(auto);

        // 2. Build Sidebar Card HTML
        listHtml += `
            <div class="nearby-card" onclick="focusAutoMarker(${auto.driverId}, ${auto.latitude}, ${auto.longitude})" id="auto-card-${auto.driverId}">
                <div class="nearby-header">
                    <span class="driver-name">${escapeHtml(auto.driverName)}</span>
                    <span class="auto-badge">${escapeHtml(auto.autoRegistrationNumber)}</span>
                </div>
                <div class="nearby-meta">
                    <div class="meta-item">
                        <span>📍</span>
                        <strong>${auto.distanceKm} km away</strong>
                    </div>
                    <div class="meta-item">
                        <span>⏱️</span>
                        <strong>ETA ~${auto.etaMinutes} min</strong>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; font-size:0.8rem; color:var(--text-muted);">
                    <span>📞 <a href="tel:${auto.phone}" style="color:var(--accent-amber);">${escapeHtml(auto.phone)}</a></span>
                    <span style="color:var(--accent-emerald);">● Online</span>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = listHtml;
}

/**
 * Creates or updates an individual auto marker on the Leaflet map.
 */
function updateOrCreateAutoMarker(auto) {
    const autoIcon = L.divIcon({
        className: 'auto-marker-icon',
        html: `
            <div class="custom-auto-marker" title="${escapeHtml(auto.driverName)} (${auto.autoRegistrationNumber})">
                <svg viewBox="0 0 24 24">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    const popupContent = `
        <div style="padding: 6px; font-family: var(--font-body);">
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: #f59e0b; margin-bottom: 2px;">
                ${escapeHtml(auto.driverName)}
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 6px;">
                Auto: <strong style="color:#f8fafc;">${escapeHtml(auto.autoRegistrationNumber)}</strong>
            </div>
            <div style="display:flex; gap:12px; font-size:0.85rem; margin-bottom:6px;">
                <span>📍 <strong>${auto.distanceKm} km</strong></span>
                <span>⏱️ <strong>~${auto.etaMinutes} min ETA</strong></span>
            </div>
            <div style="font-size: 0.85rem;">
                📞 <a href="tel:${auto.phone}" style="color: #10b981; font-weight: 600;">${escapeHtml(auto.phone)}</a>
            </div>
        </div>
    `;

    if (autoMarkersMap.has(auto.driverId)) {
        // Smoothly update existing marker's position and popup
        const existingMarker = autoMarkersMap.get(auto.driverId);
        existingMarker.setLatLng([auto.latitude, auto.longitude]);
        existingMarker.setPopupContent(popupContent);
    } else {
        // Create new marker
        const marker = L.marker([auto.latitude, auto.longitude], { icon: autoIcon })
            .addTo(passengerMap)
            .bindPopup(popupContent);

        marker.on('click', () => {
            highlightSidebarCard(auto.driverId);
        });

        autoMarkersMap.set(auto.driverId, marker);
    }
}

/**
 * Focuses and animates map to the selected auto marker from the sidebar list.
 */
function focusAutoMarker(driverId, lat, lng) {
    if (passengerMap) {
        passengerMap.flyTo([lat, lng], 16, { duration: 1.2 });
    }
    const marker = autoMarkersMap.get(driverId);
    if (marker) {
        marker.openPopup();
    }
    highlightSidebarCard(driverId);
}

function highlightSidebarCard(driverId) {
    document.querySelectorAll('.nearby-card').forEach(card => card.classList.remove('selected'));
    const targetCard = document.getElementById(`auto-card-${driverId}`);
    if (targetCard) {
        targetCard.classList.add('selected');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Connects to Spring Boot STOMP WebSocket for real-time driver coordinates push.
 */
function initWebSocket() {
    const isStatic = window.location.hostname.includes('vercel.app') || 
                     window.location.hostname.includes('github.io') || 
                     (window.location.port !== '8080' && window.location.protocol.startsWith('http'));

    if (isStatic && !window.location.hostname.includes('localhost')) {
        console.log('Running on static host (Vercel) - WebSocket disabled, using dynamic simulated telemetry.');
        return;
    }

    try {
        const socket = new SockJS('/ws-auto-tracking');
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // Disable verbose console log

        stompClient.connect({}, (frame) => {
            // Subscribe to live driver updates channel
            stompClient.subscribe('/topic/driver-updates', (message) => {
                const update = JSON.parse(message.body);
                handleRealtimeDriverUpdate(update);
            });
        }, (error) => {
            console.warn('WebSocket connection failed, relying on periodic polling:', error);
        });
    } catch (err) {
        console.warn('WebSocket init error, fallback active:', err);
    }
}

/**
 * Handles incoming live WebSocket telemetry event.
 */
function handleRealtimeDriverUpdate(update) {
    // If the driver updated location and is available
    if (update.available && update.latitude && update.longitude) {
        // Calculate distance from current passenger position
        const dist = calculateHaversineKm(currentPassengerLat, currentPassengerLng, update.latitude, update.longitude);
        if (dist <= currentRadiusKm) {
            fetchNearbyAutos(); // Refresh list to recalculate exact ordering and ETA
        } else if (autoMarkersMap.has(update.driverId)) {
            // Driver moved outside passenger radius
            passengerMap.removeLayer(autoMarkersMap.get(update.driverId));
            autoMarkersMap.delete(update.driverId);
            fetchNearbyAutos();
        }
    } else {
        // Driver went offline or became unavailable: remove marker
        if (autoMarkersMap.has(update.driverId)) {
            passengerMap.removeLayer(autoMarkersMap.get(update.driverId));
            autoMarkersMap.delete(update.driverId);
            fetchNearbyAutos();
        }
    }
}

/**
 * Periodic Polling Fallback (every 5 seconds) to guarantee fresh data on cellular connections.
 */
function startPollingFallback() {
    pollTimer = setInterval(() => {
        fetchNearbyAutos();
    }, 5000);
}

/**
 * Client-side Haversine calculation helper.
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Destination Geocoding using OpenStreetMap Nominatim (Free, no billing needed!)
 */
async function geocodeDestination(query) {
    try {
        showToast('Searching for location...', 'info');
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        const results = await response.json();
        if (results && results.length > 0) {
            const dest = results[0];
            const destLat = parseFloat(dest.lat);
            const destLng = parseFloat(dest.lon);

            // Add destination marker on map
            const destIcon = L.divIcon({
                className: 'dest-marker',
                html: '<div style="font-size:2rem;">🏁</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });

            L.marker([destLat, destLng], { icon: destIcon })
                .addTo(passengerMap)
                .bindPopup(`<strong>Destination:</strong> ${escapeHtml(dest.display_name)}`)
                .openPopup();

            passengerMap.panTo([destLat, destLng]);
            showToast('Destination marked on map!', 'success');
        } else {
            showToast('Location not found. Try searching with city name.', 'danger');
        }
    } catch (err) {
        showToast('Error searching destination.', 'danger');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
