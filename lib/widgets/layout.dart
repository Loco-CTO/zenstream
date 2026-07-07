import "dart:async";
import "dart:ui";

import "package:bitsdojo_window/bitsdojo_window.dart";
import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../utils/responsive.dart";
import "brand_mark.dart";

class LayoutScaffold extends StatefulWidget {
  final Widget body;
  final String currentRoute;
  final ScrollController? scrollController;
  final bool extendBodyBehindHeader;

  const LayoutScaffold({
    required this.body,
    this.currentRoute = "/home",
    this.scrollController,
    this.extendBodyBehindHeader = false,
    super.key,
  });

  @override
  LayoutScaffoldState createState() => LayoutScaffoldState();
}

class LayoutScaffoldState extends State<LayoutScaffold> {
  late final ScrollController _ownedScrollController;
  final TextEditingController _searchController = TextEditingController();
  Timer? _scrollTimer;
  bool _isScrolling = false;
  bool _isMouseNearEdge = false;

  ScrollController get _scrollController =>
      widget.scrollController ?? _ownedScrollController;

  @override
  void initState() {
    super.initState();
    _ownedScrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }

  @override
  void didUpdateWidget(covariant LayoutScaffold oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldController = oldWidget.scrollController ?? _ownedScrollController;
    final newController = widget.scrollController ?? _ownedScrollController;

    if (oldController != newController) {
      oldController.removeListener(_onScroll);
      newController.addListener(_onScroll);
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _ownedScrollController.dispose();
    _searchController.dispose();
    _scrollTimer?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (!_isScrolling) setState(() => _isScrolling = true);
    _scrollTimer?.cancel();
    _scrollTimer = Timer(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _isScrolling = false);
    });
  }

  void _onPointerHover(PointerEvent event) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isNearEdge = event.position.dx >= screenWidth - 10;
    if (isNearEdge != _isMouseNearEdge) {
      setState(() => _isMouseNearEdge = isNearEdge);
    }
  }

  void _goTo(String route) {
    if (widget.currentRoute == route) return;
    Navigator.of(context).pushNamed(route);
  }

  void _submitSearch(String value) {
    final query = value.trim();
    if (query.isEmpty) return;
    Navigator.of(context).pushNamed("/browse", arguments: query);
  }

  void _openSearch() {
    _searchController.selection = TextSelection.collapsed(
      offset: _searchController.text.length,
    );

    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withAlpha((0.60 * 255).toInt()),
      builder: (dialogContext) {
        return _SearchDialog(
          controller: _searchController,
          onSubmitted: (value) {
            Navigator.of(dialogContext).pop();
            _submitSearch(value);
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      drawer: _CompactDrawer(
        currentRoute: widget.currentRoute,
        onRouteSelected: _goTo,
        onSearchPressed: _openSearch,
      ),
      backgroundColor: scheme.surface,
      body: MouseRegion(
        onHover: _onPointerHover,
        child: Stack(
          children: [
            Positioned.fill(child: _buildScrollableContent(context)),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _buildWindowTitleBar(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWindowTitleBar(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final buttonColors = WindowButtonColors(
      normal: Colors.transparent,
      iconNormal: scheme.onSurfaceVariant,
      mouseOver: scheme.surfaceContainerHigh,
      mouseDown: scheme.surfaceContainerHighest,
      iconMouseOver: scheme.onSurface,
      iconMouseDown: scheme.onSurface,
    );
    final closeButtonColors = WindowButtonColors(
      normal: Colors.transparent,
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
            Expanded(child: MoveWindow()),
            MinimizeWindowButton(colors: buttonColors),
            MaximizeWindowButton(colors: buttonColors),
            CloseWindowButton(colors: closeButtonColors),
          ],
        ),
      ),
    );
  }

  Widget _buildScrollableContent(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final topInset = widget.extendBodyBehindHeader
        ? 0.0
        : ResponsiveMetrics.headerInset(context);

    return ScrollbarTheme(
      data: ScrollbarThemeData(
        thumbColor: WidgetStateProperty.resolveWith<Color>(
          (states) {
            if (_isScrolling || _isMouseNearEdge) {
              return scheme.onSurfaceVariant.withAlpha((0.36 * 255).toInt());
            }
            return Colors.transparent;
          },
        ),
        thickness: const WidgetStatePropertyAll(6),
        radius: const Radius.circular(999),
      ),
      child: Scrollbar(
        controller: _scrollController,
        thumbVisibility: true,
        child: SingleChildScrollView(
          controller: _scrollController,
          child: Stack(
            children: [
              Padding(
                padding: EdgeInsets.only(top: topInset),
                child: widget.body,
              ),
              Positioned(
                top: ResponsiveMetrics.headerTop(context),
                left: 0,
                right: 0,
                child: Builder(
                  builder: (headerContext) => _FloatingHeader(
                    currentRoute: widget.currentRoute,
                    onRouteSelected: _goTo,
                    onSearchPressed: _openSearch,
                    onMenuPressed: () =>
                        Scaffold.of(headerContext).openDrawer(),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FloatingHeader extends StatelessWidget {
  final String currentRoute;
  final ValueChanged<String> onRouteSelected;
  final VoidCallback onSearchPressed;
  final VoidCallback onMenuPressed;

  const _FloatingHeader({
    required this.currentRoute,
    required this.onRouteSelected,
    required this.onSearchPressed,
    required this.onMenuPressed,
  });

  static const _items = [
    _HeaderItem("Home", "/home", TablerIcons.home),
    _HeaderItem("Browse", "/browse", TablerIcons.folder),
    _HeaderItem("My List", "/my-list", TablerIcons.heart),
    _HeaderItem("Movies", "/movies", TablerIcons.movie),
  ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < ResponsiveMetrics.compactWidth;
    final header = compact
        ? Row(
            children: [
              const _BrandLogo(),
              const Spacer(),
              _HeaderIconButton(
                tooltip: "Open menu",
                icon: TablerIcons.menu_2,
                onPressed: onMenuPressed,
              ),
              _HeaderIconButton(
                tooltip: "Search",
                icon: TablerIcons.search,
                onPressed: onSearchPressed,
              ),
              const _ProfileButton(),
            ],
          )
        : Row(
            children: [
              const _BrandLogo(),
              const SizedBox(width: 26),
              for (final item in _items)
                _FloatingNavButton(
                  label: item.label,
                  selected: currentRoute == item.route,
                  onPressed: () => onRouteSelected(item.route),
                ),
              const Spacer(),
              _HeaderSearchButton(onPressed: onSearchPressed),
              const SizedBox(width: 8),
              _HeaderIconButton(
                tooltip: "Notifications",
                icon: TablerIcons.bell,
                onPressed: () {},
              ),
              const _ProfileButton(),
            ],
          );

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 12 : ResponsiveMetrics.contentSideInset(context),
      ),
      child: SizedBox(
        height: ResponsiveMetrics.headerHeight(context),
        child: header,
      ),
    );
  }
}

class _HeaderItem {
  final String label;
  final String route;
  final IconData icon;

  const _HeaderItem(this.label, this.route, this.icon);
}

class _BrandLogo extends StatelessWidget {
  const _BrandLogo();

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: "ZenStream",
      child: Padding(
        padding: const EdgeInsets.only(left: 2, right: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandMark(size: 32),
          ],
        ),
      ),
    );
  }
}

class _FloatingNavButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  const _FloatingNavButton({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final foreground = selected ? scheme.primary : scheme.onSurface;

    return Tooltip(
      message: label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 1),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(10),
            hoverColor: scheme.primary.withAlpha((0.10 * 255).toInt()),
            focusColor: scheme.primary.withAlpha((0.14 * 255).toInt()),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 64, minHeight: 36),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: foreground,
                              fontWeight:
                                  selected ? FontWeight.w900 : FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (selected)
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 0,
                      child: Container(
                        height: 2.5,
                        decoration: BoxDecoration(
                          color: scheme.primary,
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: [
                            BoxShadow(
                              color: scheme.primary
                                  .withAlpha((0.45 * 255).toInt()),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderSearchButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _HeaderSearchButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Tooltip(
      message: "Search",
      child: Material(
        color: scheme.surfaceContainerHigh.withAlpha((0.62 * 255).toInt()),
        borderRadius: BorderRadius.circular(7),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(7),
          hoverColor: scheme.primary.withAlpha((0.08 * 255).toInt()),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minWidth: 270,
              maxWidth: 320,
              minHeight: 34,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  Icon(
                    TablerIcons.search,
                    color: scheme.onSurfaceVariant,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Search anime, movies...",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  const _HeaderIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: tooltip,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 1),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(999),
            hoverColor: scheme.primary.withAlpha((0.10 * 255).toInt()),
            focusColor: scheme.primary.withAlpha((0.14 * 255).toInt()),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                minWidth: 34,
                minHeight: 34,
              ),
              child: Padding(
                padding: EdgeInsets.zero,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: scheme.onSurface, size: 18),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileButton extends StatelessWidget {
  const _ProfileButton();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: "Profile",
      child: Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Material(
          color: scheme.surfaceContainerHigh.withAlpha((0.78 * 255).toInt()),
          shape: const CircleBorder(),
          child: InkWell(
            onTap: () {},
            customBorder: const CircleBorder(),
            hoverColor: scheme.primary.withAlpha((0.18 * 255).toInt()),
            child: SizedBox.square(
              dimension: 34,
              child: Icon(
                TablerIcons.user,
                color: scheme.onSurface,
                size: 19,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchDialog extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;

  const _SearchDialog({
    required this.controller,
    required this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 22),
      backgroundColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: scheme.surface.withAlpha((0.92 * 255).toInt()),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: scheme.outlineVariant),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha((0.34 * 255).toInt()),
                    blurRadius: 34,
                    offset: const Offset(0, 18),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: TextField(
                  controller: controller,
                  autofocus: true,
                  onSubmitted: onSubmitted,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: scheme.onSurface,
                  ),
                  decoration: InputDecoration(
                    hintText: "Search anime, movies, and more",
                    prefixIcon: const Icon(TablerIcons.search, size: 20),
                    suffixIcon: IconButton(
                      tooltip: "Search",
                      onPressed: () => onSubmitted(controller.text),
                      icon: const Icon(TablerIcons.arrow_right, size: 20),
                    ),
                    filled: true,
                    fillColor: scheme.surfaceContainerHigh,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CompactDrawer extends StatelessWidget {
  final String currentRoute;
  final ValueChanged<String> onRouteSelected;
  final VoidCallback onSearchPressed;

  const _CompactDrawer({
    required this.currentRoute,
    required this.onRouteSelected,
    required this.onSearchPressed,
  });

  static const _items = [
    _HeaderItem("Home", "/home", TablerIcons.home),
    _HeaderItem("Browse", "/browse", TablerIcons.folder),
    _HeaderItem("My List", "/my-list", TablerIcons.heart),
    _HeaderItem("Movies", "/movies", TablerIcons.movie),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Drawer(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(18),
          bottomRight: Radius.circular(18),
        ),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: scheme.surface.withAlpha((0.94 * 255).toInt()),
              border: Border(
                right: BorderSide(color: scheme.outlineVariant),
              ),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: _BrandLogo(),
                    ),
                    const SizedBox(height: 22),
                    for (final item in _items)
                      _DrawerRouteButton(
                        item: item,
                        selected: currentRoute == item.route,
                        onPressed: () {
                          Navigator.of(context).pop();
                          onRouteSelected(item.route);
                        },
                      ),
                    const SizedBox(height: 12),
                    _DrawerRouteButton(
                      item: const _HeaderItem(
                        "Search",
                        "/browse",
                        TablerIcons.search,
                      ),
                      selected: false,
                      onPressed: () {
                        Navigator.of(context).pop();
                        onSearchPressed();
                      },
                    ),
                    const Spacer(),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerRouteButton extends StatelessWidget {
  final _HeaderItem item;
  final bool selected;
  final VoidCallback onPressed;

  const _DrawerRouteButton({
    required this.item,
    required this.selected,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected
            ? scheme.primary.withAlpha((0.16 * 255).toInt())
            : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(10),
          hoverColor: scheme.primary.withAlpha((0.10 * 255).toInt()),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  color: selected ? scheme.primary : scheme.onSurface,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: selected ? scheme.primary : scheme.onSurface,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
