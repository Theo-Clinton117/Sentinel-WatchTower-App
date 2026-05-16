import { io, Socket } from 'socket.io-client';
import type { EmergencyLocation } from '../store/useAppStore';
import { resolveDevBackendUrl } from './runtime-host';

const wsUrl = resolveDevBackendUrl(process.env.EXPO_PUBLIC_WS_URL);

let socket: Socket | null = null;

type SessionSocketHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onConnectionError?: () => void;
  onLocationUpdate?: (locations: EmergencyLocation[]) => void;
  onStatus?: (payload: { status: string; stage?: string }) => void;
};

export const connectSessionSocket = (sessionId: string, handlers: SessionSocketHandlers = {}) => {
  socket?.disconnect();
  socket = io(`${wsUrl}/sessions`, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 8000,
  });
  socket.on('connected', () => handlers.onConnected?.());
  socket.on('connect', () => handlers.onConnected?.());
  socket.on('disconnect', () => handlers.onDisconnected?.());
  socket.io.on('reconnect_failed', () => handlers.onConnectionError?.());
  socket.io.on('error', () => handlers.onConnectionError?.());
  socket.on('location:update', (payload: { sessionId: string; locations: EmergencyLocation[] }) => {
    if (payload?.sessionId === sessionId) {
      handlers.onLocationUpdate?.(payload.locations || []);
    }
  });
  socket.on('session:status', (payload: { sessionId: string; status: string; stage?: string }) => {
    if (payload?.sessionId === sessionId && payload?.status) {
      handlers.onStatus?.({ status: payload.status, stage: payload.stage });
    }
  });
  socket.emit('join', { sessionId });
  return socket;
};

export const disconnectSessionSocket = () => {
  socket?.disconnect();
  socket = null;
};
