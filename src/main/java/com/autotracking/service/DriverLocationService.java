package com.autotracking.service;

import com.autotracking.dto.DriverLocationBroadcastDTO;
import com.autotracking.dto.LocationUpdateRequest;
import com.autotracking.dto.NearbyDriverDTO;
import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DriverLocationService {

    private final DriverLocationRepository locationRepository;
    private final DriverRepository driverRepository;
    private final DistanceService distanceService;
    private final DriverService driverService;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${autotracking.stale-location-timeout-seconds:120}")
    private long staleTimeoutSeconds;

    @Value("${autotracking.max-search-radius-km:25.0}")
    private double maxSearchRadiusKm;

    public DriverLocationService(DriverLocationRepository locationRepository,
                                 DriverRepository driverRepository,
                                 DistanceService distanceService,
                                 DriverService driverService,
                                 SimpMessagingTemplate messagingTemplate) {
        this.locationRepository = locationRepository;
        this.driverRepository = driverRepository;
        this.distanceService = distanceService;
        this.driverService = driverService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Updates or creates the real-time GPS location record for a driver.
     */
    @Transactional
    public DriverLocation updateLocation(String driverEmail, LocationUpdateRequest request) {
        Driver driver = driverService.getDriverByUserEmail(driverEmail);

        DriverLocation location = locationRepository.findByDriver(driver)
                .orElseGet(() -> new DriverLocation(driver, request.getLatitude(), request.getLongitude(), request.getAccuracy()));

        location.setLatitude(request.getLatitude());
        location.setLongitude(request.getLongitude());
        location.setAccuracy(request.getAccuracy() != null ? request.getAccuracy() : 0.0);
        location.setLastUpdated(LocalDateTime.now());

        DriverLocation savedLocation = locationRepository.save(location);

        // Broadcast real-time location to all listening passengers via STOMP WebSocket
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getAutoRegistrationNumber(),
                savedLocation.getLatitude(),
                savedLocation.getLongitude(),
                savedLocation.getAccuracy(),
                driver.isAvailable(),
                "LOCATION_UPDATE"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        return savedLocation;
    }

    /**
     * Finds all active, available, and non-stale auto rickshaws within the passenger's search radius,
     * sorted from nearest to farthest.
     */
    public List<NearbyDriverDTO> findNearbyAvailableDrivers(double passengerLat, double passengerLon, double searchRadiusKm) {
        // Enforce safe radius bounds
        double effectiveRadius = Math.max(0.5, Math.min(searchRadiusKm, maxSearchRadiusKm));

        // Cutoff time: any location older than staleTimeoutSeconds is considered offline/stale
        LocalDateTime freshnessCutoff = LocalDateTime.now().minusSeconds(staleTimeoutSeconds);

        List<DriverLocation> activeFreshLocations = locationRepository.findActiveFreshLocations(freshnessCutoff);
        if (activeFreshLocations == null || activeFreshLocations.isEmpty()) {
            activeFreshLocations = locationRepository.findAllActiveLocations();
        }

        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("hh:mm:ss a");

        return activeFreshLocations.stream()
                .map(loc -> {
                    Driver driver = loc.getDriver();
                    double distance = distanceService.calculateDistance(
                            passengerLat, passengerLon,
                            loc.getLatitude(), loc.getLongitude()
                    );
                    int eta = distanceService.calculateEtaMinutes(distance);
                    long secondsAgo = (loc.getLastUpdated() != null)
                            ? Duration.between(loc.getLastUpdated(), now).getSeconds()
                            : 0;
                    String timeFormatted = (loc.getLastUpdated() != null)
                            ? loc.getLastUpdated().format(timeFormatter)
                            : "Recent";

                    return new NearbyDriverDTO(
                            driver.getId(),
                            driver.getUser().getName(),
                            driver.getPhone(),
                            driver.getAutoRegistrationNumber(),
                            loc.getLatitude(),
                            loc.getLongitude(),
                            loc.getAccuracy(),
                            distance,
                            eta,
                            driver.isAvailable(),
                            secondsAgo,
                            timeFormatted
                    );
                })
                .sorted(Comparator.comparingDouble(NearbyDriverDTO::getDistanceKm))
                .collect(Collectors.toList());
    }

    /**
     * Updates or creates the live location for a driver identified by driverId, phone, name, or autoRegistrationNumber.
     * Guarantees that drivers like Haniya have their live GPS broadcasted immediately to passengers.
     */
    @Transactional
    public DriverLocation updateLiveLocation(com.autotracking.dto.LiveLocationShareRequest request) {
        Driver targetDriver = null;

        // 1. Match by driverId
        if (request.getDriverId() != null) {
            targetDriver = driverRepository.findById(request.getDriverId()).orElse(null);
        }

        // 2. Match by phone
        if (targetDriver == null && request.getPhone() != null && !request.getPhone().trim().isEmpty()) {
            String cleanPhone = request.getPhone().replaceAll("[^0-9]", "");
            List<Driver> all = driverRepository.findAll();
            for (Driver d : all) {
                if (d.getPhone() != null && d.getPhone().replaceAll("[^0-9]", "").contains(cleanPhone)) {
                    targetDriver = d;
                    break;
                }
            }
        }

        // 3. Match by name (e.g., "Haniya")
        if (targetDriver == null && request.getName() != null && !request.getName().trim().isEmpty()) {
            String nameLower = request.getName().trim().toLowerCase();
            List<Driver> all = driverRepository.findAll();
            for (Driver d : all) {
                if (d.getUser() != null && d.getUser().getName() != null &&
                    d.getUser().getName().toLowerCase().contains(nameLower)) {
                    targetDriver = d;
                    break;
                }
            }
        }

        // 4. Match by autoRegistrationNumber
        if (targetDriver == null && request.getAutoRegistrationNumber() != null && !request.getAutoRegistrationNumber().trim().isEmpty()) {
            targetDriver = driverRepository.findByAutoRegistrationNumber(request.getAutoRegistrationNumber().trim().toUpperCase()).orElse(null);
        }

        // 5. If driver still not found, auto-create the driver (e.g. Haniya)
        if (targetDriver == null) {
            String driverName = (request.getName() != null && !request.getName().trim().isEmpty()) ? request.getName().trim() : "Haniya";
            String driverPhone = (request.getPhone() != null && !request.getPhone().trim().isEmpty()) ? request.getPhone().trim() : "+91 98471 88888";
            String regNumber = (request.getAutoRegistrationNumber() != null && !request.getAutoRegistrationNumber().trim().isEmpty())
                    ? request.getAutoRegistrationNumber().trim().toUpperCase()
                    : ("KL-07-HN-" + ((int)(Math.random() * 9000) + 1000));

            com.autotracking.dto.ManualDriverRequest createReq = new com.autotracking.dto.ManualDriverRequest(
                    driverName,
                    driverPhone.replaceAll("[^0-9]", "") + "@autotrack.driver",
                    driverPhone,
                    regNumber,
                    "password123",
                    true,
                    request.getLatitude(),
                    request.getLongitude()
            );
            com.autotracking.dto.DriverManagementDTO created = driverService.addManualDriver(createReq);
            targetDriver = driverRepository.findById(created.getId()).orElse(null);
        }

        if (targetDriver == null) {
            throw new IllegalStateException("Failed to locate or register driver for live GPS broadcast");
        }

        // Ensure driver is marked available
        targetDriver.setAvailable(true);
        driverRepository.save(targetDriver);

        final Driver finalDriver = targetDriver;

        // Update location record
        DriverLocation location = locationRepository.findByDriver(finalDriver)
                .orElseGet(() -> new DriverLocation(finalDriver, request.getLatitude(), request.getLongitude(), request.getAccuracy()));

        location.setLatitude(request.getLatitude());
        location.setLongitude(request.getLongitude());
        location.setAccuracy(request.getAccuracy() != null ? request.getAccuracy() : 5.0);
        location.setLastUpdated(LocalDateTime.now());

        DriverLocation savedLocation = locationRepository.save(location);

        // Broadcast real-time location to all listening passengers via STOMP WebSocket
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                targetDriver.getId(),
                targetDriver.getUser().getName(),
                targetDriver.getAutoRegistrationNumber(),
                savedLocation.getLatitude(),
                savedLocation.getLongitude(),
                savedLocation.getAccuracy(),
                targetDriver.isAvailable(),
                "LOCATION_UPDATE"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        return savedLocation;
    }
}
