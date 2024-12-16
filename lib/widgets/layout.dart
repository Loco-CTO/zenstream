import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:zenstream/widgets/sidebar.dart';

class BaseLayoutScaffold extends StatefulWidget {
  final Widget body;

  const BaseLayoutScaffold({required this.body, super.key});

  @override
  BaseLayoutScaffoldState createState() => BaseLayoutScaffoldState();
}

class BaseLayoutScaffoldState extends State<BaseLayoutScaffold> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          WindowTitleBarBox(
            child: Row(
              children: [
                Expanded(
                  child: MoveWindow(
                    child: Container(),
                  ),
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
                scrollDirection: Axis.vertical,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight:
                        MediaQuery.of(context).size.height - kToolbarHeight,
                  ),
                  child: widget.body,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class LayoutScaffold extends StatelessWidget {
  final Widget body;

  const LayoutScaffold({required this.body, super.key});

  @override
  Widget build(BuildContext context) {
    return BaseLayoutScaffold(
      body: Row(
        children: [
          const Sidebar(),
          Expanded(
            child: body,
          ),
        ],
      ),
    );
  }
}
