import "package:flutter/material.dart";
import "../environment.dart";
import "../widgets/layout.dart";
import "../widgets/featured_bar.dart";
import "../widgets/series/item_banner.dart";
import "../widgets/series/scroller.dart";
import "../routes/observer.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> with RouteAware {
  final _featuredBarKey = GlobalKey<FeaturedBarState>();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    routeObserver.subscribe(this, ModalRoute.of(context)!);
  }

  @override
  void dispose() {
    routeObserver.unsubscribe(this);
    super.dispose();
  }

  @override
  void didPopNext() {
    super.didPopNext();
    _featuredBarKey.currentState?.refreshContent();
  }

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FeaturedBar(key: _featuredBarKey),
            SizedBox(height: 20),
            _buildScroller("最新なアニメ"),
            _buildScroller("最新なアニメ"),
            SizedBox(height: 20),
            _buildServerAddress(),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, '/test'),
              child: Text('Go to Test Screen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScroller(String title) {
    return Scroller(
      title: title,
      items: List.generate(
        15,
        (index) => MouseRegion(
          onEnter: (_) => setState(() {}),
          onExit: (_) => setState(() {}),
          child: Container(
            width: 220,
            margin: EdgeInsets.all(8),
            child: ItemBanner(
              imageUrl:
                  "https://theatre.lococto.me/Items/329e09da86188f42c1f304be2a60946a/Images/Primary?fillHeight=656&fillWidth=446&quality=96&tag=31562f151b0cfa4e0c98801a022928d4",
              title: "コードギアス 反逆のルルーシュ",
              subtitle: "シーズン2 第一話：超合集国決議第壱號 ",
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildServerAddress() {
    return Text(
      "Server Address: ${Environment.webURL}",
      style: TextStyle(
        fontSize: 12,
        fontFamily: "GoNotoKurrent",
        fontWeight: FontWeight.w400,
      ),
    );
  }
}
