import 'package:flutter/material.dart';
import 'package:zenstream/widgets/layout.dart';
import 'package:zenstream/pages/list.dart';
import 'package:zenstream/widgets/featured_bar.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  _HomePageState createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FeaturedBar(),
            const SizedBox(height: 20),
            const Text('ようだい！'),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const ListPage()),
                );
              },
              child: const Text('Go to List Page'),
            ),
          ],
        ),
      ),
    );
  }
}
