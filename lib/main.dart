import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:zenstream/pages/home.dart';
import 'package:zenstream/utils/theme_notifier.dart';
import 'package:zenstream/utils/theme_style.dart';
import 'package:bitsdojo_window/bitsdojo_window.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeNotifier(),
      child: MyApp(),
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

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeNotifier = Provider.of<ThemeNotifier>(context);

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ZenStream',
      theme: ThemeDataStyle.light,
      darkTheme: ThemeDataStyle.dark,
      themeMode: themeNotifier.themeMode,
      home: HomePage(),
    );
  }
}
