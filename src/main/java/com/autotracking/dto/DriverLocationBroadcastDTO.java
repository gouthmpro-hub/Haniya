package com.autotracking.dto;

public class DriverLocationBroadcastDTO {

    private Long driverId;
    private String driverName;
    private String autoRegistrationNumber;
    private Double latitude;
    private Double longitude;
    private Double accuracy;
    private boolean available;
    private String eventType; // "LOCATION_UPDATE", "AVAILABILITY_CHANGE", "WENT_OFFLINE"

    public DriverLocationBroadcastDTO() {
    }

    public DriverLocationBroadcastDTO(Long driverId, String driverName, String autoRegistrationNumber,
                                      Double latitude, Double longitude, Double accuracy,
                                      boolean available, String eventType) {
        this.driverId = driverId;
        this.driverName = driverName;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.available = available;
        this.eventType = eventType;
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

    public String getAutoRegistrationNumber() {
        return autoRegistrationNumber;
    }

    public void setAutoRegistrationNumber(String autoRegistrationNumber) {
        this.autoRegistrationNumber = autoRegistrationNumber;
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

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }
}
