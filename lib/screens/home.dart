import "package:flutter/material.dart";
import "package:zenstream/widgets/layout.dart";
import "package:zenstream/widgets/featured_bar.dart";
import "package:zenstream/widgets/series/item_banner.dart";
import "package:zenstream/widgets/series/scroller.dart";
import "package:zenstream/jellyfin/api_services.swagger.dart";
import "package:flutter_dotenv/flutter_dotenv.dart";
import "package:shared_preferences/shared_preferences.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  final JellyfinApiService _apiService = JellyfinApiService();
  List<dynamic> _libraries = [];

  @override
  void initState() {
    super.initState();
    _fetchLibraries();
  }

  Future<void> _fetchLibraries() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString("token");

    if (token != null) {
      final libraries = await _apiService.getUserLibraries(token);
      setState(() {
        _libraries = libraries;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FeaturedBar(),
            const SizedBox(height: 20),
            _buildScroller("最新なアニメ"),
            _buildScroller("最新なアニメ"),
            const SizedBox(height: 20),
            _buildServerAddress(),
          ],
        ),
      ),
    );
  }

  Widget _buildScroller(String title) {
    return Scroller(
      title: title,
      items: List.generate(
        50,
        (index) => MouseRegion(
          onEnter: (_) => setState(() {}),
          onExit: (_) => setState(() {}),
          child: Container(
            width: 220,
            margin: const EdgeInsets.all(8),
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
      "Server Address: ${dotenv.env["WEB_URL"] ?? "Unknown"}",
      style: const TextStyle(
        fontSize: 12,
        fontFamily: "GoNotoKurrent",
        fontWeight: FontWeight.w400,
      ),
    );
  }
}
