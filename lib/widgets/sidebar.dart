import 'package:flutter/material.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:solar_icons/solar_icons.dart';
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
    _scaleAnimation = Tween<double>(begin: 1, end: 1.2).animate(
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
                      fontSize: 13,
                      fontFamily: "Nunito",
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(top: 8),
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
                        icon:
                            Icon(SolarIconsBold.sidebarMinimalistic, color: iconColor),
                        iconSize: 35,
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
          Spacer(),
          Padding(
            padding: EdgeInsets.only(top: 8, bottom: 8),
            child: IconButton(
              highlightColor: Colors.transparent,
              hoverColor: Colors.transparent,
              icon: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 45,
                  height: 45,
                  decoration: BoxDecoration(
                    image: DecorationImage(
                      image: NetworkImage(
                          "https://theatre.lococto.me/Users/8eff4cbbd8224764bbc0d24b9ecedec8/Images/Primary"),
                      fit: BoxFit.cover,
                      onError: (_, __) => Icon(SolarIconsBold.user,
                          size: 45,
                          color: Theme.of(context).colorScheme.primary),
                    ),
                  ),
                ),
              ),
              iconSize: 45,
              onPressed: () {
                // TODO: Implement user account view
              },
            ),
          ),
        ],
      ),
    );
  }
}
