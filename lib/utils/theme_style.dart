import 'package:flutter/material.dart';

class ThemeDataStyle {
  static final TextStyle baseTextStyle = TextStyle(
    fontFamily: 'GoNotoKurrent',
    fontWeight: FontWeight.w600,
    letterSpacing: 0.15,
  );

  static final TextTheme lightTextTheme = TextTheme(
    displayLarge: baseTextStyle.copyWith(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.5,
      color: Colors.black,
    ),
    displayMedium: baseTextStyle.copyWith(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
      color: Colors.black,
    ),
    displaySmall: baseTextStyle.copyWith(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
      color: const Color.fromARGB(255, 52, 52, 52),
    ),
    headlineLarge: baseTextStyle.copyWith(
      fontSize: 36,
      color: Colors.black,
    ),
    headlineMedium: baseTextStyle.copyWith(
      fontSize: 24,
      color: Colors.black,
    ),
    headlineSmall: baseTextStyle.copyWith(
      fontSize: 20,
      color: Colors.black,
    ),
  );

  static final TextTheme darkTextTheme = TextTheme(
    displayLarge: baseTextStyle.copyWith(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.5,
      color: Colors.white,
    ),
    displayMedium: baseTextStyle.copyWith(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
      color: Colors.white,
    ),
    displaySmall: baseTextStyle.copyWith(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.25,
      color: const Color.fromARGB(255, 184, 184, 184),
    ),
    headlineLarge: baseTextStyle.copyWith(
      fontSize: 36,
      color: Colors.white,
    ),
    headlineMedium: baseTextStyle.copyWith(
      fontSize: 24,
      color: Colors.white,
    ),
    headlineSmall: baseTextStyle.copyWith(
      fontSize: 20,
      color: Colors.white,
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
      onSurface: const Color.fromARGB(255, 0, 0, 0),
    ),
    textTheme: lightTextTheme,
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
      onSurface: const Color.fromARGB(255, 255, 255, 255),
    ),
    textTheme: darkTextTheme,
  );
}
