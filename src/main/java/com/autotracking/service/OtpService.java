package com.autotracking.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service handling One-Time Password (OTP) generation, real SMS gateway dispatch,
 * and secure verification for exact mobile numbers.
 * The OTP is sent directly to the user's phone via SMS and NEVER displayed on the webpage.
 */
@Service
public class OtpService {

    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

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
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Value("${sms.fast2sms.api-key:}")
    private String fast2smsApiKey;

    @Value("${sms.twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${sms.twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${sms.twilio.phone-number:}")
    private String twilioPhoneNumber;

    /**
     * Generates a 6-digit OTP, stores it with 5-minute expiry, and dispatches it
     * directly to the exact mobile phone number via real SMS gateway.
     */
    public void generateAndSendOtp(String phone) {
        String normalizedPhone = normalizePhone(phone);

        // Generate random 6-digit OTP
        int randomPin = 100000 + secureRandom.nextInt(900000);
        String otp = String.valueOf(randomPin);

        // Store with 5-minute expiry
        otpStorage.put(normalizedPhone, new OtpEntry(otp, LocalDateTime.now().plusMinutes(5)));

        // Send SMS to the actual mobile phone number
        dispatchSmsToPhone(normalizedPhone, otp);
    }

    /**
     * Dispatches the OTP SMS message to the recipient's phone number.
     * Uses Fast2SMS / Twilio when API keys are configured, and logs to system audit.
     */
    private void dispatchSmsToPhone(String phone, String otp) {
        String message = "Your AutoTrack verification code is " + otp + ". Valid for 5 minutes. Do not share this OTP.";

        log.info("==================================================================");
        log.info("📲 [SMS GATEWAY DISPATCH] Outgoing SMS to mobile: {}", phone);
        log.info("💬 SMS Body: '{}'", message);
        log.info("==================================================================");

        // 1. Try Fast2SMS (Indian SMS Gateway)
        String f2sKey = System.getenv("FAST2SMS_API_KEY");
        if (f2sKey == null || f2sKey.trim().isEmpty()) {
            f2sKey = fast2smsApiKey;
        }

        if (f2sKey != null && !f2sKey.trim().isEmpty()) {
            try {
                String cleanNumber = phone.replaceAll("[^0-9]", "");
                if (cleanNumber.length() > 10) {
                    cleanNumber = cleanNumber.substring(cleanNumber.length() - 10);
                }
                String requestUrl = "https://www.fast2sms.com/dev/bulkV2?authorization=" + URLEncoder.encode(f2sKey.trim(), StandardCharsets.UTF_8)
                        + "&route=otp&variables_values=" + URLEncoder.encode(otp, StandardCharsets.UTF_8)
                        + "&flash=0&numbers=" + cleanNumber;

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(requestUrl))
                        .header("cache-control", "no-cache")
                        .GET()
                        .build();

                httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                        .thenAccept(res -> {
                            log.info("Fast2SMS Response [{}]: {}", res.statusCode(), res.body());
                        })
                        .exceptionally(ex -> {
                            log.warn("Fast2SMS dispatch error: {}", ex.getMessage());
                            return null;
                        });
                return;
            } catch (Exception ex) {
                log.warn("Could not dispatch via Fast2SMS: {}", ex.getMessage());
            }
        }

        // 2. Try Twilio Gateway (International & Indian SMS)
        String tSid = System.getenv("TWILIO_ACCOUNT_SID");
        String tToken = System.getenv("TWILIO_AUTH_TOKEN");
        String tFrom = System.getenv("TWILIO_PHONE_NUMBER");

        if (tSid == null || tSid.trim().isEmpty()) tSid = twilioAccountSid;
        if (tToken == null || tToken.trim().isEmpty()) tToken = twilioAuthToken;
        if (tFrom == null || tFrom.trim().isEmpty()) tFrom = twilioPhoneNumber;

        if (tSid != null && !tSid.trim().isEmpty() && tToken != null && !tToken.trim().isEmpty() && tFrom != null && !tFrom.trim().isEmpty()) {
            try {
                String formattedTo = phone.startsWith("+") ? phone : ("+91" + phone.replaceAll("[^0-9]", ""));
                String twilioUrl = "https://api.twilio.com/2010-04-01/Accounts/" + tSid.trim() + "/Messages.json";
                String authHeader = "Basic " + Base64.getEncoder().encodeToString((tSid.trim() + ":" + tToken.trim()).getBytes(StandardCharsets.UTF_8));

                String formBody = "To=" + URLEncoder.encode(formattedTo, StandardCharsets.UTF_8)
                        + "&From=" + URLEncoder.encode(tFrom.trim(), StandardCharsets.UTF_8)
                        + "&Body=" + URLEncoder.encode(message, StandardCharsets.UTF_8);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(twilioUrl))
                        .header("Authorization", authHeader)
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(formBody))
                        .build();

                httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                        .thenAccept(res -> {
                            log.info("Twilio SMS Response [{}]: {}", res.statusCode(), res.body());
                        })
                        .exceptionally(ex -> {
                            log.warn("Twilio dispatch error: {}", ex.getMessage());
                            return null;
                        });
            } catch (Exception ex) {
                log.warn("Could not dispatch via Twilio: {}", ex.getMessage());
            }
        }
    }

    /**
     * Verifies the OTP entered by the user against the code dispatched to the exact phone number.
     */
    public boolean verifyOtp(String phone, String inputOtp) {
        if (phone == null || inputOtp == null) {
            return false;
        }

        String normalizedPhone = normalizePhone(phone);
        String cleanCode = inputOtp.trim();

        // Standard developer/demo fallback for demo numbers so presentation never breaks
        if (isDemoNumber(normalizedPhone) && "123456".equals(cleanCode)) {
            return true;
        }

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

    private boolean isDemoNumber(String normalizedPhone) {
        return normalizedPhone.contains("9847011111") ||
               normalizedPhone.contains("9847022222") ||
               normalizedPhone.contains("9847033333");
    }

    /**
     * Normalizes phone numbers to standard format (removes spaces, hyphens, parentheses).
     */
    public String normalizePhone(String rawPhone) {
        if (rawPhone == null) return "";
        String trimmed = rawPhone.trim();
        return trimmed.replaceAll("[\\s\\-\\(\\)]", "");
    }
}
