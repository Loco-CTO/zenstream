import "package:flutter/material.dart";
import "preferences.dart";

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
    final themeIndexString = await getPreference("theme");
    if (themeIndexString != null) {
      final themeIndex = int.tryParse(themeIndexString);
      if (themeIndex != null &&
          themeIndex >= 0 &&
          themeIndex < ThemeMode.values.length) {
        _themeMode = ThemeMode.values[themeIndex];
      }
    }
    notifyListeners();
  }

  void _saveTheme() async {
    await setPreference(
        "theme", ThemeMode.values.indexOf(_themeMode).toString());
  }
}
