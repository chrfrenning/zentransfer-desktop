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
      const api = getElectronAPI();
      const value = await api.config.get(settingKey);
      setChecked(Boolean(value));
    } catch (error) {
      console.error(`Failed to load setting ${settingKey}:`, error);
      // Default to false if loading fails
      setChecked(false);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (newValue: boolean) => {
    const oldValue = checked;
    
    try {
      const api = getElectronAPI();
      await api.config.set(settingKey, newValue);
      setChecked(newValue);

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
      // Revert to old value on error
      setChecked(oldValue);
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