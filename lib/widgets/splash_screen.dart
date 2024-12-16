import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

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
