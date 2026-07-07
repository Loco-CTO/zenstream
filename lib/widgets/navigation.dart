import "dart:math" as math;
import "dart:ui";

import "package:flutter/material.dart";
import "package:provider/provider.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../environment.dart";
import "../jellyfin/api_services.swagger.dart";
import "../utils/preferences.dart";
import "../utils/theme_notifier.dart";
import "brand_mark.dart";

class NavigationMenu extends StatefulWidget {
  const NavigationMenu({super.key});

  @override
  NavigationState createState() => NavigationState();
}

class NavigationState extends State<NavigationMenu> {
  final JellyfinApiService _apiService = JellyfinApiService();
  final Map<String, bool> _hoverStates = {};
  List<dynamic> _libraries = [];

  final Map<String, IconData> _collectionTypeIcons = {
    "tvshows": TablerIcons.device_tv,
    "movies": TablerIcons.movie,
    "musicvideos": TablerIcons.video,
    "music": TablerIcons.music,
    "playlists": TablerIcons.playlist,
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
    if (!mounted) return;

    setState(() {
      _libraries = libraries;
    });
  }

  Widget _buildLibraryBanner(dynamic library) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final libraryId = library.id?.toString() ?? "";
    final isHovered = _hoverStates[libraryId] == true;
    final collectionType = library.collectionType?.toString() ?? "";

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hoverStates[libraryId] = true),
        onExit: (_) => setState(() => _hoverStates[libraryId] = false),
        child: Material(
          color: isHovered
              ? scheme.primary.withAlpha((0.12 * 255).toInt())
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              // Library detail navigation is not implemented yet.
            },
            child: SizedBox(
              height: 58,
              child: Stack(
                children: [
                  AnimatedOpacity(
                    opacity: isHovered && libraryId.isNotEmpty ? 0.22 : 0,
                    duration: const Duration(milliseconds: 160),
                    child: Image.network(
                      "${Environment.webURL}/Items/$libraryId/Images/Primary",
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      errorBuilder: (context, error, stackTrace) =>
                          const SizedBox.shrink(),
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: isHovered
                            ? scheme.primary.withAlpha((0.24 * 255).toInt())
                            : scheme.outlineVariant,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      children: [
                        Icon(
                          _collectionTypeIcons[collectionType] ??
                              TablerIcons.folder,
                          color: isHovered ? scheme.primary : scheme.onSurface,
                          size: 22,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            library.name?.toString() ?? "Unknown Library",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: scheme.onSurface,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final width = math.min(MediaQuery.sizeOf(context).width * 0.86, 340.0);

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        topRight: Radius.circular(18),
        bottomRight: Radius.circular(18),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Drawer(
          width: width,
          backgroundColor: scheme.surface.withAlpha((0.94 * 255).toInt()),
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                right: BorderSide(
                  color: scheme.outlineVariant.withAlpha((0.82 * 255).toInt()),
                ),
              ),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 26, 22, 14),
                  child: Row(
                    children: [
                      const BrandMark(size: 34),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "ZenStream",
                              style: theme.textTheme.titleLarge,
                            ),
                            Text(
                              "Libraries",
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: scheme.outlineVariant),
                Expanded(
                  child: _libraries.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              "No libraries found",
                              textAlign: TextAlign.center,
                              style: theme.textTheme.bodyMedium,
                            ),
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          children: _libraries
                              .map((library) => _buildLibraryBanner(library))
                              .toList(),
                        ),
                ),
                Divider(height: 1, color: scheme.outlineVariant),
                Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: 12, horizontal: 18),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _MenuAction(
                        icon: Theme.of(context).brightness == Brightness.light
                            ? TablerIcons.moon_stars
                            : TablerIcons.sun,
                        label: "Toggle theme",
                        onPressed: () =>
                            Provider.of<ThemeNotifier>(context, listen: false)
                                .toggleTheme(),
                      ),
                      _MenuAction(
                        icon: TablerIcons.settings,
                        label: "Settings",
                        onPressed: () {
                          // Settings are not implemented yet.
                        },
                      ),
                      _MenuAction(
                        icon: TablerIcons.logout,
                        label: "Log out",
                        onPressed: () async {
                          await deletePreference("token");
                          if (!context.mounted) return;
                          Navigator.of(context).pushNamedAndRemoveUntil(
                            "/login",
                            (route) => false,
                          );
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

class _MenuAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  const _MenuAction({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Tooltip(
      message: label,
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon),
        color: scheme.onSurfaceVariant,
        style: IconButton.styleFrom(
          fixedSize: const Size(44, 44),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
    );
  }
}
