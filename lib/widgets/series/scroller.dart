import 'package:flutter/material.dart';

class Scroller extends StatefulWidget {
  final String? title;
  final List<Widget> items;

  const Scroller({Key? key, this.title, required this.items}) : super(key: key);

  @override
  _ScrollerState createState() => _ScrollerState();
}

class _ScrollerState extends State<Scroller> {
  final ScrollController _scrollController = ScrollController();
  double _dragStartPosition = 0.0;

  void _scrollLeft() {
    _scrollController.animateTo(
      _scrollController.offset - 200,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  void _scrollRight() {
    _scrollController.animateTo(
      _scrollController.offset + 200,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  void _onHorizontalDragStart(DragStartDetails details) {
    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragUpdate(DragUpdateDetails details) {
    double dragDistance =
        (details.globalPosition.dx - _dragStartPosition) * 0.5;
    _scrollController.jumpTo(_scrollController.offset - dragDistance);
    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    double velocity = details.primaryVelocity ?? 0.0;
    _scrollController.animateTo(
      _scrollController.offset - velocity / 2,
      duration: const Duration(milliseconds: 500),
      curve: Curves.decelerate,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 0.0, vertical: 5.0),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 65.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (widget.title != null)
                  Text(
                    widget.title!,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back),
                      onPressed: _scrollLeft,
                    ),
                    IconButton(
                      icon: const Icon(Icons.arrow_forward),
                      onPressed: _scrollRight,
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 50.0),
            child: GestureDetector(
              onHorizontalDragStart: _onHorizontalDragStart,
              onHorizontalDragUpdate: _onHorizontalDragUpdate,
              onHorizontalDragEnd: _onHorizontalDragEnd,
              child: SingleChildScrollView(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: ClipRect(
                  child: Row(
                    children: widget.items,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
