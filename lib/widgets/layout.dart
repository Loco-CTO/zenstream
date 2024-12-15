import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

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
      body: Row(
        children: [
          Container(
            width: 90,
            decoration: BoxDecoration(
              color: Colors.grey[850], // Sidebar background color
            ),
            child: Column(
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
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: Icon(Icons.home, color: Colors.white),
                        onPressed: () {},
                      ),
                      IconButton(
                        icon: Icon(Icons.list, color: Colors.white),
                        onPressed: () {},
                      ),
                      IconButton(
                        icon: Icon(Icons.settings, color: Colors.white),
                        onPressed: () {},
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Column(
              children: [
                WindowTitleBarBox(
                  child: Row(
                    children: [
                      Expanded(
                        child: MoveWindow(
                          child:
                              Container(), // Empty container to make the area draggable
                        ),
                      ),
                      MinimizeWindowButton(),
                      MaximizeWindowButton(),
                      CloseWindowButton(),
                    ],
                  ),
                ),
                widget.body, // Ensure this starts at the top
              ],
            ),
          ),
        ],
      ),
    );
  }
}
