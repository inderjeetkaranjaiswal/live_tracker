import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/admin_socket_service.dart';
import 'role_selection_screen.dart';
import 'status_screen.dart';

class EmployeeLocationModel {
  final String employeeId;
  final String name;
  final String email;
  final double? latitude;
  final double? longitude;
  final DateTime? updatedAt;

  EmployeeLocationModel({
    required this.employeeId,
    required this.name,
    required this.email,
    this.latitude,
    this.longitude,
    this.updatedAt,
  });

  bool get hasLocation => latitude != null && longitude != null;

  /// Online if updated within 30 seconds
  bool get isOnline {
    if (!hasLocation || updatedAt == null) return false;
    return DateTime.now().difference(updatedAt!).inSeconds < 30;
  }

  String get timeAgo {
    if (updatedAt == null) return 'No updates yet';
    final diff = DateTime.now().difference(updatedAt!);
    if (diff.inSeconds < 5) return 'Updated just now';
    if (diff.inSeconds < 60) return 'Updated ${diff.inSeconds} sec ago';
    if (diff.inMinutes < 60) return 'Updated ${diff.inMinutes} min ago';
    if (diff.inHours < 24) return 'Updated ${diff.inHours} hr ago';
    return 'Updated ${diff.inDays} days ago';
  }

  EmployeeLocationModel copyWith({
    String? name,
    String? email,
    double? latitude,
    double? longitude,
    DateTime? updatedAt,
  }) {
    return EmployeeLocationModel(
      employeeId: employeeId,
      name: name ?? this.name,
      email: email ?? this.email,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory EmployeeLocationModel.fromJson(Map<String, dynamic> json) {
    DateTime? parsedDate;
    final rawDate = json['updatedAt'] ?? json['timestamp'];
    if (rawDate != null) {
      parsedDate = DateTime.tryParse(rawDate.toString())?.toLocal();
    }

    double? parseCoord(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      return double.tryParse(val.toString());
    }

    return EmployeeLocationModel(
      employeeId: json['employeeId']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name'] ?? json['employeeName'] ?? 'Employee',
      email: json['email'] ?? json['employeeEmail'] ?? '',
      latitude: parseCoord(json['latitude']),
      longitude: parseCoord(json['longitude']),
      updatedAt: parsedDate,
    );
  }
}

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final Map<String, EmployeeLocationModel> _employees = {};
  final AdminSocketService _socketService = AdminSocketService();

  final MapController _mapController = MapController();
  Timer? _heartbeatTimer;

  bool _isLoading = true;
  bool _isSocketConnected = false;
  String _adminName = 'Admin';
  String _adminEmail = '';
  String? _selectedEmployeeId;
  int _viewMode = 0; // 0 = Split View, 1 = Full Map, 2 = Full List

  static const LatLng _defaultCenter = LatLng(17.3850, 78.4867);

  @override
  void initState() {
    super.initState();
    _loadAdminInfo();
    _fetchEmployees();
    _initSocket();

    // Heartbeat timer every 15 seconds to recalculate online/offline (< 30s) and relative timestamps without jank
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _loadAdminInfo() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _adminName = prefs.getString('user_name') ?? 'Admin';
      _adminEmail = prefs.getString('user_email') ?? '';
    });
  }

  Future<void> _fetchEmployees() async {
    setState(() => _isLoading = true);
    final result = await ApiService.getEmployeesLocations();

    if (!mounted) return;

    if (result['success']) {
      final list = result['employees'] as List<dynamic>? ?? [];
      for (final item in list) {
        if (item is Map<String, dynamic>) {
          final emp = EmployeeLocationModel.fromJson(item);
          if (emp.employeeId.isNotEmpty) {
            _employees[emp.employeeId] = emp;
          }
        }
      }
      _fitMapToMarkers();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message'] ?? 'Failed to load employees'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }

    setState(() => _isLoading = false);
  }

  void _initSocket() {
    _socketService.connect(
      onConnectionChange: (connected) {
        if (mounted) {
          setState(() => _isSocketConnected = connected);
        }
      },
      onLocationUpdate: (data) {
        final empId = data['employeeId']?.toString() ?? data['id']?.toString();
        if (empId == null || empId.isEmpty) return;

        double? parseCoord(dynamic val) {
          if (val == null) return null;
          if (val is num) return val.toDouble();
          return double.tryParse(val.toString());
        }

        final lat = parseCoord(data['latitude']);
        final lng = parseCoord(data['longitude']);
        DateTime? parsedDate;
        final rawDate = data['timestamp'] ?? data['updatedAt'];
        if (rawDate != null) {
          parsedDate = DateTime.tryParse(rawDate.toString())?.toLocal() ?? DateTime.now();
        } else {
          parsedDate = DateTime.now();
        }

        if (mounted) {
          setState(() {
            final existing = _employees[empId];
            if (existing != null) {
              _employees[empId] = existing.copyWith(
                name: data['employeeName'] ?? data['name'] ?? existing.name,
                email: data['employeeEmail'] ?? data['email'] ?? existing.email,
                latitude: lat ?? existing.latitude,
                longitude: lng ?? existing.longitude,
                updatedAt: parsedDate,
              );
            } else {
              _employees[empId] = EmployeeLocationModel(
                employeeId: empId,
                name: data['employeeName'] ?? data['name'] ?? 'Employee',
                email: data['employeeEmail'] ?? data['email'] ?? '',
                latitude: lat,
                longitude: lng,
                updatedAt: parsedDate,
              );
            }
          });
        }
      },
    );
  }

  void _fitMapToMarkers() {
    final locatedEmployees = _employees.values.where((e) => e.hasLocation).toList();
    if (locatedEmployees.isEmpty) return;

    if (locatedEmployees.length == 1) {
      final e = locatedEmployees.first;
      _mapController.move(LatLng(e.latitude!, e.longitude!), 15.0);
      return;
    }

    final points = locatedEmployees.map((e) => LatLng(e.latitude!, e.longitude!)).toList();
    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.all(50),
      ),
    );
  }

  void _centerOnEmployee(EmployeeLocationModel emp) {
    if (!emp.hasLocation) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${emp.name} has not reported GPS coordinates yet')),
      );
      return;
    }

    setState(() => _selectedEmployeeId = emp.employeeId);
    _mapController.move(LatLng(emp.latitude!, emp.longitude!), 16.5);
  }

  Future<void> _openInGoogleMaps(EmployeeLocationModel emp) async {
    if (!emp.hasLocation) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location unavailable — no GPS coordinates yet')),
      );
      return;
    }
    final lat = emp.latitude!;
    final lng = emp.longitude!;
    final googleMapsUrl = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=$lat,$lng',
    );
    final geoUri = Uri.parse('geo:$lat,$lng?q=$lat,$lng(${Uri.encodeComponent(emp.name)})');

    try {
      if (await canLaunchUrl(geoUri)) {
        await launchUrl(geoUri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {}

    try {
      await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open Google Maps')),
        );
      }
    }
  }

  void _showEmployeeDetailsModal(EmployeeLocationModel emp) {
    final theme = Theme.of(context);
    final online = emp.isOnline;

    showModalBottomSheet(
      context: context,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.outlineVariant,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: online
                          ? Colors.green.withValues(alpha: 0.2)
                          : Colors.red.withValues(alpha: 0.2),
                      child: Icon(
                        online ? Icons.person_pin_circle : Icons.location_off,
                        color: online ? Colors.green : Colors.red,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            emp.name,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            emp.email,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.outline,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: online
                            ? Colors.green.withValues(alpha: 0.15)
                            : Colors.red.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        online ? 'ONLINE' : 'OFFLINE',
                        style: TextStyle(
                          color: online ? Colors.green : Colors.red,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(height: 28),
                Row(
                  children: [
                    const Icon(Icons.access_time, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      emp.timeAgo,
                      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.explore_outlined, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        emp.hasLocation
                            ? 'Lat: ${emp.latitude!.toStringAsFixed(6)}, Lng: ${emp.longitude!.toStringAsFixed(6)}'
                            : 'Coordinates unavailable',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                    if (emp.hasLocation)
                      IconButton(
                        icon: const Icon(Icons.copy, size: 18),
                        tooltip: 'Copy Coordinates',
                        onPressed: () {
                          Clipboard.setData(
                            ClipboardData(text: '${emp.latitude}, ${emp.longitude}'),
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Coordinates copied to clipboard')),
                          );
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _centerOnEmployee(emp);
                  },
                  icon: const Icon(Icons.my_location),
                  label: const Text('Center & Focus on Map'),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: emp.hasLocation
                      ? () {
                          Navigator.of(ctx).pop();
                          _openInGoogleMaps(emp);
                        }
                      : null,
                  icon: const Icon(Icons.map_outlined),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF10B981),
                    side: const BorderSide(color: Color(0xFF10B981)),
                  ),
                  label: Text(
                    emp.hasLocation ? 'Open in Google Maps' : 'Location Unavailable',
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Marker> _buildMarkers() {
    final markers = <Marker>[];
    for (final emp in _employees.values) {
      if (!emp.hasLocation) continue;
      final online = emp.isOnline;
      final isSelected = emp.employeeId == _selectedEmployeeId;

      markers.add(
        Marker(
          point: LatLng(emp.latitude!, emp.longitude!),
          width: 80,
          height: 64,
          child: GestureDetector(
            onTap: () {
              setState(() => _selectedEmployeeId = emp.employeeId);
              _showEmployeeDetailsModal(emp);
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: isSelected
                          ? Colors.cyanAccent
                          : (online ? const Color(0xFF10B981) : Colors.redAccent),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.4),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    emp.name.split(' ').first,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Icon(
                  Icons.location_on,
                  color: isSelected
                      ? Colors.cyanAccent
                      : (online ? const Color(0xFF10B981) : Colors.redAccent),
                  size: 34,
                ),
              ],
            ),
          ),
        ),
      );
    }
    return markers;
  }

  Future<void> _handleLogout() async {
    _socketService.disconnect();
    _heartbeatTimer?.cancel();
    await ApiService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const RoleSelectionScreen()),
      (route) => false,
    );
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _socketService.disconnect();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final employeeList = _employees.values.toList();
    final totalCount = employeeList.length;
    final onlineCount = employeeList.where((e) => e.isOnline).length;
    final offlineCount = totalCount - onlineCount;

    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(10.0),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Container(
              color: Colors.white,
              child: Image.asset('assets/images/app_logo.jpg', fit: BoxFit.contain),
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'ADMIN DASHBOARD',
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 0.8),
            ),
            Row(
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: _isSocketConnected ? const Color(0xFF10B981) : Colors.amber,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isSocketConnected ? 'Live Socket Connected' : 'Connecting...',
                  style: TextStyle(
                    fontSize: 11,
                    color: _isSocketConnected ? const Color(0xFF10B981) : Colors.amber,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: CircleAvatar(
              radius: 13,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                _adminName.isNotEmpty ? _adminName[0].toUpperCase() : 'A',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: theme.colorScheme.onPrimaryContainer,
                ),
              ),
            ),
            tooltip: '$_adminName ($_adminEmail)',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Administrator: $_adminName ($_adminEmail)'),
                  duration: const Duration(seconds: 2),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.badge_outlined),
            tooltip: 'View Employee Tracking Mode',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const StatusScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Telemetry',
            onPressed: _fetchEmployees,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Log Out',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Metrics Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                children: [
                  _buildMetricCard(
                    theme,
                    title: 'Total Employees',
                    value: '$totalCount',
                    color: theme.colorScheme.primary,
                    icon: Icons.people_alt_outlined,
                  ),
                  const SizedBox(width: 8),
                  _buildMetricCard(
                    theme,
                    title: 'Active (Online)',
                    value: '$onlineCount',
                    color: Colors.green,
                    icon: Icons.wifi_tethering,
                  ),
                  const SizedBox(width: 8),
                  _buildMetricCard(
                    theme,
                    title: 'Offline',
                    value: '$offlineCount',
                    color: Colors.redAccent,
                    icon: Icons.wifi_off_rounded,
                  ),
                ],
              ),
            ),

            // View Mode Segmented Controls
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
              child: SegmentedButton<int>(
                segments: const [
                  ButtonSegment(
                    value: 0,
                    icon: Icon(Icons.vertical_split_rounded, size: 16),
                    label: Text('Split View', style: TextStyle(fontSize: 12)),
                  ),
                  ButtonSegment(
                    value: 1,
                    icon: Icon(Icons.map_rounded, size: 16),
                    label: Text('Map Focus', style: TextStyle(fontSize: 12)),
                  ),
                  ButtonSegment(
                    value: 2,
                    icon: Icon(Icons.list_alt_rounded, size: 16),
                    label: Text('Employee List', style: TextStyle(fontSize: 12)),
                  ),
                ],
                selected: {_viewMode},
                onSelectionChanged: (set) {
                  setState(() => _viewMode = set.first);
                },
              ),
            ),
            const SizedBox(height: 6),

            // Content Area depending on viewMode
            Expanded(
              child: _isLoading && employeeList.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _buildMainContent(employeeList),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(
    ThemeData theme, {
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: color.withValues(alpha: 0.25),
            width: 1.2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 15, color: color),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainContent(List<EmployeeLocationModel> employeeList) {
    if (_viewMode == 1) {
      // Full Map
      return _buildGoogleMap();
    } else if (_viewMode == 2) {
      // Full List
      return _buildEmployeeList(employeeList);
    } else {
      // Split View: Top Map, Bottom List
      return Column(
        children: [
          Expanded(
            flex: 5,
            child: _buildGoogleMap(),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'FIELD PERSONNEL LIST',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.6),
                ),
                Text(
                  '${employeeList.length} employees',
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            flex: 5,
            child: _buildEmployeeList(employeeList),
          ),
        ],
      );
    }
  }

  Widget _buildGoogleMap() {
    final markers = _buildMarkers();
    final hasEmployees = _employees.values.any((e) => e.hasLocation);
    final initialCenter = hasEmployees
        ? LatLng(
            _employees.values.firstWhere((e) => e.hasLocation).latitude!,
            _employees.values.firstWhere((e) => e.hasLocation).longitude!,
          )
        : _defaultCenter;

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: initialCenter,
            initialZoom: 14.0,
            onMapReady: () {
              _fitMapToMarkers();
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
              userAgentPackageName: 'com.livetracker.employee_app',
              maxZoom: 20,
              maxNativeZoom: 19,
            ),
            MarkerLayer(markers: markers),
          ],
        ),
        Positioned(
          right: 12,
          bottom: 12,
          child: Column(
            children: [
              FloatingActionButton.small(
                heroTag: 'fit_bounds',
                onPressed: _fitMapToMarkers,
                tooltip: 'Fit All Markers',
                child: const Icon(Icons.crop_free_rounded),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'zoom_in',
                onPressed: () {
                  final zoom = _mapController.camera.zoom + 1;
                  _mapController.move(_mapController.camera.center, zoom);
                },
                tooltip: 'Zoom In',
                child: const Icon(Icons.add),
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: 'zoom_out',
                onPressed: () {
                  final zoom = _mapController.camera.zoom - 1;
                  _mapController.move(_mapController.camera.center, zoom);
                },
                tooltip: 'Zoom Out',
                child: const Icon(Icons.remove),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmployeeList(List<EmployeeLocationModel> employeeList) {
    if (employeeList.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 48, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            const Text('No employees found in organization'),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      itemCount: employeeList.length,
      itemBuilder: (ctx, index) {
        final emp = employeeList[index];
        final online = emp.isOnline;
        final isSelected = emp.employeeId == _selectedEmployeeId;

        return Card(
          margin: const EdgeInsets.symmetric(vertical: 4),
          elevation: isSelected ? 2 : 0,
          color: isSelected
              ? Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.25)
              : Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: isSelected
                ? BorderSide(color: Theme.of(context).colorScheme.primary, width: 1.5)
                : BorderSide.none,
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            leading: Stack(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                  child: Text(
                    emp.name.isNotEmpty ? emp.name[0].toUpperCase() : 'E',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                    ),
                  ),
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 11,
                    height: 11,
                    decoration: BoxDecoration(
                      color: online ? const Color(0xFF10B981) : Colors.red,
                      shape: BoxShape.circle,
                      border: Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
                    ),
                  ),
                ),
              ],
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    emp.name,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
                Text(
                  online ? '🟢 Online' : '🔴 Offline',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: online ? const Color(0xFF10B981) : Colors.redAccent,
                  ),
                ),
              ],
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  emp.email,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(Icons.schedule, size: 12, color: Theme.of(context).colorScheme.outline),
                    const SizedBox(width: 4),
                    Text(
                      emp.timeAgo,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                    if (emp.hasLocation) ...[
                      const SizedBox(width: 8),
                      Text(
                        '•  (${emp.latitude!.toStringAsFixed(3)}, ${emp.longitude!.toStringAsFixed(3)})',
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(
                    Icons.my_location_rounded,
                    color: emp.hasLocation ? Theme.of(context).colorScheme.primary : Colors.grey,
                    size: 22,
                  ),
                  tooltip: 'Center on In-App Map',
                  onPressed: () {
                    _centerOnEmployee(emp);
                    if (_viewMode == 2) {
                      setState(() => _viewMode = 0); // Switch to split view to see map
                    }
                  },
                ),
                IconButton(
                  icon: Icon(
                    Icons.open_in_new_rounded,
                    color: emp.hasLocation ? const Color(0xFF10B981) : Colors.grey,
                    size: 22,
                  ),
                  tooltip: 'Open in Google Maps',
                  onPressed: emp.hasLocation ? () => _openInGoogleMaps(emp) : null,
                ),
              ],
            ),
            onTap: () {
              _centerOnEmployee(emp);
              _showEmployeeDetailsModal(emp);
            },
          ),
        );
      },
    );
  }
}
