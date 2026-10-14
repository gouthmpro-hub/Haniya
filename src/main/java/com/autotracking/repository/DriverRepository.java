package com.autotracking.repository;

import com.autotracking.model.Driver;
import com.autotracking.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverRepository extends JpaRepository<Driver, Long> {
    Optional<Driver> findByUser(User user);
    Optional<Driver> findByUserId(Long userId);
    Optional<Driver> findByAutoRegistrationNumber(String autoRegistrationNumber);
    boolean existsByAutoRegistrationNumber(String autoRegistrationNumber);
    List<Driver> findByAvailableTrue();
}
