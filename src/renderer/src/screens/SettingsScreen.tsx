import React from 'react';
import ScreenHeader from '../components/ScreenHeader';

const SettingsScreen = () => {
  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        <ScreenHeader mode="settings" />
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600">Settings screen content will be implemented here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen; 