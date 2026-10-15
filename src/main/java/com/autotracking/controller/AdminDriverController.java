package com.autotracking.controller;

import com.autotracking.dto.DriverFleetStatsDTO;
import com.autotracking.dto.DriverManagementDTO;
import com.autotracking.service.DriverService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/drivers")
public class AdminDriverController {

    private final DriverService driverService;
    private final com.autotracking.service.DriverLocationService locationService;

    public AdminDriverController(DriverService driverService, com.autotracking.service.DriverLocationService locationService) {
        this.driverService = driverService;
        this.locationService = locationService;
    }

    /**
     * Returns all registered drivers in the system with their vehicle and live status details.
     */
    @GetMapping
    public ResponseEntity<List<DriverManagementDTO>> getAllDrivers() {
        return ResponseEntity.ok(driverService.getAllDrivers());
    }

    /**
     * Returns fleet metrics: total registered drivers, available drivers, and busy drivers.
     */
    @GetMapping("/stats")
    public ResponseEntity<DriverFleetStatsDTO> getFleetStats() {
        return ResponseEntity.ok(driverService.getFleetStats());
    }

    /**
     * Deletes / removes a driver from the portal and database.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteDriver(@PathVariable Long id) {
        Map<String, Object> response = new HashMap<>();
        try {
            driverService.deleteDriver(id);
            response.put("success", true);
            response.put("message", "Driver successfully removed from system.");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to remove driver: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Toggles driver availability state directly from the management console.
     */
    @PostMapping("/{id}/toggle")
    public ResponseEntity<DriverManagementDTO> toggleAvailability(@PathVariable Long id) {
        return ResponseEntity.ok(driverService.toggleDriverAvailability(id));
    }

    /**
     * Manually registers a new driver into the system with their name and vehicle details.
     */
    @PostMapping
    public ResponseEntity<?> addDriver(@jakarta.validation.Valid @RequestBody com.autotracking.dto.ManualDriverRequest request) {
        try {
            DriverManagementDTO createdDriver = driverService.addManualDriver(request);
            return ResponseEntity.ok(createdDriver);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to add driver: " + e.getMessage()
            ));
        }
    }

    /**
     * Endpoint to quickly update driver location from Admin Fleet Console or direct GPS sync.
     */
    @PostMapping("/update-location")
    public ResponseEntity<?> updateDriverLocationDirect(@jakarta.validation.Valid @RequestBody com.autotracking.dto.LiveLocationShareRequest request) {
        try {
            com.autotracking.model.DriverLocation savedLoc = locationService.updateLiveLocation(request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Driver location updated successfully",
                    "driverId", savedLoc.getDriver().getId(),
                    "driverName", savedLoc.getDriver().getUser().getName(),
                    "phone", savedLoc.getDriver().getPhone(),
                    "autoRegistrationNumber", savedLoc.getDriver().getAutoRegistrationNumber(),
                    "latitude", savedLoc.getLatitude(),
                    "longitude", savedLoc.getLongitude(),
                    "accuracy", savedLoc.getAccuracy(),
                    "lastUpdated", savedLoc.getLastUpdated().format(java.time.format.DateTimeFormatter.ofPattern("hh:mm:ss a"))
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to update driver location: " + e.getMessage()
            ));
        }
    }
}
