import "package:flutter/material.dart";
import "preferences.dart";

class ThemeNotifier extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.dark;

  ThemeNotifier() {
    _loadTheme();
  }

  ThemeMode get themeMode => _themeMode;

  void toggleTheme() async {
    _themeMode =
        _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
    await _saveTheme();
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

  Future<void> _saveTheme() async {
    await setPreference(
        "theme", ThemeMode.values.indexOf(_themeMode).toString());
  }
}
