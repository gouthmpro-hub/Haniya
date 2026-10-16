package com.autotracking.controller;

import com.autotracking.dto.DriverFleetStatsDTO;
import com.autotracking.dto.DriverManagementDTO;
import com.autotracking.dto.NearbyDriverDTO;
import com.autotracking.dto.RegisterRequest;
import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import com.autotracking.model.Role;
import com.autotracking.model.User;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import com.autotracking.service.DistanceService;
import com.autotracking.service.DriverLocationService;
import com.autotracking.service.DriverService;
import com.autotracking.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Public REST Controller for state-wide Kerala driver telemetry,
 * real-time registered driver counts, and multi-device driver registration.
 */
@RestController
@RequestMapping("/api/drivers")
@CrossOrigin(origins = "*")
public class PublicFleetController {

    private final DriverService driverService;
    private final DriverRepository driverRepository;
    private final DriverLocationRepository locationRepository;
    private final UserService userService;
    private final DistanceService distanceService;
    private final SimpMessagingTemplate messagingTemplate;

    public PublicFleetController(DriverService driverService,
                                 DriverRepository driverRepository,
                                 DriverLocationRepository locationRepository,
                                 UserService userService,
                                 DistanceService distanceService,
                                 SimpMessagingTemplate messagingTemplate) {
        this.driverService = driverService;
        this.driverRepository = driverRepository;
        this.locationRepository = locationRepository;
        this.userService = userService;
        this.distanceService = distanceService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Public endpoint to fetch total registered driver count across all Kerala.
     * Every person's phone fetches this to display the accurate driver count.
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getFleetStats() {
        DriverFleetStatsDTO stats = driverService.getFleetStats();
        long totalDrivers = driverRepository.count();

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("totalRegisteredDrivers", totalDrivers);
        res.put("totalDrivers", totalDrivers);
        res.put("availableDrivers", stats.getAvailableDrivers());
        res.put("busyDrivers", stats.getBusyDrivers());
        res.put("scope", "All Kerala");
        res.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("hh:mm:ss a")));

        return ResponseEntity.ok(res);
    }

    /**
     * Public endpoint to fetch ALL registered drivers across Kerala without radius restrictions.
     */
    @GetMapping("/all")
    public ResponseEntity<Map<String, Object>> getAllKeralaDrivers(
            @RequestParam(value = "lat", required = false) Double passengerLat,
            @RequestParam(value = "lng", required = false) Double passengerLon) {

        double refLat = (passengerLat != null) ? passengerLat : 9.9825;
        double refLng = (passengerLon != null) ? passengerLon : 76.2820;

        List<Driver> allDrivers = driverRepository.findAll();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("hh:mm a");

        List<Map<String, Object>> driverList = new ArrayList<>();

        for (Driver driver : allDrivers) {
            Optional<DriverLocation> locOpt = locationRepository.findByDriver(driver);
            double lat = locOpt.map(DriverLocation::getLatitude).orElse(9.9825);
            double lng = locOpt.map(DriverLocation::getLongitude).orElse(76.2820);
            double dist = distanceService.calculateDistance(refLat, refLng, lat, lng);
            int eta = distanceService.calculateEtaMinutes(dist);

            Map<String, Object> d = new HashMap<>();
            d.put("driverId", driver.getId());
            d.put("driverName", driver.getUser().getName());
            d.put("phone", driver.getPhone());
            d.put("autoRegistrationNumber", driver.getAutoRegistrationNumber());
            d.put("available", driver.isAvailable());
            d.put("latitude", lat);
            d.put("longitude", lng);
            d.put("distanceKm", Math.round(dist * 100.0) / 100.0);
            d.put("etaMinutes", eta);
            d.put("lastUpdated", locOpt.map(l -> l.getLastUpdated() != null ? l.getLastUpdated().format(timeFormatter) : "Recent").orElse("Recent"));

            driverList.add(d);
        }

        // Sort by distance from closest to farthest across all of Kerala
        driverList.sort(Comparator.comparingDouble(m -> (Double) m.get("distanceKm")));

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("count", driverList.size());
        res.put("totalRegisteredDrivers", driverList.size());
        res.put("scope", "All Kerala");
        res.put("drivers", driverList);

        return ResponseEntity.ok(res);
    }

    /**
     * Public registration endpoint: anyone on any mobile phone can register as a driver.
     * Stored immediately in the central backend database and broadcasted to all active phones.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerDriver(@RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            String phone = (String) body.get("phone");
            String autoNumber = (String) body.get("autoRegistrationNumber");
            String password = body.get("password") != null ? (String) body.get("password") : "password123";

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Driver name is required"));
            }
            if (phone == null || phone.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Phone number is required"));
            }
            if (autoNumber == null || autoNumber.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Auto registration number is required"));
            }

            double lat = 9.9825;
            double lng = 76.2820;
            if (body.get("latitude") != null) {
                lat = Double.parseDouble(body.get("latitude").toString());
            }
            if (body.get("longitude") != null) {
                lng = Double.parseDouble(body.get("longitude").toString());
            }

            RegisterRequest req = new RegisterRequest();
            req.setName(name.trim());
            req.setPhone(phone.trim());
            req.setAutoRegistrationNumber(autoNumber.trim().toUpperCase());
            req.setPassword(password);
            req.setRole(Role.DRIVER);

            User user = userService.registerUser(req);
            Driver driver = driverRepository.findByUser(user)
                    .orElseThrow(() -> new IllegalStateException("Driver profile creation failed"));

            // Set coordinates
            DriverLocation location = locationRepository.findByDriver(driver)
                    .orElseGet(() -> new DriverLocation(driver, 9.9825, 76.2820, 5.0));
            location.setLatitude(lat);
            location.setLongitude(lng);
            location.setLastUpdated(LocalDateTime.now());
            locationRepository.save(location);

            // Broadcast new driver and updated count to all connected phones via WebSocket
            long newTotalCount = driverRepository.count();
            messagingTemplate.convertAndSend("/topic/fleet-stats", Map.of(
                    "totalRegisteredDrivers", newTotalCount,
                    "event", "NEW_DRIVER_REGISTERED",
                    "driverName", driver.getUser().getName(),
                    "phone", driver.getPhone()
            ));

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Driver registered successfully in central backend!",
                    "driverId", driver.getId(),
                    "driverName", driver.getUser().getName(),
                    "phone", driver.getPhone(),
                    "autoRegistrationNumber", driver.getAutoRegistrationNumber(),
                    "totalRegisteredDrivers", newTotalCount,
                    "latitude", lat,
                    "longitude", lng
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "Registration error: " + e.getMessage()));
        }
    }
}
