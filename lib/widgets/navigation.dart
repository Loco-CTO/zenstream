import 'package:flutter/material.dart';
import 'dart:ui';

class NavigationMenu extends StatelessWidget {
  const NavigationMenu({super.key});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Drawer(
          backgroundColor: Colors.black.withAlpha((0.3 * 255).toInt()),
          child: Container(
            color: Colors.black.withAlpha((0.3 * 255).toInt()),
            child: ListView(
              padding: EdgeInsets.zero,
              children: <Widget>[],
            ),
          ),
        ),
      ),
    );
  }
}
