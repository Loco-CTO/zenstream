import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:zenstream/widgets/sidebar.dart';

class LayoutScaffold extends StatefulWidget {
  final Widget body;

  const LayoutScaffold({required this.body, super.key});

  @override
  LayoutScaffoldState createState() => LayoutScaffoldState();
}

class LayoutScaffoldState extends State<LayoutScaffold> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Sidebar(),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                WindowTitleBarBox(
                  child: Row(
                    children: [
                      Expanded(
                        child: MoveWindow(),
                      ),
                      MinimizeWindowButton(),
                      MaximizeWindowButton(),
                      CloseWindowButton(),
                    ],
                  ),
                ),
                Expanded(
                  child: Scrollbar(
                    thumbVisibility: true,
                    controller: _scrollController,
                    child: SingleChildScrollView(
                      controller: _scrollController,
                      child: widget.body,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
