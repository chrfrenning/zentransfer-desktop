import React from 'react';
import PreferenceSetting, { SettingChangeNotification } from './PreferenceSetting';

interface PreferencesProps {
  onChange?: (notification: SettingChangeNotification) => void; // Optional global change handler
}

const PreferencesSection: React.FC<PreferencesProps> = ({
  onChange,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Preferences</h3>
      <div className="space-y-6">
        <PreferenceSetting
          label="Skip existing files"
          description="Skip files that already exist in destination folders"
          settingKey="preferences.skipExisting"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Skip known duplicates"
          description="Skip files that are present in log files"
          settingKey="preferences.skipDuplicates"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Create high-water mark"
          description="Write a file with last import time to source card/folder"
          settingKey="preferences.createHighWaterMark"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Create previews"
          description="Generate preview and thumbnails for cloud stores"
          settingKey="preferences.createPreviews"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Extract metadata"
          description="Extract metadata and save as json in cloud stores"
          settingKey="preferences.extractMetaData"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Create indexes"
          description="Upload a json index of uploaded files to cloud stores"
          settingKey="preferences.createIndexFiles"
          onChange={onChange}
        />

        <PreferenceSetting
          label="Public URLs"
          description="Store public URLs in indexes"
          settingKey="preferences.publicUrlsInIndexes"
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default PreferencesSection; 