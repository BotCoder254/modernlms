import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

const VersionHistory = ({ versions, isEnrolled = false }) => {
  if (!versions || versions.length === 0) return null;
  
  const latestVersion = versions[0];

  return (
    <div className="bg-blue-50 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <InformationCircleIcon className="h-5 w-5 text-blue-600" />
        </div>
        <div className="ml-3">
          <h4 className="text-sm font-medium text-blue-800">
            {isEnrolled ? (
              <>This course was updated on {new Date(latestVersion.updatedAt).toLocaleDateString()}</>
            ) : (
              <>Latest version: v{latestVersion.version} ({new Date(latestVersion.updatedAt).toLocaleDateString()})</>
            )}
          </h4>
          <p className="mt-1 text-sm text-blue-700">
            {latestVersion.changelog || 'Course content has been updated.'}
          </p>
          <details className="mt-2">
            <summary className="text-xs text-blue-800 cursor-pointer hover:underline">
              Version history
            </summary>
            <div className="mt-2 space-y-2">
              {versions.map((version, index) => (
                <div key={`version-${index}`} className="text-xs">
                  <span className="font-medium">v{version.version}</span> - 
                  {new Date(version.updatedAt).toLocaleDateString()} - 
                  {version.updaterName && <span>{version.updaterName} - </span>}
                  <span className={
                    version.updateType === 'major' ? 'text-orange-700' : 'text-blue-700'
                  }>
                    {version.updateType === 'major' ? '[Major Update] ' : ''}
                    {version.changelog || 'No description'}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default VersionHistory; 