import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";

class ThemeNotifier extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.light;

  ThemeNotifier() {
    _loadTheme();
  }

  ThemeMode get themeMode => _themeMode;

  void toggleTheme() async {
    if (_themeMode == ThemeMode.light) {
      _themeMode = ThemeMode.dark;
    } else {
      _themeMode = ThemeMode.light;
    }
    notifyListeners();
    _saveTheme();
  }

  void _loadTheme() async {
    final prefs = await SharedPreferences.getInstance();
    final themeIndex = prefs.getInt("themeMode") ?? 0;
    _themeMode = ThemeMode.values[themeIndex];
    notifyListeners();
  }

  void _saveTheme() async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setInt("themeMode", _themeMode.index);
  }
}
