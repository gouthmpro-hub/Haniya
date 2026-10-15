package com.autotracking.service;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service handling One-Time Password (OTP) dispatch and verification for exact mobile numbers.
 */
@Service
public class OtpService {

    private static class OtpEntry {
        final String code;
        final LocalDateTime expiry;

        OtpEntry(String code, LocalDateTime expiry) {
            this.code = code;
            this.expiry = expiry;
        }

        boolean isExpired() {
            return LocalDateTime.now().isAfter(expiry);
        }
    }

    private final Map<String, OtpEntry> otpStorage = new ConcurrentHashMap<>();
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Generates a 6-digit OTP for the exact mobile number and caches it for 5 minutes.
     */
    public String generateAndSendOtp(String phone) {
        String normalizedPhone = normalizePhone(phone);
        
        // Generate random 6-digit numeric OTP (e.g. 529143)
        int randomPin = 100000 + secureRandom.nextInt(900000);
        String otp = String.valueOf(randomPin);

        // Store with 5-minute expiration
        otpStorage.put(normalizedPhone, new OtpEntry(otp, LocalDateTime.now().plusMinutes(5)));

        System.out.println("==================================================================");
        System.out.println("📲 [SMS GATEWAY] Outgoing OTP dispatched to exact number: " + normalizedPhone);
        System.out.println("🔑 Verification Code: " + otp + " (Valid for 5 minutes)");
        System.out.println("==================================================================");

        return otp;
    }

    /**
     * Verifies the OTP for the given exact mobile number.
     */
    public boolean verifyOtp(String phone, String inputOtp) {
        if (phone == null || inputOtp == null) {
            return false;
        }

        String normalizedPhone = normalizePhone(phone);
        String cleanCode = inputOtp.trim();

        OtpEntry entry = otpStorage.get(normalizedPhone);
        if (entry == null) {
            return false;
        }

        if (entry.isExpired()) {
            otpStorage.remove(normalizedPhone);
            return false;
        }

        boolean isValid = entry.code.equals(cleanCode);
        if (isValid) {
            // Invalidate after successful verification
            otpStorage.remove(normalizedPhone);
        }

        return isValid;
    }

    /**
     * Normalizes phone numbers to standard searchable format.
     */
    public String normalizePhone(String rawPhone) {
        if (rawPhone == null) return "";
        String trimmed = rawPhone.trim();
        // Remove spaces, hyphens, and brackets
        return trimmed.replaceAll("[\\s\\-\\(\\)]", "");
    }
}
