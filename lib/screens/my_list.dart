import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/layout.dart";
import "../widgets/media_section.dart";

class MyListScreen extends StatefulWidget {
  const MyListScreen({super.key});

  @override
  State<MyListScreen> createState() => _MyListScreenState();
}

class _MyListScreenState extends State<MyListScreen> {
  final JellyfinApiService _apiService = JellyfinApiService();
  late Future<List<JellyfinShow>> _items = _loadItems();

  Future<List<JellyfinShow>> _loadItems() async {
    final token = await getPreference("token");
    if (token == null) return [];
    return _apiService.getFavoriteItems(token, limit: 30);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = ResponsiveMetrics.pagePadding(context);

    return LayoutScaffold(
      currentRoute: "/my-list",
      body: FutureBuilder<List<JellyfinShow>>(
        future: _items,
        builder: (context, snapshot) {
          final items = snapshot.data ?? [];

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(
                  padding.left,
                  ResponsiveMetrics.pageTopPadding(context),
                  padding.right,
                  18,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("My List", style: theme.textTheme.displayMedium),
                    const SizedBox(height: 8),
                    Text(
                      "Favorites saved from your library.",
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(
                    child: SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    ),
                  ),
                )
              else if (snapshot.hasError)
                _ErrorState(
                  onRetry: () {
                    setState(() {
                      _items = _loadItems();
                    });
                  },
                )
              else if (items.isEmpty)
                _EmptyList()
              else
                MediaSection(
                  title: "Favorites",
                  items: items,
                  collectionArguments: const MediaGridArguments(
                    title: "Favorites",
                    description: "Favorites saved from your library.",
                    sourceRoute: "/my-list",
                    kind: MediaCollectionKind.favorites,
                  ),
                ),
              SizedBox(height: padding.bottom),
            ],
          );
        },
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 34, padding.right, 42),
      child: DecoratedBox(
        decoration: ResponsiveMetrics.panelDecoration(context),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 34),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                TablerIcons.heart,
                color: scheme.primary,
                size: 34,
              ),
              const SizedBox(height: 12),
              Text("No favorites yet", style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                "Mark items as favorites in Jellyfin and they will appear here.",
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 26, padding.right, 40),
      child: DecoratedBox(
        decoration: ResponsiveMetrics.panelDecoration(context),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              const Expanded(child: Text("Unable to load favorites.")),
              TextButton(onPressed: onRetry, child: const Text("Retry")),
            ],
          ),
        ),
      ),
    );
  }
}
