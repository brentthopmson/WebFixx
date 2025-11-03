import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShield,
  faRobot,
  faChartLine,
  faFingerprint,
  faChevronDown, // Add chevron down icon
  faChevronUp    // Add chevron up icon
} from '@fortawesome/free-solid-svg-icons';

const ProtectionFeaturesCard: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // Tailwind's 'md' breakpoint is 768px. We'll use that as our mobile threshold.
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true); // Ensure it's collapsed by default on mobile
      }
    };

    checkIsMobile(); // Initial check
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Protection Features</h2>
        {isMobile && (
          <button 
            onClick={toggleCollapse}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-expanded={!isCollapsed}
            aria-controls="protection-features-content"
          >
            <FontAwesomeIcon icon={isCollapsed ? faChevronDown : faChevronUp} className="w-5 h-5" />
          </button>
        )}
      </div>
      <div 
        id="protection-features-content"
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isMobile && isCollapsed ? 'max-h-0 opacity-0' : 'max-h-screen opacity-100'
        } md:max-h-screen md:opacity-100`} // Always expanded on desktop
      >
        <div className="space-y-6 mt-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-900">
              <FontAwesomeIcon icon={faShield} className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium dark:text-white">Anti-Red</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Advanced protection against detection</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center dark:bg-blue-900">
              <FontAwesomeIcon icon={faRobot} className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium dark:text-white">Bot Detector/Killer</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Automatic bot detection and blocking</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center dark:bg-purple-900">
              <FontAwesomeIcon icon={faChartLine} className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium dark:text-white">Analytics</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Traffic and health monitoring</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center dark:bg-yellow-900">
              <FontAwesomeIcon icon={faFingerprint} className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="font-medium dark:text-white">Fingerprinting</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Visitor validation system</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtectionFeaturesCard;
