import 'package:flutter/material.dart';
import 'package:zenstream/widgets/layout.dart';
import 'package:zenstream/widgets/featured_bar.dart';
import 'package:zenstream/widgets/series/scroller.dart';
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
            Scroller(
              title: 'New Releases',
              items: List.generate(
                50,
                (index) => MouseRegion(
                  onEnter: (_) => setState(() {}),
                  onExit: (_) => setState(() {}),
                  child: Container(
                    width: 220,
                    margin: const EdgeInsets.all(8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        'http://localhost:8096/Items/329e09da86188f42c1f304be2a60946a/Images/Primary?fillHeight=656&fillWidth=446&quality=96&tag=31562f151b0cfa4e0c98801a022928d4',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Scroller(
              title: 'New Releases',
              items: List.generate(
                50,
                (index) => MouseRegion(
                  onEnter: (_) => setState(() {}),
                  onExit: (_) => setState(() {}),
                  child: Container(
                    width: 220,
                    margin: const EdgeInsets.all(8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.network(
                        'http://localhost:8096/Items/329e09da86188f42c1f304be2a60946a/Images/Primary?fillHeight=656&fillWidth=446&quality=96&tag=31562f151b0cfa4e0c98801a022928d4',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text('Server Address: ${dotenv.env['WEB_URL'] ?? 'Unknown'}',
                style: TextStyle(
                  fontSize: 12,
                  fontFamily: 'GoNotoKurrent',
                  fontWeight: FontWeight.w400,
                )),
          ],
        ),
      ),
    );
  }
}
