import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class BaseLayout extends StatelessWidget {
  final Widget child;

  const BaseLayout({required this.child, super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          _buildWindowTitleBar(),
          Expanded(child: child),
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
}
