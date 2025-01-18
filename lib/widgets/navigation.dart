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
  Map<String, bool> _hoverStates = {};

  final Map<String, IconData> _collectionTypeIcons = {
    'tvshows': Icons.tv,
    'movies': Icons.movie,
    'musicvideos': Icons.music_video,
    'music': Icons.music_note,
    'playlists': Icons.playlist_play,
  };

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

    for (final library in _libraries) {
      print(library.collectionType);
    }
  }

  Widget _buildLibraryBanner(dynamic library) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hoverStates[library.id] = true),
      onExit: (_) => setState(() => _hoverStates[library.id] = false),
      child: SizedBox(
        height: 60,
        child: Stack(
          children: [
            AnimatedOpacity(
              opacity: _hoverStates[library.id] == true ? 1.0 : 0.0,
              duration: Duration(milliseconds: 200),
              child: Image.network(
                '${dotenv.env["WEB_URL"]}/Items/${library.id}/Images/Primary',
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                errorBuilder: (context, error, stackTrace) => Container(
                  color: Colors.grey[900],
                  child: Icon(Icons.broken_image, size: 50),
                ),
              ),
            ),
            AnimatedOpacity(
              opacity: _hoverStates[library.id] == true ? 1.0 : 0.0,
              duration: Duration(milliseconds: 200),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.black.withOpacity(0.8),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 0, 0),
                child: Icon(
                  _collectionTypeIcons[library.collectionType] ?? Icons.folder,
                  color: Theme.of(context).colorScheme.onSurface,
                  size: 20,
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.fromLTRB(60, 0, 0, 0),
                child: Text(
                  library.name ?? 'Unknown Library',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            )
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
          width: 350,
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
