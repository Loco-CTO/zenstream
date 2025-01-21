import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:json_theme_plus/json_theme_plus.dart';

class ThemeDataStyle {
  static Future<ThemeData> loadTheme(String path) async {
    final String jsonString = await rootBundle.loadString(path);
    final Map<String, dynamic> jsonMap = json.decode(jsonString);
    return ThemeDecoder.decodeThemeData(jsonMap)!;
  }

  static Future<ThemeData> get light async =>
      await loadTheme('themes/light.json');
  static Future<ThemeData> get dark async =>
      await loadTheme('themes/dark.json');
}
