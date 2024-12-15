import 'package:flutter/material.dart';

class ThemeDataStyle {
  static ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      surface: const Color.fromARGB(255, 245, 248, 255),
      surfaceDim: const Color.fromARGB(255, 235, 238, 245),
      primary: const Color.fromARGB(255, 160, 157, 219),
      secondary: const Color.fromARGB(255, 160, 157, 219),
    ),
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      surface: const Color.fromARGB(255, 22, 24, 29),
      surfaceDim: const Color.fromARGB(255, 13, 15, 18),
      primary: const Color.fromARGB(255, 160, 157, 219),
      secondary: const Color.fromARGB(255, 160, 157, 219),
    ),
  );
}
