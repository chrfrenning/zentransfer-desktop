import React, { useState, useEffect } from 'react';
import SimpleSwitch from '../generic/SimpleSwitch';
import SecureInput from '../generic/SecureInput';
import { DocumentIcon, FingerPrintIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../api/ZenTransferAPI';

export interface SignWithPGPChangeNotification {
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface SignWithPGPSectionProps {
  onChange?: (notification: SignWithPGPChangeNotification) => void;
}

interface SignWithPGPState {
  enabled: boolean;
  pgpKey: string;
  pgpKeyPassword: string;
  pgpKeyFileName: string;
}

const SignWithPGPSection: React.FC<SignWithPGPSectionProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<SignWithPGPState>({
    enabled: false,
    pgpKey: '',
    pgpKeyPassword: '',
    pgpKeyFileName: '',
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const signWithPGPConfig = await api.config.get('signWithPGP');
      
      if (signWithPGPConfig && typeof signWithPGPConfig === 'object') {
        const config = signWithPGPConfig as any;
        setSettings({
          enabled: Boolean(config['enabled'] || false),
          pgpKey: String(config['pgpKey'] || ''),
          pgpKeyPassword: String(config['pgpKeyPassword'] || ''),
          pgpKeyFileName: config['pgpKey'] ? 'PGP key loaded' : '',
        });
      }
    } catch (error) {
      console.error('Failed to load Sign with PGP settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSignWithPGPSetting = async (property: string, value: any) => {
    const oldValue = (settings as any)[property];
    
    // Update local state first for immediate UI feedback
    setSettings(prev => ({ ...prev, [property]: value }));
    
    try {
      const api = getElectronAPI();
      
      // Use current local state as base to preserve all settings
      const updatedSettings = {
        enabled: settings.enabled,
        pgpKey: settings.pgpKey,
        pgpKeyPassword: settings.pgpKeyPassword,
        [property]: value, // Override with the new value
      };
      
      await api.config.set('signWithPGP', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: SignWithPGPChangeNotification = {
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update Sign with PGP ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateSignWithPGPSetting('enabled', enabled);
  };

  const handlePGPKeyPasswordChange = (value: string) => {
    updateSignWithPGPSetting('pgpKeyPassword', value);
  };

  const handlePGPKeyChange = (keyContent: string, fileName: string) => {
    setSettings(prev => ({ ...prev, pgpKey: keyContent, pgpKeyFileName: fileName }));
    updateSignWithPGPSetting('pgpKey', keyContent);
  };

  const handleClearPGPKey = () => {
    setSettings(prev => ({ ...prev, pgpKey: '', pgpKeyFileName: '' }));
    updateSignWithPGPSetting('pgpKey', '');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handlePGPKeyChange(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FingerPrintIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Sign with PGP</h3>
          </div>
          <div className="animate-pulse">
            <div className="h-6 w-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FingerPrintIcon className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Sign with PGP</h3>
        </div>
        <SimpleSwitch
          checked={settings.enabled}
          onChange={handleEnabledChange}
        />
      </div>
      
      {settings.enabled && (
        <div className="space-y-6 mt-6">
          {/* PGP Key File */}
          <div className="space-y-2">
            <label htmlFor="pgpKeyFile" className="block text-sm font-medium text-gray-700">
              PGP Key File <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="pgpKeyFile"
                accept=".asc,.pgp,.gpg,.key"
                onChange={handleFileUpload}
                className="hidden"
                required
              />
              <button
                type="button"
                onClick={() => document.getElementById('pgpKeyFile')?.click()}
                className="flex-1 text-left justify-start bg-white hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-md border border-gray-300 hover:border-gray-400 transition-colors duration-200 flex items-center"
              >
                <DocumentIcon className="w-4 h-4 mr-2" />
                {settings.pgpKeyFileName || 'Choose PGP key file...'}
              </button>
              {settings.pgpKey && (
                <button
                  type="button"
                  onClick={handleClearPGPKey}
                  className="px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors duration-200"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Select your PGP private key file (.asc, .pgp, .gpg, .key).
            </p>
          </div>

          {/* PGP Key Password */}
          <SecureInput
            id="pgp-key-password"
            label="PGP Key Password"
            value={settings.pgpKeyPassword}
            onChange={handlePGPKeyPasswordChange}
            placeholder="Enter PGP key password"
          />
        </div>
      )}
    </div>
  );
};

export default SignWithPGPSection; 