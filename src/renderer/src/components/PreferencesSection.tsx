import React from 'react';
import PreferenceSetting from './PreferenceSetting';

interface PreferencesProps {
  skipExisting: boolean;
  skipDuplicates: boolean;
  createPreviews: boolean;
  extractMetaData: boolean;
  createIndexfiles: boolean;
  createLedger: boolean;
  onSkipExistingChange: (value: boolean) => void;
  onSkipDuplicatesChange: (value: boolean) => void;
  onCreatePreviewsChange: (value: boolean) => void;
  onExtractMetaDataChange: (value: boolean) => void;
  onCreateIndexfilesChange: (value: boolean) => void;
  onCreateLedgerChange: (value: boolean) => void;
}

const PreferencesSection: React.FC<PreferencesProps> = ({
  skipExisting,
  skipDuplicates,
  createPreviews,
  extractMetaData,
  createIndexfiles,
  createLedger,
  onSkipExistingChange,
  onSkipDuplicatesChange,
  onCreatePreviewsChange,
  onExtractMetaDataChange,
  onCreateIndexfilesChange,
  onCreateLedgerChange,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Preferences</h3>
      <div className="space-y-6">
        <PreferenceSetting
          label="Skip existing files"
          description="Skip files that already exist in destination folders"
          settingSection="preferences.skipExisting"
          checked={skipExisting}
          onChange={onSkipExistingChange}
        />

        <PreferenceSetting
          label="Skip known duplicates"
          description="Skip files that are present in log files"
          settingSection="preferences.skipDuplicates"
          checked={skipDuplicates}
          onChange={onSkipDuplicatesChange}
        />

        <PreferenceSetting
          label="Create previews"
          description="Generate preview and thumbnails for cloud stores"
          settingSection="preferences.createPreviews"
          checked={createPreviews}
          onChange={onCreatePreviewsChange}
        />

        <PreferenceSetting
          label="Extract metadata"
          description="Extract metadata and save as json in cloud stores"
          settingSection="preferences.extractMetaData"
          checked={extractMetaData}
          onChange={onExtractMetaDataChange}
        />

        <PreferenceSetting
          label="Create indexes"
          description="Generate json indexes of uploaded files"
          settingSection="preferences.createIndexfiles"
          checked={createIndexfiles}
          onChange={onCreateIndexfilesChange}
        />

        <PreferenceSetting
          label="Create ledger"
          description="Creates a proof-of-work ledger for content authenticity"
          settingSection="preferences.createLedger"
          checked={createLedger}
          onChange={onCreateLedgerChange}
        />
      </div>
    </div>
  );
};

export default PreferencesSection; 