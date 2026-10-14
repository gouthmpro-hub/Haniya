package com.autotracking.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entity storing the latest real-time GPS coordinates of an auto driver.
 */
@Entity
@Table(name = "driver_locations", indexes = {
    @Index(name = "idx_location_coords", columnList = "latitude, longitude"),
    @Index(name = "idx_location_last_updated", columnList = "last_updated")
})
public class DriverLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "driver_id", referencedColumnName = "id", nullable = false, unique = true)
    private Driver driver;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Double accuracy = 0.0;

    @Column(name = "last_updated", nullable = false)
    private LocalDateTime lastUpdated;

    public DriverLocation() {
    }

    public DriverLocation(Driver driver, Double latitude, Double longitude, Double accuracy) {
        this.driver = driver;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.lastUpdated = LocalDateTime.now();
    }

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.lastUpdated = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Driver getDriver() {
        return driver;
    }

    public void setDriver(Driver driver) {
        this.driver = driver;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
