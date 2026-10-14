package com.autotracking.controller;

import com.autotracking.dto.DriverStatusDTO;
import com.autotracking.dto.LocationUpdateRequest;
import com.autotracking.model.DriverLocation;
import com.autotracking.service.DriverLocationService;
import com.autotracking.service.DriverService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/driver")
public class DriverApiController {

    private final DriverLocationService locationService;
    private final DriverService driverService;

    public DriverApiController(DriverLocationService locationService, DriverService driverService) {
        this.locationService = locationService;
        this.driverService = driverService;
    }

    /**
     * Endpoint for drivers to push their real-time GPS coordinates.
     */
    @PostMapping("/location")
    public ResponseEntity<?> updateLocation(
            @Valid @RequestBody LocationUpdateRequest request,
            Authentication authentication) {

        String driverEmail = authentication.getName();
        DriverLocation savedLocation = locationService.updateLocation(driverEmail, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Location updated successfully",
                "latitude", savedLocation.getLatitude(),
                "longitude", savedLocation.getLongitude(),
                "accuracy", savedLocation.getAccuracy(),
                "lastUpdated", savedLocation.getLastUpdated().format(DateTimeFormatter.ofPattern("hh:mm:ss a"))
        ));
    }

    /**
     * Endpoint for drivers to toggle their availability (available or busy).
     */
    @PostMapping("/availability")
    public ResponseEntity<?> updateAvailability(
            @RequestParam("available") boolean available,
            Authentication authentication) {

        String driverEmail = authentication.getName();
        DriverStatusDTO status = driverService.updateAvailability(driverEmail, available);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "available", status.isAvailable(),
                "message", available ? "You are now marked AVAILABLE to passengers." : "You are now marked UNAVAILABLE."
        ));
    }

    /**
     * Endpoint to fetch the current driver's profile and active telemetry status.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getDriverStatus(Authentication authentication) {
        String driverEmail = authentication.getName();
        DriverStatusDTO status = driverService.getStatus(driverEmail);
        return ResponseEntity.ok(status);
    }
}
