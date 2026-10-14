package com.autotracking.config;

import com.autotracking.model.Driver;
import com.autotracking.repository.DriverRepository;
import com.autotracking.service.DriverService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.logout.LogoutHandler;

import java.io.IOException;
import java.util.Collection;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final DriverService driverService;

    public SecurityConfig(@Lazy DriverService driverService) {
        this.driverService = driverService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF for login, register, API endpoints, H2 console, and WebSockets to prevent mobile fetch rejection
            .csrf(csrf -> csrf.ignoringRequestMatchers(
                "/login",
                "/register",
                "/api/**",
                "/ws-auto-tracking/**",
                "/h2-console/**"
            ))
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
            .authorizeHttpRequests(auth -> auth
                // Publicly accessible pages and static assets
                .requestMatchers(
                    "/",
                    "/login",
                    "/register",
                    "/admin/**",
                    "/api/admin/**",
                    "/admin-dashboard.html",
                    "/passenger-dashboard.html",
                    "/driver-dashboard.html",
                    "/api/auth/**",
                    "/css/**",
                    "/js/**",
                    "/images/**",
                    "/ws-auto-tracking/**",
                    "/h2-console/**"
                ).permitAll()
                // Role-specific protected routes
                .requestMatchers("/passenger/**", "/api/passenger/**").hasRole("PASSENGER")
                .requestMatchers("/driver/**", "/api/driver/**").hasRole("DRIVER")
                // All other requests require authentication
                .anyRequest().authenticated()
            )
            .formLogin(login -> login
                .loginPage("/login")
                .loginProcessingUrl("/login")
                .usernameParameter("email")
                .passwordParameter("password")
                .successHandler(roleBasedSuccessHandler())
                .failureUrl("/login?error=true")
                .permitAll()
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .addLogoutHandler(driverOfflineLogoutHandler())
                .logoutSuccessUrl("/login?logout=true")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .permitAll()
            );

        return http.build();
    }

    /**
     * Redirects users to their designated dashboard based on their role upon login.
     */
    @Bean
    public AuthenticationSuccessHandler roleBasedSuccessHandler() {
        return (request, response, authentication) -> {
            Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();
            boolean isDriver = authorities.stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_DRIVER"));
            boolean isPassenger = authorities.stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_PASSENGER"));

            if (isDriver) {
                response.sendRedirect("/driver/dashboard");
            } else if (isPassenger) {
                response.sendRedirect("/passenger/dashboard");
            } else {
                response.sendRedirect("/");
            }
        };
    }

    /**
     * Marks a driver unavailable in the database and broadcasts an offline event when they log out.
     */
    @Bean
    public LogoutHandler driverOfflineLogoutHandler() {
        return (HttpServletRequest request, HttpServletResponse response, Authentication authentication) -> {
            if (authentication != null && authentication.isAuthenticated()) {
                boolean isDriver = authentication.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_DRIVER"));
                if (isDriver) {
                    try {
                        driverService.updateAvailability(authentication.getName(), false);
                    } catch (Exception ignored) {
                    }
                }
            }
        };
    }
}
