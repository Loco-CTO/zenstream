import 'package:flutter/material.dart';
import 'dart:ui';
import "package:zenstream/jellyfin/api_services.swagger.dart";
import "package:shared_preferences/shared_preferences.dart";
import 'package:flutter_dotenv/flutter_dotenv.dart';

class NavigationMenu extends StatefulWidget {
  const NavigationMenu({super.key});

  @override
  NavigationState createState() => NavigationState();
}

class NavigationState extends State<NavigationMenu> {
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

  Widget _buildLibraryBanner(dynamic library) {
    return Container(
      height: 200,
      margin: EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            Image.network(
              '${dotenv.env["WEB_URL"]}/Items/${library.id}/Images/Primary',
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorBuilder: (context, error, stackTrace) => Container(
                color: Colors.grey[900],
                child: Icon(Icons.broken_image, size: 50),
              ),
            ),
            Text(
              library.name ?? 'Unknown Library',
              style: TextStyle(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Drawer(
          width: 592,
          backgroundColor: Colors.black.withAlpha((0.3 * 255).toInt()),
          child: Container(
            color: Colors.black.withAlpha((0.3 * 255).toInt()),
            child: ListView(
              padding: EdgeInsets.zero,
              children: _libraries
                  .map((library) => _buildLibraryBanner(library))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}
