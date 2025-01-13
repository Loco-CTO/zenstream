import "package:flutter/material.dart";
import "package:zenstream/widgets/splash_screen.dart";
import "package:zenstream/screens/home.dart";
import "package:zenstream/screens/login.dart";
import "package:zenstream/utils/precheck.dart";

class AppRoutes {
  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case "/":
        return MaterialPageRoute(
          builder: (context) => const SplashScreen(),
        );
      case "/home":
        return MaterialPageRoute(
          builder: (context) => PreCheck(nextPage: const HomeScreen()),
        );
      case "/login":
        return MaterialPageRoute(
          builder: (context) => const LoginScreen(),
        );
      default:
        return MaterialPageRoute(
          builder: (context) => const SplashScreen(),
        );
    }
  }
}
