import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

final closeButtonColors = WindowButtonColors(
  mouseOver: const Color.fromARGB(255, 93, 47, 211),
  mouseDown: const Color.fromARGB(255, 70, 35, 159),
);

class LayoutScaffold extends StatefulWidget {
  final Widget body;

  const LayoutScaffold({required this.body, super.key});

  @override
  LayoutScaffoldState createState() => LayoutScaffoldState();
}

class LayoutScaffoldState extends State<LayoutScaffold> {
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
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(15, 5, 0, 0),
                      child: Text(
                        'ZenStream',
                        style: TextStyle(
                          fontSize: 13.0,
                          fontFamily: 'Nunito',
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
                MinimizeWindowButton(),
                MaximizeWindowButton(),
                CloseWindowButton(colors: closeButtonColors),
              ],
            ),
          ),
          Row(
            children: [
              Column(
                children: [
                  IconButton(
                    icon: Icon(Icons.home),
                    onPressed: () {},
                  ),
                  IconButton(
                    icon: Icon(Icons.list),
                    onPressed: () {},
                  ),
                  IconButton(
                    icon: Icon(Icons.settings),
                    onPressed: () {},
                  ),
                ],
              ),
              Expanded(
                child: widget.body,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
