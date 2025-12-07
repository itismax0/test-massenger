import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

class SocketService {
  private socket: Socket | null = null;

  connect(userId: string) {
    if (this.socket?.connected) return;

    this.socket = io({
      path: '/socket.io',
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.socket?.emit('join', userId);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(message: Message & { recipientId: string }) {
    if (this.socket) {
      this.socket.emit('send_message', message);
    }
  }

  onReceiveMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('receive_message', callback);
    }
  }
  
  onMessageSent(callback: (data: { tempId: string, status: string }) => void) {
      if (this.socket) {
          this.socket.on('message_sent', callback);
      }
  }
}

export const socketService = new SocketService();
