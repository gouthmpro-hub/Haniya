package com.autotracking.service;

import com.autotracking.dto.RegisterRequest;
import com.autotracking.model.Driver;
import com.autotracking.model.Role;
import com.autotracking.model.User;
import com.autotracking.repository.DriverRepository;
import com.autotracking.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.autotracking.model.DriverLocation;
import com.autotracking.repository.DriverLocationRepository;
import com.autotracking.repository.DriverRepository;
import com.autotracking.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;

@Service
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final DriverRepository driverRepository;
    private final DriverLocationRepository locationRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       DriverRepository driverRepository,
                       DriverLocationRepository locationRepository,
                       @Lazy PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.driverRepository = driverRepository;
        this.locationRepository = locationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        String clean = identifier.trim().toLowerCase();
        User user = userRepository.findByPhone(clean)
                .or(() -> userRepository.findByEmail(clean))
                .orElseThrow(() -> new UsernameNotFoundException("No user found with phone or email: " + identifier));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }

    @Transactional
    public User registerUser(RegisterRequest request) {
        String phone = request.getPhone() != null ? request.getPhone().trim() : "";
        if (phone.isEmpty()) {
            throw new IllegalArgumentException("Mobile phone number is required.");
        }

        if (userRepository.existsByPhone(phone)) {
            throw new IllegalArgumentException("An account with mobile number " + phone + " already exists. Please log in.");
        }

        String internalEmail = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? request.getEmail().trim().toLowerCase()
                : (phone.replaceAll("[^0-9]", "") + "@autotrack.phone");

        if (userRepository.existsByEmail(internalEmail)) {
            internalEmail = "user_" + System.currentTimeMillis() + "@autotrack.phone";
        }

        String rawPassword = (request.getPassword() != null && !request.getPassword().trim().isEmpty())
                ? request.getPassword().trim()
                : "password123";

        // Create base user account
        User user = new User(
                request.getName().trim(),
                phone,
                internalEmail,
                passwordEncoder.encode(rawPassword),
                request.getRole()
        );

        User savedUser = userRepository.save(user);

        // If the registered role is DRIVER, create linked Driver profile
        if (request.getRole() == Role.DRIVER) {
            if (request.getAutoRegistrationNumber() == null || request.getAutoRegistrationNumber().trim().isEmpty()) {
                throw new IllegalArgumentException("Auto registration number is required for drivers.");
            }

            String regNumber = request.getAutoRegistrationNumber().trim().toUpperCase();
            if (driverRepository.existsByAutoRegistrationNumber(regNumber)) {
                throw new IllegalArgumentException("Auto registration number " + regNumber + " is already registered.");
            }

            Driver driver = new Driver(
                    savedUser,
                    phone,
                    regNumber,
                    true // Set available so driver is immediately ready upon signup
            );
            Driver savedDriver = driverRepository.save(driver);

            // Seed initial location from registration coordinates so driver is immediately discoverable
            double initialLat = (request.getLatitude() != null) ? request.getLatitude() : 9.9825;
            double initialLng = (request.getLongitude() != null) ? request.getLongitude() : 76.2820;
            DriverLocation initialLoc = new DriverLocation(savedDriver, initialLat, initialLng, 10.0);
            locationRepository.save(initialLoc);
        }

        return savedUser;
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .orElse(null);
    }

    public User findByPhone(String phone) {
        return userRepository.findByPhone(phone.trim())
                .orElse(null);
    }

    public User findByIdentifier(String identifier) {
        if (identifier == null) return null;
        String clean = identifier.trim().toLowerCase();
        return userRepository.findByPhone(clean)
                .or(() -> userRepository.findByEmail(clean))
                .orElse(null);
    }
}
