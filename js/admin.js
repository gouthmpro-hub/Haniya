/**
 * ===================================================================
 * GPS-Based Auto Tracking System - Fleet & Driver Management Controller
 * Manages driver listings, real-time metrics, availability toggling,
 * and driver removal (deletion) from the portal.
 * ===================================================================
 */

let allDrivers = [];

document.addEventListener('DOMContentLoaded', () => {
    loadFleetData();

    const searchInput = document.getElementById('driverSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterDrivers(e.target.value);
        });
    }
});

/**
 * Fleet storage default for strictly registered drivers.
 */
function getDefaultDemoDrivers() {
    return [];
}

/**
 * Loads driver list and metrics from Spring Boot REST API (with localStorage fallback on Vercel).
 */
async function loadFleetData() {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         (window.location.port !== '8080' && window.location.protocol.startsWith('http'));

    if (!isStaticHost) {
        try {
            const [driversRes, statsRes] = await Promise.all([
                fetch('/api/admin/drivers'),
                fetch('/api/admin/drivers/stats')
            ]);

            if (driversRes.ok && statsRes.ok) {
                allDrivers = await driversRes.json();
                const stats = await statsRes.json();
                updateStatsHUD(stats.totalDrivers, stats.availableDrivers, stats.busyDrivers);
                renderDriversTable(allDrivers);
                return;
            }
        } catch (err) {
            console.warn('Backend API unavailable, falling back to local storage cache:', err.message);
        }
    }

    // Static mode for Vercel: strictly use registered drivers
    const stored = localStorage.getItem('autotrack_drivers');
    if (stored) {
        try {
            allDrivers = JSON.parse(stored);
        } catch (e) {
            allDrivers = [];
        }
    } else {
        allDrivers = [];
        localStorage.setItem('autotrack_drivers', JSON.stringify([]));
    }

    const total = allDrivers.length;
    const available = allDrivers.filter(d => d.available).length;
    const busy = total - available;

    updateStatsHUD(total, available, busy);
    renderDriversTable(allDrivers);
}

/**
 * Updates the 3 metric cards at the top of the dashboard.
 */
function updateStatsHUD(total, available, busy) {
    const totalEl = document.getElementById('statTotalDrivers');
    const availEl = document.getElementById('statAvailableDrivers');
    const busyEl = document.getElementById('statBusyDrivers');

    if (totalEl) totalEl.textContent = total;
    if (availEl) availEl.textContent = available;
    if (busyEl) busyEl.textContent = busy;
}

/**
 * Renders the driver table rows.
 */
function renderDriversTable(drivers) {
    const tbody = document.getElementById('driversTableBody');
    const countBadge = document.getElementById('tableCountBadge');

    if (countBadge) {
        countBadge.textContent = `${drivers.length} Driver${drivers.length === 1 ? '' : 's'}`;
    }

    if (!tbody) return;

    if (drivers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
                    <div style="font-size:2.5rem; margin-bottom:0.5rem;">🛺</div>
                    <h4>No registered drivers found</h4>
                    <p style="font-size:0.85rem; color:var(--text-dim);">New drivers who register will automatically appear in this fleet list.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = drivers.map(d => {
        const statusBadge = d.available
            ? `<span class="auto-badge" style="background:rgba(16,185,129,0.15); color:var(--accent-emerald); border-color:rgba(16,185,129,0.3);">● Available</span>`
            : `<span class="auto-badge" style="background:rgba(239,68,68,0.15); color:var(--accent-rose); border-color:rgba(239,68,68,0.3);">● Busy / Off-Duty</span>`;

        const coordsText = (d.latitude && d.longitude)
            ? `<span style="font-family:monospace; color:var(--accent-amber);">${d.latitude.toFixed(4)}°, ${d.longitude.toFixed(4)}°</span>`
            : `<span style="color:var(--text-dim);">No fix</span>`;

        return `
            <tr id="driver-row-${d.id}" style="border-bottom:1px solid var(--border-glass); transition:var(--transition);">
                <td style="padding:1.1rem 1rem;">
                    <div style="font-weight:600; font-size:1.02rem; color:var(--text-main);">${escapeHtml(d.name)}</div>
                    <div style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(d.email || 'N/A')}</div>
                </td>
                <td style="padding:1.1rem 1rem;">
                    <a href="tel:${escapeHtml(d.phone)}" style="color:var(--text-main); font-weight:500; text-decoration:none;">
                        📞 ${escapeHtml(d.phone)}
                    </a>
                </td>
                <td style="padding:1.1rem 1rem;">
                    <span class="auto-badge" style="font-size:0.88rem; font-weight:700; letter-spacing:0.04em;">
                        🛺 ${escapeHtml(d.autoRegistrationNumber)}
                    </span>
                </td>
                <td style="padding:1.1rem 1rem;">
                    ${statusBadge}
                </td>
                <td style="padding:1.1rem 1rem; font-size:0.85rem;">
                    <div>${coordsText}</div>
                    <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px;">Last ping: ${escapeHtml(d.lastUpdated || 'Recent')}</div>
                </td>
                <td style="padding:1.1rem 1rem; text-align:right;">
                    <div style="display:inline-flex; gap:0.5rem; align-items:center;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="toggleDriver(${d.id})" title="Toggle Available / Busy">
                            ${d.available ? 'Set Busy' : 'Set Available'}
                        </button>
                        <button type="button" class="btn btn-sm" onclick="confirmDeleteDriver(${d.id}, '${escapeHtml(d.name)}', '${escapeHtml(d.autoRegistrationNumber)}')" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#fca5a5;" title="Permanently remove driver">
                            🗑️ Remove
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Filter drivers by name or auto registration number.
 */
function filterDrivers(keyword) {
    const q = (keyword || '').toLowerCase().trim();
    if (!q) {
        renderDriversTable(allDrivers);
        return;
    }

    const filtered = allDrivers.filter(d => 
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.autoRegistrationNumber && d.autoRegistrationNumber.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.email && d.email.toLowerCase().includes(q))
    );

    renderDriversTable(filtered);
}

/**
 * Confirmation dialog before permanently removing a driver.
 */
function confirmDeleteDriver(driverId, driverName, autoNumber) {
    const confirmed = confirm(`Are you sure you want to remove driver:\n\n👤 ${driverName} (${autoNumber})\n\nThis will remove them from the tracking portal and delete their location pin.`);
    if (confirmed) {
        deleteDriver(driverId, driverName);
    }
}

/**
 * Deletes a driver via DELETE /api/admin/drivers/{id} (or localStorage on Vercel).
 */
async function deleteDriver(driverId, driverName) {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         (window.location.port !== '8080' && window.location.protocol.startsWith('http'));

    if (!isStaticHost) {
        try {
            const response = await fetch(`/api/admin/drivers/${driverId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                showToast(data.message || `Driver ${driverName} removed successfully!`, 'success');
                loadFleetData();
                return;
            } else {
                const err = await response.json();
                showToast(err.message || 'Failed to remove driver', 'danger');
            }
        } catch (e) {
            console.warn('Backend DELETE error, using client persistence:', e.message);
        }
    }

    // Static mode deletion: update in memory and localStorage
    allDrivers = allDrivers.filter(d => d.id !== driverId);
    localStorage.setItem('autotrack_drivers', JSON.stringify(allDrivers));

    const total = allDrivers.length;
    const available = allDrivers.filter(d => d.available).length;
    const busy = total - available;

    updateStatsHUD(total, available, busy);
    renderDriversTable(allDrivers);
    showToast(`Driver ${driverName} removed from portal successfully!`, 'success');
}

/**
 * Toggles a driver's availability state (Available / Busy).
 */
async function toggleDriver(driverId) {
    const isStaticHost = window.location.hostname.includes('vercel.app') || 
                         window.location.hostname.includes('github.io') || 
                         (window.location.port !== '8080' && window.location.protocol.startsWith('http'));

    if (!isStaticHost) {
        try {
            const response = await fetch(`/api/admin/drivers/${driverId}/toggle`, {
                method: 'POST'
            });

            if (response.ok) {
                showToast('Driver availability updated!', 'success');
                loadFleetData();
                return;
            }
        } catch (e) {
            console.warn('Backend toggle error:', e.message);
        }
    }

    // Static mode
    allDrivers = allDrivers.map(d => {
        if (d.id === driverId) {
            return { ...d, available: !d.available };
        }
        return d;
    });
    localStorage.setItem('autotrack_drivers', JSON.stringify(allDrivers));

    const total = allDrivers.length;
    const available = allDrivers.filter(d => d.available).length;
    const busy = total - available;

    updateStatsHUD(total, available, busy);
    renderDriversTable(allDrivers);
    showToast('Driver status toggled successfully!', 'info');
}

/**
 * Resets fleet demo data (convenience tool for class viva presentation).
 */
function resetFleetDemo() {
    if (confirm('Reset drivers list back to default demo drivers (Rajesh, Suresh, Ali)?')) {
        allDrivers = getDefaultDemoDrivers();
        localStorage.setItem('autotrack_drivers', JSON.stringify(allDrivers));
        const total = allDrivers.length;
        const available = allDrivers.filter(d => d.available).length;
        const busy = total - available;
        updateStatsHUD(total, available, busy);
        renderDriversTable(allDrivers);
        showToast('Fleet data reset to default demo accounts.', 'success');
    }
}

/**
 * Helper to escape HTML and prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
