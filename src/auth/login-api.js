/**
 * Login API Client
 * Handles all authentication-related API calls
 */

import { config } from '../config/app-config.js';

export class LoginAPI {
    static async initialize(email, deviceId) {
        try {
            const response = await fetch(`${config.SERVER_BASE_URL}/login/initialize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    cid: deviceId,
                    app_name: config.APP_NAME,
                    app_version: config.APP_VERSION,
                    client_id: config.CLIENT_ID
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login initialization failed:', error);
            throw error;
        }
    }
    
    static async finalize(sessionId, otp) {
        try {
            const response = await fetch(`${config.SERVER_BASE_URL}/login/finalize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    token: otp
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login finalization failed:', error);
            throw error;
        }
    }
    
    static async verify(token) {
        try {
            const response = await fetch(`${config.SERVER_BASE_URL}/login/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: token,
                    app_name: config.APP_NAME,
                    app_version: config.APP_VERSION,
                    client_id: config.CLIENT_ID
                })
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }
    
    static async refresh(token) {
        try {
            const response = await fetch(`${config.SERVER_BASE_URL}/login/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: token,
                    app_name: config.APP_NAME,
                    app_version: config.APP_VERSION,
                    client_id: config.CLIENT_ID
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }
} 