import React from 'react';
import { 
  BoltIcon, 
  CheckIcon, 
  XMarkIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

type ButtonColor = 'orange' | 'blue' | 'red' | 'green' | 'purple';
type ButtonState = 'idle' | 'testing' | 'success' | 'error';

interface TestConnectionButtonProps {
  color: ButtonColor;
  state: ButtonState;
  onClick: () => void;
  disabled?: boolean;
}

const TestConnectionButton: React.FC<TestConnectionButtonProps> = ({
  color,
  state,
  onClick,
  disabled = false,
}) => {
  const getButtonText = () => {
    switch (state) {
      case 'testing':
        return 'Testing Connection...';
      case 'success':
        return 'Connection Successful!';
      case 'error':
        return 'Connection Failed';
      default:
        return 'Test Connection';
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'testing':
        return <ArrowPathIcon className="h-5 w-5 animate-spin" />;
      case 'success':
        return <CheckIcon className="h-5 w-5" />;
      case 'error':
        return <XMarkIcon className="h-5 w-5" />;
      default:
        return <BoltIcon className="h-5 w-5" />;
    }
  };

  const getButtonClasses = () => {
    const baseClasses = "w-full flex items-center justify-center space-x-2 font-semibold py-2.5 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    
    switch (state) {
      case 'success':
        return `${baseClasses} bg-green-600 hover:bg-green-700 text-white`;
      case 'error':
        return `${baseClasses} bg-red-600 hover:bg-red-700 text-white`;
      case 'testing':
        return `${baseClasses} bg-gray-600 text-white cursor-not-allowed`;
      default:
        switch (color) {
          case 'orange':
            return `${baseClasses} bg-orange-500 hover:bg-orange-600 text-white`;
          case 'blue':
            return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white`;
          case 'red':
            return `${baseClasses} bg-red-600 hover:bg-red-700 text-white`;
          case 'green':
            return `${baseClasses} bg-green-600 hover:bg-green-700 text-white`;
          case 'purple':
            return `${baseClasses} bg-purple-600 hover:bg-purple-700 text-white`;
          default:
            return `${baseClasses} bg-blue-600 hover:bg-blue-700 text-white`;
        }
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || state === 'testing' || state === 'success'}
      className={getButtonClasses()}
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </button>
  );
};

export default TestConnectionButton; 