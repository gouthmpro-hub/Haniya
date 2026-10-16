/**
 * ===================================================================
 * GPS-Based Auto Tracking System - Driver Live GPS Broadcaster
 * Streams real-time smartphone hardware GPS to passengers via
 * WebSocket telemetry, REST API, and synchronized localStorage.
 * ===================================================================
 */

let watchId = null;
let isBroadcasting = null;
let broadcasterMap = null;
let driverMarker = null;
let accuracyCircle = null;
let pingsCount = 0;
let simulationInterval = null;
let wakeLock = null;
let stompClient = null;

let activeDriver = {
    name: 'Haniya',
    phone: '+91 98471 88888',
    autoRegistrationNumber: 'KL-07-HN-7777',
    latitude: 9.9880,
    longitude: 76.2760
};

// Simulation route coordinates through Kochi
const simWaypoints = [
    { lat: 9.9880, lng: 76.2760, speed: 22.5 },
    { lat: 9.9860, lng: 76.2780, speed: 24.0 },
    { lat: 9.9835, lng: 76.2805, speed: 26.5 },
    { lat: 9.9810, lng: 76.2830, speed: 28.0 },
    { lat: 9.9775, lng: 76.2855, speed: 25.0 },
    { lat: 9.9740, lng: 76.2870, speed: 21.0 },
    { lat: 9.9715, lng: 76.2870, speed: 18.0 },
    { lat: 9.9750, lng: 76.2890, speed: 24.0 },
    { lat: 9.9820, lng: 76.2860, speed: 27.0 },
    { lat: 9.9870, lng: 76.2800, speed: 22.0 }
];
let simIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    parseUrlParameters();
    initBroadcasterMap();
    await populateDriverDropdown();
    setupEventListeners();
    connectWebSocket();
    requestWakeLock();
    fetchShareFleetStats();
    setInterval(fetchShareFleetStats, 4000);
});

async function fetchShareFleetStats() {
    try {
        const res = await fetch('/api/drivers/stats');
        if (res.ok) {
            const data = await res.json();
            const count = data.totalRegisteredDrivers ?? data.count ?? 0;
            const el = document.getElementById('driverShareFleetCount');
            if (el) el.textContent = count;
        }
    } catch(e) {}
}

/**
 * Parses query params like ?name=Haniya&phone=9847123456
 */
function parseUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('name') && params.get('name').trim()) {
        activeDriver.name = params.get('name').trim();
    }
    if (params.has('phone') && params.get('phone').trim()) {
        activeDriver.phone = params.get('phone').trim();
    }
    if (params.has('auto') && params.get('auto').trim()) {
        activeDriver.autoRegistrationNumber = params.get('auto').trim().toUpperCase();
    }

    updateDriverProfileDisplay();
}

/**
 * Updates UI text displays with active driver profile
 */
function updateDriverProfileDisplay() {
    const nameEl = document.getElementById('displayDriverName');
    const phoneEl = document.getElementById('displayDriverPhone');
    const plateEl = document.getElementById('displayDriverPlate');
    const customPhoneInput = document.getElementById('customPhoneInput');

    if (nameEl) nameEl.textContent = activeDriver.name;
    if (phoneEl) phoneEl.textContent = activeDriver.phone;
    if (plateEl) plateEl.textContent = activeDriver.autoRegistrationNumber;
    if (customPhoneInput && !customPhoneInput.value) {
        customPhoneInput.value = activeDriver.phone;
    }
}

/**
 * Loads available drivers into dropdown
 */
async function populateDriverDropdown() {
    const select = document.getElementById('driverSelectDropdown');
    if (!select) return;

    let drivers = [];

    // Try fetching from backend API
    try {
        const res = await fetch('/api/admin/drivers');
        if (res.ok) {
            drivers = await res.json();
        }
    } catch(e) {}

    // Fallback to localStorage
    if (!drivers || drivers.length === 0) {
        try {
            drivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
        } catch(e) {}
    }

    // Ensure Haniya is in the list
    const hasHaniya = drivers.some(d => d.name && d.name.toLowerCase().includes('haniya'));
    if (!hasHaniya) {
        drivers.unshift({
            name: activeDriver.name,
            phone: activeDriver.phone,
            autoRegistrationNumber: activeDriver.autoRegistrationNumber
        });
    }

    select.innerHTML = drivers.map(d => {
        const isSelected = (d.name && d.name.toLowerCase() === activeDriver.name.toLowerCase()) ? 'selected' : '';
        return `<option value="${escapeHtml(d.name)}" data-phone="${escapeHtml(d.phone || '')}" data-plate="${escapeHtml(d.autoRegistrationNumber || '')}" ${isSelected}>
            ${escapeHtml(d.name)} (${escapeHtml(d.phone || 'No phone')})
        </option>`;
    }).join('');

    select.addEventListener('change', (e) => {
        const selectedOpt = select.options[select.selectedIndex];
        activeDriver.name = selectedOpt.value;
        if (selectedOpt.dataset.phone) activeDriver.phone = selectedOpt.dataset.phone;
        if (selectedOpt.dataset.plate) activeDriver.autoRegistrationNumber = selectedOpt.dataset.plate;

        const phoneInput = document.getElementById('customPhoneInput');
        if (phoneInput) phoneInput.value = activeDriver.phone;

        updateDriverProfileDisplay();
    });

    const phoneInput = document.getElementById('customPhoneInput');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            activeDriver.phone = e.target.value.trim();
            updateDriverProfileDisplay();
        });
    }
}

/**
 * Initializes Leaflet mini map
 */
function initBroadcasterMap() {
    const mapEl = document.getElementById('miniMap');
    if (!mapEl) return;

    broadcasterMap = L.map('miniMap', {
        zoomControl: true,
        attributionControl: false
    }).setView([activeDriver.latitude, activeDriver.longitude], 15);

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(broadcasterMap);

    const autoIcon = L.divIcon({
        className: 'custom-auto-marker-wrapper',
        html: `
            <div style="background:#10b981; border:3px solid #ffffff; width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 15px rgba(16,185,129,0.6); font-size:18px;">
                🛺
            </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
    });

    driverMarker = L.marker([activeDriver.latitude, activeDriver.longitude], { icon: autoIcon })
        .addTo(broadcasterMap)
        .bindPopup(`<strong>${escapeHtml(activeDriver.name)}</strong><br>GPS Broadcaster Active`);
}

/**
 * Sets up button event listeners
 */
function setupEventListeners() {
    const btnToggle = document.getElementById('btnToggleBroadcast');
    if (btnToggle) {
        btnToggle.addEventListener('click', toggleBroadcastSharing);
    }

    const btnSim = document.getElementById('btnToggleSimulation');
    if (btnSim) {
        btnSim.addEventListener('click', toggleDriveSimulation);
    }
}

/**
 * Toggles continuous real-world browser Geolocation streaming
 */
function toggleBroadcastSharing() {
    const btn = document.getElementById('btnToggleBroadcast');
    const pill = document.getElementById('livePill');

    if (!isBroadcasting) {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your mobile browser.');
            return;
        }

        // Start High Accuracy GPS Watcher
        watchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            handlePositionError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        isBroadcasting = true;
        btn.innerHTML = '<span>🛑</span> STOP SHARING LIVE LOCATION';
        btn.className = 'btn-live-toggle btn-stop-sharing';

        if (pill) {
            pill.className = 'status-pill live';
            pill.innerHTML = '<span class="pulse-dot"></span> BROADCASTING LIVE GPS';
        }
    } else {
        stopBroadcasting();
    }
}

function stopBroadcasting() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    isBroadcasting = false;
    const btn = document.getElementById('btnToggleBroadcast');
    const pill = document.getElementById('livePill');
    const btnSim = document.getElementById('btnToggleSimulation');

    if (btn) {
        btn.innerHTML = '<span>🟢</span> START SHARING MY LIVE GPS LOCATION';
        btn.className = 'btn-live-toggle btn-start-sharing';
    }

    if (btnSim) {
        btnSim.textContent = 'Start Simulated Drive';
        btnSim.classList.remove('btn-danger');
    }

    if (pill) {
        pill.className = 'status-pill offline';
        pill.innerHTML = '<span class="pulse-dot danger"></span> Offline / Not Sharing';
    }
}

/**
 * Handles incoming GPS fix from device
 */
function handlePositionSuccess(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy || 5;
    const speed = pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0
        ? (pos.coords.speed * 3.6).toFixed(1)
        : '0.0';

    activeDriver.latitude = lat;
    activeDriver.longitude = lng;

    updateHUD(lat, lng, accuracy, speed);
    updateMapMarker(lat, lng, accuracy);
    transmitLocation(lat, lng, accuracy, speed);
}

function handlePositionError(err) {
    console.warn('GPS position error:', err.message);
    const pill = document.getElementById('livePill');
    if (pill) {
        pill.innerHTML = `<span class="pulse-dot danger"></span> GPS Warning: ${err.message}`;
    }
}

/**
 * Updates UI HUD telemetry cards
 */
function updateHUD(lat, lng, accuracy, speed) {
    pingsCount++;
    const latEl = document.getElementById('hudLatitude');
    const lngEl = document.getElementById('hudLongitude');
    const accEl = document.getElementById('hudAccuracy');
    const spdEl = document.getElementById('hudSpeed');
    const pingsEl = document.getElementById('hudPings');
    const lastEl = document.getElementById('hudLastSeen');

    if (latEl) latEl.textContent = lat.toFixed(6) + '°';
    if (lngEl) lngEl.textContent = lng.toFixed(6) + '°';
    if (accEl) accEl.textContent = `±${Math.round(accuracy)}m`;
    if (spdEl) spdEl.textContent = `${speed} km/h`;
    if (pingsEl) pingsEl.textContent = pingsCount;
    if (lastEl) lastEl.textContent = new Date().toLocaleTimeString();
}

/**
 * Updates Leaflet marker on mini map
 */
function updateMapMarker(lat, lng, accuracy) {
    if (!broadcasterMap || !driverMarker) return;

    driverMarker.setLatLng([lat, lng]);
    broadcasterMap.panTo([lat, lng], { animate: true, duration: 0.8 });

    if (accuracyCircle) {
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    } else {
        accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(broadcasterMap);
    }
}

/**
 * Transmits live location to Spring Boot REST backend, WebSocket, and localStorage
 */
async function transmitLocation(latitude, longitude, accuracy, speed) {
    const payload = {
        name: activeDriver.name,
        phone: activeDriver.phone,
        autoRegistrationNumber: activeDriver.autoRegistrationNumber,
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        speed: parseFloat(speed) || 0.0
    };

    // 1. Update localStorage for 100% parity across tabs and static hosts
    try {
        let drivers = JSON.parse(localStorage.getItem('autotrack_drivers')) || [];
        const cleanPhone = activeDriver.phone.replace(/[^0-9]/g, '');
        let existing = drivers.find(d => 
            (d.phone && d.phone.replace(/[^0-9]/g, '') === cleanPhone) ||
            (d.name && d.name.toLowerCase() === activeDriver.name.toLowerCase()) ||
            (d.autoRegistrationNumber === activeDriver.autoRegistrationNumber)
        );

        if (existing) {
            existing.latitude = latitude;
            existing.longitude = longitude;
            existing.accuracy = accuracy;
            existing.available = true;
            existing.lastUpdated = new Date().toLocaleTimeString();
            existing.activeGps = true;
        } else {
            drivers.push({
                id: Date.now(),
                driverId: Date.now(),
                name: activeDriver.name,
                driverName: activeDriver.name,
                phone: activeDriver.phone,
                autoRegistrationNumber: activeDriver.autoRegistrationNumber,
                latitude: latitude,
                longitude: longitude,
                accuracy: accuracy,
                available: true,
                lastUpdated: new Date().toLocaleTimeString(),
                activeGps: true
            });
        }
        localStorage.setItem('autotrack_drivers', JSON.stringify(drivers));
    } catch(e) {}

    // 2. Post to Backend REST API
    try {
        await Promise.any([
            fetch('/api/driver/live-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }),
            fetch('/api/admin/drivers/update-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
        ]);
    } catch(err) {
        // Fallback gracefully to localStorage
    }

    // 3. Push to WebSocket if connected
    if (stompClient && stompClient.connected) {
        try {
            stompClient.send('/app/driver/location', {}, JSON.stringify(payload));
        } catch(e) {}
    }
}

/**
 * Simulated Drive Mode for indoor classroom demos
 */
function toggleDriveSimulation() {
    const btnSim = document.getElementById('btnToggleSimulation');
    const pill = document.getElementById('livePill');

    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        if (btnSim) {
            btnSim.textContent = 'Start Simulated Drive';
            btnSim.classList.remove('btn-danger');
        }
        if (!isBroadcasting && pill) {
            pill.className = 'status-pill offline';
            pill.innerHTML = '<span class="pulse-dot danger"></span> Offline / Not Sharing';
        }
        return;
    }

    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    isBroadcasting = true;
    if (btnSim) {
        btnSim.textContent = '🛑 Stop Simulation';
        btnSim.classList.add('btn-danger');
    }
    if (pill) {
        pill.className = 'status-pill live';
        pill.innerHTML = '<span class="pulse-dot"></span> SIMULATING LIVE DRIVE';
    }

    // Trigger initial waypoint immediately
    const wp = simWaypoints[simIndex];
    handlePositionSuccess({
        coords: {
            latitude: wp.lat,
            longitude: wp.lng,
            accuracy: 4,
            speed: wp.speed / 3.6
        }
    });

    simulationInterval = setInterval(() => {
        simIndex = (simIndex + 1) % simWaypoints.length;
        const curWp = simWaypoints[simIndex];
        // Introduce tiny smooth variance
        const jitterLat = curWp.lat + (Math.random() - 0.5) * 0.0002;
        const jitterLng = curWp.lng + (Math.random() - 0.5) * 0.0002;

        handlePositionSuccess({
            coords: {
                latitude: jitterLat,
                longitude: jitterLng,
                accuracy: 3.5,
                speed: curWp.speed / 3.6
            }
        });
    }, 2500);
}

/**
 * Connects to STOMP WebSocket
 */
function connectWebSocket() {
    try {
        const socket = new SockJS('/ws-auto-tracking');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({}, () => {
            console.log('Driver live telemetry WebSocket connected');
        }, () => {});
    } catch(e) {}
}

/**
 * Requests WakeLock API to keep phone screen awake
 */
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch(e) {}
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
