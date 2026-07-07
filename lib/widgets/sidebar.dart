import "package:bitsdojo_window/bitsdojo_window.dart";
import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../utils/responsive.dart";
import "brand_mark.dart";

class Sidebar extends StatefulWidget {
  const Sidebar({super.key});

  @override
  SidebarState createState() => SidebarState();
}

class SidebarState extends State<Sidebar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rotationAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 260),
      vsync: this,
    );
    _rotationAnimation = Tween<double>(begin: 0, end: 0.18).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _scaleAnimation = Tween<double>(begin: 1, end: 1.04).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final railWidth = ResponsiveMetrics.railWidth(context);

    return Container(
      width: railWidth,
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(
          right: BorderSide(
            color: scheme.outlineVariant.withAlpha((0.82 * 255).toInt()),
          ),
        ),
      ),
      child: Column(
        children: [
          SizedBox(
            height: 40,
            child: WindowTitleBarBox(
              child: MoveWindow(
                child: Center(
                  child: Text(
                    "ZenStream",
                    maxLines: 1,
                    overflow: TextOverflow.fade,
                    softWrap: false,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const BrandMark(size: 34),
          const SizedBox(height: 24),
          Builder(
            builder: (context) => MouseRegion(
              onEnter: (_) => _controller.forward(),
              onExit: (_) => _controller.reverse(),
              child: AnimatedBuilder(
                animation: _controller,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _scaleAnimation.value,
                    child: Transform.rotate(
                      angle: _rotationAnimation.value,
                      child: _RailAction(
                        icon: TablerIcons.layout_sidebar,
                        label: "Open navigation",
                        selected: true,
                        onPressed: () => Scaffold.of(context).openDrawer(),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 10),
          _RailAction(
            icon: TablerIcons.home,
            label: "Home",
            onPressed: () => Navigator.of(context).pushNamed("/home"),
          ),
          const Spacer(),
          _RailAction(
            icon: TablerIcons.user,
            label: "Account",
            onPressed: () {
              // Account details are not implemented yet.
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _RailAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  const _RailAction({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final background = selected
        ? scheme.primary.withAlpha((0.14 * 255).toInt())
        : Colors.transparent;
    final foreground = selected ? scheme.primary : scheme.onSurfaceVariant;

    return Tooltip(
      message: label,
      waitDuration: const Duration(milliseconds: 450),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: IconButton(
          onPressed: onPressed,
          icon: Icon(icon),
          color: foreground,
          style: IconButton.styleFrom(
            fixedSize: const Size(46, 46),
            backgroundColor: background,
            side: BorderSide(
              color: selected
                  ? scheme.primary
                  : scheme.outlineVariant.withAlpha((0.60 * 255).toInt()),
              width: selected ? 1 : 0,
            ),
          ),
        ),
      ),
    );
  }
}
