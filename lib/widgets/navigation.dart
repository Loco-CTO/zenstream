import 'package:flutter/material.dart';

import 'dart:ui';
import '../environment.dart';
import "../jellyfin/api_services.swagger.dart";
import 'package:provider/provider.dart';
import '../utils/preferences.dart';
import '../utils/theme_notifier.dart';

import 'package:solar_icons/solar_icons.dart';

class NavigationMenu extends StatefulWidget {
  const NavigationMenu({super.key});

  @override
  NavigationState createState() => NavigationState();
}

class NavigationState extends State<NavigationMenu> {
  final JellyfinApiService _apiService = JellyfinApiService();
  List<dynamic> _libraries = [];
  final Map<String, bool> _hoverStates = {};

  final Map<String, IconData> _collectionTypeIcons = {
    'tvshows': SolarIconsBold.display,
    'movies': SolarIconsBold.videoFramePlayHorizontal,
    'musicvideos': SolarIconsBold.videoLibrary,
    'music': SolarIconsBold.musicNote3,
    'playlists': SolarIconsBold.playlistMinimalistic2,
  };

  @override
  void initState() {
    super.initState();
    _fetchLibraries();
  }

  Future<void> _fetchLibraries() async {
    final token = await getPreference("token");
    if (token == null) return;

    final libraries = await _apiService.getUserLibraries(token);
    setState(() {
      _libraries = libraries;
    });
  }

  Widget _buildLibraryBanner(dynamic library) {
    return InkWell(
      onTap: () {
        // TODO: Navigate to library view
      },
      child: MouseRegion(
        onEnter: (_) => setState(() => _hoverStates[library.id] = true),
        onExit: (_) => setState(() => _hoverStates[library.id] = false),
        child: SizedBox(
          height: 65,
          child: Stack(
            children: [
              AnimatedOpacity(
                opacity: _hoverStates[library.id] == true ? 1.0 : 0,
                duration: Duration(milliseconds: 150),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.network(
                      '${Environment.webURL}/Items/${library.id}/Images/Primary',
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      errorBuilder: (context, error, stackTrace) => Container(
                        color: Colors.grey[900],
                        child: Icon(SolarIconsBold.folderError, size: 50),
                      ),
                    ),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            Theme.of(context)
                                .colorScheme
                                .surfaceDim
                                .withAlpha((0.8 * 255).toInt()),
                            Colors.transparent,
                            Theme.of(context)
                                .colorScheme
                                .surfaceDim
                                .withAlpha((0.8 * 255).toInt()),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(50, 0, 0, 0),
                  child: Icon(
                    _collectionTypeIcons[library.collectionType] ??
                        SolarIconsBold.folder2,
                    color: Theme.of(context).colorScheme.onSurface,
                    size: 22,
                  ),
                ),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(110, 0, 0, 0),
                  child: Text(
                    library.name ?? 'Unknown Library',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontSize: 16,
                      fontWeight: FontWeight.normal,
                    ),
                  ),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.only(
        topRight: Radius.circular(12),
        bottomRight: Radius.circular(12),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Drawer(
          width: 320,
          backgroundColor: Theme.of(context)
              .colorScheme
              .surfaceDim
              .withAlpha((0.3 * 255).toInt()),
          child: Container(
            color: Theme.of(context)
                .colorScheme
                .surfaceDim
                .withAlpha((0.3 * 255).toInt()),
            child: Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      Container(
                        padding: EdgeInsets.fromLTRB(45, 25, 0, 10),
                        child: Text(
                          'ライブラリ',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 22,
                            fontWeight: FontWeight.normal,
                          ),
                        ),
                      ),
                      ..._libraries
                          .map((library) => _buildLibraryBanner(library)),
                    ],
                  ),
                ),
                Divider(
                    height: 1,
                    color: Theme.of(context).colorScheme.surfaceBright),
                Container(
                  color: Theme.of(context).colorScheme.surfaceDim,
                  padding:
                      const EdgeInsets.symmetric(vertical: 8, horizontal: 60),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      IconButton(
                        icon: Icon(
                            Theme.of(context).brightness == Brightness.light
                                ? SolarIconsBold.sun
                                : SolarIconsBold.moonStars,
                            color: Theme.of(context).colorScheme.onSurface),
                        iconSize: 26,
                        onPressed: () =>
                            Provider.of<ThemeNotifier>(context, listen: false)
                                .toggleTheme(),
                      ),
                      IconButton(
                        icon: Icon(SolarIconsBold.settingsMinimalistic,
                            color: Theme.of(context).colorScheme.onSurface),
                        iconSize: 26,
                        onPressed: () {}, // TODO: Implement settings
                      ),
                      IconButton(
                        icon: Icon(SolarIconsBold.logout,
                            color: Theme.of(context).colorScheme.onSurface),
                        iconSize: 26,
                        onPressed: () async {
                          final navigator = Navigator.of(context);
                          final token = await getPreference("token");
                          if (token == null) return;
                          if (mounted) {
                            navigator.pushNamedAndRemoveUntil(
                                '/login', (route) => false);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
