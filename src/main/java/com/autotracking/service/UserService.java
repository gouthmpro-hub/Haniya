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
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("No user found with email: " + email));

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );
    }

    @Transactional
    public User registerUser(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("An account with email " + normalizedEmail + " already exists.");
        }

        // Create base user account
        User user = new User(
                request.getName().trim(),
                normalizedEmail,
                passwordEncoder.encode(request.getPassword()),
                request.getRole()
        );

        User savedUser = userRepository.save(user);

        // If the registered role is DRIVER, create linked Driver profile
        if (request.getRole() == Role.DRIVER) {
            if (request.getPhone() == null || request.getPhone().trim().isEmpty()) {
                throw new IllegalArgumentException("Phone number is required for auto drivers.");
            }
            if (request.getAutoRegistrationNumber() == null || request.getAutoRegistrationNumber().trim().isEmpty()) {
                throw new IllegalArgumentException("Auto registration number is required.");
            }

            String regNumber = request.getAutoRegistrationNumber().trim().toUpperCase();
            if (driverRepository.existsByAutoRegistrationNumber(regNumber)) {
                throw new IllegalArgumentException("Auto registration number " + regNumber + " is already registered.");
            }

            Driver driver = new Driver(
                    savedUser,
                    request.getPhone().trim(),
                    regNumber,
                    true // Set available so driver is immediately ready upon signup
            );
            Driver savedDriver = driverRepository.save(driver);

            // Seed initial location around Kochi so driver is immediately discoverable
            DriverLocation initialLoc = new DriverLocation(savedDriver, 9.9825, 76.2820, 10.0);
            locationRepository.save(initialLoc);
        }

        return savedUser;
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email.trim().toLowerCase())
                .orElse(null);
    }
}
