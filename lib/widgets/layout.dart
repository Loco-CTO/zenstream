import "package:flutter/material.dart";
import "package:bitsdojo_window/bitsdojo_window.dart";
import "package:zenstream/widgets/sidebar.dart";
import "dart:async";

class LayoutScaffold extends StatefulWidget {
  final Widget body;

  const LayoutScaffold({required this.body, super.key});

  @override
  LayoutScaffoldState createState() => LayoutScaffoldState();
}

class LayoutScaffoldState extends State<LayoutScaffold> {
  final ScrollController _scrollController = ScrollController();
  bool _isScrolling = false;
  bool _isMouseNearEdge = false;
  Timer? _scrollTimer;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _scrollTimer?.cancel();
    super.dispose();
  }

  void _onScroll() {
    setState(() {
      _isScrolling = true;
    });
    _scrollTimer?.cancel();
    _scrollTimer = Timer(const Duration(seconds: 1), () {
      setState(() {
        _isScrolling = false;
      });
    });
  }

  void _onPointerHover(PointerEvent event) {
    final screenWidth = MediaQuery.of(context).size.width;
    setState(() {
      _isMouseNearEdge = event.position.dx >= screenWidth - 10;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MouseRegion(
        onHover: _onPointerHover,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Sidebar(),
            Expanded(
              child: Column(
                children: [
                  _buildWindowTitleBar(),
                  _buildScrollableContent(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWindowTitleBar() {
    return WindowTitleBarBox(
      child: Row(
        children: [
          Expanded(child: MoveWindow()),
          MinimizeWindowButton(),
          MaximizeWindowButton(),
          CloseWindowButton(),
        ],
      ),
    );
  }

  Widget _buildScrollableContent() {
    return Expanded(
      child: ScrollbarTheme(
        data: ScrollbarThemeData(
          thumbColor: WidgetStateProperty.resolveWith<Color>(
            (Set<WidgetState> states) {
              if (_isScrolling || _isMouseNearEdge) {
                return const Color.fromARGB(255, 195, 163, 255)
                    .withAlpha((0.2 * 255).toInt());
              }
              return Colors.transparent;
            },
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.only(top: 8.0, right: 4.0, bottom: 8.0),
          child: Scrollbar(
            controller: _scrollController,
            thumbVisibility: true,
            thickness: 8.0,
            radius: Radius.circular(4.0),
            child: SingleChildScrollView(
              controller: _scrollController,
              child: widget.body,
            ),
          ),
        ),
      ),
    );
  }
}
