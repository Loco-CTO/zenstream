import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:provider/provider.dart';
import 'package:zenstream/utils/theme_notifier.dart';

class LayoutScaffold extends StatefulWidget {
  final Widget body;

  const LayoutScaffold({required this.body, super.key});

  @override
  LayoutScaffoldState createState() => LayoutScaffoldState();
}

class LayoutScaffoldState extends State<LayoutScaffold> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sidebarColor = theme.colorScheme.surfaceDim;
    final iconColor = theme.iconTheme.color;

    return Scaffold(
      body: Row(
        children: [
          Container(
            width: 90,
            decoration: BoxDecoration(
              color: sidebarColor,
            ),
            child: Column(
              children: [
                WindowTitleBarBox(
                  child: Row(
                    children: [
                      Expanded(
                        child: MoveWindow(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(15, 8, 0, 0),
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
                        icon: Icon(Icons.home, color: iconColor),
                        iconSize: 30.0,
                        onPressed: () {},
                      ),
                      IconButton(
                        icon: Icon(Icons.list, color: iconColor),
                        iconSize: 30.0,
                        onPressed: () {},
                      ),
                      IconButton(
                        icon: Icon(Icons.settings, color: iconColor),
                        iconSize: 30.0,
                        onPressed: () {},
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 20.0),
                  child: IconButton(
                    icon: Icon(Icons.brightness_6, color: iconColor),
                    iconSize: 25.0,
                    onPressed: () {
                      Provider.of<ThemeNotifier>(context, listen: false)
                          .toggleTheme();
                    },
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
                          child: Container(),
                        ),
                      ),
                      MinimizeWindowButton(),
                      MaximizeWindowButton(),
                      CloseWindowButton(),
                    ],
                  ),
                ),
                widget.body,
              ],
            ),
          ),
        ],
      ),
    );
  }
}
