/**
 * JWT Utilities
 * Helper functions for JWT token handling
 */

export class JWTUtils {
    static decodeToken(token) {
        try {
            // JWT tokens have 3 parts separated by dots: header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT token format');
            }
            
            // Decode the payload (second part)
            const payload = parts[1];
            // Add padding if needed for base64 decoding
            const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decodedPayload = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
            
            return JSON.parse(decodedPayload);
        } catch (error) {
            console.error('Failed to decode JWT token:', error);
            return null;
        }
    }
    
    static getTokenExpiration(token) {
        const payload = this.decodeToken(token);
        if (!payload) {
            return null;
        }

        // Handle standard JWT 'exp' field (Unix timestamp in seconds)
        if (payload.exp) {
            return payload.exp * 1000;
        }

        // Handle custom 'expires_at' field (ISO date string or ms timestamp)
        if (payload.expires_at) {
            const parsed = new Date(payload.expires_at).getTime();
            return isNaN(parsed) ? null : parsed;
        }

        return null;
    }
    
    static isTokenExpired(token) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return true; // Consider invalid tokens as expired
        }
        
        return Date.now() >= expirationTime;
    }
    
    static isTokenExpiringSoon(token, minutesThreshold = 5) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return true; // Consider invalid tokens as expiring soon
        }
        
        const thresholdMs = minutesThreshold * 60 * 1000;
        const timeUntilExpiry = expirationTime - Date.now();
        
        return timeUntilExpiry <= thresholdMs && timeUntilExpiry > 0;
    }
    
    static getTimeUntilExpiry(token) {
        const expirationTime = this.getTokenExpiration(token);
        if (!expirationTime) {
            return 0;
        }
        
        return Math.max(0, expirationTime - Date.now());
    }
} 