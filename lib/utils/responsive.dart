import "package:flutter/material.dart";

class ResponsiveMetrics {
  static const double compactWidth = 720;
  static const double mediumWidth = 1100;
  static const double windowTitleBarHeight = 34;
  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < compactWidth;

  static bool isMedium(BuildContext context) =>
      MediaQuery.sizeOf(context).width < mediumWidth;

  static double clamp(double value, double min, double max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  static double railWidth(BuildContext context) => isCompact(context) ? 68 : 86;

  static double contentSideInset(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    if (isCompact(context)) {
      return clamp(width * 0.04, 14, 18);
    }

    return clamp(width * 0.016, 22, 32);
  }

  static double headerTop(BuildContext context) =>
      windowTitleBarHeight + (isCompact(context) ? 8 : 10);

  static double headerHeight(BuildContext context) =>
      isCompact(context) ? 50 : 48;

  static double pageTopPadding(BuildContext context) =>
      isCompact(context) ? 18 : 24;

  static EdgeInsets pagePadding(BuildContext context) {
    final horizontal = contentSideInset(context);

    return EdgeInsets.fromLTRB(
      horizontal,
      pageTopPadding(context),
      horizontal,
      34,
    );
  }

  static EdgeInsets heroPadding(BuildContext context) {
    final horizontal = contentSideInset(context);
    final top = headerTop(context) + headerHeight(context) + 12;
    return EdgeInsets.fromLTRB(horizontal, top, horizontal, 0);
  }

  static double heroHeight(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return size.height * 0.75;
  }

  static double posterWidth(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    if (width < compactWidth) return clamp(width * 0.36, 128, 164);
    if (width < mediumWidth) return 164;
    return clamp(width * 0.12, 174, 208);
  }

  static double posterHeight(BuildContext context) =>
      posterWidth(context) * 1.48;

  static double resumeWidth(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    if (width < compactWidth) return clamp(width * 0.70, 252, 342);
    if (width < mediumWidth) return 312;
    return clamp(width * 0.22, 318, 392);
  }

  static double resumeHeight(BuildContext context) =>
      resumeWidth(context) * 0.56;

  static double headerInset(BuildContext context) =>
      headerTop(context) +
      headerHeight(context) +
      (isCompact(context) ? 18 : 22);

  static double scrollerSidePadding(BuildContext context) => clamp(
        contentSideInset(context),
        isCompact(context) ? 14 : 22,
        MediaQuery.sizeOf(context).width,
      );

  static double gridGap(BuildContext context) => isCompact(context) ? 2 : 8;

  static BoxDecoration panelDecoration(
    BuildContext context, {
    double radius = 10,
  }) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BoxDecoration(
      color: scheme.surfaceContainerLow.withAlpha(
        ((isDark ? 0.84 : 0.92) * 255).toInt(),
      ),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: scheme.outlineVariant),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withAlpha(((isDark ? 0.28 : 0.08) * 255).toInt()),
          blurRadius: isDark ? 24 : 18,
          offset: const Offset(0, 14),
        ),
      ],
    );
  }
}
