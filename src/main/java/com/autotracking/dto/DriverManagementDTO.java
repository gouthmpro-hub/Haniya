package com.autotracking.dto;

public class DriverManagementDTO {
    private Long id;
    private String name;
    private String email;
    private String phone;
    private String autoRegistrationNumber;
    private boolean available;
    private Double latitude;
    private Double longitude;
    private Double accuracy;
    private String lastUpdated;
    private boolean activeGps;

    public DriverManagementDTO() {
    }

    public DriverManagementDTO(Long id, String name, String email, String phone,
                               String autoRegistrationNumber, boolean available,
                               Double latitude, Double longitude, Double accuracy,
                               String lastUpdated, boolean activeGps) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.available = available;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.lastUpdated = lastUpdated;
        this.activeGps = activeGps;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getAutoRegistrationNumber() {
        return autoRegistrationNumber;
    }

    public void setAutoRegistrationNumber(String autoRegistrationNumber) {
        this.autoRegistrationNumber = autoRegistrationNumber;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
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

    public String getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(String lastUpdated) {
        this.lastUpdated = lastUpdated;
    }

    public boolean isActiveGps() {
        return activeGps;
    }

    public void setActiveGps(boolean activeGps) {
        this.activeGps = activeGps;
    }
}
