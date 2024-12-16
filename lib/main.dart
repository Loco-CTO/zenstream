import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:zenstream/utils/theme_notifier.dart';
import 'package:zenstream/utils/theme_style.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:zenstream/widgets/splash_screen.dart';

Future<void> main() async {
  await dotenv.load(fileName: ".env");

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
      title: 'ZenStream',
      theme: ThemeDataStyle.light,
      darkTheme: ThemeDataStyle.dark,
      themeMode: themeNotifier.themeMode,
      home: SplashScreen(),
    );
  }
}
