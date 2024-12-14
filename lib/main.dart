import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:zenstream/pages/home.dart';
import 'package:zenstream/utils/theme_notifier.dart';
import 'package:zenstream/utils/theme_style.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeNotifier(),
      child: MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
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
