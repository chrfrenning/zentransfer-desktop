import React, { useState, useEffect, useCallback } from 'react';

interface LoaderScreenProps {
  readonly onVersionCheckComplete: (shouldProceed: boolean) => void;
}

const LoaderScreen: React.FC<LoaderScreenProps> = ({ onVersionCheckComplete }) => {
  const [status, setStatus] = useState('Checking version...');
  const [appVersion, setAppVersion] = useState('Loading...');
  const [isVisible, setIsVisible] = useState(true);
  const [startTime] = useState(Date.now());

  const minDisplayTime = 3000; // Minimum 3 seconds

  useEffect(() => {
    // Get app version
    const initializeVersion = async () => {
        const version = await window.electronAPI.app.getVersion();
        setAppVersion(version);
    };

    initializeVersion();
    
    // Start version check after a brief delay
    const timer = setTimeout(() => {
      performVersionCheck();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const performVersionCheck = async () => {
    const result = await window.electronAPI.app.doVersionCheck();
    window.logger.info('Version check result received');
    if (result) {
      handleVersionCheckResult(result as any); // Simplified type assertion
    }
  };

  const handleVersionCheckResult = async (result: any) => { // Simplified type assertion

    switch (result.status) {
      case 'VersionCheckStatus.OK':
        setStatus('Version check passed');
        setTimeout(() => {
          completeVersionCheck(true);
        }, 1000);
        break;

      case 'VersionCheckStatus.OUTDATED':
        setStatus('New version available');
        await showVersionWarning(result.message || undefined);
        break;

      case 'VersionCheckStatus.REQUIRED':
        setStatus('Update required');
        await showUpdateRequired(result.message || undefined);
        break;

      case 'VersionCheckStatus.DOWN':
        setStatus('Server maintenance');
        await showMaintenanceMessage(result.message || undefined, result.maintenance_until || undefined);
        break;

      default:
        console.warn('Unknown version check status:', result.status);
        setStatus('Unknown status, continuing...');
        setTimeout(() => {
          completeVersionCheck(true);
        }, 2000);
    }
  };

  const showVersionWarning = async (message?: string) => {
    const customMessage = message || 'A new version of ZenTransfer is available. We recommend updating to get the latest features and improvements.';
    
    // For now, we'll just log and continue. In a full implementation,
    // you'd want to show a proper modal dialog here
    console.log('Version warning:', customMessage);
    setStatus('New version available - continuing anyway');
    
    setTimeout(() => {
      completeVersionCheck(true);
    }, 2000);
  };

  const showUpdateRequired = async (message?: string) => {
    const customMessage = message || 'This version of ZenTransfer is no longer supported. Please update to the latest version to continue using the app.';
    
    console.log('Update required:', customMessage);
    setStatus('Update required - please download latest version');
    
    // In a full implementation, this would show a modal and potentially exit the app
    setTimeout(() => {
      completeVersionCheck(false);
    }, 3000);
  };

  const showMaintenanceMessage = async (message?: string, maintenanceUntil?: string) => {
    let maintenanceMessage = message || 'ZenTransfer is currently down for maintenance. Please try again later.';
    
    if (maintenanceUntil) {
      try {
        const maintenanceDate = new Date(maintenanceUntil);
        const formattedDate = maintenanceDate.toLocaleString();
        maintenanceMessage += ` Expected to be back online: ${formattedDate}`;
      } catch (error) {
        console.error('Failed to parse maintenance_until date:', error);
      }
    }

    console.log('Maintenance message:', maintenanceMessage);
    setStatus('Server maintenance - please try again later');
    
    setTimeout(() => {
      completeVersionCheck(false);
    }, 3000);
  };

  const completeVersionCheck = useCallback((shouldProceed: boolean) => {
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

    if (remainingTime > 0) {
      // Wait for the remaining time before completing
      setTimeout(() => {
        if (onVersionCheckComplete) {
          onVersionCheckComplete(shouldProceed);
        }
      }, remainingTime);
    } else {
      // Minimum time already elapsed, proceed immediately
      if (onVersionCheckComplete) {
        onVersionCheckComplete(shouldProceed);
      }
    }
  }, [startTime, onVersionCheckComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center z-50"
      style={{ backgroundColor: '#e277cd' }}
    >
      <div className="text-center">
        {/* Logo Container */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto flex items-center justify-center">
            {/* ZenTransfer Square Logo */}
            <img 
              src="logo_sq.png" 
              alt="ZenTransfer Logo" 
              className="w-16 h-16 border border-gray-300" 
            />
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-4xl font-bold text-white mb-2">ZenTransfer</h1>
        <p className="text-purple-200 text-lg mb-8">For Professional Photographers</p>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex space-x-2">
            <div 
              className="w-3 h-3 bg-white rounded-full animate-bounce" 
              style={{ animationDelay: '0ms' }}
            ></div>
            <div 
              className="w-3 h-3 bg-white rounded-full animate-bounce" 
              style={{ animationDelay: '150ms' }}
            ></div>
            <div 
              className="w-3 h-3 bg-white rounded-full animate-bounce" 
              style={{ animationDelay: '300ms' }}
            ></div>
          </div>
          <p className="text-purple-200 text-sm">{status}</p>
        </div>

        {/* Version Info */}
        <div className="mt-8 text-purple-300 text-xs">
          Version {appVersion}
        </div>
      </div>
    </div>
  );
};

export default LoaderScreen; 