// Re-export the native module. On web, it will be resolved to KuroDeviceControlsModule.web.ts
// and on native platforms to KuroDeviceControlsModule.ts
export { default } from './src/KuroDeviceControlsModule';
export * from './src/KuroDeviceControls.types';
