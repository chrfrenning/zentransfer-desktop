import React, { useState, useEffect } from 'react';
import SimpleSwitch from './SimpleSwitch';
import { getElectronAPI } from '../api/ZenTransferAPI';

// Change notifier interface (not wired up yet as requested)
export interface SettingChangeNotification {
  setting: string;
  oldValue: boolean;
  newValue: boolean;
  timestamp: number;
}

interface PreferenceSettingProps {
  label: string;
  description: string;
  settingKey: string; // Changed from settingSection to be more clear
  onChange?: ((notification: SettingChangeNotification) => void) | undefined; // Optional change notifier
}

const PreferenceSetting: React.FC<PreferenceSettingProps> = ({
  label,
  description,
  settingKey,
  onChange,
}) => {
  const [checked, setChecked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Load the setting value on mount
  useEffect(() => {
    loadSetting();
  }, [settingKey]);

  const loadSetting = async () => {
    try {
      console.log(`PreferenceSetting: Loading setting ${settingKey}`);
      
      // Try ZenTransferAPI first
      const api = getElectronAPI();
      console.log('PreferenceSetting: ZenTransferAPI obtained for loading');
      
      const value = await api.config.get(settingKey);
      console.log(`PreferenceSetting: Loaded ${settingKey} =`, value);
      setChecked(Boolean(value));
    } catch (error) {
      console.error(`Failed to load setting ${settingKey}:`, error);
      
      // Fallback to window.electronAPI if ZenTransferAPI fails
      try {
        console.log(`PreferenceSetting: Trying fallback window.electronAPI for ${settingKey}`);
        if (window.electronAPI) {
          const value = await window.electronAPI.config.get(settingKey);
          console.log(`PreferenceSetting: Loaded via fallback ${settingKey} =`, value);
          setChecked(Boolean(value));
        } else {
          console.error('window.electronAPI not available');
          setChecked(false);
        }
      } catch (fallbackError) {
        console.error(`Fallback also failed for ${settingKey}:`, fallbackError);
        setChecked(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (newValue: boolean) => {
    const oldValue = checked;
    
    console.log(`PreferenceSetting: Changing ${settingKey} from ${oldValue} to ${newValue}`);
    
    // Update local state first for immediate UI feedback
    setChecked(newValue);
    
    try {
      console.log('PreferenceSetting: Getting ZenTransferAPI...');
      const api = getElectronAPI();
      console.log('PreferenceSetting: API obtained, checking if config.set exists:', typeof api.config.set);
      
      console.log(`PreferenceSetting: Calling api.config.set('${settingKey}', ${newValue})`);
      const result = await api.config.set(settingKey, newValue);
      console.log(`PreferenceSetting: API call result:`, result);
      console.log(`PreferenceSetting: Successfully saved ${settingKey} = ${newValue}`);

      // Emit change notification
      if (onChange) {
        const notification: SettingChangeNotification = {
          setting: settingKey,
          oldValue,
          newValue,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update setting ${settingKey}:`, error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      
      // Try fallback to window.electronAPI
      try {
        console.log(`PreferenceSetting: Trying fallback window.electronAPI.config.set for ${settingKey}`);
        if (window.electronAPI) {
          await window.electronAPI.config.set(settingKey, newValue);
          console.log(`PreferenceSetting: Successfully saved via fallback ${settingKey} = ${newValue}`);
          
          // Emit change notification
          if (onChange) {
            const notification: SettingChangeNotification = {
              setting: settingKey,
              oldValue,
              newValue,
              timestamp: Date.now(),
            };
            onChange(notification);
          }
        } else {
          console.error('window.electronAPI not available for fallback');
          setChecked(oldValue);
        }
      } catch (fallbackError) {
        console.error(`Fallback save also failed for ${settingKey}:`, fallbackError);
        // Revert to old value on error
        setChecked(oldValue);
      }
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <SimpleSwitch
        checked={checked}
        disabled={loading}
        onChange={handleChange}
      />
    </div>
  );
};

export default PreferenceSetting; 