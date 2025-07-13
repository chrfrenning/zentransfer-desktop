/**
 * Device Manager
 * Handles device ID generation and management
 */

export class DeviceManager {
    static DEVICE_ID_KEY = 'zentransfer_device_id';
    
    static generateGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    static getDeviceId() {
        let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = this.generateGUID();
            localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
            console.log('Generated new device ID:', deviceId);
        }
        return deviceId;
    }
    
    static clearDeviceId() {
        localStorage.removeItem(this.DEVICE_ID_KEY);
        console.log('Device ID cleared');
    }
} 