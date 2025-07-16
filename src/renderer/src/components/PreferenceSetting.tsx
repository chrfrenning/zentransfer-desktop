import React from 'react';
import SimpleSwitch from './SimpleSwitch';

interface PreferenceSettingProps {
  label: string;
  description: string;
  settingSection: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const PreferenceSetting: React.FC<PreferenceSettingProps> = ({
  label,
  description,
  settingSection,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <SimpleSwitch
        checked={checked}
        onChange={onChange}
      />
    </div>
  );
};

export default PreferenceSetting; 