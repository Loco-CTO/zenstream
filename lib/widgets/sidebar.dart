import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zenstream/utils/theme_notifier.dart';
import 'package:zenstream/screens/login.dart';

class Sidebar extends StatelessWidget {
  const Sidebar({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sidebarColor = theme.colorScheme.surfaceDim;
    final iconColor = theme.iconTheme.color ?? Colors.black;

    return Container(
      width: 92,
      decoration: BoxDecoration(color: sidebarColor),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildTitleBar(),
          _buildIconButtons(iconColor),
          _buildThemeToggleButton(context, iconColor),
          _buildLogoutButton(context, iconColor),
        ],
      ),
    );
  }

  Widget _buildTitleBar() {
    return WindowTitleBarBox(
      child: Row(
        children: [
          Expanded(
            child: MoveWindow(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(15, 8, 0, 0),
                child: Text(
                  'ZenStream',
                  style: TextStyle(
                    fontSize: 13.0,
                    fontFamily: 'Nunito',
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconButtons(Color iconColor) {
    return Flexible(
      fit: FlexFit.loose,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildIconButton(Icons.home, iconColor, () {}),
          _buildIconButton(Icons.list, iconColor, () {}),
          _buildIconButton(Icons.settings, iconColor, () {}),
        ],
      ),
    );
  }

  Widget _buildIconButton(IconData icon, Color color, VoidCallback onPressed) {
    return IconButton(
      icon: Icon(icon, color: color),
      iconSize: 30.0,
      onPressed: onPressed,
    );
  }

  Widget _buildThemeToggleButton(BuildContext context, Color iconColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20.0),
      child: IconButton(
        icon: Icon(Icons.brightness_6, color: iconColor),
        iconSize: 25.0,
        onPressed: () {
          Provider.of<ThemeNotifier>(context, listen: false).toggleTheme();
        },
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context, Color iconColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20.0),
      child: IconButton(
        icon: Icon(Icons.logout, color: iconColor),
        iconSize: 25.0,
        onPressed: () async {
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove('token');
          if (!context.mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (context) => const LoginScreen()),
          );
        },
      ),
    );
  }
}
