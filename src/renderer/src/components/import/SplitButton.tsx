import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../catalyst/button';

interface SplitButtonProps {
  value: string;
  onSelect: (path: string) => void;
  onBrowse: () => void;
  onDropdownOpen?: () => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  error?: string | undefined;
  recentPaths?: string[];
}

// Placeholder common paths
const defaultRecentPaths = [
  '/Users/username/Desktop',
  '/Users/username/Documents', 
  '/Users/username/Pictures',
  '/Users/username/Downloads',
  'C:\\Users\\username\\Desktop',
  'C:\\Users\\username\\Documents',
  'C:\\Users\\username\\Pictures', 
  'C:\\Users\\username\\Downloads',
  '/Volumes/SD Card',
  '/Volumes/USB Drive',
  'D:\\',
  'E:\\',
];

const SplitButton: React.FC<SplitButtonProps> = ({
  value,
  onSelect,
  onBrowse,
  onDropdownOpen,
  placeholder = "Select folder...",
  disabled = false,
  error,
  recentPaths = defaultRecentPaths
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownToggle = async () => {
    if (!disabled) {
      const willOpen = !isDropdownOpen;
      
      // If opening the dropdown, refresh the recent paths first
      if (willOpen && onDropdownOpen) {
        await onDropdownOpen();
      }
      
      setIsDropdownOpen(willOpen);
    }
  };

  const handlePathSelect = (path: string) => {
    onSelect(path);
    setIsDropdownOpen(false);
  };

  // Filter out current value from dropdown options
  const availablePaths = recentPaths.filter(path => path !== value);

  return (
    <div className="relative flex w-full" ref={dropdownRef}>
      {/* Main input area with dropdown */}
      <div className="flex-1 min-w-0 relative">
        <div
          className={`flex items-center w-full px-3 py-2 text-sm border rounded-l-lg bg-white cursor-pointer ${
            error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300'
          } ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'
          } ${isDropdownOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
          onClick={handleDropdownToggle}
        >
          <span className={`flex-1 truncate ${value ? 'text-gray-900' : 'text-gray-500'}`}>
            {value || placeholder}
          </span>
          <svg
            className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown menu */}
        {isDropdownOpen && availablePaths.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="py-1">
              {availablePaths.map((path, index) => (
                <button
                  key={index}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  onClick={() => handlePathSelect(path)}
                >
                  <span className="truncate block" title={path}>
                    {path}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Browse button */}
      <Button
        outline
        onClick={onBrowse}
        disabled={disabled}
        className={`flex-shrink-0 w-20 text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 flex items-center justify-center rounded-l-none border-l-0 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
        style={{ fontWeight: '300', lineHeight: '1' }}
      >
        Browse
      </Button>
    </div>
  );
};

export default SplitButton; 