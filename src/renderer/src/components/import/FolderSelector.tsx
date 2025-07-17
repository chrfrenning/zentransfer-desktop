import React from 'react';
import { Button } from '../catalyst/button';
import { Input } from '../catalyst/input';
import { getElectronAPI } from '../../api/ZenTransferAPI';

interface FolderSelectorProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
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
  placeholder = "Select folder...",
  required = false,
  disabled = false,
  error,
  helpText
}) => {
  const handleBrowse = async (): Promise<void> => {
    try {
      const api = getElectronAPI();
      const result = await api.dialog.showDirectoryDialog();
      
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        if (selectedPath) {
          onChange(selectedPath);
          console.log('Folder selected:', selectedPath);
        }
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
      // Fallback for development/testing
      const fallbackPath = prompt(`Enter ${label.toLowerCase()} path:`, value);
      if (fallbackPath && fallbackPath.trim()) {
        onChange(fallbackPath.trim());
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="flex space-x-2">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={placeholder}
            readOnly
            disabled={disabled}
            className={`cursor-pointer ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            onClick={!disabled ? handleBrowse : undefined}
          />
        </div>
        
        <Button
          outline
          onClick={handleBrowse}
          disabled={disabled}
          className="flex-shrink-0 text-sm text-gray-500 border-gray-300 hover:text-gray-700 hover:border-gray-400 flex items-center justify-center"
          style={{ fontWeight: '300', lineHeight: '1' }}
        >
          Browse
        </Button>
      </div>
      
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