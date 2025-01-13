import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:zenstream/jellyfin/api_services.swagger.dart";

class PreCheck extends StatefulWidget {
  final Widget nextPage;

  const PreCheck({super.key, required this.nextPage});

  @override
  PreCheckState createState() => PreCheckState();
}

class PreCheckState extends State<PreCheck> {
  final JellyfinApiService _apiService = JellyfinApiService();
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");
    if (token == null || !(await _apiService.checkAuthToken(token))) {
      await prefs.remove("token");
      setState(() {
        _errorMessage = "You have been logged out";
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.pushNamed(context, '/login');
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
    return Scaffold(
      body: Center(
        child: _errorMessage != null
            ? Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.red),
              )
            : const CircularProgressIndicator(),
      ),
    );
  }
}
