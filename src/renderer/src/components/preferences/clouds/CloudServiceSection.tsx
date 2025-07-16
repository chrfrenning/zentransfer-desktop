import React from 'react';
import SimpleSwitch from '../../generic/SimpleSwitch';
import TestConnectionButton from './TestConnectionButton';

type ButtonColor = 'orange' | 'blue' | 'red' | 'green' | 'purple';
type ButtonState = 'idle' | 'testing' | 'success' | 'error';

interface CloudServiceSectionProps {
  title: string;
  icon: React.ReactNode;
  color: ButtonColor;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  testButtonState: ButtonState;
  onTestConnection: () => void;
  children: React.ReactNode;
}

const CloudServiceSection: React.FC<CloudServiceSectionProps> = ({
  title,
  icon,
  color,
  enabled,
  onEnabledChange,
  testButtonState,
  onTestConnection,
  children,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <SimpleSwitch
          checked={enabled}
          onChange={onEnabledChange}
        />
      </div>
      
      {enabled && (
        <div className="space-y-6 mt-6">
          {children}
          
          <TestConnectionButton
            color={color}
            state={testButtonState}
            onClick={onTestConnection}
          />
        </div>
      )}
    </div>
  );
};

export default CloudServiceSection; 