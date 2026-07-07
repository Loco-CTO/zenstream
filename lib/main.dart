import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "utils/theme_style.dart";
import "utils/theme_notifier.dart";
import "package:bitsdojo_window/bitsdojo_window.dart";
import "routes/routes.dart";
import "routes/observer.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeNotifier(),
      child: const ZenStream(),
    ),
  );

  doWhenWindowReady(() {
    final win = appWindow;
    win.minSize = Size(600, 450);
    win.size = Size(1280, 720);
    win.alignment = Alignment.center;
    win.title = "ZenStream";
    win.show();
  });
}

class ZenStream extends StatelessWidget {
  const ZenStream({super.key});

  @override
  Widget build(BuildContext context) {
    final themeNotifier = Provider.of<ThemeNotifier>(context);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: "ZenStream",
      theme: ThemeDataStyle.light,
      darkTheme: ThemeDataStyle.dark,
      themeMode: themeNotifier.themeMode,
      initialRoute: "/",
      navigatorObservers: [routeObserver],
      onGenerateRoute: AppRoutes.generateRoute,
    );
  }
}
