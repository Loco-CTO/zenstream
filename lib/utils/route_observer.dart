import 'package:flutter/material.dart';
import 'package:zenstream/utils/precheck.dart';

class PreCheckRouteObserver extends RouteObserver<PageRoute<dynamic>> {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _runPreCheck(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    super.didReplace(newRoute: newRoute, oldRoute: oldRoute);
    _runPreCheck(newRoute);
  }

  void _runPreCheck(Route<dynamic>? route) {
    if (route is PageRoute && route.settings.name != '/login') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(route.navigator!.context).pushReplacement(
          MaterialPageRoute(
              builder: (context) => PreCheck(
                  nextPage: (route as MaterialPageRoute).builder(context))),
        );
      });
    }
  }
}
