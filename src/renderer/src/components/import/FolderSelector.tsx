import React, { useState, useEffect } from 'react';
import { getElectronAPI } from '../../api/ZenTransferAPI';
import SplitButton from './SplitButton';

interface FolderSelectorProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  type?: 'source' | 'destination';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
}

const FolderSelector: React.FC<FolderSelectorProps> = ({
  label,
  value,
  onChange,
  type = 'source',
  placeholder = "Select folder...",
  required = false,
  disabled = false,
  error,
  helpText
}) => {
  const [recentFolders, setRecentFolders] = useState<string[]>([]);

  // Load recent folders when component mounts or type changes
  useEffect(() => {
    loadRecentFolders();
  }, [type]);

  const loadRecentFolders = async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      let folders: ReadonlyArray<string>;
      
      if (type === 'destination') {
        folders = await api.config.getLastUsedDestinationFolders();
      } else {
        folders = await api.config.getLastUsedSourceFolders();
      }
      
      setRecentFolders([...folders]);
    } catch (error) {
      console.error('Failed to load recent folders:', error);
      setRecentFolders([]);
    }
  };

  const rememberFolder = async (folder: string): Promise<void> => {
    try {
      const api = getElectronAPI();
      
      if (type === 'destination') {
        await api.config.rememberDestinationFolder(folder);
      } else {
        await api.config.rememberSourceFolder(folder);
      }
      
      // Reload recent folders to update the list
      await loadRecentFolders();
    } catch (error) {
      console.error('Failed to remember folder:', error);
    }
  };

  const handleFolderChange = async (path: string): Promise<void> => {
    onChange(path);
    await rememberFolder(path);
  };
  const handleBrowse = async (): Promise<void> => {
          try {
        const api = getElectronAPI();
        const result = await api.dialog.showDirectoryDialog();
        await handleFolderChange(result);
      } catch (error) {
        console.error('Failed to open directory dialog:', error);
      }
  };

  return (
    <div className="w-full space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <SplitButton
        value={value}
        onSelect={handleFolderChange}
        onBrowse={handleBrowse}
        onDropdownOpen={loadRecentFolders}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        recentPaths={recentFolders}
      />
      
      {/* {helpText && !error && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )} */}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default FolderSelector; 