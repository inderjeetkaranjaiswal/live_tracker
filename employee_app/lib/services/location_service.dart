import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class LocationService extends ChangeNotifier {
  Timer? _backupTimer;
  StreamSubscription<Position>? _positionStreamSub;
  bool _isTracking = false;
  bool _isSyncing = false;
  double? _latitude;
  double? _longitude;
  DateTime? _lastUpdated;
  DateTime? _lastNetworkSyncTime;
  String? _statusMessage;

  bool get isTracking => _isTracking;
  double? get latitude => _latitude;
  double? get longitude => _longitude;
  DateTime? get lastUpdated => _lastUpdated;
  String? get statusMessage => _statusMessage;

  /// Start real-time GPS stream with throttling
  void startTracking() {
    if (_isTracking) return;
    _isTracking = true;
    _statusMessage = "Location sharing active";
    notifyListeners();

    // Trigger initial fix
    _fetchAndUpdateLocation();

    // Periodic timer (every 10 seconds) to continuously transmit GPS
    _backupTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      final now = DateTime.now();
      if (_lastNetworkSyncTime == null ||
          now.difference(_lastNetworkSyncTime!).inSeconds >= 9) {
        _fetchAndUpdateLocation();
      }
    });

    // Real-time GPS stream listener with efficient distance filter (3 meters)
    try {
      final LocationSettings locationSettings;
      if (defaultTargetPlatform == TargetPlatform.android) {
        locationSettings = AndroidSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
          intervalDuration: const Duration(seconds: 10),
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: "Live Location Sharing Active",
            notificationText: "Transmitting live GPS coordinates to admin dashboard every 10 seconds.",
            notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
            enableWakeLock: false, // Save CPU battery
          ),
        );
      } else {
        locationSettings = const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
        );
      }

      _positionStreamSub = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen((Position position) {
        _handleNewPosition(position);
      }, onError: (err) {
        // Stream error gracefully handled
      });
    } catch (_) {}
  }

  /// Stop location tracking
  void stopTracking() {
    _backupTimer?.cancel();
    _backupTimer = null;
    _positionStreamSub?.cancel();
    _positionStreamSub = null;
    _isTracking = false;
    _statusMessage = "Tracking paused";
    notifyListeners();
  }

  void _handleNewPosition(Position position) {
    _latitude = position.latitude;
    _longitude = position.longitude;
    _lastUpdated = DateTime.now();

    // Throttle network calls: approximately every 10 seconds (minimum 8s)
    final now = DateTime.now();
    if (_lastNetworkSyncTime != null &&
        now.difference(_lastNetworkSyncTime!).inSeconds < 8) {
      notifyListeners();
      return;
    }

    _syncWithBackend(position.latitude, position.longitude);
  }

  Future<void> _syncWithBackend(double lat, double lng) async {
    if (_isSyncing) return;
    _isSyncing = true;
    _lastNetworkSyncTime = DateTime.now();

    try {
      final result = await ApiService.updateLocation(lat, lng);
      if (result['success'] == true) {
        _statusMessage = "Location synchronized successfully";
      } else {
        _statusMessage = "Syncing... (Backend waking up)";
      }
    } catch (_) {
      _statusMessage = "Syncing... (Network busy)";
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  Future<void> _fetchAndUpdateLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _statusMessage = "Location services disabled on device";
        notifyListeners();
        return;
      }

      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _statusMessage = "Location permission required";
        notifyListeners();
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      _handleNewPosition(position);
    } catch (e) {
      // Handled silently to avoid UI stutter
    }
  }

  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}
