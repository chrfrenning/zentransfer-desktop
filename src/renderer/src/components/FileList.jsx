import React from 'react';
import FileTile from './FileTile';

const FileList = ({ files, formatFileSize }) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Files ({files.length})</h3>
      <div className="space-y-4">
        {files.map(file => (
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