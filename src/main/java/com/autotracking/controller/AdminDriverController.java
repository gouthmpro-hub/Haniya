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

    public AdminDriverController(DriverService driverService) {
        this.driverService = driverService;
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
}
