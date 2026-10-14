package com.autotracking;

import com.autotracking.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class AutoTrackingApplication {

    public static void main(String[] args) {
        SpringApplication.run(AutoTrackingApplication.class, args);
    }

    /**
     * System initialization.
     * Strictly registered drivers and users will be populated through the signup portal.
     */
    @Bean
    public CommandLineRunner seedDemoData(UserRepository userRepository) {
        return args -> {
            System.out.println("===> [GPS Auto Tracking] System initialized. Ready for user and driver registrations.");
        };
    }
}
