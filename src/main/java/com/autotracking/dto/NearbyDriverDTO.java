package com.autotracking.dto;

public class NearbyDriverDTO {

    private Long driverId;
    private String driverName;
    private String phone;
    private String autoRegistrationNumber;
    private Double latitude;
    private Double longitude;
    private Double accuracy;
    private Double distanceKm;
    private Integer etaMinutes;
    private boolean available;
    private Long lastUpdatedSecondsAgo;
    private String lastUpdatedFormatted;

    public NearbyDriverDTO() {
    }

    public NearbyDriverDTO(Long driverId, String driverName, String phone, String autoRegistrationNumber,
                           Double latitude, Double longitude, Double accuracy, Double distanceKm,
                           Integer etaMinutes, boolean available, Long lastUpdatedSecondsAgo,
                           String lastUpdatedFormatted) {
        this.driverId = driverId;
        this.driverName = driverName;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.distanceKm = distanceKm;
        this.etaMinutes = etaMinutes;
        this.available = available;
        this.lastUpdatedSecondsAgo = lastUpdatedSecondsAgo;
        this.lastUpdatedFormatted = lastUpdatedFormatted;
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

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public Integer getEtaMinutes() {
        return etaMinutes;
    }

    public void setEtaMinutes(Integer etaMinutes) {
        this.etaMinutes = etaMinutes;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public Long getLastUpdatedSecondsAgo() {
        return lastUpdatedSecondsAgo;
    }

    public void setLastUpdatedSecondsAgo(Long lastUpdatedSecondsAgo) {
        this.lastUpdatedSecondsAgo = lastUpdatedSecondsAgo;
    }

    public String getLastUpdatedFormatted() {
        return lastUpdatedFormatted;
    }

    public void setLastUpdatedFormatted(String lastUpdatedFormatted) {
        this.lastUpdatedFormatted = lastUpdatedFormatted;
    }
}
