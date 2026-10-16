/**
 * Auto Rickshaw Live Tracking System - Main Application Controller
 * Handles Passenger GPS Acquisition, 4 Friend Drivers Search & Telemetry,
 * Real-Time Coordinate Polling, and Direct Call / WhatsApp Connect.
 */

let allDrivers = [];
let pollingTimer = null;
let currentSearchQuery = '';
let currentRadiusFilter = null; // null = all
let isSimulationRunning = true;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch system config & check API key
  fetchSystemConfig();

  // 2. Automatically acquire passenger GPS location on load
  acquirePassengerLocation();

  // 3. Load Google Maps script & initialize map
  loadGoogleMapsScript(() => {
    if (allDrivers.length > 0 && window.updateDriverMarkersOnMap) {
      window.updateDriverMarkersOnMap(allDrivers);
    }
  });

  // 4. Setup UI Event Listeners
  setupEventListeners();

  // 5. Start live moving polling
  startLiveCoordinatePolling();
});

/**
 * Fetch initial backend system configuration.
 */
async function fetchSystemConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      if (config.configuredApiKey && !localStorage.getItem('google_maps_api_key')) {
        localStorage.setItem('google_maps_api_key', config.configuredApiKey);
      }
    }
  } catch (err) {
    console.warn("Could not fetch server config:", err);
  }
}

/**
 * Fetches nearby drivers from the Spring Boot REST API.
 */
async function fetchDriversAndRefreshUI() {
  try {
    let url = `/api/drivers/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`;
    if (currentRadiusFilter) {
      url += `&radiusKm=${currentRadiusFilter}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch nearby drivers');

    const dtos = await res.json();
    allDrivers = dtos.map(item => ({
      ...item.driver,
      distanceKm: item.distanceKm,
      etaMinutes: item.etaMinutes
    }));
    window.allDrivers = allDrivers;

    // Update active driver count pill
    const countBadge = document.getElementById('driverCountBadge');
    if (countBadge) countBadge.textContent = allDrivers.length;

    // Filter by search query if applicable
    const filtered = allDrivers.filter(d => {
      if (!currentSearchQuery) return true;
      const q = currentSearchQuery.toLowerCase();
      return (d.name && d.name.toLowerCase().includes(q)) ||
             (d.autoNumber && d.autoNumber.toLowerCase().includes(q)) ||
             (d.standName && d.standName.toLowerCase().includes(q));
    });

    // Render Cards in sidebar
    renderDriversList(filtered);

    // Update markers on Google Map
    if (window.updateDriverMarkersOnMap) {
      window.updateDriverMarkersOnMap(allDrivers);
    }
  } catch (err) {
    console.error("Error fetching drivers:", err);
  }
}

/**
 * Periodically polls the server for live moving coordinates.
 */
function startLiveCoordinatePolling() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    fetchDriversAndRefreshUI();
  }, 2500);
}

/**
 * Renders the list of nearby auto-rickshaws in the left panel.
 */
function renderDriversList(drivers) {
  const container = document.getElementById('driversList');
  if (!container) return;

  if (drivers.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-dim);">
        <div style="font-size:36px; margin-bottom:10px;">🛺</div>
        <h4 style="color:var(--text-main); margin-bottom:6px;">No Autos Found</h4>
        <p style="font-size:0.85rem;">Click "Search 4 Friend Autos" above to cluster your friends near your location.</p>
        <button onclick="searchFourFriendAutos()" class="btn-pill primary" style="margin:16px auto 0;">
          🔍 Search Friend Autos
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = drivers.map(d => {
    const isAvail = d.isAvailable !== false;
    const statusClass = isAvail ? 'available' : 'busy';
    const statusDotClass = isAvail ? 'online' : 'busy';
    const statusText = isAvail ? 'Available' : 'On Ride';
    const phoneClean = (d.phone || '').replace(/[^0-9]/g, '');

    return `
      <div class="driver-card ${statusClass}" id="card-driver-${d.id}" onclick="focusDriverOnMap(${d.id})">
        <div class="driver-card-header">
          <div class="driver-avatar-box">
            <img src="${d.photoUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" 
                 class="driver-avatar" alt="${d.name}" />
            <span class="driver-status-dot ${statusDotClass}" title="${statusText}"></span>
          </div>

          <div class="driver-header-info">
            <div class="driver-name-row">
              <span class="driver-name">${d.name}</span>
            </div>
            <div class="driver-badge-row">
              <span class="auto-number-plate">${d.autoNumber}</span>
              <span class="fuel-badge ${d.fuelType ? d.fuelType.toLowerCase() : 'cng'}">${d.fuelType || 'CNG'}</span>
              <span class="rating-badge">★ ${d.rating ? d.rating.toFixed(1) : '4.9'}</span>
            </div>
          </div>
        </div>

        <div class="driver-card-body">
          <div class="info-metric">
            <span class="metric-label">Proximity</span>
            <span class="metric-value distance">${d.distanceKm ? d.distanceKm.toFixed(2) + ' km' : '0.45 km'}</span>
          </div>
          <div class="info-metric">
            <span class="metric-label">Est. Arrival</span>
            <span class="metric-value eta">~${d.etaMinutes || 2} min</span>
          </div>
          <div class="info-metric">
            <span class="metric-label">Auto Stand</span>
            <span class="metric-value">${d.standName || 'College Stand'}</span>
          </div>
          <div class="info-metric">
            <span class="metric-label">Fare Rate</span>
            <span class="metric-value fare">₹${d.farePerKm || 15}/km</span>
          </div>
        </div>

        <div class="driver-card-actions" onclick="event.stopPropagation()">
          <a href="tel:${d.phone}" class="btn-action btn-call" title="Call Driver Directly">
            📞 Call
          </a>
          <a href="https://wa.me/${phoneClean}" target="_blank" class="btn-action btn-whatsapp" title="WhatsApp Driver">
            💬 WhatsApp
          </a>
          <button onclick="focusDriverOnMap(${d.id})" class="btn-action btn-locate" title="Show on Google Map">
            🎯 Locate
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Configures all event listeners for the dashboard.
 */
function setupEventListeners() {
  // Search input filter
  const searchInput = document.getElementById('driverSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      fetchDriversAndRefreshUI();
    });
  }

  // Radius filter select
  const radiusSelect = document.getElementById('radiusFilterSelect');
  if (radiusSelect) {
    radiusSelect.addEventListener('change', (e) => {
      currentRadiusFilter = e.target.value ? parseFloat(e.target.value) : null;
      fetchDriversAndRefreshUI();
    });
  }

  // "Use My GPS" button
  const locateMeBtn = document.getElementById('btnLocateMe');
  if (locateMeBtn) {
    locateMeBtn.addEventListener('click', locateUserGPS);
  }

  // Hero "Search 4 Friend Autos Near Me" button
  const btnSearchAutos = document.getElementById('btnSearchAutos');
  if (btnSearchAutos) {
    btnSearchAutos.addEventListener('click', searchFourFriendAutos);
  }

  // Customize 4 Friends Modal Triggers
  const openFriendsBtn = document.getElementById('btnOpenFriendsModal');
  const closeFriendsBtn = document.getElementById('btnCloseFriendsModal');
  const friendsModal = document.getElementById('customizeFriendsModal');
  if (openFriendsBtn && friendsModal) {
    openFriendsBtn.addEventListener('click', openFriendsModal);
  }
  if (closeFriendsBtn && friendsModal) {
    closeFriendsBtn.addEventListener('click', () => {
      friendsModal.classList.remove('show');
    });
  }
  const friendsForm = document.getElementById('customizeFriendsForm');
  if (friendsForm) {
    friendsForm.addEventListener('submit', handleSaveFriendsProfiles);
  }

  // Toggle Live Simulation Button
  const toggleSimBtn = document.getElementById('btnToggleSim');
  if (toggleSimBtn) {
    toggleSimBtn.addEventListener('click', toggleSimulation);
  }

  // Speed selection pills
  document.querySelectorAll('.speed-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      document.querySelectorAll('.speed-tag').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const speed = parseFloat(e.target.dataset.speed);
      setSimulationSpeed(speed);
    });
  });

  // Reset to default 4 drivers button
  const resetBtn = document.getElementById('btnResetDefaults');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetDefaultDrivers);
  }

  // Quick Add Driver Modal Triggers
  const openAddModalBtn = document.getElementById('btnOpenAddModal');
  const closeAddModalBtn = document.getElementById('btnCloseAddModal');
  const addModalBackdrop = document.getElementById('addDriverModal');

  if (openAddModalBtn && addModalBackdrop) {
    openAddModalBtn.addEventListener('click', () => {
      addModalBackdrop.classList.add('show');
    });
  }

  if (closeAddModalBtn && addModalBackdrop) {
    closeAddModalBtn.addEventListener('click', () => {
      addModalBackdrop.classList.remove('show');
    });
  }

  // Quick Add Driver Form Submit
  const addDriverForm = document.getElementById('quickAddDriverForm');
  if (addDriverForm) {
    addDriverForm.addEventListener('submit', handleQuickAddDriver);
  }

  // Google Maps API Key Modal Triggers
  const openKeyModalBtn = document.getElementById('btnOpenKeyModal');
  const closeKeyModalBtn = document.getElementById('btnCloseKeyModal');
  const keyModalBackdrop = document.getElementById('apiKeyModal');

  if (openKeyModalBtn && keyModalBackdrop) {
    openKeyModalBtn.addEventListener('click', () => {
      const input = document.getElementById('googleMapsApiKeyInput');
      if (input) input.value = localStorage.getItem('google_maps_api_key') || '';
      keyModalBackdrop.classList.add('show');
    });
  }

  if (closeKeyModalBtn && keyModalBackdrop) {
    closeKeyModalBtn.addEventListener('click', () => {
      keyModalBackdrop.classList.remove('show');
    });
  }

  // Save API Key Form Submit
  const saveKeyForm = document.getElementById('apiKeyForm');
  if (saveKeyForm) {
    saveKeyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newKey = document.getElementById('googleMapsApiKeyInput').value.trim();
      localStorage.setItem('google_maps_api_key', newKey);
      showToast('Settings saved! Reloading map...', 'success');
      keyModalBackdrop.classList.remove('show');
      setTimeout(() => window.location.reload(), 800);
    });
  }
}

/**
 * Automatically fetches the passenger's current GPS location on page load.
 */
function acquirePassengerLocation() {
  const coordsEl = document.getElementById('userCoordsDisplay');
  if (coordsEl) coordsEl.textContent = 'Acquiring GPS location...';

  if (!navigator.geolocation) {
    if (coordsEl) coordsEl.textContent = `${userLocation.lat.toFixed(4)}° N, ${userLocation.lng.toFixed(4)}° E (Default)`;
    showToast('Browser GPS not supported. Defaulting to City Center.', 'info');
    fetchDriversAndRefreshUI();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (window.setUserLocation) {
        window.setUserLocation(lat, lng, false);
      } else {
        userLocation = { lat, lng };
      }
      if (coordsEl) {
        coordsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }
      showToast('📍 Passenger GPS location acquired successfully!', 'success');
      fetchDriversAndRefreshUI();
    },
    (err) => {
      console.warn("Auto GPS acquisition:", err.message);
      if (coordsEl) {
        coordsEl.textContent = `${userLocation.lat.toFixed(4)}° N, ${userLocation.lng.toFixed(4)}° E (Default)`;
      }
      fetchDriversAndRefreshUI();
    },
    { enableHighAccuracy: true, timeout: 6000 }
  );
}

/**
 * Manually triggered when clicking the 📍 locate button.
 */
function locateUserGPS() {
  const coordsEl = document.getElementById('userCoordsDisplay');
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'error');
    return;
  }

  showToast('Acquiring your current GPS location...', 'info');
  if (coordsEl) coordsEl.textContent = 'Updating GPS location...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation(lat, lng, true);
      if (coordsEl) {
        coordsEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
      }
      showToast('Pickup location updated to your GPS!', 'success');
    },
    (err) => {
      showToast('Could not acquire GPS: ' + err.message + '. You can click anywhere on Google Maps to set pickup point.', 'warning');
      if (coordsEl) {
        coordsEl.textContent = `${userLocation.lat.toFixed(4)}° N, ${userLocation.lng.toFixed(4)}° E`;
      }
    },
    { enableHighAccuracy: true, timeout: 7000 }
  );
}

/**
 * Helper to fetch passenger coordinates asynchronously.
 */
function getPassengerCoordinatesAsync() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ lat: userLocation.lat, lng: userLocation.lng });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: userLocation.lat, lng: userLocation.lng }),
      { enableHighAccuracy: true, timeout: 4000 }
    );
  });
}

/**
 * Passenger clicks "Search 4 Friend Autos Near Me":
 * 1. Shows scanning feedback.
 * 2. Takes passenger's live GPS coordinates.
 * 3. Clusters the 4 friend drivers around passenger and returns them.
 * 4. Renders 4 friend cards with live distance, ETA, and direct Call/WhatsApp actions.
 * 5. Automatically fits passenger and all 4 friend autos into Google Map view.
 */
async function searchFourFriendAutos() {
  const searchBtn = document.getElementById('btnSearchAutos');
  const originalHtml = searchBtn ? searchBtn.innerHTML : '';

  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<span>🔄</span><span>Locating My 4 Friend Autos...</span>`;
  }

  try {
    const coords = await getPassengerCoordinatesAsync();
    
    // Update map passenger marker
    if (window.setUserLocation) {
      window.setUserLocation(coords.lat, coords.lng, false);
    }
    const coordsEl = document.getElementById('userCoordsDisplay');
    if (coordsEl) {
      coordsEl.textContent = `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E`;
    }

    // Call backend endpoint to cluster 4 friends around passenger
    const res = await fetch('/api/drivers/search-nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: coords.lat,
        longitude: coords.lng,
        relocate: true
      })
    });

    if (!res.ok) throw new Error('Failed to search friend autos');

    const dtos = await res.json();
    allDrivers = dtos.map(item => ({
      ...item.driver,
      distanceKm: item.distanceKm,
      etaMinutes: item.etaMinutes
    }));
    window.allDrivers = allDrivers;

    // Update count badge
    const countBadge = document.getElementById('driverCountBadge');
    if (countBadge) countBadge.textContent = allDrivers.length;

    // Render 4 friend cards in sidebar
    renderDriversList(allDrivers);

    // Update markers on Google Map
    if (window.updateDriverMarkersOnMap) {
      window.updateDriverMarkersOnMap(allDrivers);
    }

    // Frame Google Map to display passenger and all 4 friend drivers
    setTimeout(() => {
      if (window.fitAllDriversOnMap) {
        window.fitAllDriversOnMap();
      }
    }, 250);

    showToast(`🛺 All 4 Friend Autos located! Live GPS tracking active.`, 'success');
  } catch (err) {
    console.error("Error searching friend autos:", err);
    showToast('Error finding friend autos: ' + err.message, 'error');
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = originalHtml || `<span>🔍</span><span>Search 4 Friend Autos Near Me</span>`;
    }
  }
}

/**
 * Opens modal allowing user to customize their 4 friends' names and phone numbers.
 */
async function openFriendsModal() {
  const modal = document.getElementById('customizeFriendsModal');
  const container = document.getElementById('friendsInputsContainer');
  if (!modal || !container) return;

  modal.classList.add('show');
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">Loading friend drivers...</div>';

  try {
    const res = await fetch('/api/drivers');
    let drivers = await res.json();
    if (!drivers || drivers.length === 0) {
      await fetch('/api/drivers/reset-defaults', { method: 'POST' });
      const res2 = await fetch('/api/drivers');
      drivers = await res2.json();
    }

    const friends = drivers.slice(0, 4);

    container.innerHTML = friends.map((f, i) => `
      <div class="friend-edit-card" style="background:var(--bg-glass-card); border:1px solid var(--border-subtle); border-radius:12px; padding:14px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:700; color:var(--primary); font-size:0.9rem;">
            👥 Friend #${i + 1} Driver Profile
          </span>
          <span class="auto-number-plate" style="font-size:0.75rem;">${f.autoNumber || 'KL-07-XX-0000'}</span>
        </div>
        <input type="hidden" name="friendId_${i}" value="${f.id}" />

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" style="font-size:0.75rem;">Friend's Name *</label>
            <input type="text" id="friendName_${i}" class="form-input" value="${f.name || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:0.75rem;">Phone Number (Call/WhatsApp) *</label>
            <input type="tel" id="friendPhone_${i}" class="form-input" value="${f.phone || ''}" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" style="font-size:0.75rem;">Auto Reg Number</label>
            <input type="text" id="friendAuto_${i}" class="form-input" value="${f.autoNumber || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:0.75rem;">Auto Model</label>
            <input type="text" id="friendModel_${i}" class="form-input" value="${f.autoModel || 'Bajaj RE Compact'}" />
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger); padding:20px;">Failed to load friends: ${err.message}</div>`;
  }
}

/**
 * Saves customized friend profiles back to Spring Boot.
 */
async function handleSaveFriendsProfiles(e) {
  e.preventDefault();
  const modal = document.getElementById('customizeFriendsModal');
  const updatedFriends = [];

  for (let i = 0; i < 4; i++) {
    const idInput = document.querySelector(`input[name="friendId_${i}"]`);
    const nameInput = document.getElementById(`friendName_${i}`);
    const phoneInput = document.getElementById(`friendPhone_${i}`);
    const autoInput = document.getElementById(`friendAuto_${i}`);
    const modelInput = document.getElementById(`friendModel_${i}`);

    if (idInput && nameInput && phoneInput) {
      updatedFriends.push({
        id: parseInt(idInput.value),
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        autoNumber: autoInput ? autoInput.value.trim() : '',
        autoModel: modelInput ? modelInput.value.trim() : 'Bajaj RE Compact'
      });
    }
  }

  try {
    const res = await fetch('/api/drivers/update-friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedFriends)
    });

    if (res.ok) {
      showToast('✅ 4 Friends profiles updated successfully!', 'success');
      if (modal) modal.classList.remove('show');
      await fetchDriversAndRefreshUI();
    } else {
      showToast('Failed to update friends profiles.', 'error');
    }
  } catch (err) {
    showToast('Network error while saving friends.', 'error');
  }
}

/**
 * Toggles live simulation on/off.
 */
async function toggleSimulation() {
  try {
    const res = await fetch('/api/simulation/toggle', { method: 'POST' });
    const data = await res.json();
    isSimulationRunning = data.active;
    const btn = document.getElementById('btnToggleSim');
    const badge = document.getElementById('simStatusBadge');

    if (btn) {
      btn.innerHTML = isSimulationRunning ? '⏸️ Pause Sim' : '▶️ Resume Sim';
    }
    if (badge) {
      badge.textContent = isSimulationRunning ? 'Simulation Live' : 'Simulation Paused';
      badge.style.borderColor = isSimulationRunning ? 'var(--success)' : 'var(--warning)';
      badge.style.color = isSimulationRunning ? 'var(--success)' : 'var(--warning)';
    }

    showToast(data.message, 'info');
  } catch (err) {
    showToast('Error toggling simulation', 'error');
  }
}

/**
 * Adjusts simulation speed.
 */
async function setSimulationSpeed(speed) {
  try {
    await fetch(`/api/simulation/speed?speed=${speed}`, { method: 'POST' });
    showToast(`Simulation speed set to ${speed}x`, 'info');
  } catch (err) {
    console.error(err);
  }
}

/**
 * Resets backend to default 4 friends.
 */
async function resetDefaultDrivers() {
  if (!confirm('Reset all drivers back to default 4 registered friends?')) return;
  try {
    const res = await fetch('/api/drivers/reset-defaults', { method: 'POST' });
    if (res.ok) {
      showToast('Reset to default 4 registered friends!', 'success');
      fetchDriversAndRefreshUI();
    }
  } catch (err) {
    showToast('Failed to reset drivers', 'error');
  }
}

/**
 * Handles Quick Add Driver form submission.
 */
async function handleQuickAddDriver(e) {
  e.preventDefault();

  const name = document.getElementById('addDriverName').value.trim();
  const phone = document.getElementById('addDriverPhone').value.trim();
  const autoNumber = document.getElementById('addDriverAutoNumber').value.trim();
  const autoModel = document.getElementById('addDriverModel').value.trim();
  const fuelType = document.getElementById('addDriverFuel').value;
  const standName = document.getElementById('addDriverStand').value.trim();
  const farePerKm = parseFloat(document.getElementById('addDriverFare').value) || 15.0;

  // Offset slightly from user location or center
  const lat = userLocation.lat + (Math.random() - 0.5) * 0.008;
  const lng = userLocation.lng + (Math.random() - 0.5) * 0.008;

  const newDriver = {
    name,
    phone,
    autoNumber,
    autoModel,
    fuelType,
    standName,
    latitude: lat,
    longitude: lng,
    heading: Math.random() * 360,
    farePerKm,
    baseFare: 30.0,
    rating: 4.8,
    isAvailable: true,
    isSimulating: true
  };

  try {
    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver)
    });

    if (res.ok) {
      const created = await res.json();
      showToast(`Auto ${created.autoNumber} successfully registered!`, 'success');
      document.getElementById('addDriverModal').classList.remove('show');
      document.getElementById('quickAddDriverForm').reset();
      
      // Instantly refresh list and focus on map
      await fetchDriversAndRefreshUI();
      focusDriverOnMap(created.id);
    } else {
      showToast('Failed to register driver. Auto number may already exist.', 'error');
    }
  } catch (err) {
    showToast('Network error while registering driver.', 'error');
  }
}

function resetRadiusFilter() {
  currentRadiusFilter = null;
  const sel = document.getElementById('radiusFilterSelect');
  if (sel) sel.value = '';
  fetchDriversAndRefreshUI();
}

/**
 * Shows modern toast notification.
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none; border:none; color:inherit; font-size:16px; cursor:pointer; line-height:1;">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slide-out 0.3s forwards ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global hooks
window.refreshNearbyDrivers = fetchDriversAndRefreshUI;
window.resetRadiusFilter = resetRadiusFilter;
window.showToast = showToast;
window.searchFourFriendAutos = searchFourFriendAutos;
window.openFriendsModal = openFriendsModal;
