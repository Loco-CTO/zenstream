import 'package:flutter/material.dart';
import 'package:zenstream/utils/precheck.dart';
import 'package:zenstream/widgets/base_layout.dart';
import 'package:zenstream/screens/home.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  SplashScreenState createState() => SplashScreenState();
}

class SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
              builder: (context) => const PreCheck(nextPage: HomeScreen())),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BaseLayout(
      child: Center(
        child: Image.asset(
          'assets/icons/icon.png',
          width: 150,
          height: 150,
        ),
      ),
    );
  }
}
