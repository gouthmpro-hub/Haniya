package com.autotracking.controller;

import com.autotracking.model.Driver;
import com.autotracking.model.User;
import com.autotracking.service.DriverService;
import com.autotracking.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    private final UserService userService;
    private final DriverService driverService;

    public PageController(UserService userService, DriverService driverService) {
        this.userService = userService;
        this.driverService = driverService;
    }

    @GetMapping("/")
    public String index(Authentication authentication, Model model) {
        if (isAuthenticatedUser(authentication)) {
            model.addAttribute("authenticated", true);
            model.addAttribute("username", authentication.getName());
        } else {
            model.addAttribute("authenticated", false);
        }
        return "index";
    }

    @GetMapping("/login")
    public String loginPage(Authentication authentication) {
        if (isAuthenticatedUser(authentication)) {
            boolean isDriver = authentication.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_DRIVER"));
            return isDriver ? "redirect:/driver/dashboard" : "redirect:/passenger/dashboard";
        }
        return "login";
    }

    @GetMapping("/register")
    public String registerPage(Authentication authentication) {
        if (isAuthenticatedUser(authentication)) {
            return "redirect:/";
        }
        return "register";
    }

    private boolean isAuthenticatedUser(Authentication authentication) {
        return authentication != null 
                && authentication.isAuthenticated() 
                && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
    }

    @GetMapping("/passenger/dashboard")
    public String passengerDashboard(Authentication authentication, Model model) {
        User user = userService.findByEmail(authentication.getName());
        model.addAttribute("user", user);
        return "passenger-dashboard";
    }

    @GetMapping("/driver/dashboard")
    public String driverDashboard(Authentication authentication, Model model) {
        Driver driver = driverService.getDriverByUserEmail(authentication.getName());
        model.addAttribute("driver", driver);
        model.addAttribute("user", driver.getUser());
        return "driver-dashboard";
    }
}
