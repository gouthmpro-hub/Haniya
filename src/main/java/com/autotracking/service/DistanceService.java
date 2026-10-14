package com.autotracking.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Service providing mathematical distance calculations using the Haversine formula,
 * along with approximate Estimated Time of Arrival (ETA) based on average city speed.
 *
 * NOTE FOR COLLEGE PROJECT:
 * Straight-line (great-circle) distance calculates the shortest geometric path across the
 * curvature of the Earth. Real-world road distance will typically be 20% to 40% longer
 * depending on city road layout, one-ways, and turns. Without an expensive routing API
 * (like Google Directions API or Mapbox Directions API), this provides an efficient,
 * cost-free approximation for finding nearby vehicles.
 */
@Service
public class DistanceService {

    // Approximate mean radius of the Earth in kilometers
    private static final double EARTH_RADIUS_KM = 6371.0;

    @Value("${autotracking.average-speed-kmh:25.0}")
    private double averageSpeedKmh;

    /**
     * Calculates the great-circle distance between two GPS coordinates using the Haversine Formula.
     *
     * @param lat1 Latitude of point 1 (in degrees)
     * @param lon1 Longitude of point 1 (in degrees)
     * @param lat2 Latitude of point 2 (in degrees)
     * @param lon2 Longitude of point 2 (in degrees)
     * @return Straight-line distance in kilometers, rounded to 2 decimal places.
     */
    public double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        // Convert latitude and longitude differences from degrees to radians
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);

        // Convert starting and ending latitudes to radians
        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        // Haversine formula implementation
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                 + Math.cos(rLat1) * Math.cos(rLat2)
                 * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        double distance = EARTH_RADIUS_KM * c;

        // Round to 2 decimal places (e.g. 1.45 km)
        return BigDecimal.valueOf(distance)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    /**
     * Calculates an approximate Estimated Time of Arrival (ETA) in minutes
     * based on the straight-line distance and the configured average city speed.
     *
     * @param distanceKm Straight-line distance in kilometers
     * @return Estimated arrival time in minutes (minimum 1 minute if distance > 0)
     */
    public int calculateEtaMinutes(double distanceKm) {
        if (distanceKm <= 0.05) {
            return 1; // Auto is already at the passenger's location
        }
        // time (hours) = distance / speed
        // time (minutes) = (distance / speed) * 60
        double minutes = (distanceKm / averageSpeedKmh) * 60.0;
        return (int) Math.max(1, Math.round(minutes));
    }
}
