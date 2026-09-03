import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'login_screen.dart';

class StatusScreen extends StatefulWidget {
  const StatusScreen({super.key});

  @override
  State<StatusScreen> createState() => _StatusScreenState();
}

class _StatusScreenState extends State<StatusScreen> {
  late LocationService _locationService;
  String _userName = 'Employee';
  String _userEmail = '';

  @override
  void initState() {
    super.initState();
    _locationService = LocationService();
    _locationService.addListener(_onLocationChange);
    _loadUserInfo();
    _locationService.startTracking();
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('user_name') ?? 'Employee';
      _userEmail = prefs.getString('user_email') ?? '';
    });
  }

  void _onLocationChange() {
    if (mounted) setState(() {});
  }

  Future<void> _handleLogout() async {
    _locationService.stopTracking();
    await ApiService.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  void dispose() {
    _locationService.removeListener(_onLocationChange);
    _locationService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isTracking = _locationService.isTracking;
    final lat = _locationService.latitude;
    final lng = _locationService.longitude;
    final lastUpdated = _locationService.lastUpdated;

    final formattedTime = lastUpdated != null
        ? DateFormat('hh:mm:ss a').format(lastUpdated)
        : 'Syncing...';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Location Tracker'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log Out',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // User Profile Banner
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceVariant,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: theme.colorScheme.primary,
                        child: Text(
                          _userName.isNotEmpty ? _userName[0].toUpperCase() : 'E',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: theme.colorScheme.onPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _userName,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              _userEmail,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.outline,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.green.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'AUTHENTICATED - EMPLOYEE',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Live Status Pulse Box
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: isTracking
                        ? [const Color(0xFF065F46), const Color(0xFF134E4A)]
                        : [Colors.grey.shade800, const Color(0xFF0F172A)],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: (isTracking ? Colors.green : Colors.grey).withOpacity(0.2),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        if (isTracking)
                          Container(
                            width: 72,
                            height: 72,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.green.withOpacity(0.2),
                            ),
                          ),
                        Icon(
                          isTracking ? Icons.radar_rounded : Icons.location_off_rounded,
                          size: 40,
                          color: isTracking ? Colors.greenAccent : Colors.grey.shade400,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      isTracking ? 'LOCATION SHARING ACTIVE' : 'LOCATION SHARING PAUSED',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _locationService.statusMessage ?? 'GPS interval: Every 10 seconds',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Coordinates Details
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(color: theme.colorScheme.outlineVariant),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.access_time_rounded, size: 20, color: theme.colorScheme.primary),
                              const SizedBox(width: 8),
                              const Text('Last Updated', style: TextStyle(fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Text(
                            formattedTime,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 28),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Latitude', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                const SizedBox(height: 4),
                                Text(
                                  lat != null ? lat.toStringAsFixed(6) : '--',
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Longitude', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                const SizedBox(height: 4),
                                Text(
                                  lng != null ? lng.toStringAsFixed(6) : '--',
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Toggle Tracking Button
              OutlinedButton.icon(
                onPressed: () {
                  if (isTracking) {
                    _locationService.stopTracking();
                  } else {
                    _locationService.startTracking();
                  }
                  setState(() {});
                },
                icon: Icon(isTracking ? Icons.pause_circle_outline : Icons.play_circle_outline),
                label: Text(isTracking ? 'Pause Location Sharing' : 'Resume Location Sharing'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
