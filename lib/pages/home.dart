import 'package:flutter/material.dart';
import 'package:zenstream/widgets/layout.dart';
import 'package:zenstream/widgets/featured_bar.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  HomePageState createState() => HomePageState();
}

class HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FeaturedBar(),
            const SizedBox(height: 20),
            Text('Server URL: ${dotenv.env['WEB_URL'] ?? 'Unknown'}'),
          ],
        ),
      ),
    );
  }
}
