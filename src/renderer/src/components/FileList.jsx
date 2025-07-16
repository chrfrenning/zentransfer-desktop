import React from 'react';
import FileTile from './FileTile';

const FileList = ({ files, formatFileSize }) => {
  if (!files || files.length === 0) {
    return null;
  }

  // Sort files by status: uploading first, then queued, then completed/failed
  const sortedFiles = [...files].sort((a, b) => {
    const getStatusPriority = (status) => {
      switch (status) {
        case 'uploading':
          return 1; // Highest priority (top)
        case undefined:
        case null:
        case '':
          return 2; // Queued files (middle)
        case 'completed':
          return 3; // Completed files (bottom)
        case 'failed':
          return 4; // Failed files (bottom)
        default:
          return 2; // Default to queued priority
      }
    };

    const aPriority = getStatusPriority(a.status);
    const bPriority = getStatusPriority(b.status);

    // If priorities are the same, maintain original order
    if (aPriority === bPriority) {
      return 0;
    }
    
    return aPriority - bPriority;
  });

  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Files ({files.length})</h3>
      <div className="space-y-4">
        {sortedFiles.map(file => (
          <FileTile 
            key={file.id} 
            file={file} 
            formatFileSize={formatFileSize}
          />
        ))}
      </div>
    </div>
  );
};

export default FileList; 