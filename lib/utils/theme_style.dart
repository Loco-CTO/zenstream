import 'package:flutter/material.dart';

class ThemeDataStyle {
  static ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      surface: const Color.fromARGB(255, 245, 248, 255),
      primary: const Color.fromARGB(255, 160, 157, 219),
      secondary: Colors.deepPurple.shade300,
    ),
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      surface: const Color.fromARGB(255, 35, 35, 37),
      primary: Colors.deepPurple.shade500,
      secondary: Colors.deepPurple.shade700,
    ),
  );
}
