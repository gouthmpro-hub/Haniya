package com.autotracking.repository;

import com.autotracking.model.Driver;
import com.autotracking.model.DriverLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DriverLocationRepository extends JpaRepository<DriverLocation, Long> {

    Optional<DriverLocation> findByDriver(Driver driver);

    Optional<DriverLocation> findByDriverId(Long driverId);

    /**
     * Finds all driver locations where:
     * 1. Driver availability status is TRUE
     * 2. The location coordinates were updated after the specified cutoff timestamp (freshness filter)
     */
    @Query("SELECT dl FROM DriverLocation dl " +
           "JOIN FETCH dl.driver d " +
           "JOIN FETCH d.user u " +
           "WHERE d.available = true AND dl.lastUpdated >= :cutoffTime")
    List<DriverLocation> findActiveFreshLocations(@Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * Finds all driver locations where driver is marked available (regardless of cutoff, for admin/monitoring)
     */
    @Query("SELECT dl FROM DriverLocation dl " +
           "JOIN FETCH dl.driver d " +
           "JOIN FETCH d.user u " +
           "WHERE d.available = true")
    List<DriverLocation> findAllActiveLocations();
}
