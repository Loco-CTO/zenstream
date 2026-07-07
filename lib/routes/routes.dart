import "package:flutter/material.dart";
import "../widgets/splash_screen.dart";
import "../screens/browse.dart";
import "../screens/home.dart";
import "../screens/login.dart";
import "../screens/media_grid.dart";
import "../screens/movies.dart";
import "../screens/my_list.dart";
import "../utils/precheck.dart";
import "../models/media_collection.dart";
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
      case "/browse":
        final searchTerm =
            settings.arguments is String ? settings.arguments as String : null;
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: BrowseScreen(initialSearch: searchTerm)),
          transitionDuration: Duration.zero,
        );
      case "/movies":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: MoviesScreen()),
          transitionDuration: Duration.zero,
        );
      case "/my-list":
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: MyListScreen()),
          transitionDuration: Duration.zero,
        );
      case "/media-grid":
        final arguments = settings.arguments is MediaGridArguments
            ? settings.arguments as MediaGridArguments
            : const MediaGridArguments(
                title: "Media",
                kind: MediaCollectionKind.items,
              );
        return PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              PreCheck(nextPage: MediaGridScreen(arguments: arguments)),
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
