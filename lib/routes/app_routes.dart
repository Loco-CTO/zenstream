import 'package:flutter/material.dart';
import 'package:zenstream/widgets/splash_screen.dart';
import 'package:zenstream/pages/home.dart';
import 'package:zenstream/pages/login.dart';

class AppRoutes {
  static Map<String, WidgetBuilder> getRoutes() {
    return {
      '/': (context) => const SplashScreen(),
      '/home': (context) => const HomePage(),
      '/login': (context) => const LoginScreen(),
    };
  }
}
