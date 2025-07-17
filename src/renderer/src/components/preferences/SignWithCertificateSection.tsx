import React, { useState, useEffect } from 'react';
import SimpleSwitch from '../generic/SimpleSwitch';
import SecureInput from '../generic/SecureInput';
import { DocumentIcon, KeyIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../api/ZenTransferAPI';

export interface SignWithCertificateChangeNotification {
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface SignWithCertificateSectionProps {
  onChange?: (notification: SignWithCertificateChangeNotification) => void;
}

interface SignWithCertificateState {
  enabled: boolean;
  certificate: string;
  certificatePassword: string;
  enableC2PA: boolean;
  certificateFileName: string;
}

const SignWithCertificateSection: React.FC<SignWithCertificateSectionProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<SignWithCertificateState>({
    enabled: false,
    certificate: '',
    certificatePassword: '',
    enableC2PA: false,
    certificateFileName: '',
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const signWithCertificateConfig = await api.config.get('signWithCertificate');
      
      if (signWithCertificateConfig && typeof signWithCertificateConfig === 'object') {
        const config = signWithCertificateConfig as any;
        setSettings({
          enabled: Boolean(config['enabled'] || false),
          certificate: String(config['certificate'] || ''),
          certificatePassword: String(config['certificatePassword'] || ''),
          enableC2PA: Boolean(config['enableC2PA'] || false),
          certificateFileName: config['certificate'] ? 'Certificate loaded' : '',
        });
      }
    } catch (error) {
      console.error('Failed to load Sign with Certificate settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSignWithCertificateSetting = async (property: string, value: any) => {
    const oldValue = (settings as any)[property];
    
    // Update local state first for immediate UI feedback
    setSettings(prev => ({ ...prev, [property]: value }));
    
    try {
      const api = getElectronAPI();
      
      // Use current local state as base to preserve all settings
      const updatedSettings = {
        enabled: settings.enabled,
        certificate: settings.certificate,
        certificatePassword: settings.certificatePassword,
        enableC2PA: settings.enableC2PA,
        [property]: value, // Override with the new value
      };
      
      await api.config.set('signWithCertificate', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: SignWithCertificateChangeNotification = {
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update Sign with Certificate ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateSignWithCertificateSetting('enabled', enabled);
  };

  const handleCertificatePasswordChange = (value: string) => {
    updateSignWithCertificateSetting('certificatePassword', value);
  };

  const handleEnableC2PAChange = (enableC2PA: boolean) => {
    updateSignWithCertificateSetting('enableC2PA', enableC2PA);
  };

  const handleCertificateChange = (certificateContent: string, fileName: string) => {
    setSettings(prev => ({ ...prev, certificate: certificateContent, certificateFileName: fileName }));
    updateSignWithCertificateSetting('certificate', certificateContent);
  };

  const handleClearCertificate = () => {
    setSettings(prev => ({ ...prev, certificate: '', certificateFileName: '' }));
    updateSignWithCertificateSetting('certificate', '');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handleCertificateChange(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <KeyIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Sign with Digital ID</h3>
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
          <KeyIcon className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Sign with Digital ID</h3>
        </div>
        <SimpleSwitch
          checked={settings.enabled}
          onChange={handleEnabledChange}
        />
      </div>
      
      {settings.enabled && (
        <div className="space-y-6 mt-6">
          {/* Certificate File */}
          <div className="space-y-2">
            <label htmlFor="certificateFile" className="block text-sm font-medium text-gray-700">
              Certificate File <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="certificateFile"
                accept=".p12,.pfx,.pem,.crt,.cer"
                onChange={handleFileUpload}
                className="hidden"
                required
              />
              <button
                type="button"
                onClick={() => document.getElementById('certificateFile')?.click()}
                className="flex-1 text-left justify-start bg-white hover:bg-gray-50 text-gray-900 font-medium py-2.5 px-4 rounded-md border border-gray-300 hover:border-gray-400 transition-colors duration-200 flex items-center"
              >
                <DocumentIcon className="w-4 h-4 mr-2" />
                {settings.certificateFileName || 'Choose certificate file...'}
              </button>
              {settings.certificate && (
                <button
                  type="button"
                  onClick={handleClearCertificate}
                  className="px-3 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors duration-200"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Select your certificate file (.p12, .pfx, .pem, .crt, .cer).
            </p>
          </div>

          {/* Certificate Password */}
          <SecureInput
            id="certificate-password"
            label="Certificate Password"
            value={settings.certificatePassword}
            onChange={handleCertificatePasswordChange}
            placeholder="Enter certificate password"
          />

          {/* Enable C2PA Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-700">Enable C2PA</label>
              <p className="text-sm text-gray-500">Enable Content Authenticity Initiative (C2PA) metadata</p>
            </div>
            <SimpleSwitch
              checked={settings.enableC2PA}
              onChange={handleEnableC2PAChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SignWithCertificateSection; 