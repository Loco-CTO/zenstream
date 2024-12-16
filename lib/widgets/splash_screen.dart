import 'package:flutter/material.dart';
import 'package:zenstream/pages/home.dart';
import 'package:zenstream/widgets/layout.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  SplashScreenState createState() => SplashScreenState();
}

class SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateToHome();
  }

  _navigateToHome() async {
    await Future.delayed(Duration(seconds: 3), () {});
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => HomePage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BaseLayoutScaffold(
      body: Center(
        child: Image.asset(
          'assets/icons/icon.png',
          width: 150,
          height: 150,
        ),
      ),
    );
  }
}
