import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

class Sidebar extends StatefulWidget {
  const Sidebar({super.key});

  @override
  SidebarState createState() => SidebarState();
}

class SidebarState extends State<Sidebar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rotationAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 350),
      vsync: this,
    );
    _rotationAnimation = Tween<double>(begin: 0, end: 0.785398).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutQuint),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutQuint),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sidebarColor = theme.colorScheme.surfaceDim;
    final iconColor = theme.colorScheme.primary;

    return Container(
      width: 92,
      decoration: BoxDecoration(color: sidebarColor),
      child: Column(
        children: [
          SizedBox(
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
            child: MouseRegion(
              child: MouseRegion(
                onEnter: (_) {
                  _controller.forward();
                },
                onExit: (_) {
                  _controller.reverse();
                },
                child: AnimatedBuilder(
                  animation: _controller,
                  builder: (context, child) {
                    return Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..rotateZ(_rotationAnimation.value)
                        ..scale(_scaleAnimation.value),
                      child: IconButton(
                        hoverColor: Colors.transparent,
                        icon: Icon(Icons.widgets_rounded, color: iconColor),
                        iconSize: 35.0,
                        onPressed: () {
                          // TODO: Handle Menu
                        },
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
