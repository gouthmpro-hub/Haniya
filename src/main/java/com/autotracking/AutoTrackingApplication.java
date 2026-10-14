package com.autotracking;

import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import com.autotracking.model.Role;
import com.autotracking.model.User;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import com.autotracking.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@SpringBootApplication
public class AutoTrackingApplication {

    public static void main(String[] args) {
        SpringApplication.run(AutoTrackingApplication.class, args);
    }

    /**
     * Seeds initial demo accounts and realistic auto positions if the database is empty.
     * This ensures the application works immediately for college presentations and testing!
     */
    @Bean
    public CommandLineRunner seedDemoData(UserRepository userRepository,
                                          DriverRepository driverRepository,
                                          DriverLocationRepository locationRepository,
                                          PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() == 0) {
                System.out.println("===> [GPS Auto Tracking] Database is empty. Seeding initial test accounts...");

                String defaultHash = passwordEncoder.encode("password123");

                // 1. Create Passenger Account
                User passenger = new User("Rahul Sharma", "passenger@autotrack.com", defaultHash, Role.PASSENGER);
                userRepository.save(passenger);

                // 2. Create Driver 1 (Rajesh Kumar - Available)
                User driverUser1 = new User("Rajesh Kumar", "rajesh@autotrack.com", defaultHash, Role.DRIVER);
                userRepository.save(driverUser1);
                Driver driver1 = new Driver(driverUser1, "+91 98471 23456", "KL-07-CD-4521", true);
                driverRepository.save(driver1);
                // Center coordinates near Marine Drive / MG Road, Kochi (9.9825° N, 76.2820° E)
                DriverLocation loc1 = new DriverLocation(driver1, 9.9825, 76.2820, 10.0);
                locationRepository.save(loc1);

                // 3. Create Driver 2 (Suresh Menon - Available)
                User driverUser2 = new User("Suresh Menon", "suresh@autotrack.com", defaultHash, Role.DRIVER);
                userRepository.save(driverUser2);
                Driver driver2 = new Driver(driverUser2, "+91 98472 34567", "KL-07-AB-8910", true);
                driverRepository.save(driver2);
                DriverLocation loc2 = new DriverLocation(driver2, 9.9790, 76.2855, 12.5);
                locationRepository.save(loc2);

                // 4. Create Driver 3 (Mohammed Ali - Unavailable/Off-Duty)
                User driverUser3 = new User("Mohammed Ali", "ali@autotrack.com", defaultHash, Role.DRIVER);
                userRepository.save(driverUser3);
                Driver driver3 = new Driver(driverUser3, "+91 98473 45678", "KL-07-EF-6324", false);
                driverRepository.save(driver3);
                DriverLocation loc3 = new DriverLocation(driver3, 9.9910, 76.2950, 15.0);
                locationRepository.save(loc3);

                System.out.println("===> [GPS Auto Tracking] Sample accounts successfully seeded!");
                System.out.println("     Passenger: passenger@autotrack.com | password123");
                System.out.println("     Driver 1 : rajesh@autotrack.com    | password123 (Available)");
                System.out.println("     Driver 2 : suresh@autotrack.com    | password123 (Available)");
                System.out.println("     Driver 3 : ali@autotrack.com       | password123 (Busy/Off-duty)");
            }
        };
    }
}
