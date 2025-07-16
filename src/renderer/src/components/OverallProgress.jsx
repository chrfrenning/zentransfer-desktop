import React from 'react';

const OverallProgress = ({ 
  progress = 0, 
  label = "Progress",
  color = "blue",
  className = ""
}) => {
  const getProgressBarColor = () => {
    switch (color) {
      case 'green': return 'bg-green-600';
      case 'yellow': return 'bg-yellow-600';
      case 'red': return 'bg-red-600';
      case 'blue':
      default: return 'bg-blue-600';
    }
  };

  return (
    <div className={`mb-6 ${className}`}>
      {/* <div className="flex justify-between text-sm text-gray-600 mb-3">
        <span className="font-medium">{label}</span>
        <span>{progress}%</span>
      </div> */}
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div 
          className={`h-4 rounded-full transition-all duration-500 ease-out ${getProgressBarColor()}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default OverallProgress; 