import React from 'react';

interface SimpleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const SimpleSwitch: React.FC<SimpleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      className={`
        relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${checked ? 'bg-blue-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="sr-only">Toggle setting</span>
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  );
};

export default SimpleSwitch; 