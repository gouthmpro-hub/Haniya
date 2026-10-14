package com.autotracking.controller;

import com.autotracking.dto.NearbyDriverDTO;
import com.autotracking.service.DriverLocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/passenger")
public class PassengerApiController {

    private final DriverLocationService driverLocationService;

    public PassengerApiController(DriverLocationService driverLocationService) {
        this.driverLocationService = driverLocationService;
    }

    /**
     * Search for available auto-rickshaws within the passenger's chosen radius.
     *
     * @param lat Passenger's current latitude
     * @param lng Passenger's current longitude
     * @param radius Search radius in kilometers (default 5.0 km)
     * @return List of nearby drivers sorted by distance
     */
    @GetMapping("/nearby-autos")
    public ResponseEntity<?> getNearbyAutos(
            @RequestParam("lat") Double lat,
            @RequestParam("lng") Double lng,
            @RequestParam(value = "radius", defaultValue = "5.0") Double radius) {

        if (lat == null || lat < -90.0 || lat > 90.0 || lng == null || lng < -180.0 || lng > 180.0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Invalid passenger coordinates provided."
            ));
        }

        List<NearbyDriverDTO> nearbyAutos = driverLocationService.findNearbyAvailableDrivers(lat, lng, radius);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("count", nearbyAutos.size());
        response.put("passengerLat", lat);
        response.put("passengerLng", lng);
        response.put("searchRadiusKm", radius);
        response.put("autos", nearbyAutos);

        return ResponseEntity.ok(response);
    }
}
