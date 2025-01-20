import "package:flutter/material.dart";
import "../utils/preferences.dart";
import "base_layout.dart";

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  SplashScreenState createState() => SplashScreenState();
}

class SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(seconds: 2), () {
      _checkLoginStatus();
    });
  }

  void _navigateToLogin() {
    Navigator.pushNamed(context, '/login');
  }

  Future<void> _checkLoginStatus() async {
    final token = await getPreference("token");

    if (!mounted) return;

    if (token == null) {
      _navigateToLogin();
    } else {
      Navigator.pushNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseLayout(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              "assets/icons/icon.png",
              width: 150,
              height: 150,
            ),
          ],
        ),
      ),
    );
  }
}
