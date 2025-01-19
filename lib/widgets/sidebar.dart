import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import '../jellyfin/api_services.swagger.dart';

class Sidebar extends StatefulWidget {
  const Sidebar({super.key});

  @override
  SidebarState createState() => SidebarState();
}

class SidebarState extends State<Sidebar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rotationAnimation;
  late Animation<double> _scaleAnimation;
  final JellyfinApiService _apiService = JellyfinApiService();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: Duration(milliseconds: 350),
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
          Spacer(),
          Padding(
            padding: EdgeInsets.only(bottom: 2.0),
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
                        highlightColor: Colors.transparent,
                        hoverColor: Colors.transparent,
                        icon: Icon(Icons.widgets_rounded, color: iconColor),
                        iconSize: 35.0,
                        onPressed: () {
                          Scaffold.of(context).openDrawer();
                        },
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(bottom: 20.0),
            child: ClipRRect(
              borderRadius: BorderRadius.all(
                Radius.circular(12.0),
              ),
              child: IconButton(
                highlightColor: Colors.transparent,
                hoverColor: Colors.transparent,
                icon: Image.network(
                    "https://theatre.lococto.me/Items/329e09da86188f42c1f304be2a60946a/Images/Primary?fillHeight=656&fillWidth=446&quality=96&tag=31562f151b0cfa4e0c98801a022928d4"),
                iconSize: 35.0,
                onPressed: () {
                  // TODO: Implement user account view
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
