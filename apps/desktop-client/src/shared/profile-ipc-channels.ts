export const PROFILE_IPC_CHANNELS = {
  LIST: 'profile:list',
  CREATE: 'profile:create',
  UPDATE: 'profile:update',
  REMOVE: 'profile:remove',
  LAUNCH: 'profile:launch',
  STOP: 'profile:stop',
  GET_RUNTIME_SNAPSHOT: 'profile:get-runtime-snapshot',
  RUNTIME_EVENT: 'profile:runtime-event',
} as const;
