import React, { useState, useEffect } from 'react';
import SimpleSwitch from '../generic/SimpleSwitch';
import PreferenceSetting from './PreferenceSetting';
import SecureInput from '../generic/SecureInput';
import CustomSelect from '../generic/CustomSelect';
import { Textarea } from '../catalyst/textarea';
import { CogIcon } from '@heroicons/react/24/outline';
import { getElectronAPI } from '../../api/ZenTransferAPI';

export interface AutosortChangeNotification {
  property: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface AutosortSectionProps {
  onChange?: (notification: AutosortChangeNotification) => void;
}

interface AutosortState {
  enabled: boolean;
  enableFolderSort: boolean;
  folderPrompt: string;
  enableMetaData: boolean;
  metaDataPrompt: string;
  apiKeyOpenAI: string;
  model: string;
}

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

const AutosortSection: React.FC<AutosortSectionProps> = ({ onChange }) => {
  const [settings, setSettings] = useState<AutosortState>({
    enabled: false,
    enableFolderSort: false,
    folderPrompt: '',
    enableMetaData: false,
    metaDataPrompt: '',
    apiKeyOpenAI: '',
    model: 'gpt-4o',
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const api = getElectronAPI();
      const autoSortConfig = await api.config.get('autoSort');
      
      if (autoSortConfig && typeof autoSortConfig === 'object') {
        const config = autoSortConfig as any;
        setSettings({
          enabled: Boolean(config['enabled'] || false),
          enableFolderSort: Boolean(config['enableFolderSort'] || false),
          folderPrompt: String(config['folderPrompt'] || ''),
          enableMetaData: Boolean(config['enableMetaData'] || false),
          metaDataPrompt: String(config['metaDataPrompt'] || ''),
          apiKeyOpenAI: String(config['apiKeyOpenAI'] || ''),
          model: String(config['model'] || 'gpt-4o'),
        });
      }
    } catch (error) {
      console.error('Failed to load Autosort settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAutosortSetting = async (property: string, value: any) => {
    const oldValue = (settings as any)[property];
    
    // Update local state first for immediate UI feedback
    setSettings(prev => ({ ...prev, [property]: value }));
    
    try {
      const api = getElectronAPI();
      
      // Use current local state as base to preserve all settings
      const updatedSettings = {
        enabled: settings.enabled,
        enableFolderSort: settings.enableFolderSort,
        folderPrompt: settings.folderPrompt,
        enableMetaData: settings.enableMetaData,
        metaDataPrompt: settings.metaDataPrompt,
        apiKeyOpenAI: settings.apiKeyOpenAI,
        model: settings.model,
        [property]: value, // Override with the new value
      };
      
      await api.config.set('autoSort', updatedSettings);

      // Emit change notification
      if (onChange) {
        const notification: AutosortChangeNotification = {
          property,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        };
        onChange(notification);
      }
    } catch (error) {
      console.error(`Failed to update Autosort ${property} setting:`, error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [property]: oldValue }));
    }
  };

  // Event handlers
  const handleEnabledChange = (enabled: boolean) => {
    updateAutosortSetting('enabled', enabled);
  };

  const handleFolderSortChange = async (newValue: boolean) => {
    updateAutosortSetting('enableFolderSort', newValue);
  };

  const handleMetaDataChange = async (newValue: boolean) => {
    updateAutosortSetting('enableMetaData', newValue);
  };

  const handleFolderPromptChange = (value: string) => {
    updateAutosortSetting('folderPrompt', value);
  };

  const handleMetaDataPromptChange = (value: string) => {
    updateAutosortSetting('metaDataPrompt', value);
  };

  const handleApiKeyChange = (value: string) => {
    updateAutosortSetting('apiKeyOpenAI', value);
  };

  const handleModelChange = (value: string) => {
    updateAutosortSetting('model', value);
  };

  const fetchModels = async () => {
    if (!settings.apiKeyOpenAI) {
      console.warn('No OpenAI API key provided');
      return;
    }

    setModelsLoading(true);
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${settings.apiKeyOpenAI}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && data.data && Array.isArray(data.data)) {
        // Filter for GPT models and sort them
        const gptModels = data.data
          .filter((model: OpenAIModel) => model.id.includes('gpt'))
          .sort((a: OpenAIModel, b: OpenAIModel) => a.id.localeCompare(b.id));
        
        setModels(gptModels);
      }
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
      // Could show user-friendly error message here
    } finally {
      setModelsLoading(false);
    }
  };

  const handleModelSelect = (value: string) => {
    if (value === 'load-models') {
      fetchModels();
    } else if (value === 'refresh') {
      fetchModels();
    } else {
      handleModelChange(value);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CogIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Autosort</h3>
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
          <CogIcon className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Autosort</h3>
        </div>
        <SimpleSwitch
          checked={settings.enabled}
          onChange={handleEnabledChange}
        />
      </div>
      
      {settings.enabled && (
        <div className="space-y-6 mt-6">
          {/* Folder Structure Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-700">Folder structure</label>
              <p className="text-sm text-gray-500">Automatically organize files into folders based on AI analysis</p>
            </div>
            <SimpleSwitch
              checked={settings.enableFolderSort}
              onChange={handleFolderSortChange}
            />
          </div>

          {/* Folder Prompt - Show when folder structure is enabled */}
          {settings.enableFolderSort && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Folder organization prompt
              </label>
              <Textarea
                value={settings.folderPrompt}
                onChange={(e) => handleFolderPromptChange(e.target.value)}
                placeholder="Describe how you want files to be organized into folders..."
                className="w-full"
                rows={3}
              />
            </div>
          )}

          {/* Metadata Setting */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-700">Metadata</label>
              <p className="text-sm text-gray-500">Extract and enhance metadata using AI analysis</p>
            </div>
            <SimpleSwitch
              checked={settings.enableMetaData}
              onChange={handleMetaDataChange}
            />
          </div>

          {/* Metadata Prompt - Show when metadata is enabled */}
          {settings.enableMetaData && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Metadata extraction prompt
              </label>
              <Textarea
                value={settings.metaDataPrompt}
                onChange={(e) => handleMetaDataPromptChange(e.target.value)}
                placeholder="Describe what metadata you want to extract from files..."
                className="w-full"
                rows={3}
              />
            </div>
          )}

          {/* OpenAI API Key */}
          <SecureInput
            id="openai-api-key"
            label="OpenAI API Key"
            value={settings.apiKeyOpenAI}
            onChange={handleApiKeyChange}
            placeholder="sk-..."
          />

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Model
            </label>
            <CustomSelect
              value={settings.model}
              onChange={handleModelSelect}
              options={
                models.length === 0
                  ? [
                      // Show current value if it exists
                      ...(settings.model ? [{ value: settings.model, label: settings.model }] : []),
                      { value: 'load-models', label: modelsLoading ? 'Loading models...' : 'Load models' }
                    ]
                  : [
                      // Include current value if it's not in the loaded models
                      ...(settings.model && !models.find(m => m.id === settings.model) 
                        ? [{ value: settings.model, label: settings.model }] 
                        : []
                      ),
                      ...models.map(model => ({ value: model.id, label: model.id })),
                      { value: 'refresh', label: 'Refresh' }
                    ]
              }
              disabled={modelsLoading}
              placeholder="Select a model"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AutosortSection; 