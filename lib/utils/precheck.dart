import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zenstream/pages/login.dart';
import 'package:zenstream/jellyfin/api_services.swagger.dart';

class PreCheck extends StatefulWidget {
  final Widget nextPage;

  const PreCheck({super.key, required this.nextPage});

  @override
  PreCheckState createState() => PreCheckState();
}

class PreCheckState extends State<PreCheck> {
  final JellyfinApiService _apiService = JellyfinApiService();

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (token == null || !(await _apiService.checkAuthToken(token))) {
      await prefs.remove('token');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => const LoginScreen()),
        );
      });
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (context) => widget.nextPage),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
