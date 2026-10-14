# GPS-Based Auto Tracking System — Java Web Application
> **BTech S3 Computer Science & Engineering Mini Project**  
> Built with **Java 17**, **Spring Boot 3**, **Spring Security**, **Spring Data JPA**, **MySQL / H2**, **Google Maps**, and **HTML5 / CSS3 / JavaScript**.

---

## 📖 Project Overview

The **GPS-Based Auto Tracking System** is a responsive, web-based platform designed to connect urban passengers with nearby available auto-rickshaws in real time. Unlike native Android applications that require APK installation and mobile app store distribution, this solution functions entirely within any standard mobile or desktop web browser using the W3C **Browser Geolocation API** (`navigator.geolocation`).

### Key Capabilities
- **Passenger Portal**: Real-time pickup geolocation, configurable discovery radius (1–15 km), interactive Google Maps visualization (Streets, Satellite, and Terrain layers), closest-driver sorting, straight-line distance, and estimated arrival time (ETA).
- **Driver Portal**: Foreground browser GPS tracking using `watchPosition()`, one-click availability toggle (Available vs. Busy/Off-Duty), live telemetry HUD (Latitude, Longitude, Accuracy, Speed), and simulated driving demonstration mode for indoor evaluations.
- **Fleet & Driver Management**: Real-time driver roster, dynamic count statistics (Total, Available, Busy), status toggling, and instant driver removal from the database and radar.
- **Real-Time Push Architecture**: Spring Boot WebSocket with STOMP message broker (`/topic/driver-updates`) with fail-safe 5-second polling fallback.
- **Google Maps Integration**: High-resolution Google Maps imagery with multi-layer switching (Streets, Satellite, Terrain) and zero API limits.

---

## 🛠️ Technology Stack & Architecture

| Layer | Technology | Details / Rationale |
|---|---|---|
| **Frontend UI** | HTML5, CSS3, Vanilla JavaScript | Custom dark obsidian & electric amber design system, responsive glassmorphic cards |
| **Mapping Engine** | Google Maps (Streets, Satellite, Terrain) | Crisp Google Maps satellite and road layers, custom SVG auto-rickshaw markers |
| **Backend Framework** | Java 17, Spring Boot 3.2.5 | Enterprise-grade MVC, REST APIs, and STOMP WebSocket |
| **Security & Auth** | Spring Security 6, BCrypt | Session-based authentication, role-based authorization (`ROLE_PASSENGER`, `ROLE_DRIVER`) |
| **Database** | MySQL 8.x (Production) & H2 (Zero-Setup Fallback) | Relational schema with foreign keys, unique constraints, and coordinate indexes |
| **GPS API** | Browser Geolocation API | `navigator.geolocation.watchPosition()` & `getCurrentPosition()` |
| **Build Tool** | Apache Maven 3.9+ | Standard dependency management and executable JAR packaging |

---

## 🗄️ Database Design

### 1. `users` Table
Stores basic credentials and system role.
```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'PASSENGER' or 'DRIVER'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_email (email)
);
```

### 2. `drivers` Table
Stores driver-specific telemetry and vehicle identity linked 1-to-1 with a User record.
```sql
CREATE TABLE drivers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    auto_registration_number VARCHAR(30) NOT NULL UNIQUE,
    available BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_driver_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_driver_available (available)
);
```

### 3. `driver_locations` Table
Stores high-precision GPS coordinates, horizontal accuracy, and timestamp.
```sql
CREATE TABLE driver_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    driver_id BIGINT NOT NULL UNIQUE,
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    accuracy DOUBLE DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_location_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
    INDEX idx_location_coords (latitude, longitude),
    INDEX idx_location_last_updated (last_updated)
);
```

---

## 🚀 How to Run the Application

### Option A: Zero-Setup Instant Run (Using Embedded H2 Mode)
You do not even need MySQL installed or running! Execute the command below to start the server immediately with in-memory H2 database:

```bash
mvn spring-boot:run "-Dspring-boot.run.profiles=dev"
```
The server will boot on `http://localhost:8080`.

### Option B: Running with MySQL
1. Ensure your MySQL server (or XAMPP MySQL) is running on port 3306.
2. In MySQL Workbench or phpMyAdmin, create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS auto_tracking_db;
   ```
3. Update `src/main/resources/application.properties` with your MySQL username and password (defaults are `root` / `root`).
4. Run:
   ```bash
   mvn spring-boot:run
   ```

---

## 🔑 Pre-Seeded Test Accounts

The system automatically initializes demo test accounts on startup so you can test and present without manual database typing:

| Role | Name | Email | Password | Status / Vehicle |
|---|---|---|---|---|
| **Passenger** | Rahul Sharma | `passenger@autotrack.com` | `password123` | Active Passenger |
| **Driver 1** | Rajesh Kumar | `rajesh@autotrack.com` | `password123` | **Available** &bull; `KL-07-CD-4521` |
| **Driver 2** | Suresh Menon | `suresh@autotrack.com` | `password123` | **Available** &bull; `KL-07-AB-8910` |
| **Driver 3** | Mohammed Ali | `ali@autotrack.com` | `password123` | **Busy/Off-Duty** &bull; `KL-07-EF-6324` |

*(Tip: On the `/login` page, click any of the 1-Click Demo buttons to instantly pre-fill credentials!)*

---

## 📱 Testing on Two Smartphones or Smartphone + Laptop

Because browser GPS access requires a secure context or localhost:
1. Connect both devices to the same Wi-Fi network or mobile hotspot.
2. Find your laptop's local IP address (run `ipconfig` in terminal, e.g., `192.168.1.15`).
3. On phone 1 (Driver): open `http://<your-ip>:8080`, log in as Driver, and click **Start Location Sharing**.
4. On phone 2 or laptop (Passenger): open `http://<your-ip>:8080`, log in as Passenger, and observe the driver's vehicle marker updating live on your map!
5. In modern mobile browsers (Chrome / Safari), non-HTTPS origins over local IP may prompt a location permission restriction. You can enable `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with your laptop IP on Android Chrome, or use the built-in **"Simulate Live Drive"** button on the driver dashboard for 100% reliable indoor presentations!

---

## 📐 Mathematical Formulation: Haversine Formula

The straight-line great-circle distance $d$ between passenger coordinates $(\phi_1, \lambda_1)$ and driver coordinates $(\phi_2, \lambda_2)$ is calculated as:

$$\Delta\phi = \phi_2 - \phi_1$$
$$\Delta\lambda = \lambda_2 - \lambda_1$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
$$d = R \cdot c \quad (\text{where Earth radius } R \approx 6371.0 \text{ km})$$

### Approximate Estimated Time of Arrival (ETA)
$$\text{ETA (minutes)} = \left(\frac{d}{\text{Average City Speed}}\right) \times 60$$
*(Configured at an assumed average urban auto speed of 25.0 km/h).*
