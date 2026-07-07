import "package:flutter/material.dart";

class ThemeDataStyle {
  static const Color _violet = Color(0xFF7C3AED);
  static const Color _violetSoft = Color(0xFFA78BFA);
  static const Color _mint = Color(0xFF2DD4BF);
  static const String _fontFamily = "GoNotoKurrent";

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: _violet,
      brightness: Brightness.light,
    ).copyWith(
      primary: const Color(0xFF6D5EF6),
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFFE8E4FF),
      onPrimaryContainer: const Color(0xFF21144B),
      secondary: const Color(0xFF0F766E),
      onSecondary: Colors.white,
      surface: const Color(0xFFF5F6FA),
      surfaceDim: const Color(0xFFE4E7EF),
      surfaceBright: const Color(0xFFFFFFFF),
      surfaceContainerLowest: const Color(0xFFFFFFFF),
      surfaceContainerLow: const Color(0xFFF0F2F7),
      surfaceContainer: const Color(0xFFE9ECF3),
      surfaceContainerHigh: const Color(0xFFE2E6EF),
      surfaceContainerHighest: const Color(0xFFD9DEEA),
      onSurface: const Color(0xFF12141B),
      onSurfaceVariant: const Color(0xFF5B6272),
      outline: const Color(0xFF8A92A3),
      outlineVariant: const Color(0xFFD1D6E1),
      error: const Color(0xFFB42318),
    );

    return _buildTheme(scheme);
  }

  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(
      seedColor: _violet,
      brightness: Brightness.dark,
    ).copyWith(
      primary: _violetSoft,
      onPrimary: Colors.white,
      primaryContainer: const Color(0xFF26144E),
      onPrimaryContainer: const Color(0xFFF1ECFF),
      secondary: _mint,
      onSecondary: const Color(0xFF06201D),
      surface: const Color(0xFF030305),
      surfaceDim: const Color(0xFF000000),
      surfaceBright: const Color(0xFF17151D),
      surfaceContainerLowest: const Color(0xFF000000),
      surfaceContainerLow: const Color(0xFF08080B),
      surfaceContainer: const Color(0xFF0D0C12),
      surfaceContainerHigh: const Color(0xFF15131B),
      surfaceContainerHighest: const Color(0xFF1F1C27),
      onSurface: const Color(0xFFF8F7FB),
      onSurfaceVariant: const Color(0xFFA9A5B4),
      outline: const Color(0xFF4E495A),
      outlineVariant: const Color(0xFF292632),
      error: const Color(0xFFFFB4AB),
    );

    return _buildTheme(scheme);
  }

  static ThemeData _buildTheme(ColorScheme scheme) {
    final isDark = scheme.brightness == Brightness.dark;

    return ThemeData(
      useMaterial3: true,
      brightness: scheme.brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      canvasColor: scheme.surface,
      cardColor: scheme.surfaceContainerLow,
      dividerColor: scheme.outlineVariant,
      disabledColor: scheme.onSurface.withAlpha((0.38 * 255).toInt()),
      hoverColor: scheme.primary.withAlpha((0.08 * 255).toInt()),
      focusColor: scheme.primary.withAlpha((0.14 * 255).toInt()),
      highlightColor: scheme.primary.withAlpha((0.10 * 255).toInt()),
      splashColor: scheme.primary.withAlpha((0.12 * 255).toInt()),
      visualDensity: VisualDensity.compact,
      fontFamily: _fontFamily,
      textTheme: _textTheme(scheme),
      iconTheme: IconThemeData(color: scheme.onSurface, size: 22),
      drawerTheme: DrawerThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(12)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          disabledBackgroundColor:
              scheme.onSurface.withAlpha((0.12 * 255).toInt()),
          disabledForegroundColor:
              scheme.onSurface.withAlpha((0.38 * 255).toInt()),
          minimumSize: const Size(118, 44),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.onSurface,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: scheme.onSurfaceVariant,
          hoverColor: scheme.primary.withAlpha((0.10 * 255).toInt()),
          focusColor: scheme.primary.withAlpha((0.16 * 255).toInt()),
          highlightColor: scheme.primary.withAlpha((0.14 * 255).toInt()),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHigh,
        hintStyle: TextStyle(
          color: scheme.onSurfaceVariant,
          fontSize: 14,
          letterSpacing: 0,
        ),
        labelStyle: TextStyle(
          color: scheme.onSurfaceVariant,
          fontSize: 14,
          letterSpacing: 0,
        ),
        floatingLabelStyle: TextStyle(
          color: scheme.primary,
          fontSize: 13,
          letterSpacing: 0,
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: _inputBorder(scheme.outlineVariant),
        enabledBorder: _inputBorder(scheme.outlineVariant),
        focusedBorder: _inputBorder(scheme.primary),
        errorBorder: _inputBorder(scheme.error),
        focusedErrorBorder: _inputBorder(scheme.error),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        elevation: isDark ? 0 : 10,
        shadowColor: Colors.black.withAlpha((0.18 * 255).toInt()),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: scheme.outlineVariant),
        ),
        textStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 14,
          letterSpacing: 0,
        ),
      ),
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStatePropertyAll(
          scheme.onSurfaceVariant.withAlpha((0.32 * 255).toInt()),
        ),
        trackColor: const WidgetStatePropertyAll(Colors.transparent),
        radius: const Radius.circular(999),
        thickness: const WidgetStatePropertyAll(6),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        circularTrackColor: scheme.outlineVariant,
      ),
    );
  }

  static OutlineInputBorder _inputBorder(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: color),
    );
  }

  static TextTheme _textTheme(ColorScheme scheme) {
    final primary = scheme.onSurface;
    final muted = scheme.onSurfaceVariant;

    return TextTheme(
      displayLarge: TextStyle(
        color: primary,
        fontSize: 42,
        fontWeight: FontWeight.w700,
        height: 1.05,
        letterSpacing: 0,
      ),
      displayMedium: TextStyle(
        color: primary,
        fontSize: 32,
        fontWeight: FontWeight.w700,
        height: 1.08,
        letterSpacing: 0,
      ),
      displaySmall: TextStyle(
        color: primary,
        fontSize: 26,
        fontWeight: FontWeight.w700,
        height: 1.12,
        letterSpacing: 0,
      ),
      headlineMedium: TextStyle(
        color: primary,
        fontSize: 21,
        fontWeight: FontWeight.w700,
        height: 1.2,
        letterSpacing: 0,
      ),
      headlineSmall: TextStyle(
        color: primary,
        fontSize: 17,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: 0,
      ),
      titleLarge: TextStyle(
        color: primary,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: 0,
      ),
      titleMedium: TextStyle(
        color: primary,
        fontSize: 14,
        fontWeight: FontWeight.w700,
        height: 1.3,
        letterSpacing: 0,
      ),
      titleSmall: TextStyle(
        color: muted,
        fontSize: 13,
        fontWeight: FontWeight.w700,
        height: 1.35,
        letterSpacing: 0,
      ),
      bodyLarge: TextStyle(
        color: primary,
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.45,
        letterSpacing: 0,
      ),
      bodyMedium: TextStyle(
        color: muted,
        fontSize: 13,
        fontWeight: FontWeight.w400,
        height: 1.45,
        letterSpacing: 0,
      ),
      bodySmall: TextStyle(
        color: muted,
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 1.35,
        letterSpacing: 0,
      ),
      labelLarge: TextStyle(
        color: primary,
        fontSize: 14,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: 0,
      ),
      labelMedium: TextStyle(
        color: muted,
        fontSize: 12,
        fontWeight: FontWeight.w700,
        height: 1.25,
        letterSpacing: 0,
      ),
      labelSmall: TextStyle(
        color: muted,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        height: 1.2,
        letterSpacing: 0,
      ),
    );
  }
}
