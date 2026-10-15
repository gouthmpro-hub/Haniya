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
    public String index(Authentication authentication) {
        if (isAuthenticatedUser(authentication)) {
            return "redirect:/passenger/dashboard";
        }
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String loginPage(Authentication authentication) {
        if (isAuthenticatedUser(authentication)) {
            return "redirect:/passenger/dashboard";
        }
        return "login";
    }

    @GetMapping("/register")
    public String registerPage(Authentication authentication) {
        if (isAuthenticatedUser(authentication)) {
            return "redirect:/passenger/dashboard";
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
        if (user == null) {
            user = userService.findByPhone(authentication.getName());
        }
        model.addAttribute("user", user);
        return "passenger-dashboard";
    }

    @GetMapping({"/driver/dashboard", "/driver-dashboard", "/driver-dashboard.html", "/driver/**"})
    public String driverDashboard() {
        // Driver portal removed for end users; redirect to passenger tracking dashboard
        return "redirect:/passenger/dashboard";
    }

    @GetMapping({"/admin/drivers", "/admin-dashboard.html", "/admin"})
    public String adminDrivers(Model model) {
        model.addAttribute("drivers", driverService.getAllDrivers());
        model.addAttribute("stats", driverService.getFleetStats());
        return "admin-drivers";
    }
}
