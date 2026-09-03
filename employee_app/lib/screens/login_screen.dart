import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../services/api_service.dart';
import 'permission_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isRegister = false;
  bool _showServerConfig = false;

  final _nameController = TextEditingController();
  final _emailController = TextEditingController(text: 'employee@livetracker.com');
  final _passwordController = TextEditingController();
  final _serverUrlController = TextEditingController();
  String _selectedRole = 'employee';

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _serverUrlController.text = AppConfig.baseUrl;
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_serverUrlController.text.trim().isNotEmpty) {
      await AppConfig.setBaseUrl(_serverUrlController.text.trim());
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final Map<String, dynamic> result;

    if (_isRegister) {
      result = await ApiService.register(
        _nameController.text.trim(),
        _emailController.text.trim(),
        _passwordController.text.trim(),
        role: _selectedRole,
      );
    } else {
      result = await ApiService.login(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );
    }

    setState(() {
      _isLoading = false;
    });

    if (result['success']) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const PermissionScreen()),
      );
    } else {
      setState(() {
        _errorMessage = result['message'];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Brand Icon
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Icon(
                        Icons.my_location_rounded,
                        size: 44,
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 24),

                    Text(
                      _isRegister ? 'Create Account' : 'Employee Portal',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isRegister
                          ? 'Register your account to begin sharing live GPS updates'
                          : 'Sign in to enable live GPS location tracking for field operations',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),

                    if (_errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: theme.colorScheme.onErrorContainer),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    if (_isRegister) ...[
                      TextFormField(
                        controller: _nameController,
                        decoration: InputDecoration(
                          labelText: 'Full Name',
                          prefixIcon: const Icon(Icons.person_outline),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        validator: (val) {
                          if (val == null || val.isEmpty) return 'Please enter your full name';
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: 'Email Address',
                        prefixIcon: const Icon(Icons.email_outlined),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) return 'Please enter your email';
                        if (!val.contains('@')) return 'Enter a valid email address';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      validator: (val) {
                        if (val == null || val.isEmpty) return 'Please enter your password';
                        if (_isRegister && val.length < 8) return 'Password must be at least 8 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    if (_isRegister) ...[
                      DropdownButtonFormField<String>(
                        value: _selectedRole,
                        decoration: InputDecoration(
                          labelText: 'Select Role',
                          prefixIcon: const Icon(Icons.badge_outlined),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'employee', child: Text('Employee (Field Personnel)')),
                          DropdownMenuItem(value: 'admin', child: Text('Admin (System Monitor)')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedRole = val);
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Server Configuration Expansion
                    ExpansionTile(
                      title: const Text('Server Connection Settings', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      leading: const Icon(Icons.dns_outlined, size: 20),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12.0),
                          child: TextFormField(
                            controller: _serverUrlController,
                            decoration: InputDecoration(
                              labelText: 'Backend Server URL',
                              hintText: 'http://172.18.22.40:8080',
                              prefixIcon: const Icon(Icons.link),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    FilledButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2.5),
                            )
                          : Text(
                              _isRegister ? 'Register Account' : 'Log In & Enable Tracking',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                    ),
                    const SizedBox(height: 16),

                    TextButton(
                      onPressed: () {
                        setState(() {
                          _isRegister = !_isRegister;
                          _errorMessage = null;
                        });
                      },
                      child: Text(
                        _isRegister
                            ? 'Already have an account? Sign In'
                            : 'Need a new account? Register here',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
