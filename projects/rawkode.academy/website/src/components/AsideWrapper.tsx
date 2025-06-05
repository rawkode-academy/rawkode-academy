import React from 'react';
import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  FireIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface AsideProps {
  variant: 'tip' | 'caution' | 'danger' | 'info';
  children: React.ReactNode;
}

const AsideWrapper: React.FC<AsideProps> = ({ variant, children }) => {
  const styles = {
    container: '',
    icon: '',
    gradient: '',
    border: '',
  };

  switch (variant) {
    case 'tip':
      styles.container =
        'bg-gradient-to-r from-green-50 to-green-100 text-green-800 dark:from-green-950/80 dark:to-green-900/80 dark:text-green-100';
      styles.icon = 'text-green-600 dark:text-green-400';
      styles.gradient = 'from-green-500 to-green-400';
      styles.border = 'border-green-500';
      break;
    case 'caution':
      styles.container =
        'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 dark:from-orange-950/80 dark:to-orange-900/80 dark:text-orange-100';
      styles.icon = 'text-orange-600 dark:text-orange-400';
      styles.gradient = 'from-yellow-500 to-orange-400';
      styles.border = 'border-yellow-500';
      break;
    case 'danger':
      styles.container =
        'bg-gradient-to-r from-red-50 to-red-100 text-red-800 dark:from-red-950/80 dark:to-red-900/80 dark:text-red-100';
      styles.icon = 'text-red-600 dark:text-red-400';
      styles.gradient = 'from-red-500 to-red-400';
      styles.border = 'border-red-500';
      break;
    case 'info':
      styles.container =
        'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 dark:from-blue-950/80 dark:to-blue-900/80 dark:text-blue-100';
      styles.icon = 'text-blue-600 dark:text-blue-400';
      styles.gradient = 'from-blue-500 to-blue-400';
      styles.border = 'border-blue-500';
      break;
  }

  const IconComponent = {
    tip: LightBulbIcon,
    caution: ExclamationTriangleIcon,
    danger: FireIcon,
    info: InformationCircleIcon,
  }[variant];

  return (
    <div
      className={`aside my-2 rounded-lg backdrop-blur-sm shadow-md border-r border-b ${styles.border} ${styles.container} relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${styles.gradient} shadow-[0_0_8px_rgba(var(--accent-glow),0.6)]`}
      />
      <div className="px-4 relative z-10">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-full bg-gradient-to-br ${styles.gradient} p-1.5 flex items-center justify-center shadow-sm transform transition-transform duration-200 hover:scale-105`}
          >
            <IconComponent className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold tracking-wider">
            {variant.toUpperCase()}
          </p>
        </div>
        <div className="px-0.5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AsideWrapper;