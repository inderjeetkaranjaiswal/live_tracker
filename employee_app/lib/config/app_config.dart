import 'package:shared_preferences/shared_preferences.dart';

/// Centralized configuration for Mobile App (Employee & Admin).
/// Production base URL is strictly bound to Render: https://live-tracker-ahr5.onrender.com
class AppConfig {
  /// Canonical production Render backend URL.
  static const String productionBaseUrl = 'https://live-tracker-ahr5.onrender.com';

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    // Clean up any stale or accidental localhost/127.0.0.1 custom URLs from previous runs
    await prefs.remove('custom_server_url');
  }

  /// Backend API Base URL — strictly points to the production Render backend.
  static String get baseUrl => productionBaseUrl;
}

