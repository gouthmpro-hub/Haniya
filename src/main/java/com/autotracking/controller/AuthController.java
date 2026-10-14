package com.autotracking.controller;

import com.autotracking.dto.RegisterRequest;
import com.autotracking.model.User;
import com.autotracking.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.Collections;
import java.util.Map;

@Controller
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
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
}
