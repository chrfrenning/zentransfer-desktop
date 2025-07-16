import React from 'react';
import SimpleSwitch from './SimpleSwitch';

interface PreferencesProps {
  skipDuplicates: boolean;
  createPreviews: boolean;
  extractMetaData: boolean;
  createIndexfiles: boolean;
  onSkipDuplicatesChange: (value: boolean) => void;
  onCreatePreviewsChange: (value: boolean) => void;
  onExtractMetaDataChange: (value: boolean) => void;
  onCreateIndexfilesChange: (value: boolean) => void;
}

const PreferencesSection: React.FC<PreferencesProps> = ({
  skipDuplicates,
  createPreviews,
  extractMetaData,
  createIndexfiles,
  onSkipDuplicatesChange,
  onCreatePreviewsChange,
  onExtractMetaDataChange,
  onCreateIndexfilesChange,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Preferences</h3>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Skip duplicates during import</label>
            <p className="text-sm text-gray-500">Skip files that already exist in destination folders</p>
          </div>
          <SimpleSwitch
            checked={skipDuplicates}
            onChange={onSkipDuplicatesChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Create previews</label>
            <p className="text-sm text-gray-500">Generate preview and thumbnails for cloud stores</p>
          </div>
          <SimpleSwitch
            checked={createPreviews}
            onChange={onCreatePreviewsChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Extract metadata</label>
            <p className="text-sm text-gray-500">Extract metadata and save as json in cloud stores</p>
          </div>
          <SimpleSwitch
            checked={extractMetaData}
            onChange={onExtractMetaDataChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">Create indexes</label>
            <p className="text-sm text-gray-500">Generate json indexes of uploaded files</p>
          </div>
          <SimpleSwitch
            checked={createIndexfiles}
            onChange={onCreateIndexfilesChange}
          />
        </div>
      </div>
    </div>
  );
};

export default PreferencesSection; 