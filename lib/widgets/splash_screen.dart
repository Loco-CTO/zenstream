import 'package:flutter/material.dart';
import 'package:zenstream/pages/home.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  _SplashScreenState createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(seconds: 3), () {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (context) => const HomePage()),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _buildWindowTitleBar(),
          _buildLogo(),
        ],
      ),
    );
  }

  Widget _buildWindowTitleBar() {
    return WindowTitleBarBox(
      child: Row(
        children: [
          Expanded(child: MoveWindow(child: Container())),
          MinimizeWindowButton(),
          MaximizeWindowButton(),
          CloseWindowButton(),
        ],
      ),
    );
  }

  Widget _buildLogo() {
    return Expanded(
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
