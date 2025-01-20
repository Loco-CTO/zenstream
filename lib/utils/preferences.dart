import "package:universal_html/html.dart" as html;
import "package:shared_preferences/shared_preferences.dart";
import 'package:flutter/foundation.dart' show kIsWeb;

Future<String?> getPreference(String name) async {
  if (kIsWeb) {
    final cookies = html.window.document.cookie?.split(';') ?? [];
    for (final cookie in cookies) {
      final pair = cookie.trim().split('=');
      if (pair.length == 2 && pair[0] == name) {
        return pair[1];
      }
    }
    return null;
  } else {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(name);
  }
}

Future<void> setPreference(String name, String value) async {
  if (kIsWeb) {
    final String cookie = '$name=$value; path=/';
    html.window.document.cookie = cookie;
  } else {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(name, value);
  }
}

Future<void> deletePreference(String name) async {
  if (kIsWeb) {
    html.window.document.cookie =
        '$name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
  } else {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(name);
  }
}
