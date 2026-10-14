package com.autotracking.dto;

public class DriverStatusDTO {

    private Long driverId;
    private String driverName;
    private String phone;
    private String autoRegistrationNumber;
    private boolean available;
    private Double latitude;
    private Double longitude;
    private Double accuracy;
    private String lastUpdatedFormatted;
    private boolean locationSharingActive;

    public DriverStatusDTO() {
    }

    public DriverStatusDTO(Long driverId, String driverName, String phone, String autoRegistrationNumber,
                           boolean available, Double latitude, Double longitude, Double accuracy,
                           String lastUpdatedFormatted, boolean locationSharingActive) {
        this.driverId = driverId;
        this.driverName = driverName;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.available = available;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.lastUpdatedFormatted = lastUpdatedFormatted;
        this.locationSharingActive = locationSharingActive;
    }

    public Long getDriverId() {
        return driverId;
    }

    public void setDriverId(Long driverId) {
        this.driverId = driverId;
    }

    public String getDriverName() {
        return driverName;
    }

    public void setDriverName(String driverName) {
        this.driverName = driverName;
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

    public String getLastUpdatedFormatted() {
        return lastUpdatedFormatted;
    }

    public void setLastUpdatedFormatted(String lastUpdatedFormatted) {
        this.lastUpdatedFormatted = lastUpdatedFormatted;
    }

    public boolean isLocationSharingActive() {
        return locationSharingActive;
    }

    public void setLocationSharingActive(boolean locationSharingActive) {
        this.locationSharingActive = locationSharingActive;
    }
}
