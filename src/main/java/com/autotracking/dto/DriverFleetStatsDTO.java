package com.autotracking.dto;

public class DriverFleetStatsDTO {
    private long totalDrivers;
    private long availableDrivers;
    private long busyDrivers;
    private long activeGpsDrivers;

    public DriverFleetStatsDTO() {
    }

    public DriverFleetStatsDTO(long totalDrivers, long availableDrivers, long busyDrivers, long activeGpsDrivers) {
        this.totalDrivers = totalDrivers;
        this.availableDrivers = availableDrivers;
        this.busyDrivers = busyDrivers;
        this.activeGpsDrivers = activeGpsDrivers;
    }

    public long getTotalDrivers() {
        return totalDrivers;
    }

    public void setTotalDrivers(long totalDrivers) {
        this.totalDrivers = totalDrivers;
    }

    public long getAvailableDrivers() {
        return availableDrivers;
    }

    public void setAvailableDrivers(long availableDrivers) {
        this.availableDrivers = availableDrivers;
    }

    public long getBusyDrivers() {
        return busyDrivers;
    }

    public void setBusyDrivers(long busyDrivers) {
        this.busyDrivers = busyDrivers;
    }

    public long getActiveGpsDrivers() {
        return activeGpsDrivers;
    }

    public void setActiveGpsDrivers(long activeGpsDrivers) {
        this.activeGpsDrivers = activeGpsDrivers;
    }
}
