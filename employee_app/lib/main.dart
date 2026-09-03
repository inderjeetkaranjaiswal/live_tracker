import 'package:flutter/material.dart';
import 'config/app_config.dart';
import 'services/api_service.dart';
import 'screens/login_screen.dart';
import 'screens/status_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  final loggedIn = await ApiService.isLoggedIn();
  runApp(EmployeeApp(isLoggedIn: loggedIn));
}

class EmployeeApp extends StatelessWidget {
  final bool isLoggedIn;
  const EmployeeApp({super.key, required this.isLoggedIn});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Employee Live Tracker',
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
      home: isLoggedIn ? const StatusScreen() : const LoginScreen(),
    );
  }
}
