import 'package:flutter/material.dart';
import 'config/app_config.dart';
import 'services/api_service.dart';
import 'screens/role_selection_screen.dart';
import 'screens/status_screen.dart';
import 'screens/admin_dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  final loggedIn = await ApiService.isLoggedIn();
  String? role;
  if (loggedIn) {
    role = await ApiService.getUserRole();
  }
  runApp(EmployeeApp(isLoggedIn: loggedIn, userRole: role));
}

class EmployeeApp extends StatelessWidget {
  final bool isLoggedIn;
  final String? userRole;

  const EmployeeApp({
    super.key,
    required this.isLoggedIn,
    this.userRole,
  });

  @override
  Widget build(BuildContext context) {
    Widget initialScreen;
    if (isLoggedIn) {
      if (userRole == 'admin') {
        initialScreen = const AdminDashboardScreen();
      } else {
        initialScreen = const StatusScreen();
      }
    } else {
      initialScreen = const RoleSelectionScreen();
    }

    return MaterialApp(
      title: 'Live Employee Tracker',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10B981), // Emerald accent
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10B981),
          brightness: Brightness.dark,
          surface: const Color(0xFF0F172A),
        ),
      ),
      home: initialScreen,
    );
  }
}
