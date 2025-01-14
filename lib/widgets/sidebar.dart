import "package:flutter/material.dart";
import 'package:bitsdojo_window/bitsdojo_window.dart';

class Sidebar extends StatelessWidget {
  const Sidebar({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sidebarColor = theme.colorScheme.surfaceDim;

    return Container(
      width: 92,
      decoration: BoxDecoration(color: sidebarColor),
      child: Column(
        children: [
          Container(
            height: 40,
            child: WindowTitleBarBox(
              child: MoveWindow(
                child: Center(
                  child: Text(
                    "ZenStream",
                    style: TextStyle(
                      fontSize: 13.0,
                      fontFamily: "Nunito",
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.only(bottom: 20.0),
            child: IconButton(
              icon: Icon(Icons.widgets_rounded,
                  color: Theme.of(context)
                      .colorScheme
                      .outline
                      .withAlpha((0.5 * 255).toInt())),
              iconSize: 40.0,
              onPressed: () {
                // TODO: Handle Menu
              },
            ),
          ),
        ],
      ),
    );
  }
}
