// Custom Neon Auth UI Provider with react-adapter logic
export { NeonAuthUIProvider } from './neon-auth-ui-provider';
export type { NeonAuthUIProviderProps } from './neon-auth-ui-provider';

// Re-export all components and utilities from better-auth-ui
export * from '@daveyplate/better-auth-ui';

// Export react-adapter utilities for external use if needed
export { getReactClient } from './react-adapter';

// Export theme hook for consumers
export { useTheme } from 'next-themes';
