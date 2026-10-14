-- ===================================================================
-- GPS-Based Auto Tracking System - Sample Seed Data
-- Passwords for all sample users are: "password123"
-- BCrypt Hash: $2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG
-- ===================================================================

USE auto_tracking_db;

-- Insert Sample Users
-- 1. Passenger: Rahul Sharma (passenger@autotrack.com / password123)
-- 2. Driver 1: Rajesh Kumar (rajesh@autotrack.com / password123)
-- 3. Driver 2: Suresh Menon (suresh@autotrack.com / password123)
-- 4. Driver 3: Mohammed Ali (ali@autotrack.com / password123)

INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES
(1, 'Rahul Sharma', 'passenger@autotrack.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'PASSENGER', NOW()),
(2, 'Rajesh Kumar', 'rajesh@autotrack.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'DRIVER', NOW()),
(3, 'Suresh Menon', 'suresh@autotrack.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'DRIVER', NOW()),
(4, 'Mohammed Ali', 'ali@autotrack.com', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', 'DRIVER', NOW())
ON DUPLICATE KEY UPDATE email=email;

-- Insert Driver Profiles
INSERT INTO drivers (id, user_id, phone, auto_registration_number, available) VALUES
(1, 2, '+91 98471 23456', 'KL-07-CD-4521', TRUE),
(2, 3, '+91 98472 34567', 'KL-07-AB-8910', TRUE),
(3, 4, '+91 98473 45678', 'KL-07-EF-6324', FALSE)
ON DUPLICATE KEY UPDATE auto_registration_number=auto_registration_number;

-- Insert Driver Locations (Centered in Kochi / Marine Drive / MG Road area: 9.9816° N, 76.2999° E)
INSERT INTO driver_locations (id, driver_id, latitude, longitude, accuracy, last_updated) VALUES
(1, 1, 9.9825, 76.2820, 10.5, NOW()),
(2, 2, 9.9790, 76.2855, 12.0, NOW()),
(3, 3, 9.9910, 76.2950, 15.0, NOW())
ON DUPLICATE KEY UPDATE latitude=VALUES(latitude), longitude=VALUES(longitude), last_updated=NOW();
