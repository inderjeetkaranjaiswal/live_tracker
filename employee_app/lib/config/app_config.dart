import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Configuration settings for Employee Mobile App.
class AppConfig {
  static String _customBaseUrl = '';

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUrl = prefs.getString('custom_server_url');
    if (savedUrl != null && savedUrl.isNotEmpty) {
      _customBaseUrl = savedUrl.trim();
    }
  }

  static Future<void> setBaseUrl(String url) async {
    _customBaseUrl = url.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_server_url', _customBaseUrl);
  }

  /// Backend API Base URL (Render Production Server)
  static String get baseUrl {
    if (_customBaseUrl.isNotEmpty) return _customBaseUrl;
    return 'https://live-tracker-ahr5.onrender.com';
  }
}
