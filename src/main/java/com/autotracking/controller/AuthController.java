package com.autotracking.controller;

import com.autotracking.dto.RegisterRequest;
import com.autotracking.model.Role;
import com.autotracking.model.User;
import com.autotracking.service.DriverService;
import com.autotracking.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.HashMap;
import java.util.Map;

@Controller
public class AuthController {

    private final UserService userService;
    private final DriverService driverService;

    public AuthController(UserService userService, DriverService driverService) {
        this.userService = userService;
        this.driverService = driverService;
    }

    /**
     * Handles browser HTML registration form submissions.
     */
    @PostMapping("/register")
    public String handleRegistration(@Valid @ModelAttribute("registerRequest") RegisterRequest request,
                                     BindingResult bindingResult,
                                     Model model,
                                     RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            return "register";
        }

        try {
            userService.registerUser(request);
            redirectAttributes.addFlashAttribute("successMessage", "Account created successfully! Please log in.");
            return "redirect:/login?registered=true";
        } catch (IllegalArgumentException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            return "register";
        } catch (Exception ex) {
            model.addAttribute("errorMessage", "Registration failed: " + ex.getMessage());
            return "register";
        }
    }

    /**
     * REST API endpoint for headless registration.
     */
    @PostMapping("/api/auth/register")
    @ResponseBody
    public ResponseEntity<?> registerApi(@Valid @RequestBody RegisterRequest request) {
        try {
            User user = userService.registerUser(request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "User registered successfully",
                    "userId", user.getId(),
                    "email", user.getEmail(),
                    "role", user.getRole().name()
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", ex.getMessage()
            ));
        } catch (Exception ex) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", "Registration error: " + ex.getMessage()
            ));
        }
    }

    /**
     * REST API endpoint to retrieve the currently logged in user's profile and name.
     */
    @GetMapping("/api/auth/me")
    @ResponseBody
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || 
            authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }

        User user = userService.findByEmail(authentication.getName());
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("authenticated", false));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("authenticated", true);
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("role", user.getRole().name());

        if (user.getRole() == Role.DRIVER) {
            driverService.findDriverByEmail(user.getEmail()).ifPresent(driver -> {
                response.put("driverId", driver.getId());
                response.put("autoRegistrationNumber", driver.getAutoRegistrationNumber());
                response.put("phone", driver.getPhone());
                response.put("available", driver.isAvailable());
            });
        }

        return ResponseEntity.ok(response);
    }
}
