import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "utils/theme_notifier.dart";
import "utils/theme_style.dart";
import "package:bitsdojo_window/bitsdojo_window.dart";
import "package:flutter_dotenv/flutter_dotenv.dart";
import "routes/routes.dart";
import "dart:io";
import "package:flutter/foundation.dart" show kIsWeb;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb) {
    if (File(".env").existsSync()) {
      await dotenv.load(fileName: ".env");
    }
  }

  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeNotifier(),
      child: ZenStream(),
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
      onGenerateRoute: AppRoutes.generateRoute,
    );
  }
}
