/**
 * Device Manager
 * Handles device ID generation and management
 */

export class DeviceManager {
    static DEVICE_ID_KEY = 'zentransfer_device_id';
    
    static async getDeviceId() {
        try {
            // Try to get device ID from configuration system first
            let deviceId = await window.electronAPI.config.get('deviceId');
            
            if (!deviceId) {
                // Fallback to localStorage for migration
                deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
                
                if (!deviceId) {
                    // Generate new device ID
                    deviceId = this.generateGUID();
                    window.logger.info('Generated new device ID:', deviceId);
                }
                
                // Save to configuration system
                await window.electronAPI.config.set('deviceId', deviceId);
                
                // Clear from localStorage after migration
                localStorage.removeItem(this.DEVICE_ID_KEY);
            }
            
            return deviceId;
        } catch (error) {
            console.error('Failed to get device ID from configuration, falling back to localStorage:', error);
            // Fallback to localStorage if configuration system fails
            let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
            if (!deviceId) {
                deviceId = this.generateGUID();
                localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
                window.logger.info('Generated new device ID (localStorage fallback):', deviceId);
            }
            return deviceId;
        }
    }
    
    static async clearDeviceId() {
        try {
            await window.electronAPI.config.set('deviceId', '');
            localStorage.removeItem(this.DEVICE_ID_KEY);
            window.logger.info('Device ID cleared from configuration and localStorage');
        } catch (error) {
            console.error('Failed to clear device ID from configuration:', error);
            localStorage.removeItem(this.DEVICE_ID_KEY);
            window.logger.info('Device ID cleared from localStorage only');
        }
    }
} 