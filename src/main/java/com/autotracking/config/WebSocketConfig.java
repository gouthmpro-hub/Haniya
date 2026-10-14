package com.autotracking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket & STOMP Message Broker Configuration for real-time driver coordinate push.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // In-memory message broker with destination prefix /topic
        // Passengers subscribe to "/topic/driver-updates" to receive live driver coordinate broadcasts
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket endpoint with SockJS fallback for wide browser compatibility
        registry.addEndpoint("/ws-auto-tracking")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Plain WebSocket endpoint for standard modern browser WebSocket clients
        registry.addEndpoint("/ws-auto-tracking")
                .setAllowedOriginPatterns("*");
    }
}
