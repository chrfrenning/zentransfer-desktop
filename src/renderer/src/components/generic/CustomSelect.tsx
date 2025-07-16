import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  required = false,
  className = "",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Find the selected option
  const selectedOption = options.find(option => option.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (isOpen && focusedIndex >= 0) {
          const option = options[focusedIndex];
          if (option && !option.disabled) {
            onChange(option.value);
            setIsOpen(false);
            setFocusedIndex(-1);
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          const nextIndex = Math.min(focusedIndex + 1, options.length - 1);
          setFocusedIndex(nextIndex);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          const prevIndex = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prevIndex);
        }
        break;
    }
  };

  const handleOptionClick = (option: Option) => {
    if (!option.disabled) {
      onChange(option.value);
      setIsOpen(false);
      setFocusedIndex(-1);
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        // Find the currently selected option index for keyboard navigation
        const selectedIndex = options.findIndex(option => option.value === value);
        setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        setFocusedIndex(-1);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      {/* Hidden input for form submission */}
      <input
        type="hidden"
        id={id}
        name={id}
        value={value}
        required={required}
      />
      
      {/* Custom select button */}
      <button
        type="button"
        className={`
          relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm
          focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
          ${disabled ? 'cursor-not-allowed bg-gray-50 text-gray-500' : 'hover:border-gray-400'}
          text-sm
        `}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={id ? `${id}-label` : undefined}
      >
        <span className="block truncate">
          {selectedOption ? selectedOption.label : (
            <span className="text-gray-400 italic">{placeholder}</span>
          )}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon 
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true" 
          />
        </span>
      </button>

      {/* Dropdown options */}
      {isOpen && (
        <div
          ref={optionsRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="listbox"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`
                relative cursor-pointer select-none py-2 pl-3 pr-9 text-sm
                ${option.disabled 
                  ? 'cursor-not-allowed text-gray-400 bg-gray-50' 
                  : focusedIndex === index
                    ? 'bg-blue-100 text-blue-900'
                    : value === option.value
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                }
              `}
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={value === option.value}
              onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
            >
              <span className={`block truncate ${value === option.value ? 'font-medium' : 'font-normal'}`}>
                {option.label}
              </span>
              {value === option.value && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600">
                  ✓
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect; 