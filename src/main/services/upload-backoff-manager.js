/**
 * Upload Backoff Manager
 * Manages global exponential backoff for upload retries
 */

class UploadBackoffManager {
    constructor() {
        this.loadBackoffConfiguration();

        this.lastFailureTime = 0;
        this.consecutiveFailures = 0;
        this.currentBackoffInterval = this.backoffConfig.initialInterval;
    }
    
    /**
     * Load backoff configuration from config system
     */
    loadBackoffConfiguration() {
        try {
            const { getConfig } = require('../app/main-config-setup.js');
            const preferences = getConfig('preferences');
            if (preferences && preferences.uploadBackoff) {
                this.backoffConfig = { ...preferences.uploadBackoff };
            }
        } catch (error) {
            console.warn('Failed to load upload backoff configuration, using defaults:', error);
            throw error;
        }
    }
    
    /**
     * Called when an upload fails
     */
    onUploadFailure() {
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();
        
        // Calculate new backoff interval with exponential increase
        this.currentBackoffInterval = Math.min(
            this.backoffConfig.initialInterval * Math.pow(this.backoffConfig.multiplier, this.consecutiveFailures - 1),
            this.backoffConfig.maxInterval
        );
        
        console.log(`Upload failure #${this.consecutiveFailures}, backoff: ${this.currentBackoffInterval}ms`);
    }
    
    /**
     * Called when an upload succeeds
     */
    onUploadSuccess() {
        if (this.backoffConfig.resetOnSuccess && this.consecutiveFailures > 0) {
            console.log('Upload success - resetting backoff');
            this.reset();
        }
    }
    
    /**
     * Check if we're currently in backoff period
     */
    isInBackoff() {
        if (this.consecutiveFailures === 0) return false;
        
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return timeSinceLastFailure < this.currentBackoffInterval;
    }
    
    /**
     * Get time remaining in current backoff period
     */
    getBackoffTimeRemaining() {
        if (!this.isInBackoff()) return 0;
        
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return Math.max(0, this.currentBackoffInterval - timeSinceLastFailure);
    }
    
    /**
     * Reset backoff state
     */
    reset() {
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        this.currentBackoffInterval = this.backoffConfig.initialInterval;
        console.log('Upload backoff reset');
    }
    
    /**
     * Manually trigger backoff reset (e.g., when user manually retries)
     */
    forceReset() {
        console.log('Upload backoff force reset by user action');
        this.reset();
    }
    
    /**
     * Get current backoff state for debugging/UI
     */
    getState() {
        return {
            consecutiveFailures: this.consecutiveFailures,
            currentInterval: this.currentBackoffInterval,
            maxInterval: this.backoffConfig.maxInterval,
            isInBackoff: this.isInBackoff(),
            timeRemaining: this.getBackoffTimeRemaining()
        };
    }
}

module.exports = { UploadBackoffManager }; 