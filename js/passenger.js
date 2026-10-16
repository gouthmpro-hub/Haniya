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
let currentRadiusKm = 15.0;
let stompClient = null;
let pollTimer = null;
let activeRouteLine = null;
let currentAutosList = [];

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
        draggable: false
    }).addTo(passengerMap);

    passengerMarker.bindPopup('<strong>📍 Your Current Location</strong><br><small>Press "Show My Current Location" to update GPS</small>');

    // Fixed: Map clicking and pin dragging disabled so clicking the map does NOT change your location.
    // Location is calibrated exclusively via the "Show My Current Location" button.

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

    const handleLocateClick = () => {
        requestPassengerGPS(true);
    };

    if (btnLocateMe) {
        btnLocateMe.addEventListener('click', handleLocateClick);
    }

    const btnFloatingLocate = document.getElementById('btnFloatingLocate');
    if (btnFloatingLocate) {
        btnFloatingLocate.addEventListener('click', handleLocateClick);
    }

    const btnViewAllKerala = document.getElementById('btnViewAllKerala');
    if (btnViewAllKerala) {
        btnViewAllKerala.addEventListener('click', () => {
            zoomToFitAllKeralaDrivers();
        });
    }

    const btnFloatingKerala = document.getElementById('btnFloatingKerala');
    if (btnFloatingKerala) {
        btnFloatingKerala.addEventListener('click', () => {
            zoomToFitAllKeralaDrivers();
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
 * Centering on the blue pin occurs exclusively when this function is invoked.
 */
function requestPassengerGPS(userInitiated = false) {
    if (!navigator.geolocation) {
        if (userInitiated) {
            showToast('Geolocation is not supported by your browser.', 'danger');
            if (passengerMap) {
                passengerMap.setView([currentPassengerLat, currentPassengerLng], 15);
            }
        }
        fetchNearbyAutos();
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
    };

    if (userInitiated) {
        showToast('📍 Pinpointing your current GPS location...', 'info');
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
            if (userInitiated) {
                showToast(`📍 Found your location! Precision: ±${Math.round(accuracy)}m`, 'success');
            }
        },
        (error) => {
            console.warn('GPS location error:', error.message);
            if (userInitiated) {
                if (passengerMap) {
                    passengerMap.setView([currentPassengerLat, currentPassengerLng], 15);
                }
                showToast('Device GPS unavailable. Centered on current pickup point.', 'info');
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
 * Fetches real registered drivers across ALL of Kerala from central backend.
 * NO RADIUS LIMIT - Every registered auto across Kerala is shown to all users,
 * sorted from closest to farthest, with exact km difference and ETA.
 */
async function fetchNearbyAutos() {
    // 1. Refresh live Kerala fleet stats & counts across all UI elements
    fetchFleetStats();

    // 2. Query central backend public fleet endpoint for ALL Kerala drivers
    try {
        const url = `/api/drivers/all?lat=${currentPassengerLat}&lng=${currentPassengerLng}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data && data.drivers && Array.isArray(data.drivers)) {
                renderNearbyAutos(data.drivers);
                return;
            }
        }
    } catch (err) {
        console.warn('Central backend driver query failed, using local sync fallback:', err);
    }

    // 3. Fallback to client-side registered driver database
    let registeredDrivers = [];
    try {
        registeredDrivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
    } catch(err) {
        registeredDrivers = [];
    }

    // Include all registered drivers across Kerala without radius cutoff
    const activeAutos = registeredDrivers
        .filter(driver => driver && driver.available !== false && driver.latitude && driver.longitude)
        .map(driver => {
            const dist = calculateHaversineKm(currentPassengerLat, currentPassengerLng, driver.latitude, driver.longitude);
            return {
                driverId: driver.driverId || 1,
                driverName: driver.driverName,
                phone: driver.phone || 'N/A',
                autoRegistrationNumber: driver.autoRegistrationNumber,
                latitude: driver.latitude,
                longitude: driver.longitude,
                accuracy: driver.accuracy || 8.0,
                available: true,
                distanceKm: Number(dist.toFixed(2)),
                etaMinutes: Math.max(1, Math.round((dist / 25) * 60))
            };
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);

    renderNearbyAutos(activeAutos);
}

/**
 * Fetches central backend registered driver stats across all Kerala
 * and updates every driver count badge on the phone screen.
 */
async function fetchFleetStats() {
    try {
        const res = await fetch('/api/drivers/stats');
        if (res.ok) {
            const data = await res.json();
            const total = data.totalRegisteredDrivers ?? data.count ?? 0;
            updateFleetStatsDisplays(total);
            return;
        }
    } catch(e) {}

    // Fallback based on current autos length
    if (currentAutosList && currentAutosList.length > 0) {
        updateFleetStatsDisplays(currentAutosList.length);
    }
}

/**
 * Synchronizes driver count on all UI elements across the screen.
 */
function updateFleetStatsDisplays(count) {
    const navEl = document.getElementById('keralaTotalDriversCount');
    const sideEl = document.getElementById('sidebarTotalDrivers');
    const floatEl = document.getElementById('floatingDriverCount');
    const badgeEl = document.getElementById('nearbyCountBadge');

    if (navEl) navEl.textContent = count;
    if (sideEl) sideEl.textContent = count;
    if (floatEl) floatEl.textContent = count;
    if (badgeEl && (!currentAutosList || currentAutosList.length === 0)) {
        badgeEl.textContent = `${count} Registered in Kerala`;
    }
}

/**
 * Automatically fits map bounds to display all registered drivers across Kerala at once.
 */
function zoomToFitAllKeralaDrivers() {
    if (!passengerMap) return;
    const latLngs = [];

    // Current passenger location
    if (currentPassengerLat && currentPassengerLng) {
        latLngs.push([currentPassengerLat, currentPassengerLng]);
    }

    // All registered drivers across Kerala
    if (currentAutosList && currentAutosList.length > 0) {
        currentAutosList.forEach(a => {
            if (a.latitude && a.longitude) {
                latLngs.push([a.latitude, a.longitude]);
            }
        });
    }

    if (latLngs.length > 1) {
        const bounds = L.latLngBounds(latLngs);
        passengerMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        showToast(`🌴 Viewing all ${latLngs.length - 1} registered drivers across Kerala!`, 'info');
    } else if (latLngs.length === 1) {
        passengerMap.setView(latLngs[0], 14);
    }
}

/**
 * Renders auto-rickshaw markers on the Leaflet map and cards in the sidebar list.
 */
/**
 * Renders auto-rickshaw markers on the Leaflet map and cards in the sidebar list.
 * Automatically sorts by distance and calculates the exact kilometer difference
 * between each driver and the #1 closest driver to the passenger.
 */
function renderNearbyAutos(autos) {
    const listContainer = document.getElementById('nearbyAutosList');
    const countBadge = document.getElementById('nearbyCountBadge');

    // Strict proximity sorting: closest auto is always at index 0
    autos.sort((a, b) => Number(a.distanceKm) - Number(b.distanceKm));
    currentAutosList = autos;

    if (countBadge) {
        countBadge.textContent = `${autos.length} Active in Kerala`;
    }
    updateFleetStatsDisplays(autos.length);
    const nearestEl = document.getElementById('sidebarNearestDistance');
    if (nearestEl && autos.length > 0) {
        nearestEl.textContent = `${autos[0].distanceKm} km (${autos[0].driverName})`;
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
        if (activeRouteLine && passengerMap) {
            passengerMap.removeLayer(activeRouteLine);
            activeRouteLine = null;
        }
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-dim);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛺</div>
                <h4 style="color: var(--text-muted); margin-bottom: 0.4rem;">No Registered Drivers Active Nearby</h4>
                <p style="font-size: 0.85rem; line-height: 1.5;">Strict policy: Only registered drivers manually added via the Admin Fleet Console appear on this map.</p>
                <a href="/admin-dashboard.html" class="btn btn-outline btn-sm" style="margin-top:1rem; display:inline-flex; align-items:center; gap:0.4rem;">
                    ➕ Add Drivers in Fleet Manager
                </a>
            </div>
        `;
        return;
    }

    const nearestKm = Number(autos[0].distanceKm);

    let listHtml = '';

    autos.forEach((auto, index) => {
        const distKm = Number(auto.distanceKm);
        const diffKm = Number((distKm - nearestKm).toFixed(2));
        const isNearest = (index === 0);

        const distFormatted = distKm < 1.0
            ? `${Math.round(distKm * 1000)} meters (${distKm.toFixed(2)} km)`
            : `${distKm.toFixed(2)} km`;

        // 1. Update or create Leaflet Map Marker with proximity data
        updateOrCreateAutoMarker(auto, isNearest, diffKm, index);

        // 2. Build Sidebar Card HTML highlighting proximity and kilometer difference
        listHtml += `
            <div class="nearby-card ${isNearest ? 'nearest-card' : ''}" onclick="focusAutoMarker(${auto.driverId}, ${auto.latitude}, ${auto.longitude})" id="auto-card-${auto.driverId}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                    ${isNearest ? `
                        <span class="badge-nearest">🏆 NEAREST AUTO TO YOU</span>
                    ` : `
                        <span class="badge-rank">#${index + 1} • +${diffKm} km farther</span>
                    `}
                    <span class="auto-badge">${escapeHtml(auto.autoRegistrationNumber)}</span>
                </div>

                <div class="nearby-header">
                    <span class="driver-name">${escapeHtml(auto.driverName)}</span>
                    <span style="font-weight:700; color:${isNearest ? 'var(--accent-emerald)' : 'var(--accent-amber)'}; font-size:1.05rem;">
                        ${distFormatted}
                    </span>
                </div>

                <div class="nearby-meta" style="margin-top:0.35rem;">
                    <div class="meta-item">
                        <span>📍</span>
                        <span>Distance: <strong>${distFormatted}</strong></span>
                    </div>
                    <div class="meta-item">
                        <span>⏱️</span>
                        <span>ETA: <strong>~${auto.etaMinutes} min</strong></span>
                    </div>
                </div>

                ${isNearest ? `
                    <div class="km-difference-indicator nearest-indicator" style="margin-top:0.4rem;">
                        <span>⚡ Proximity Rank:</span>
                        <strong style="color:var(--accent-emerald);">Fastest pickup (~${auto.etaMinutes} min away)</strong>
                    </div>
                ` : `
                    <div class="km-difference-indicator" style="margin-top:0.4rem;">
                        <span>📏 Km Difference:</span>
                        <span><strong>+${diffKm} km</strong> farther than <em>${escapeHtml(autos[0].driverName)}</em></span>
                    </div>
                `}

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; font-size:0.8rem; color:var(--text-muted); border-top:1px solid rgba(255,255,255,0.06); padding-top:0.35rem;">
                    <span>📞 <a href="tel:${auto.phone}" style="color:var(--accent-amber); font-weight:600; text-decoration:none;">${escapeHtml(auto.phone)}</a></span>
                    <span style="color:var(--accent-emerald); font-weight:600;">● Available</span>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = listHtml;
}

/**
 * Creates or updates an individual auto marker on the Leaflet map with kilometer difference data.
 */
function updateOrCreateAutoMarker(auto, isNearest = false, diffKm = 0, index = 0) {
    const borderColor = isNearest ? '#10b981' : '#f59e0b';
    const badgeText = isNearest ? '🏆 #1 Nearest' : `#${index + 1} (+${diffKm} km)`;

    const autoIcon = L.divIcon({
        className: 'auto-marker-icon',
        html: `
            <div class="custom-auto-marker" style="border-color:${borderColor}; box-shadow:0 0 16px ${isNearest ? 'rgba(16,185,129,0.7)' : 'rgba(245,158,11,0.5)'};" title="${escapeHtml(auto.driverName)} (${auto.autoRegistrationNumber})">
                <svg viewBox="0 0 24 24" style="fill:${borderColor};">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    const popupContent = `
        <div style="padding: 6px; font-family: var(--font-body); min-width: 200px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="background:${isNearest ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color:${isNearest ? '#34d399' : '#fbbf24'}; font-size:0.75rem; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid ${isNearest ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'};">
                    ${badgeText}
                </span>
                <span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">${escapeHtml(auto.autoRegistrationNumber)}</span>
            </div>
            <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; color: ${isNearest ? '#34d399' : '#f59e0b'}; margin-bottom: 2px;">
                ${escapeHtml(auto.driverName)}
            </div>
            <div style="display:flex; gap:12px; font-size:0.88rem; margin:6px 0; color:#e2e8f0;">
                <span>📍 <strong>${auto.distanceKm} km away</strong></span>
                <span>⏱️ <strong>~${auto.etaMinutes} min ETA</strong></span>
            </div>
            ${!isNearest ? `
                <div style="font-size:0.8rem; color:#fbbf24; margin-bottom:6px; background:rgba(245,158,11,0.1); padding:3px 6px; border-radius:4px;">
                    📏 <strong>+${diffKm} km farther</strong> than closest auto
                </div>
            ` : `
                <div style="font-size:0.8rem; color:#34d399; margin-bottom:6px; background:rgba(16,185,129,0.1); padding:3px 6px; border-radius:4px;">
                    ⚡ <strong>Closest auto</strong> available right now
                </div>
            `}
            <div style="font-size: 0.85rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">
                📞 <a href="tel:${auto.phone}" style="color: #10b981; font-weight: 600;">${escapeHtml(auto.phone)}</a>
            </div>
        </div>
    `;

    if (autoMarkersMap.has(auto.driverId)) {
        const existingMarker = autoMarkersMap.get(auto.driverId);
        existingMarker.setLatLng([auto.latitude, auto.longitude]);
        existingMarker.setIcon(autoIcon);
        existingMarker.setPopupContent(popupContent);
    } else {
        const marker = L.marker([auto.latitude, auto.longitude], { icon: autoIcon })
            .addTo(passengerMap)
            .bindPopup(popupContent);

        marker.on('click', () => {
            focusAutoMarker(auto.driverId, auto.latitude, auto.longitude);
        });

        autoMarkersMap.set(auto.driverId, marker);
    }
}

/**
 * Focuses map, connects direct route line, and highlights sidebar card.
 */
function focusAutoMarker(driverId, lat, lng) {
    // 1. Remove previous route line
    if (activeRouteLine && passengerMap) {
        passengerMap.removeLayer(activeRouteLine);
        activeRouteLine = null;
    }

    const auto = currentAutosList.find(a => a.driverId === driverId);
    const nearestKm = currentAutosList.length > 0 ? Number(currentAutosList[0].distanceKm) : 0;

    if (auto && passengerMap) {
        const distKm = Number(auto.distanceKm);
        const diffKm = Number((distKm - nearestKm).toFixed(2));
        const isNearest = (auto.driverId === currentAutosList[0].driverId);

        // 2. Draw direct connection line showing exact distance
        const lineColor = isNearest ? '#10b981' : '#f59e0b';
        activeRouteLine = L.polyline([[currentPassengerLat, currentPassengerLng], [lat, lng]], {
            color: lineColor,
            weight: 3.5,
            opacity: 0.9,
            dashArray: '8, 8'
        }).addTo(passengerMap);

        const diffSnippet = (!isNearest && diffKm > 0) ? ` (+${diffKm} km farther)` : ' (🏆 Closest)';
        activeRouteLine.bindTooltip(`📏 ${distKm} km direct line${diffSnippet} • ETA ~${auto.etaMinutes} min`, {
            permanent: true,
            direction: 'center',
            className: 'distance-route-tooltip'
        }).openTooltip();

        // 3. Smoothly fit bounds to view both passenger and the auto
        passengerMap.fitBounds([[currentPassengerLat, currentPassengerLng], [lat, lng]], {
            padding: [70, 70],
            maxZoom: 16
        });
    } else if (passengerMap) {
        passengerMap.flyTo([lat, lng], 15, { duration: 1.0 });
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
    try {
        const socket = new SockJS('/ws-auto-tracking');
        stompClient = Stomp.over(socket);
        stompClient.debug = null; // Disable verbose console log

        stompClient.connect({}, (frame) => {
            // 1. Subscribe to live driver movement telemetry
            stompClient.subscribe('/topic/driver-updates', (message) => {
                try {
                    const update = JSON.parse(message.body);
                    handleRealtimeDriverUpdate(update);
                } catch(e) {}
            });

            // 2. Subscribe to central fleet registration events across all Kerala
            stompClient.subscribe('/topic/fleet-stats', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    const count = data.totalRegisteredDrivers;
                    updateFleetStatsDisplays(count);
                    showToast(`🛺 New driver registered (${data.driverName || 'Kerala Fleet'})! Total drivers: ${count}`, 'success');
                    fetchNearbyAutos();
                } catch(e) {}
            });
        }, (error) => {
            // Polling fallback guarantees updates even without WebSockets
        });
    } catch (err) {
        // Fallback active
    }
}

/**
 * Handles incoming live WebSocket telemetry event across all Kerala.
 */
function handleRealtimeDriverUpdate(update) {
    if (update.available && update.latitude && update.longitude) {
        fetchNearbyAutos(); // Refresh list to recalculate exact ordering and ETA
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
 * Periodic Polling Fallback (every 3.5 seconds) to guarantee fresh data across all mobile phones.
 */
function startPollingFallback() {
    pollTimer = setInterval(() => {
        fetchNearbyAutos();
    }, 3500);
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
