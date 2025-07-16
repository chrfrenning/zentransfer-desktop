import React from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Button } from '../components/catalyst/button';
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';

const DownloadScreen = () => {
  const handleTestClick = () => {
    console.log('Catalyst button clicked!');
  };

  return (
    <div className="h-full px-4 pt-2 pb-6 overflow-y-auto">
      <div className="w-full">
        <ScreenHeader mode="download" />
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <Heading level={2} className="mb-4">
              Testing Catalyst Components
            </Heading>
            
            <Text className="mb-4">
              This is a catalyst Text component. If you can see this styled correctly, the catalyst components are working.
            </Text>
            
            <div className="space-x-4">
              <Button onClick={handleTestClick}>
                Primary Button
              </Button>
              
              <Button outline onClick={handleTestClick}>
                Outline Button
              </Button>
              
              <Button plain onClick={handleTestClick}>
                Plain Button
              </Button>
              
              <Button color="red" onClick={handleTestClick}>
                Red Button
              </Button>
            </div>
            
            <Text className="mt-4 text-sm">
              Download screen content will be implemented here.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadScreen;