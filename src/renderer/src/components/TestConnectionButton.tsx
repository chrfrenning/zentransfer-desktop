import React from 'react';
import { Button } from './catalyst/button';
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

  const getButtonColor = (): ButtonColor => {
    switch (state) {
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      default:
        return color;
    }
  };

  return (
    <Button
      color={getButtonColor()}
      onClick={onClick}
      disabled={disabled || state === 'testing' || state === 'success'}
      className="w-full flex items-center justify-center space-x-2"
    >
      {getIcon()}
      <span>{getButtonText()}</span>
    </Button>
  );
};

export default TestConnectionButton; 