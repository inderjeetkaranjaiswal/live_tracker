import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/app_config.dart';

/// Socket.IO client service for Admin live tracking.
/// Listens to real-time events broadcast by the Render backend.
class AdminSocketService {
  io.Socket? _socket;
  bool _isConnected = false;

  bool get isConnected => _isConnected;

  void connect({
    required Function(Map<String, dynamic>) onLocationUpdate,
    required Function(bool isConnected) onConnectionChange,
  }) {
    if (_socket != null) {
      if (_socket!.connected) return;
      disconnect();
    }

    final serverUrl = AppConfig.baseUrl;

    try {
      _socket = io.io(
        serverUrl,
        io.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .enableAutoConnect()
            .enableReconnection()
            .setReconnectionDelay(2000)
            .setReconnectionAttempts(999)
            .build(),
      );

      _socket!.onConnect((_) {
        debugPrint('[Admin Socket.IO] Connected to $serverUrl');
        _isConnected = true;
        onConnectionChange(true);
      });

      _socket!.onDisconnect((_) {
        debugPrint('[Admin Socket.IO] Disconnected from server');
        _isConnected = false;
        onConnectionChange(false);
      });

      _socket!.onConnectError((err) {
        debugPrint('[Admin Socket.IO] Connect error: $err');
        _isConnected = false;
        onConnectionChange(false);
      });

      void handleUpdate(dynamic data) {
        if (data is Map<String, dynamic>) {
          onLocationUpdate(data);
        } else if (data is Map) {
          onLocationUpdate(Map<String, dynamic>.from(data));
        }
      }

      // Listen for both backend event signatures
      _socket!.on('location_updated', handleUpdate);
      _socket!.on('employeeLocationUpdated', handleUpdate);

      _socket!.connect();
    } catch (e) {
      debugPrint('[Admin Socket.IO] Initialization error: $e');
      _isConnected = false;
      onConnectionChange(false);
    }
  }

  void disconnect() {
    try {
      _socket?.off('location_updated');
      _socket?.off('employeeLocationUpdated');
      _socket?.disconnect();
      _socket?.dispose();
      _socket = null;
      _isConnected = false;
    } catch (_) {}
  }
}
