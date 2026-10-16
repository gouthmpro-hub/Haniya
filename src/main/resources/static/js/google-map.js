/**
 * Auto Rickshaw Live Tracking System - Google Maps Engine
 * Powered by Leaflet + High-Resolution Google Maps Tile Layers
 * Provides 100% Free, Official Google Maps Road, Satellite, and Terrain visualization
 * with real-time GPS telemetry, animated auto-rickshaw markers, and passenger radar.
 */

let leafletMap = null;
let leafletUserMarker = null;
let leafletDriverMarkers = new Map();
let currentDriversList = [];
let userLocation = { lat: 10.0261, lng: 76.3125 };
let isMapReady = false;

// Custom Auto Rickshaw SVG Generator with heading rotation
function getAutoSvg(heading = 0, isAvailable = true) {
  const bodyColor = '#FBBF24'; // Vivid Auto Rickshaw Yellow
  const roofColor = '#1F2937'; // Dark Canopy
  const beaconColor = isAvailable ? '#10B981' : '#F59E0B';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54" width="46" height="46">
      <defs>
        <filter id="auto-shadow-${Math.round(heading)}" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.6"/>
        </filter>
      </defs>
      <g filter="url(#auto-shadow-${Math.round(heading)})" transform="rotate(${heading}, 27, 27)">
        <!-- Outer Rickshaw Body -->
        <rect x="14" y="8" width="26" height="38" rx="8" fill="${bodyColor}" stroke="#000" stroke-width="2"/>
        <!-- Dark Roof -->
        <path d="M16 16 Q27 12 38 16 L38 34 Q27 38 16 34 Z" fill="${roofColor}" stroke="#111" stroke-width="1.5"/>
        <!-- Front Windshield -->
        <path d="M18 10 Q27 7 36 10 L35 15 Q27 13 19 15 Z" fill="#93C5FD" opacity="0.95"/>
        <!-- Headlight / Front Handle -->
        <circle cx="27" cy="8" r="3" fill="#FFF" stroke="#000" stroke-width="1.2"/>
        <!-- Side Mirrors -->
        <rect x="11" y="11" width="3" height="4" rx="1" fill="#111"/>
        <rect x="40" y="11" width="3" height="4" rx="1" fill="#111"/>
        <!-- Wheels -->
        <rect x="12" y="32" width="3.5" height="10" rx="1.5" fill="#000"/>
        <rect x="38.5" y="32" width="3.5" height="10" rx="1.5" fill="#000"/>
        <!-- Rear Bumper -->
        <rect x="16" y="44" width="22" height="3" rx="1" fill="#DC2626"/>
        <!-- Availability Beacon Dot -->
        <circle cx="27" cy="25" r="4.5" fill="${beaconColor}" stroke="#FFF" stroke-width="1.5"/>
      </g>
    </svg>
  `;
}

/**
 * Initializes Google Maps via Leaflet with Official Google Maps Tile Layers.
 */
function initGoogleMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
    leafletDriverMarkers.clear();
  }

  // 1. Define Official Google Maps Tile Layers (Roadmap, Satellite Hybrid, Terrain)
  const googleStreets = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: 'Map data © Google'
  });

  const googleHybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: 'Imagery © Google'
  });

  const googleTerrain = L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: 'Map data © Google'
  });

  // 2. Initialize Leaflet Map
  leafletMap = L.map('map', {
    center: [userLocation.lat, userLocation.lng],
    zoom: 15,
    layers: [googleStreets],
    zoomControl: false
  });

  // 3. Add Controls: Zoom & Google Layer Switcher
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  const baseMaps = {
    "🗺️ Google Streets": googleStreets,
    "🛰️ Google Satellite": googleHybrid,
    "⛰️ Google Terrain": googleTerrain
  };
  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(leafletMap);

  // 4. Add Google Maps Brand Badge (Bottom-Left)
  const googleBrandControl = L.control({ position: 'bottomleft' });
  googleBrandControl.onAdd = function() {
    const div = L.DomUtil.create('div', 'google-map-brand-badge');
    div.innerHTML = `
      <div style="background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); padding:4px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(0,0,0,0.4); font-family:'Outfit',sans-serif;">
        <span style="font-weight:800; font-size:15px; letter-spacing:-0.5px;">
          <span style="color:#4285F4;">G</span><span style="color:#EA4335;">o</span><span style="color:#FBBC05;">o</span><span style="color:#4285F4;">g</span><span style="color:#34A853;">l</span><span style="color:#EA4335;">e</span>
        </span>
        <span style="font-size:11px; color:#94A3B8; font-weight:600;">Maps • Live Telemetry</span>
      </div>
    `;
    return div;
  };
  googleBrandControl.addTo(leafletMap);

  // 5. Create Passenger Pickup Marker
  createOrUpdateUserMarker(userLocation.lat, userLocation.lng);

  // 6. Click on map to relocate passenger
  leafletMap.on('click', (e) => {
    setUserLocation(e.latlng.lat, e.latlng.lng, true);
  });

  isMapReady = true;
  console.log("✅ Google Maps Engine initialized successfully with real Google tiles!");

  // If drivers already loaded, render them
  if (currentDriversList.length > 0) {
    updateDriverMarkersOnMap(currentDriversList);
  }
}

/**
 * Creates or updates the pulsing Passenger Pickup marker.
 */
function createOrUpdateUserMarker(lat, lng) {
  if (!leafletMap) return;

  const userHtml = `
    <div style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); pointer-events:none;">
      <div style="position:absolute; width:44px; height:44px; border-radius:50%; border:2.5px solid #3B82F6; animation:radar-wave 1.8s infinite ease-out; top:-11px; left:-11px;"></div>
      <div style="width:22px; height:22px; background:#2563EB; border:3px solid #FFFFFF; border-radius:50%; box-shadow:0 0 16px rgba(59,130,246,0.9); z-index:2;"></div>
      <div style="background:#0F172A; border:1.5px solid #3B82F6; color:#93C5FD; font-size:10.5px; font-weight:800; padding:2px 8px; border-radius:9999px; margin-top:4px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.6); z-index:3;">
        📍 You (Passenger)
      </div>
    </div>
  `;

  const userIcon = L.divIcon({
    className: 'custom-user-leaflet-icon',
    html: userHtml,
    iconSize: [0, 0]
  });

  if (!leafletUserMarker) {
    leafletUserMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000
    }).addTo(leafletMap);

    leafletUserMarker.bindPopup(`
      <div style="padding:6px; font-family:'Plus Jakarta Sans',sans-serif;">
        <h4 style="margin:0 0 4px 0; color:#60A5FA; font-size:14px; font-weight:700;">📍 Passenger Location</h4>
        <p style="margin:0; font-size:12px; color:#E2E8F0;">
          Coordinates: <strong>${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</strong><br/>
          <span style="color:#94A3B8; font-size:11px;">(Click anywhere on Google Maps to adjust pickup point)</span>
        </p>
      </div>
    `, { className: 'dark-driver-popup' });
  } else {
    leafletUserMarker.setLatLng([lat, lng]);
  }
}

/**
 * Sets the passenger location and refreshes distances.
 */
function setUserLocation(lat, lng, triggerRefresh = true) {
  userLocation = { lat, lng };
  createOrUpdateUserMarker(lat, lng);

  const coordsEl = document.getElementById('userCoordsDisplay');
  if (coordsEl) {
    coordsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  }

  if (triggerRefresh && window.refreshNearbyDrivers) {
    window.refreshNearbyDrivers();
  }
}

/**
 * Updates all 4 friend driver markers on the Google Map.
 */
function updateDriverMarkersOnMap(driversList) {
  currentDriversList = driversList || [];
  if (!leafletMap || !isMapReady) return;

  const currentIds = new Set();

  currentDriversList.forEach(driver => {
    currentIds.add(driver.id);
    const heading = driver.heading || 0;
    const isAvail = driver.isAvailable !== false;
    const autoSvg = getAutoSvg(heading, isAvail);

    const d = calculateDistanceKm(userLocation.lat, userLocation.lng, driver.latitude, driver.longitude);
    const eta = Math.max(1, Math.ceil((d / 25) * 60));

    const iconHtml = `
      <div class="auto-marker-container" style="position:relative; display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); cursor:pointer;">
        ${isAvail ? '<div style="position:absolute; width:52px; height:52px; border-radius:50%; border:2px solid #10B981; animation:radar-wave 2s infinite; top:-10px; left:-10px; pointer-events:none;"></div>' : ''}
        <div style="transition: transform 0.4s ease;">
          ${autoSvg}
        </div>
        <div style="background:rgba(15,23,42,0.95); border:1.5px solid #FBBF24; color:#FFF; font-size:11px; font-weight:800; padding:2px 8px; border-radius:9999px; margin-top:-4px; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); display:flex; align-items:center; gap:4px;">
          <span>🛺</span>
          <span>${driver.name ? driver.name.split(' ')[0] : 'Driver'}</span>
          <span style="color:#FBBF24;">(${driver.autoNumber})</span>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'custom-driver-leaflet-icon',
      html: iconHtml,
      iconSize: [0, 0]
    });

    const popupHtml = buildDriverPopupHtml(driver, d, eta);

    if (leafletDriverMarkers.has(driver.id)) {
      const marker = leafletDriverMarkers.get(driver.id);
      // Smoothly update position & icon
      marker.setLatLng([driver.latitude, driver.longitude]);
      marker.setIcon(customIcon);
      marker.setPopupContent(popupHtml);
    } else {
      const marker = L.marker([driver.latitude, driver.longitude], {
        icon: customIcon,
        zIndexOffset: 500
      });
      marker.bindPopup(popupHtml, { maxWidth: 300, minWidth: 260, className: 'dark-driver-popup' });
      marker.on('click', () => {
        focusDriverOnMap(driver.id);
      });
      marker.addTo(leafletMap);
      leafletDriverMarkers.set(driver.id, marker);
    }
  });

  // Remove markers no longer in list
  for (let [id, marker] of leafletDriverMarkers.entries()) {
    if (!currentIds.has(id)) {
      leafletMap.removeLayer(marker);
      leafletDriverMarkers.delete(id);
    }
  }
}

/**
 * Builds stylish Popup HTML for a Driver Marker.
 */
function buildDriverPopupHtml(driver, distanceKm, etaMinutes) {
  const photo = driver.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
  const cleanPhone = (driver.phone || '').replace(/[^0-9]/g, '');

  return `
    <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="${photo}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid #FBBF24;" />
        <div>
          <div style="display:flex; align-items:center; gap:4px;">
            <h4 style="margin:0; font-size:14px; font-weight:700; color:#F8FAFC;">${driver.name}</h4>
          </div>
          <span style="background:rgba(245,158,11,0.2); color:#FCD34D; border:1px solid rgba(245,158,11,0.5); padding:1px 6px; border-radius:4px; font-size:10.5px; font-weight:800;">
            ${driver.autoNumber}
          </span>
        </div>
      </div>

      <div style="font-size:11.5px; color:#CBD5E1; margin-bottom:10px; line-height:1.6; background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:6px;">
        <div>📍 <strong>Stand:</strong> ${driver.standName || 'College Main Stand'}</div>
        <div>🛺 <strong>Vehicle:</strong> ${driver.autoModel || 'Bajaj RE Compact'} (${driver.fuelType || 'CNG'})</div>
        <div>⭐ <strong>Rating:</strong> ${driver.rating ? driver.rating.toFixed(1) : '4.9'} / 5.0 (Friend Driver)</div>
        <div style="color:#FBBF24; font-weight:700; margin-top:2px;">
          ⏱️ ${distanceKm ? distanceKm.toFixed(2) : '0.45'} km away • ~${etaMinutes || 2} mins ETA
        </div>
      </div>

      <div style="display:flex; gap:8px;">
        <a href="tel:${driver.phone}" 
           style="flex:1; background:#10B981; color:#fff; text-align:center; padding:7px 8px; border-radius:6px; text-decoration:none; font-weight:700; font-size:12px; display:inline-block; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
          📞 Call
        </a>
        <a href="https://wa.me/${cleanPhone}" target="_blank"
           style="flex:1; background:#25D366; color:#fff; text-align:center; padding:7px 8px; border-radius:6px; text-decoration:none; font-weight:700; font-size:12px; display:inline-block; box-shadow:0 2px 6px rgba(37,211,102,0.3);">
          💬 WhatsApp
        </a>
      </div>
    </div>
  `;
}

/**
 * Focuses Google Map on a specific driver and opens their popup.
 */
function focusDriverOnMap(driverId) {
  const driver = window.allDrivers ? window.allDrivers.find(d => d.id === driverId) : null;
  if (!driver || !leafletMap) return;

  leafletMap.setView([driver.latitude, driver.longitude], 17, { animate: true, duration: 0.8 });

  if (leafletDriverMarkers.has(driverId)) {
    const marker = leafletDriverMarkers.get(driverId);
    setTimeout(() => {
      marker.openPopup();
    }, 400);
  }

  // Highlight card in sidebar
  document.querySelectorAll('.driver-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`card-driver-${driverId}`);
  if (card) {
    card.classList.add('selected');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Automatically frames the Google Map so the passenger and all 4 friend drivers are perfectly visible.
 */
function fitAllDriversOnMap() {
  if (!leafletMap) return;
  const drivers = window.allDrivers || currentDriversList || [];

  const points = [[userLocation.lat, userLocation.lng]];
  drivers.forEach(d => {
    if (d.latitude && d.longitude) {
      points.push([d.latitude, d.longitude]);
    }
  });

  if (points.length > 1) {
    const bounds = L.latLngBounds(points);
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  } else {
    leafletMap.setView([userLocation.lat, userLocation.lng], 15);
  }
}

/**
 * Mathematical Haversine distance formula.
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Map loader function.
 */
function loadGoogleMapsScript(callback) {
  // If Leaflet is loaded, initialize Google Map immediately
  if (typeof L !== 'undefined') {
    initGoogleMap();
    if (callback) callback();
  } else {
    // Retry in 100ms
    setTimeout(() => {
      initGoogleMap();
      if (callback) callback();
    }, 100);
  }
}

// Global hooks
window.focusDriverOnMap = focusDriverOnMap;
window.setUserLocation = setUserLocation;
window.updateDriverMarkersOnMap = updateDriverMarkersOnMap;
window.loadGoogleMapsScript = loadGoogleMapsScript;
window.fitAllDriversOnMap = fitAllDriversOnMap;
window.userLocation = userLocation;
