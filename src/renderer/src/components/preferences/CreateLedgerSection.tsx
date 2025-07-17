import React, { useState, useEffect } from 'react';
import SimpleSwitch from '../generic/SimpleSwitch';
import CustomSelect from '../generic/CustomSelect';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../api/ZenTransferAPI';

export interface CreateLedgerChangeNotification {
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface CreateLedgerSectionProps {
  onChange?: (notification: CreateLedgerChangeNotification) => void;
}

interface CreateLedgerState {
  enabled: boolean;
  complexityBits: number;
  publicLinks: boolean;
}

interface PerformanceEstimate {
  bits: number;
  coresUsed: number;
  totalCores: number;
  hashRatePerCore: string;
  totalHashRate: string;
  estimatedTime: string;
}

const CreateLedgerSection: React.FC<CreateLedgerSectionProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<CreateLedgerState>({
    enabled: false,
    complexityBits: 8,
    publicLinks: true,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [performanceEstimate, setPerformanceEstimate] = useState<PerformanceEstimate | null>(null);
  const [estimatingPerformance, setEstimatingPerformance] = useState<boolean>(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Estimate performance when complexity bits change
  useEffect(() => {
    if (!loading && settings.enabled) {
      estimatePerformance(settings.complexityBits);
    }
  }, [settings.complexityBits, settings.enabled, loading]);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const ledgerConfig = await api.config.get('ledger');
      
      if (ledgerConfig && typeof ledgerConfig === 'object') {
        const config = ledgerConfig as any;
        setSettings({
          enabled: Boolean(config['enabled'] || false),
          complexityBits: Number(config['complexityBits'] || 8),
          publicLinks: Boolean(config['publicLinks'] !== undefined ? config['publicLinks'] : true),
        });
      }
    } catch (error) {
      console.error('Failed to load Create Ledger settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const estimatePerformance = async (bits: number) => {
    setEstimatingPerformance(true);
    try {
      const api = getElectronAPI();
      const result = await api.utility.estimatePOWPerformance(bits);
      setPerformanceEstimate(result);
    } catch (error) {
      console.error('Failed to estimate POW performance:', error);
      setPerformanceEstimate(null);
    } finally {
      setEstimatingPerformance(false);
    }
  };

  const updateCreateLedgerSetting = async (property: string, value: any) => {
    const oldValue = (settings as any)[property];
    
    // Update local state first for immediate UI feedback
    setSettings(prev => ({ ...prev, [property]: value }));
    
    try {
      const api = getElectronAPI();
      
      // Use current local state as base to preserve all settings
      const updatedSettings = {
        enabled: settings.enabled,
        complexityBits: settings.complexityBits,
        publicLinks: settings.publicLinks,
        [property]: value, // Override with the new value
      };
      
      await api.config.set('ledger', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: CreateLedgerChangeNotification = {
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update Create Ledger ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateCreateLedgerSetting('enabled', enabled);
  };

  const handleComplexityBitsChange = (value: number) => {
    updateCreateLedgerSetting('complexityBits', value);
  };

  const handlePublicLinksChange = (publicLinks: boolean) => {
    updateCreateLedgerSetting('publicLinks', publicLinks);
  };

  const handleComplexityBitsInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 32) {
      handleComplexityBitsChange(value);
    }
  };

  const handlePresetChange = (value: string) => {
    if (value !== 'custom') {
      const presetValue = parseInt(value, 10);
      handleComplexityBitsChange(presetValue);
    }
  };

  // Define presets
  const complexityPresets = [
    { value: '5', label: 'Testing: 5' },
    { value: '13', label: 'Light Security: 13' },
    { value: '20', label: 'High Security: 20' },
    { value: '28', label: 'Maximum Security: 28' },
    { value: 'custom', label: 'Custom' }
  ];

  // Determine current preset or custom
  const getCurrentPreset = () => {
    const presetMatch = complexityPresets.find(preset => 
      preset.value !== 'custom' && parseInt(preset.value, 10) === settings.complexityBits
    );
    return presetMatch ? presetMatch.value : 'custom';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpenIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Create Ledger</h3>
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
          <BookOpenIcon className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Create Ledger</h3>
        </div>
        <SimpleSwitch
          checked={settings.enabled}
          onChange={handleEnabledChange}
        />
      </div>
      
      {settings.enabled && (
        <div className="space-y-6 mt-6">
          {/* Complexity Bits */}
          <div className="space-y-2">
            <label htmlFor="complexityBits" className="block text-sm font-medium text-gray-700">
              Complexity Bits
            </label>
            <div className="flex space-x-2">
              <input
                id="complexityBits"
                type="number"
                min="1"
                max="64"
                value={settings.complexityBits}
                onChange={handleComplexityBitsInputChange}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
              <div className="w-48">
                <CustomSelect
                  value={getCurrentPreset()}
                  onChange={handlePresetChange}
                  options={complexityPresets}
                  placeholder="Select preset"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Computational complexity for ledger entries. Higher values provide more security but require more computation.
            </p>
            
            {/* Performance Estimation */}
            {settings.enabled && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <div className="text-sm font-medium text-gray-700 mb-2">Performance Estimation</div>
                {estimatingPerformance ? (
                  <div className="text-sm text-gray-500">Calculating...</div>
                ) : performanceEstimate ? (
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Cores Available: {performanceEstimate.coresUsed}</div>
                    <div className="font-medium text-gray-700">Time per File: {performanceEstimate.estimatedTime}</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Performance estimation unavailable</div>
                )}
              </div>
            )}
          </div>

          {/* Public Links Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-700">Public Links</label>
              <p className="text-sm text-gray-500">Enable public access to ledger entries via shareable links</p>
            </div>
            <SimpleSwitch
              checked={settings.publicLinks}
              onChange={handlePublicLinksChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateLedgerSection; 