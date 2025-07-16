import React from 'react';

interface SupportSectionProps {
  onHelpClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
  onDownloadClick: () => void;
  onDonateClick: () => void;
}

const SupportSection: React.FC<SupportSectionProps> = ({
  onHelpClick,
  onPrivacyClick,
  onTermsClick,
  onDownloadClick,
  onDonateClick,
}) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Support</h3>
      <div className="space-y-4">
        <button
          onClick={onHelpClick}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Help & Support
        </button>
        <button
          onClick={onPrivacyClick}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Privacy Policy
        </button>
        <button
          onClick={onTermsClick}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Terms of Service
        </button>
        <button
          onClick={onDownloadClick}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Download Latest Version
        </button>
        <button
          onClick={onDonateClick}
          className="w-full text-left text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-transparent border-none cursor-pointer"
        >
          Donate
        </button>
      </div>
    </div>
  );
};

export default SupportSection; 