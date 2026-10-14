package com.autotracking.model;

import jakarta.persistence.*;

/**
 * Entity representing an Auto Driver profile linked to a User account.
 */
@Entity
@Table(name = "drivers")
public class Driver {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "auto_registration_number", nullable = false, unique = true, length = 30)
    private String autoRegistrationNumber;

    @Column(nullable = false)
    private boolean available = false;

    public Driver() {
    }

    public Driver(User user, String phone, String autoRegistrationNumber, boolean available) {
        this.user = user;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.available = available;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
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
}
