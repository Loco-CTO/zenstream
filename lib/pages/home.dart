import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:zenstream/utils/theme_notifier.dart';

class HomePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final themeNotifier = Provider.of<ThemeNotifier>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'ZenStream',
          style: TextStyle(
            fontSize: 24.0,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(themeNotifier.themeMode == ThemeMode.light
                ? Icons.dark_mode
                : Icons.light_mode),
            onPressed: () {
              themeNotifier.toggleTheme();
            },
          ),
        ],
      ),
      body: Center(
        child: Text('ようだい！'),
      ),
    );
  }
}
