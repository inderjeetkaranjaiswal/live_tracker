import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class LocationService extends ChangeNotifier {
  Timer? _timer;
  StreamSubscription<Position>? _positionStreamSub;
  bool _isTracking = false;
  double? _latitude;
  double? _longitude;
  DateTime? _lastUpdated;
  String? _statusMessage;

  bool get isTracking => _isTracking;
  double? get latitude => _latitude;
  double? get longitude => _longitude;
  DateTime? get lastUpdated => _lastUpdated;
  String? get statusMessage => _statusMessage;

  /// Start real-time GPS stream and 10-second backup timer location tracking
  void startTracking() {
    if (_isTracking) return;
    _isTracking = true;
    _statusMessage = "Location sharing active";
    notifyListeners();

    // Trigger immediate update
    _fetchAndUpdateLocation();

    // Setup 10-second recurring backup timer
    _timer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _fetchAndUpdateLocation();
    });

    // Real-time GPS stream listener with Foreground Service enabled for continuous background tracking
    try {
      final LocationSettings locationSettings;
      if (defaultTargetPlatform == TargetPlatform.android) {
        locationSettings = AndroidSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 1,
          forceLocationManager: true,
          intervalDuration: const Duration(seconds: 10),
          foregroundNotificationConfig: const ForegroundNotificationConfig(
            notificationTitle: "Live Location Sharing Active",
            notificationText: "Transmitting live GPS coordinates to admin dashboard.",
            notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
            enableWakeLock: true,
          ),
        );
      } else {
        locationSettings = const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 1,
        );
      }

      _positionStreamSub = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen((Position position) {
        _updateWithPosition(position);
      }, onError: (err) {
        // Log stream error gracefully, fallback timer remains active
      });
    } catch (_) {}
  }

  /// Stop location tracking
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    _positionStreamSub?.cancel();
    _positionStreamSub = null;
    _isTracking = false;
    _statusMessage = "Tracking paused";
    notifyListeners();
  }

  Future<void> _updateWithPosition(Position position) async {
    _latitude = position.latitude;
    _longitude = position.longitude;
    _lastUpdated = DateTime.now();

    final result = await ApiService.updateLocation(position.latitude, position.longitude);

    if (result['success']) {
      _statusMessage = "Location synchronized successfully";
    } else {
      _statusMessage = "Backend offline (Retrying automatically...)";
    }

    notifyListeners();
  }

  Future<void> _fetchAndUpdateLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _statusMessage = "Location services disabled on device";
        notifyListeners();
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        _statusMessage = "Location permission required";
        notifyListeners();
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      await _updateWithPosition(position);
    } catch (e) {
      _statusMessage = "GPS / Network Notice: ${e.toString()} (Retrying...)";
      notifyListeners();
    }
  }

  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}
