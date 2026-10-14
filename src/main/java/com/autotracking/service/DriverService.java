package com.autotracking.service;

import com.autotracking.dto.DriverLocationBroadcastDTO;
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

import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Service
public class DriverService {

    private final DriverRepository driverRepository;
    private final DriverLocationRepository locationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public DriverService(DriverRepository driverRepository,
                         DriverLocationRepository locationRepository,
                         UserRepository userRepository,
                         SimpMessagingTemplate messagingTemplate) {
        this.driverRepository = driverRepository;
        this.locationRepository = locationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
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
}
