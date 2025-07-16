import React from 'react';
import ScreenHeader from '../components/ScreenHeader';

const ImportScreen = () => {
  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        <ScreenHeader mode="import" />
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600">Import screen content will be implemented here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportScreen; 