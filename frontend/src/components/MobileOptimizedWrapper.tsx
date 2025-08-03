import React from 'react';

interface MobileOptimizedWrapperProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  loading?: boolean;
  error?: string;
}

/**
 * Mobile-optimized wrapper component that ensures proper responsive behavior
 * for all dashboard components on mobile devices
 */
const MobileOptimizedWrapper: React.FC<MobileOptimizedWrapperProps> = ({
  children,
  className = '',
  title,
  loading = false,
  error
}) => {
  return (
    <div className={`
      w-full 
      max-w-full 
      overflow-hidden 
      bg-slate-800/50 
      backdrop-blur-sm 
      border 
      border-slate-700/50 
      rounded-lg 
      p-3 
      sm:p-4 
      md:p-6
      mobile-full-width
      ${className}
    `}>
      {/* Title */}
      {title && (
        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-white truncate">
            {title}
          </h3>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-400"></div>
          <span className="ml-2 text-xs sm:text-sm text-slate-400">Loading...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4 mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-xs sm:text-sm text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div className="mobile-scroll">
          {children}
        </div>
      )}
    </div>
  );
};

export default MobileOptimizedWrapper;