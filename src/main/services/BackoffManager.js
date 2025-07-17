/**
 * Upload Backoff Manager
 * Manages global exponential backoff for upload retries
 */

const logger = require('../utils/Logger.js');

class BackOffManager {
    constructor(initialInterval, maxInterval, multiplier, resetOnSuccess) {
        this.backoffConfig = {
            initialInterval: initialInterval,
            maxInterval: maxInterval,
            multiplier: multiplier,
            resetOnSuccess: resetOnSuccess
        };
        
        this.lastFailureTime = 0;
        this.consecutiveFailures = 0;
        this.currentBackoffInterval = this.backoffConfig.initialInterval;
    }
    
    onFailure() {
        this.increase();
    }

    increase() {
        this.consecutiveFailures++;
        this.lastFailureTime = Date.now();
        
        // Calculate new backoff interval with exponential increase
        this.currentBackoffInterval = Math.min(
            this.backoffConfig.initialInterval * Math.pow(this.backoffConfig.multiplier, this.consecutiveFailures - 1),
            this.backoffConfig.maxInterval
        );
        
        logger.warn(`Backoff increase to #${this.consecutiveFailures}, backoff time now: ${this.currentBackoffInterval}ms`);
    }
    
    onSuccess() {
        if (this.backoffConfig.resetOnSuccess && this.consecutiveFailures > 0) {
            logger.info('Success - resetting backoff');
            this.reset();
        }
    }
    
    isInBackoff() {
        if (this.consecutiveFailures === 0) return false;
        
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return timeSinceLastFailure < this.currentBackoffInterval;
    }
    
    getBackoffTimeRemaining() {
        if (!this.isInBackoff()) return 0;
        
        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return Math.max(0, this.currentBackoffInterval - timeSinceLastFailure);
    }
    
    reset() {
        this.consecutiveFailures = 0;
        this.lastFailureTime = 0;
        this.currentBackoffInterval = this.backoffConfig.initialInterval;
        
        logger.info('Upload backoff reset');
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

module.exports = { BackOffManager }; 