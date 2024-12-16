import 'package:flutter/material.dart';

class ThemeDataStyle {
  static final TextTheme textTheme = TextTheme(
    displayLarge: TextStyle(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.5,
    ),
    displayMedium: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
    ),
    displaySmall: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
    ),
    headlineLarge: TextStyle(
      fontSize: 36,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.15,
    ),
    headlineMedium: TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.15,
    ),
    headlineSmall: TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.15,
    ),
  );

  static ThemeData light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      surface: const Color.fromARGB(255, 245, 248, 255),
      surfaceDim: const Color.fromARGB(255, 235, 238, 245),
      surfaceBright: const Color.fromARGB(255, 255, 255, 255),
      surfaceTint: const Color.fromARGB(65, 245, 248, 255),
      primary: const Color.fromARGB(255, 162, 116, 255),
      secondary: const Color.fromARGB(255, 70, 44, 123),
      tertiary: const Color.fromARGB(255, 255, 255, 255),
    ),
    textTheme: textTheme,
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      surface: const Color.fromARGB(255, 22, 24, 29),
      surfaceDim: const Color.fromARGB(255, 13, 15, 18),
      surfaceBright: const Color.fromARGB(255, 32, 34, 39),
      surfaceTint: const Color.fromARGB(65, 22, 24, 29),
      primary: const Color.fromARGB(255, 162, 116, 255),
      secondary: const Color.fromARGB(255, 70, 44, 123),
      tertiary: const Color.fromARGB(255, 255, 255, 255),
    ),
    textTheme: textTheme,
  );
}
