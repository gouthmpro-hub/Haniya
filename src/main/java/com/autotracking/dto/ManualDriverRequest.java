package com.autotracking.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ManualDriverRequest {

    @NotBlank(message = "Driver name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    private String email;

    @NotBlank(message = "Phone number is required")
    private String phone;

    @NotBlank(message = "Auto registration number is required")
    private String autoRegistrationNumber;

    private String password = "password123";

    private Boolean available = true;

    private Double latitude = 9.9825;

    private Double longitude = 76.2820;

    public ManualDriverRequest() {
    }

    public ManualDriverRequest(String name, String email, String phone, String autoRegistrationNumber, String password, Boolean available, Double latitude, Double longitude) {
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.autoRegistrationNumber = autoRegistrationNumber;
        this.password = password != null && !password.trim().isEmpty() ? password : "password123";
        this.available = available != null ? available : true;
        this.latitude = latitude != null ? latitude : 9.9825;
        this.longitude = longitude != null ? longitude : 76.2820;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Boolean getAvailable() {
        return available;
    }

    public void setAvailable(Boolean available) {
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
}
