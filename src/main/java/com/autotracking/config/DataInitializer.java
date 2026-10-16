package com.autotracking.config;

import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import com.autotracking.model.Role;
import com.autotracking.model.User;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import com.autotracking.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Seeds initial registered auto rickshaw drivers across Kerala
 * so all connected mobile phones immediately see active registered drivers on startup.
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final DriverRepository driverRepository;
    private final DriverLocationRepository locationRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository,
                           DriverRepository driverRepository,
                           DriverLocationRepository locationRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.driverRepository = driverRepository;
        this.locationRepository = locationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (driverRepository.count() > 0) {
            log.info("Central database already contains {} registered drivers across Kerala.", driverRepository.count());
            return;
        }

        log.info("Initializing central database with registered Kerala auto rickshaw drivers...");

        // 1. Driver Haniya (Kochi Marine Drive / Menaka)
        seedDriver("Haniya", "+91 98471 88888", "KL-07-HN-7777", 9.9880, 76.2760);

        // 2. Driver Rahul Sharma (Ernakulam South Railway Station Stand)
        seedDriver("Rahul Sharma", "+91 98470 11111", "KL-07-AB-1234", 9.9680, 76.2890);

        // 3. Driver Suresh Kumar (Thrissur Swaraj Round Stand)
        seedDriver("Suresh Kumar", "+91 98472 22222", "KL-08-SK-5678", 10.5276, 76.2144);

        // 4. Driver Biju Kozhikode (Kozhikode Beach / Railway Stand)
        seedDriver("Biju Kozhikode", "+91 98473 33333", "KL-11-BJ-9012", 11.2588, 75.7804);

        log.info("Successfully seeded {} Kerala auto rickshaw drivers in central backend database.", driverRepository.count());
    }

    private void seedDriver(String name, String phone, String autoNumber, double lat, double lng) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        String email = cleanPhone + "@autotrack.phone";

        if (userRepository.findByPhone(phone).isPresent() || userRepository.findByEmail(email).isPresent()) {
            return;
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
        user.setPasswordHash(passwordEncoder.encode("password123"));
        user.setRole(Role.DRIVER);
        User savedUser = userRepository.save(user);

        Driver driver = new Driver();
        driver.setUser(savedUser);
        driver.setPhone(phone);
        driver.setAutoRegistrationNumber(autoNumber);
        driver.setAvailable(true);
        Driver savedDriver = driverRepository.save(driver);

        DriverLocation location = new DriverLocation();
        location.setDriver(savedDriver);
        location.setLatitude(lat);
        location.setLongitude(lng);
        location.setAccuracy(8.0);
        location.setLastUpdated(LocalDateTime.now());
        locationRepository.save(location);
    }
}
