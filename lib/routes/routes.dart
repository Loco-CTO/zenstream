import "package:flutter/material.dart";
import "../widgets/splash_screen.dart";
import "../screens/home.dart";
import "../screens/login.dart";
import "../utils/precheck.dart";
import "../screens/test_screen.dart";

class AppRoutes {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case "/":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              SplashScreen(),
          transitionDuration: Duration.zero,
        );
      case "/home":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: HomeScreen()),
          transitionDuration: Duration.zero,
        );
      case "/login":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              LoginScreen(),
          transitionDuration: Duration.zero,
        );
      case "/test":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: TestScreen()),
          transitionDuration: Duration.zero,
        );
      default:
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              SplashScreen(),
          transitionDuration: Duration.zero,
        );
    }
  }
}
