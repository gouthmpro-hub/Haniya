package com.autotracking.dto;

import jakarta.validation.constraints.NotNull;

public class LiveLocationShareRequest {

    private String name;
    private String phone;
    private String autoRegistrationNumber;
    private Long driverId;

    @NotNull(message = "Latitude is required")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    private Double longitude;

    private Double accuracy = 5.0;
    private Double speed = 0.0;
    private Double heading = 0.0;

    public LiveLocationShareRequest() {
    }

    public LiveLocationShareRequest(String name, String phone, String autoRegistrationNumber,
                                    Double latitude, Double longitude, Double accuracy) {
        this.name = name;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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

    public Long getDriverId() {
        return driverId;
    }

    public void setDriverId(Long driverId) {
        this.driverId = driverId;
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

    public Double getSpeed() {
        return speed;
    }

    public void setSpeed(Double speed) {
        this.speed = speed;
    }

    public Double getHeading() {
        return heading;
    }

    public void setHeading(Double heading) {
        this.heading = heading;
    }
}
