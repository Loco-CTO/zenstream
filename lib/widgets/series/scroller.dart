import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../../utils/responsive.dart";

class Scroller extends StatefulWidget {
  final String? title;
  final List<Widget> items;
  final VoidCallback? onSeeAll;

  const Scroller({
    super.key,
    this.title,
    required this.items,
    this.onSeeAll,
  });

  @override
  ScrollerState createState() => ScrollerState();
}

class ScrollerState extends State<Scroller> {
  final ScrollController _scrollController = ScrollController();
  double _dragStartPosition = 0;
  bool _canScrollLeft = false;
  bool _canScrollRight = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_updateScrollButtons);
    _scheduleScrollButtonsUpdate();
  }

  @override
  void didUpdateWidget(covariant Scroller oldWidget) {
    super.didUpdateWidget(oldWidget);
    _scheduleScrollButtonsUpdate();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updateScrollButtons);
    _scrollController.dispose();
    super.dispose();
  }

  void _scheduleScrollButtonsUpdate() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateScrollButtons());
  }

  void _updateScrollButtons() {
    if (!mounted) return;

    if (!_scrollController.hasClients) {
      if (_canScrollLeft || _canScrollRight) {
        setState(() {
          _canScrollLeft = false;
          _canScrollRight = false;
        });
      }
      return;
    }

    final position = _scrollController.position;
    final canScrollLeft = position.pixels > position.minScrollExtent + 1;
    final canScrollRight = position.pixels < position.maxScrollExtent - 1;

    if (canScrollLeft == _canScrollLeft && canScrollRight == _canScrollRight) {
      return;
    }

    setState(() {
      _canScrollLeft = canScrollLeft;
      _canScrollRight = canScrollRight;
    });
  }

  void _scrollBy(double distance) {
    if (!_scrollController.hasClients) return;

    final target = ResponsiveMetrics.clamp(
      _scrollController.offset + distance,
      0,
      _scrollController.position.maxScrollExtent,
    );

    _scrollController.animateTo(
      target,
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutCubic,
    );
  }

  void _onHorizontalDragStart(DragStartDetails details) {
    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragUpdate(DragUpdateDetails details) {
    if (!_scrollController.hasClients) return;

    final dragDistance = (details.globalPosition.dx - _dragStartPosition) * 0.7;
    final newOffset = ResponsiveMetrics.clamp(
      _scrollController.offset - dragDistance,
      0,
      _scrollController.position.maxScrollExtent,
    );

    _scrollController.jumpTo(newOffset);
    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    _scrollBy(-velocity / 2.8);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final sidePadding = ResponsiveMetrics.scrollerSidePadding(context);
    final scrollAmount = MediaQuery.sizeOf(context).width * 0.72;

    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: sidePadding),
            child: Row(
              children: [
                if (widget.title != null)
                  Expanded(
                    child: Text(
                      widget.title!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.headlineSmall,
                    ),
                  )
                else
                  const Spacer(),
                if (widget.onSeeAll != null)
                  TextButton(
                    onPressed: widget.onSeeAll,
                    style: TextButton.styleFrom(
                      foregroundColor: scheme.onSurfaceVariant,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text("See all"),
                        SizedBox(width: 4),
                        Icon(TablerIcons.chevron_right, size: 15),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Stack(
            alignment: Alignment.centerLeft,
            children: [
              NotificationListener<ScrollMetricsNotification>(
                onNotification: (_) {
                  _scheduleScrollButtonsUpdate();
                  return false;
                },
                child: GestureDetector(
                  onHorizontalDragStart: _onHorizontalDragStart,
                  onHorizontalDragUpdate: _onHorizontalDragUpdate,
                  onHorizontalDragEnd: _onHorizontalDragEnd,
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.symmetric(horizontal: sidePadding - 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: widget.items,
                    ),
                  ),
                ),
              ),
              if (_canScrollLeft)
                Positioned(
                  left: ResponsiveMetrics.clamp(sidePadding - 20, 18, 9999),
                  child: _ScrollerButton(
                    icon: TablerIcons.chevron_left,
                    label: "Scroll left",
                    onPressed: () => _scrollBy(-scrollAmount),
                  ),
                ),
              if (_canScrollRight)
                Positioned(
                  right: ResponsiveMetrics.clamp(sidePadding - 20, 18, 9999),
                  child: _ScrollerButton(
                    icon: TablerIcons.chevron_right,
                    label: "Scroll right",
                    onPressed: () => _scrollBy(scrollAmount),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScrollerButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  const _ScrollerButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: label,
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon),
        color: scheme.onSurface,
        style: IconButton.styleFrom(
          fixedSize: const Size(42, 42),
          backgroundColor: Colors.black.withAlpha((0.55 * 255).toInt()),
          side: BorderSide(
            color: Colors.white.withAlpha((0.08 * 255).toInt()),
          ),
        ),
      ),
    );
  }
}
