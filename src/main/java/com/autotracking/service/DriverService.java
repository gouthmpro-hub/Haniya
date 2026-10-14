package com.autotracking.service;

import com.autotracking.dto.DriverFleetStatsDTO;
import com.autotracking.dto.DriverLocationBroadcastDTO;
import com.autotracking.dto.DriverManagementDTO;
import com.autotracking.dto.DriverStatusDTO;
import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import com.autotracking.model.User;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import com.autotracking.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final DriverLocationRepository locationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    public DriverService(DriverRepository driverRepository,
                         DriverLocationRepository locationRepository,
                         UserRepository userRepository,
                         SimpMessagingTemplate messagingTemplate,
                         @org.springframework.context.annotation.Lazy org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        this.driverRepository = driverRepository;
        this.locationRepository = locationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    public Driver getDriverByUserEmail(String email) {
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));

        return driverRepository.findByUser(user)
                .orElseThrow(() -> new IllegalArgumentException("No driver profile associated with user: " + email));
    }

    public Optional<Driver> findDriverByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .flatMap(driverRepository::findByUser);
    }

    @Transactional
    public DriverStatusDTO updateAvailability(String email, boolean available) {
        Driver driver = getDriverByUserEmail(email);
        driver.setAvailable(available);
        driverRepository.save(driver);

        Optional<DriverLocation> locationOpt = locationRepository.findByDriver(driver);

        // Broadcast availability update to passengers via WebSocket
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getAutoRegistrationNumber(),
                locationOpt.map(DriverLocation::getLatitude).orElse(null),
                locationOpt.map(DriverLocation::getLongitude).orElse(null),
                locationOpt.map(DriverLocation::getAccuracy).orElse(0.0),
                driver.isAvailable(),
                available ? "AVAILABILITY_CHANGE" : "WENT_OFFLINE"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        return buildStatusDTO(driver, locationOpt.orElse(null), true);
    }

    public DriverStatusDTO getStatus(String email) {
        Driver driver = getDriverByUserEmail(email);
        Optional<DriverLocation> locationOpt = locationRepository.findByDriver(driver);
        return buildStatusDTO(driver, locationOpt.orElse(null), true);
    }

    public List<DriverManagementDTO> getAllDrivers() {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd hh:mm a");
        LocalDateTime activeCutoff = LocalDateTime.now().minusSeconds(120);

        return driverRepository.findAll().stream().map(driver -> {
            Optional<DriverLocation> locOpt = locationRepository.findByDriver(driver);
            String lastSeen = locOpt.map(loc -> loc.getLastUpdated() != null ? loc.getLastUpdated().format(formatter) : "Never").orElse("No coordinates recorded");
            boolean activeGps = locOpt.map(loc -> loc.getLastUpdated() != null && loc.getLastUpdated().isAfter(activeCutoff)).orElse(false);

            return new DriverManagementDTO(
                    driver.getId(),
                    driver.getUser().getName(),
                    driver.getUser().getEmail(),
                    driver.getPhone(),
                    driver.getAutoRegistrationNumber(),
                    driver.isAvailable(),
                    locOpt.map(DriverLocation::getLatitude).orElse(null),
                    locOpt.map(DriverLocation::getLongitude).orElse(null),
                    locOpt.map(DriverLocation::getAccuracy).orElse(null),
                    lastSeen,
                    activeGps
            );
        }).collect(Collectors.toList());
    }

    public DriverFleetStatsDTO getFleetStats() {
        List<Driver> all = driverRepository.findAll();
        long total = all.size();
        long available = all.stream().filter(Driver::isAvailable).count();
        long busy = total - available;
        LocalDateTime activeCutoff = LocalDateTime.now().minusSeconds(120);
        long activeGps = locationRepository.findAll().stream()
                .filter(loc -> loc.getLastUpdated() != null && loc.getLastUpdated().isAfter(activeCutoff))
                .count();

        return new DriverFleetStatsDTO(total, available, busy, activeGps);
    }

    @Transactional
    public void deleteDriver(Long driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with ID: " + driverId));

        // 1. Remove associated location record
        locationRepository.findByDriver(driver).ifPresent(locationRepository::delete);

        // 2. Broadcast removal via WebSocket to connected passengers so map pins disappear instantly
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getAutoRegistrationNumber(),
                null,
                null,
                0.0,
                false,
                "DRIVER_REMOVED"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        // 3. Delete Driver record
        User user = driver.getUser();
        driverRepository.delete(driver);

        // 4. Delete user account
        if (user != null) {
            userRepository.delete(user);
        }
    }

    @Transactional
    public DriverManagementDTO toggleDriverAvailability(Long driverId) {
        Driver driver = driverRepository.findById(driverId)
                .orElseThrow(() -> new IllegalArgumentException("Driver not found with ID: " + driverId));
        driver.setAvailable(!driver.isAvailable());
        driverRepository.save(driver);

        Optional<DriverLocation> locOpt = locationRepository.findByDriver(driver);

        // Broadcast to WebSocket
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getAutoRegistrationNumber(),
                locOpt.map(DriverLocation::getLatitude).orElse(null),
                locOpt.map(DriverLocation::getLongitude).orElse(null),
                locOpt.map(DriverLocation::getAccuracy).orElse(0.0),
                driver.isAvailable(),
                driver.isAvailable() ? "AVAILABILITY_CHANGE" : "WENT_OFFLINE"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd hh:mm a");
        String lastSeen = locOpt.map(loc -> loc.getLastUpdated() != null ? loc.getLastUpdated().format(formatter) : "Never").orElse("No coordinates recorded");
        boolean activeGps = locOpt.map(loc -> loc.getLastUpdated() != null && loc.getLastUpdated().isAfter(LocalDateTime.now().minusSeconds(120))).orElse(false);

        return new DriverManagementDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getUser().getEmail(),
                driver.getPhone(),
                driver.getAutoRegistrationNumber(),
                driver.isAvailable(),
                locOpt.map(DriverLocation::getLatitude).orElse(null),
                locOpt.map(DriverLocation::getLongitude).orElse(null),
                locOpt.map(DriverLocation::getAccuracy).orElse(null),
                lastSeen,
                activeGps
        );
    }

    private DriverStatusDTO buildStatusDTO(Driver driver, DriverLocation location, boolean locationSharingActive) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("hh:mm:ss a");
        String formattedTime = (location != null && location.getLastUpdated() != null)
                ? location.getLastUpdated().format(formatter)
                : "Not yet updated";

        return new DriverStatusDTO(
                driver.getId(),
                driver.getUser().getName(),
                driver.getPhone(),
                driver.getAutoRegistrationNumber(),
                driver.isAvailable(),
                location != null ? location.getLatitude() : null,
                location != null ? location.getLongitude() : null,
                location != null ? location.getAccuracy() : 0.0,
                formattedTime,
                locationSharingActive
        );
    }

    /**
     * Manually adds a driver with their name, contact, vehicle number, and encrypted password.
     */
    @Transactional
    public DriverManagementDTO addManualDriver(com.autotracking.dto.ManualDriverRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("User with email " + normalizedEmail + " already exists.");
        }

        String regNumber = request.getAutoRegistrationNumber().trim().toUpperCase();
        if (driverRepository.existsByAutoRegistrationNumber(regNumber)) {
            throw new IllegalArgumentException("Auto registration number " + regNumber + " is already registered.");
        }

        String rawPassword = (request.getPassword() != null && !request.getPassword().trim().isEmpty())
                ? request.getPassword().trim()
                : "password123";

        // 1. Create User with encrypted BCrypt password
        User user = new User(
                request.getName().trim(),
                normalizedEmail,
                passwordEncoder.encode(rawPassword),
                com.autotracking.model.Role.DRIVER
        );
        User savedUser = userRepository.save(user);

        // 2. Create Driver entity
        boolean isAvailable = request.getAvailable() != null ? request.getAvailable() : true;
        Driver driver = new Driver(
                savedUser,
                request.getPhone().trim(),
                regNumber,
                isAvailable
        );
        Driver savedDriver = driverRepository.save(driver);

        // 3. Create initial DriverLocation
        double lat = request.getLatitude() != null ? request.getLatitude() : 9.9825;
        double lng = request.getLongitude() != null ? request.getLongitude() : 76.2820;
        DriverLocation location = new DriverLocation(savedDriver, lat, lng, 10.0);
        location.setLastUpdated(LocalDateTime.now());
        locationRepository.save(location);

        // 4. Broadcast to passengers via WebSocket
        DriverLocationBroadcastDTO broadcast = new DriverLocationBroadcastDTO(
                savedDriver.getId(),
                savedDriver.getUser().getName(),
                savedDriver.getAutoRegistrationNumber(),
                lat,
                lng,
                10.0,
                savedDriver.isAvailable(),
                "DRIVER_ADDED"
        );
        messagingTemplate.convertAndSend("/topic/driver-updates", broadcast);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd hh:mm a");
        return new DriverManagementDTO(
                savedDriver.getId(),
                savedDriver.getUser().getName(),
                savedDriver.getUser().getEmail(),
                savedDriver.getPhone(),
                savedDriver.getAutoRegistrationNumber(),
                savedDriver.isAvailable(),
                lat,
                lng,
                10.0,
                location.getLastUpdated().format(formatter),
                true
        );
    }
}
