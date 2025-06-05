import React, { useEffect, useRef } from 'react';
import { createApp } from 'vue';
import SimpleStats from './simple.vue';

interface SimpleStatsWrapperProps {
  title: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
}

export const SimpleStatsWrapper: React.FC<SimpleStatsWrapperProps> = ({ title, stats }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = createApp(SimpleStats, { title, stats });
    app.mount(containerRef.current);

    return () => {
      app.unmount();
    };
  }, [title, stats]);

  return <div ref={containerRef} />;
};