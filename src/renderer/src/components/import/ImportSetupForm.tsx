import React from 'react';
import { Checkbox } from '../catalyst/checkbox';
import { Select } from '../catalyst/select';
import { Input } from '../catalyst/input';
import { Button } from '../catalyst/button';
import FolderSelector from './FolderSelector';
import CloudServiceSelector from './CloudServiceSelector';
import type { ImportSettings } from '../../types/import';

interface ImportSetupFormProps {
  settings: Partial<ImportSettings>;
  onSettingsChange: (updates: Partial<ImportSettings>) => void;
  onStartImport: () => void;
  onStartDiscovery: () => void;
  canStartImport: boolean;
  isDiscovering: boolean;
  hasFiles: boolean;
  disabled?: boolean;
}

const ImportSetupForm: React.FC<ImportSetupFormProps> = ({
  settings,
  onSettingsChange,
  onStartImport,
  onStartDiscovery,
  canStartImport,
  isDiscovering,
  hasFiles,
  disabled = false
}) => {
  const handleFolderOrganizationChange = (checked: boolean): void => {
    onSettingsChange({ organizeIntoFolders: checked });
  };

  const handleFolderTypeChange = (value: string): void => {
    onSettingsChange({ 
      folderOrganizationType: value as 'date' | 'custom' 
    });
  };

  const handleDateFormatChange = (value: string): void => {
    onSettingsChange({ dateFormat: value });
  };

  const handleCustomFolderNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onSettingsChange({ customFolderName: e.target.value });
  };

  const handleBackupToggle = (checked: boolean): void => {
    onSettingsChange({ backupEnabled: checked });
  };

  const handleCloudServiceChange = (service: string, enabled: boolean): void => {
    switch (service) {
      case 'zentransfer':
        onSettingsChange({ uploadToZenTransfer: enabled });
        break;
      case 'aws-s3':
        onSettingsChange({ uploadToAwsS3: enabled });
        break;
      case 'azure-blob':
        onSettingsChange({ uploadToAzure: enabled });
        break;
      case 'gcp-storage':
        onSettingsChange({ uploadToGcp: enabled });
        break;
      case 'minio':
        onSettingsChange({ uploadToMinio: enabled });
        break;
    }
  };

  const dateFormatOptions = [
    { value: '2025/05/26', label: '2025/05/26 (YYYY/MM/DD)' },
    { value: '2025-05-26', label: '2025-05-26 (YYYY-MM-DD)' },
    { value: '2025/2025-05-26', label: '2025/2025-05-26' },
    { value: '2025/may 26', label: '2025/may 26' },
    { value: '2025/05', label: '2025/05 (YYYY/MM)' },
    { value: '2025/may', label: '2025/may' },
    { value: '2025/may/26', label: '2025/may/26' },
    { value: '2025/2025-05/2025-05-26', label: '2025/2025-05/2025-05-26' },
    { value: '2025 may 26', label: '2025 may 26' },
    { value: '20250526', label: '20250526 (YYYYMMDD)' }
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Source Directory */}
      <FolderSelector
        label="Import from"
        value={settings.sourcePath || ''}
        onChange={(path) => onSettingsChange({ sourcePath: path })}
        placeholder="Select source directory (e.g., SD card)..."
        required
        disabled={disabled}
        helpText="Select the folder containing files to import"
      />

      {/* Include Subdirectories */}
      <div className="flex items-center space-x-3">
        <Checkbox
          checked={settings.includeSubdirectories !== false}
          onChange={(checked) => onSettingsChange({ includeSubdirectories: checked })}
          disabled={disabled}
        />
        <label className="text-sm font-medium text-gray-700 cursor-pointer">
          Include subfolders
        </label>
      </div>

      {/* Destination Directory */}
      <FolderSelector
        label="Destination"
        value={settings.destinationPath || ''}
        onChange={(path) => onSettingsChange({ destinationPath: path })}
        placeholder="Select destination directory..."
        required
        disabled={disabled}
        helpText="Where to copy the imported files"
      />

      {/* Folder Organization */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={settings.organizeIntoFolders !== false}
            onChange={handleFolderOrganizationChange}
            disabled={disabled}
          />
          <label className="text-sm font-medium text-gray-700 cursor-pointer">
            Organize into folders
          </label>
        </div>

        {settings.organizeIntoFolders && (
          <div className="ml-7 space-y-4">
            {/* Date-based organization */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id="dateFolderRadio"
                  name="folderOrganization"
                  value="date"
                  checked={settings.folderOrganizationType !== 'custom'}
                  onChange={() => handleFolderTypeChange('date')}
                  disabled={disabled}
                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="dateFolderRadio" className="text-sm text-gray-700">
                  Organize by date:
                </label>
              </div>
              
              <div className="ml-7">
                <Select
                  value={settings.dateFormat || '2025/05/26'}
                  onChange={(e) => handleDateFormatChange(e.target.value)}
                  disabled={disabled || settings.folderOrganizationType === 'custom'}
                  className="w-full max-w-sm"
                >
                  {dateFormatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Custom folder organization */}
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id="customFolderRadio"
                  name="folderOrganization"
                  value="custom"
                  checked={settings.folderOrganizationType === 'custom'}
                  onChange={() => handleFolderTypeChange('custom')}
                  disabled={disabled}
                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="customFolderRadio" className="text-sm text-gray-700">
                  Custom folder name:
                </label>
              </div>
              
              <div className="ml-7">
                <Input
                  value={settings.customFolderName || ''}
                  onChange={handleCustomFolderNameChange}
                  placeholder="Enter folder name..."
                  disabled={disabled || settings.folderOrganizationType !== 'custom'}
                  className="w-full max-w-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup Option */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={settings.backupEnabled || false}
            onChange={handleBackupToggle}
            disabled={disabled}
          />
          <label className="text-sm font-medium text-gray-700 cursor-pointer">
            Create backup copy
          </label>
        </div>

        {settings.backupEnabled && (
          <div className="ml-7">
            <FolderSelector
              label="Backup location"
              value={settings.backupPath || ''}
              onChange={(path) => onSettingsChange({ backupPath: path })}
              placeholder="Select backup directory..."
              required={settings.backupEnabled}
              disabled={disabled}
              helpText="Additional backup location for imported files"
            />
          </div>
        )}
      </div>

      {/* Cloud Upload Services */}
      <CloudServiceSelector
        enableCloudUpload={settings.enableCloudUpload || false}
        onEnableCloudUploadChange={(enabled) => onSettingsChange({ enableCloudUpload: enabled })}
        uploadToZenTransfer={settings.uploadToZenTransfer || false}
        uploadToAwsS3={settings.uploadToAwsS3 || false}
        uploadToAzure={settings.uploadToAzure || false}
        uploadToGcp={settings.uploadToGcp || false}
        uploadToMinio={settings.uploadToMinio || false}
        onServiceChange={handleCloudServiceChange}
        disabled={disabled}
      />

      {/* Discovery and Import Actions */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        {/* Discover Files Button */}
        {!hasFiles && (
          <Button
            onClick={onStartDiscovery}
            disabled={disabled || isDiscovering || !settings.sourcePath}
            className="w-full"
            color="blue"
          >
            {isDiscovering ? 'Discovering Files...' : 'Start Import'}
          </Button>
        )}

        {/* Start Import Button */}
        {hasFiles && (
          <Button
            onClick={onStartImport}
            disabled={disabled || !canStartImport}
            className="w-full"
            color="purple"
          >
            Start Import
          </Button>
        )}

        {/* Validation Messages */}
        {!settings.sourcePath && (
          <p className="text-sm text-amber-600">
            Please select a source directory to begin
          </p>
        )}
        
        {settings.sourcePath && !settings.destinationPath && (
          <p className="text-sm text-amber-600">
            Please select a destination directory
          </p>
        )}
        
        {settings.backupEnabled && !settings.backupPath && (
          <p className="text-sm text-amber-600">
            Please select a backup directory
          </p>
        )}
        
        {settings.organizeIntoFolders && 
         settings.folderOrganizationType === 'custom' && 
         !settings.customFolderName && (
          <p className="text-sm text-amber-600">
            Please enter a custom folder name
          </p>
        )}
      </div>
    </div>
  );
};

export default ImportSetupForm; 