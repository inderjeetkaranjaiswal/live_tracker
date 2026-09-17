import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';

class ApiService {
  static String get baseUrl => AppConfig.baseUrl;

  // In-memory cache to avoid continuous disk reads on frequent location updates
  static String? _cachedToken;
  static String? _cachedUserId;
  static String? _cachedUserName;
  static String? _cachedUserEmail;
  static String? _cachedUserRole;
  static bool _isCacheInitialized = false;

  // Render cold start can take 25-45 seconds; set per-attempt timeout to 30s
  static const Duration _timeoutDuration = Duration(seconds: 30);

  static Future<void> _ensureCache() async {
    if (_isCacheInitialized) return;
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString('jwt_token');
    _cachedUserId = prefs.getString('user_id');
    _cachedUserName = prefs.getString('user_name');
    _cachedUserEmail = prefs.getString('user_email');
    _cachedUserRole = prefs.getString('user_role');
    _isCacheInitialized = true;
  }

  /// Register a new user account on the backend.
  static Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password, {
    String role = 'employee',
  }) async {
    final url = Uri.parse('$baseUrl/auth/register');
    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name,
              'email': email,
              'password': password,
              'role': role,
            }),
          )
          .timeout(_timeoutDuration);

      final data = jsonDecode(response.body);
      if (response.statusCode == 201) {
        final prefs = await SharedPreferences.getInstance();
        final userRole = data['user']?['role'] ?? role;
        final token = data['token'] ?? '';
        final userName = data['user']?['name'] ?? name;
        final userEmail = data['user']?['email'] ?? email;
        final userId = data['user']?['id'] ?? '';

        await prefs.setString('jwt_token', token);
        await prefs.setString('user_name', userName);
        await prefs.setString('user_email', userEmail);
        await prefs.setString('user_id', userId);
        await prefs.setString('user_role', userRole);

        _cachedToken = token;
        _cachedUserName = userName;
        _cachedUserEmail = userEmail;
        _cachedUserId = userId;
        _cachedUserRole = userRole;
        _isCacheInitialized = true;

        return {'success': true, 'data': data, 'role': userRole};
      } else if (response.statusCode == 409) {
        return {'success': false, 'message': 'An account with this email already exists.'};
      } else if (response.statusCode == 400) {
        final errList = data['errors'] as List<dynamic>?;
        final firstMsg = errList?.isNotEmpty == true ? errList!.first['msg'] : null;
        return {'success': false, 'message': firstMsg ?? data['message'] ?? 'Invalid registration data.'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Registration failed.'};
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Server connection timed out. Server may be waking up, please retry.'};
    } on SocketException {
      return {'success': false, 'message': 'Unable to connect to server. Please check your internet connection.'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: ${e.toString()}'};
    }
  }

  /// Hardened login with Render cold-start retry handling and explicit HTTP error distinction.
  /// Does NOT retry on 401 (invalid credentials).
  /// Retries up to [maxAttempts] times only on timeouts or network drops with a short delay.
  static Future<Map<String, dynamic>> login(
    String email,
    String password, {
    void Function(String status)? onStatusUpdate,
    int maxAttempts = 3,
  }) async {
    final url = Uri.parse('$baseUrl/auth/login');
    final headers = {'Content-Type': 'application/json'};
    final body = jsonEncode({'email': email, 'password': password});

    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt == 1) {
        onStatusUpdate?.call('Connecting to server...');
      } else {
        onStatusUpdate?.call('Server is waking up, retrying (attempt $attempt of $maxAttempts)...');
      }

      try {
        final response = await http
            .post(url, headers: headers, body: body)
            .timeout(_timeoutDuration);

        Map<String, dynamic> data = {};
        try {
          data = jsonDecode(response.body);
        } catch (_) {}

        if (response.statusCode == 200) {
          final prefs = await SharedPreferences.getInstance();
          final userRole = data['user']?['role'] ?? 'employee';
          final token = data['token'] ?? '';
          final userName = data['user']?['name'] ?? 'User';
          final userEmail = data['user']?['email'] ?? email;
          final userId = data['user']?['id'] ?? '';

          await prefs.setString('jwt_token', token);
          await prefs.setString('user_name', userName);
          await prefs.setString('user_email', userEmail);
          await prefs.setString('user_id', userId);
          await prefs.setString('user_role', userRole);

          _cachedToken = token;
          _cachedUserName = userName;
          _cachedUserEmail = userEmail;
          _cachedUserId = userId;
          _cachedUserRole = userRole;
          _isCacheInitialized = true;

          return {'success': true, 'data': data, 'role': userRole};
        } else if (response.statusCode == 401) {
          // Authentication error — NEVER retry invalid credentials!
          return {'success': false, 'message': 'Invalid email or password.'};
        } else if (response.statusCode == 403) {
          return {'success': false, 'message': 'You are not authorized to access this resource.'};
        } else if (response.statusCode == 404) {
          return {'success': false, 'message': 'API endpoint unavailable.'};
        } else if (response.statusCode >= 500) {
          // Server error / Render cold gateway 502/503
          if (attempt < maxAttempts) {
            await Future.delayed(const Duration(seconds: 2));
            continue;
          }
          return {'success': false, 'message': 'Server error (${response.statusCode}). Please try again.'};
        } else {
          return {'success': false, 'message': data['message'] ?? 'Authentication failed (HTTP ${response.statusCode})'};
        }
      } on TimeoutException {
        if (attempt < maxAttempts) {
          await Future.delayed(const Duration(seconds: 2));
          continue;
        }
        return {
          'success': false,
          'message': 'Server connection timed out. Server may be waking up, please try again.',
        };
      } on SocketException {
        if (attempt < maxAttempts) {
          await Future.delayed(const Duration(seconds: 2));
          continue;
        }
        return {
          'success': false,
          'message': 'Unable to connect to server. Please check your internet connection.',
        };
      } catch (e) {
        if (attempt < maxAttempts && (e is http.ClientException || e.toString().contains('Failed host lookup'))) {
          await Future.delayed(const Duration(seconds: 2));
          continue;
        }
        return {'success': false, 'message': 'Network error: ${e.toString()}'};
      }
    }

    return {'success': false, 'message': 'Unable to connect to server. Please try again.'};
  }

  /// Check whether a valid, unexpired session exists in persistent storage.
  /// Automatically clears storage and returns false if the JWT is expired.
  static Future<bool> isSessionValid() async {
    await _ensureCache();
    final token = _cachedToken;
    if (token == null || token.isEmpty) {
      return false;
    }

    try {
      final parts = token.split('.');
      if (parts.length != 3) {
        await logout();
        return false;
      }

      final normalized = base64Url.normalize(parts[1]);
      final payloadString = utf8.decode(base64Url.decode(normalized));
      final payload = jsonDecode(payloadString);

      if (payload is Map<String, dynamic> && payload.containsKey('exp')) {
        final exp = payload['exp'];
        final expSeconds = exp is num ? exp.toInt() : int.tryParse(exp.toString());
        if (expSeconds != null) {
          final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
          // Invalidate if token expired or expires within 5 seconds
          if (nowSeconds >= expSeconds - 5) {
            await logout();
            return false;
          }
        }
      }
      return true;
    } catch (_) {
      await logout();
      return false;
    }
  }

  static Future<bool> isLoggedIn() async {
    return await isSessionValid();
  }

  /// Employee API: Update live GPS coordinates
  static Future<Map<String, dynamic>> updateLocation(double latitude, double longitude) async {
    await _ensureCache();
    final token = _cachedToken;

    if (token == null || token.isEmpty) {
      return {'success': false, 'message': 'No authentication token found'};
    }

    final url = Uri.parse('$baseUrl/location/update');
    try {
      final response = await http
          .post(
            url,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'latitude': latitude,
              'longitude': longitude,
            }),
          )
          .timeout(const Duration(seconds: 15));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'data': data};
      } else if (response.statusCode == 401) {
        await logout();
        return {'success': false, 'message': 'Session expired. Please log in again.'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Failed to update location'};
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Location sync timed out'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: ${e.toString()}'};
    }
  }

  /// Admin API: Fetch live location for all employees
  static Future<Map<String, dynamic>> getEmployeesLocations() async {
    await _ensureCache();
    final token = _cachedToken;

    if (token == null || token.isEmpty) {
      return {'success': false, 'message': 'No authentication token found'};
    }

    final url = Uri.parse('$baseUrl/location/all');
    try {
      final response = await http
          .get(
            url,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(_timeoutDuration);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return {
          'success': true,
          'count': data['count'] ?? 0,
          'employees': data['employees'] ?? [],
        };
      } else if (response.statusCode == 401) {
        await logout();
        return {'success': false, 'message': 'Session expired. Please log in again.'};
      } else {
        Map<String, dynamic> data = {};
        try {
          data = jsonDecode(response.body);
        } catch (_) {}
        return {
          'success': false,
          'message': data['message'] ?? 'Failed to fetch employee locations (HTTP ${response.statusCode})',
        };
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Server connection timed out fetching employee locations'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: ${e.toString()}'};
    }
  }

  /// Admin API: Fetch single employee location details
  static Future<Map<String, dynamic>> getEmployeeLocation(String employeeId) async {
    await _ensureCache();
    final token = _cachedToken;

    if (token == null || token.isEmpty) {
      return {'success': false, 'message': 'No authentication token found'};
    }

    final url = Uri.parse('$baseUrl/location/$employeeId');
    try {
      final response = await http
          .get(
            url,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(_timeoutDuration);

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'employee': data['employee']};
      } else if (response.statusCode == 401) {
        await logout();
        return {'success': false, 'message': 'Session expired. Please log in again.'};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Failed to fetch location'};
      }
    } on TimeoutException {
      return {'success': false, 'message': 'Request timed out'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: ${e.toString()}'};
    }
  }

  static Future<String?> getUserRole() async {
    await _ensureCache();
    return _cachedUserRole;
  }

  static Future<String?> getUserId() async {
    await _ensureCache();
    return _cachedUserId;
  }

  static Future<String?> getUserName() async {
    await _ensureCache();
    return _cachedUserName;
  }

  static Future<String?> getUserEmail() async {
    await _ensureCache();
    return _cachedUserEmail;
  }

  static Future<String?> getStoredToken() async {
    await _ensureCache();
    return _cachedToken;
  }

  static Future<void> logout() async {
    _cachedToken = null;
    _cachedUserId = null;
    _cachedUserName = null;
    _cachedUserEmail = null;
    _cachedUserRole = null;
    _isCacheInitialized = false;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
    await prefs.remove('user_id');
    await prefs.remove('user_role');
  }
}

