import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:geolocator/geolocator.dart';
import 'status_screen.dart';

class PermissionScreen extends StatefulWidget {
  const PermissionScreen({super.key});

  @override
  State<PermissionScreen> createState() => _PermissionScreenState();
}

class _PermissionScreenState extends State<PermissionScreen> {
  bool _isChecking = false;
  String? _statusText;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _requestLocationPermission();
    });
  }

  Future<void> _requestLocationPermission() async {
    setState(() {
      _isChecking = true;
      _statusText = null;
    });

    try {
      // 1. Check if location services are enabled on device
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _isChecking = false;
          _statusText = 'GPS / Location services are turned off on your device. Please enable location services in your device settings.';
        });
        return;
      }

      // 2. Request notification permission for Android 13+ foreground service notification
      if (await Permission.notification.isDenied) {
        await Permission.notification.request();
      }

      // 3. Request location permission using geolocator
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.whileInUse) {
        // Request background location permission for continuous tracking when app is closed/minimized
        await Permission.locationAlways.request();
        permission = await Geolocator.checkPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _isChecking = false;
          _statusText = 'Location permissions are permanently denied. Please enable them in App Settings.';
        });
        await openAppSettings();
        return;
      }

      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const StatusScreen()),
        );
      } else {
        setState(() {
          _isChecking = false;
          _statusText = 'Location permission is required to continue.';
        });
      }
    } catch (e) {
      setState(() {
        _isChecking = false;
        _statusText = 'Error requesting permission: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.security_rounded,
                    size: 72,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(height: 24),

                  Text(
                    'Location Permission Required',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),

                  Text(
                    'LiveTracker requires continuous GPS location permission while logged in to share your location with company administrators every 10 seconds.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.outline,
                      height: 1.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  if (_statusText != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        _statusText!,
                        style: TextStyle(color: theme.colorScheme.onErrorContainer),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  FilledButton.icon(
                    onPressed: _isChecking ? null : _requestLocationPermission,
                    icon: _isChecking
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_isChecking ? 'Checking Permissions...' : 'Grant Location Permission'),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
