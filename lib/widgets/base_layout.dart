import "package:flutter/material.dart";
import "package:bitsdojo_window/bitsdojo_window.dart";

class BaseLayout extends StatelessWidget {
  final Widget child;

  const BaseLayout({required this.child, super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: Column(
        children: [
          _buildWindowTitleBar(context),
          Expanded(child: child),
        ],
      ),
    );
  }

  Widget _buildWindowTitleBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final buttonColors = WindowButtonColors(
      iconNormal: scheme.onSurfaceVariant,
      mouseOver: scheme.surfaceContainerHigh,
      mouseDown: scheme.surfaceContainerHighest,
      iconMouseOver: scheme.onSurface,
      iconMouseDown: scheme.onSurface,
    );
    final closeButtonColors = WindowButtonColors(
      iconNormal: scheme.onSurfaceVariant,
      mouseOver: scheme.error,
      mouseDown: scheme.errorContainer,
      iconMouseOver: scheme.onError,
      iconMouseDown: scheme.onErrorContainer,
    );

    return SizedBox(
      height: 34,
      child: WindowTitleBarBox(
        child: Row(
          children: [
            Expanded(child: MoveWindow(child: const SizedBox.expand())),
            MinimizeWindowButton(colors: buttonColors),
            MaximizeWindowButton(colors: buttonColors),
            CloseWindowButton(colors: closeButtonColors),
          ],
        ),
      ),
    );
  }
}
