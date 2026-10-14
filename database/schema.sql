-- ===================================================================
-- GPS-Based Auto Tracking System - Database Schema (MySQL)
-- ===================================================================

CREATE DATABASE IF NOT EXISTS auto_tracking_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auto_tracking_db;

-- 1. Users Table (Stores credentials and basic identity for both Passengers and Drivers)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL COMMENT 'PASSENGER or DRIVER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Drivers Table (Stores driver-specific details linked 1-to-1 with a User)
CREATE TABLE IF NOT EXISTS drivers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    auto_registration_number VARCHAR(30) NOT NULL UNIQUE,
    available BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_driver_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_driver_available (available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Driver Locations Table (Stores real-time GPS coordinate telemetry)
CREATE TABLE IF NOT EXISTS driver_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    driver_id BIGINT NOT NULL UNIQUE,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    accuracy DOUBLE DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_location_driver FOREIGN KEY (driver_id) 
        REFERENCES drivers(id) ON DELETE CASCADE,
    INDEX idx_location_coords (latitude, longitude),
    INDEX idx_location_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
