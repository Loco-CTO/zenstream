import "package:flutter/material.dart";

class Scroller extends StatefulWidget {
  final String? title;
  final List<Widget> items;

  const Scroller({super.key, this.title, required this.items});

  @override
  ScrollerState createState() => ScrollerState();
}

class ScrollerState extends State<Scroller> {
  final ScrollController _scrollController = ScrollController();
  double _dragStartPosition = 0.0;

  void _scrollLeft() {
    _scrollController.animateTo(
      _scrollController.offset - 1200,
      duration: Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  void _scrollRight() {
    _scrollController.animateTo(
      _scrollController.offset + 1200,
      duration: Duration(milliseconds: 500),
      curve: Curves.easeInOut,
    );
  }

  void _onHorizontalDragStart(DragStartDetails details) {
    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragUpdate(DragUpdateDetails details) {
    final double dragDistance =
        (details.globalPosition.dx - _dragStartPosition) * 0.5;
    final double newOffset = _scrollController.offset - dragDistance;

    if (newOffset < 0) {
      _scrollController.jumpTo(0);
    } else if (newOffset > _scrollController.position.maxScrollExtent) {
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    } else {
      _scrollController.jumpTo(newOffset);
    }

    _dragStartPosition = details.globalPosition.dx;
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    final double velocity = details.primaryVelocity ?? 0.0;
    _scrollController.animateTo(
      _scrollController.offset - velocity / 2,
      duration: Duration(milliseconds: 500),
      curve: Curves.decelerate,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 0.0, vertical: 5.0),
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 65.0),
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
                      icon: Icon(Icons.arrow_back),
                      onPressed: _scrollLeft,
                    ),
                    IconButton(
                      icon: Icon(Icons.arrow_forward),
                      onPressed: _scrollRight,
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 50.0),
            child: GestureDetector(
              onHorizontalDragStart: _onHorizontalDragStart,
              onHorizontalDragUpdate: _onHorizontalDragUpdate,
              onHorizontalDragEnd: _onHorizontalDragEnd,
              child: SingleChildScrollView(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
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
