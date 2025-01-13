import "package:flutter/material.dart";
import "package:zenstream/widgets/splash_screen.dart";
import "package:zenstream/screens/home.dart";
import "package:zenstream/screens/login.dart";
import "package:zenstream/utils/precheck.dart";

class AppRoutes {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case "/":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const SplashScreen(),
          transitionDuration: Duration.zero,
        );
      case "/home":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: const HomeScreen()),
          transitionDuration: Duration.zero,
        );
      case "/login":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const LoginScreen(),
          transitionDuration: Duration.zero,
        );
      default:
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const SplashScreen(),
          transitionDuration: Duration.zero,
        );
    }
  }
}
