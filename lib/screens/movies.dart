import "package:flutter/material.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/layout.dart";
import "../widgets/media_section.dart";

class MoviesScreen extends StatefulWidget {
  const MoviesScreen({super.key});

  @override
  State<MoviesScreen> createState() => _MoviesScreenState();
}

class _MoviesScreenState extends State<MoviesScreen> {
  final JellyfinApiService _apiService = JellyfinApiService();
  late Future<_MoviesData> _data = _loadData();

  Future<_MoviesData> _loadData() async {
    final token = await getPreference("token");
    if (token == null) return const _MoviesData.empty();

    final results = await Future.wait<List<JellyfinShow>>([
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: "Movie",
        sortBy: "DateCreated",
        sortOrder: "Descending",
      ),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: "Movie",
        sortBy: "CommunityRating",
        sortOrder: "Descending",
      ),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: "Movie",
        sortBy: "PremiereDate",
        sortOrder: "Descending",
      ),
    ]);

    return _MoviesData(
      recentlyAdded: results[0],
      topRated: results[1],
      newReleases: results[2],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = ResponsiveMetrics.pagePadding(context);

    return LayoutScaffold(
      currentRoute: "/movies",
      body: FutureBuilder<_MoviesData>(
        future: _data,
        builder: (context, snapshot) {
          final data = snapshot.data ?? const _MoviesData.empty();

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
                    Text("Movies", style: theme.textTheme.displayMedium),
                    const SizedBox(height: 8),
                    Text(
                      "Feature-length stories from your library.",
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting)
                const _Loader()
              else if (snapshot.hasError)
                _ErrorState(
                  onRetry: () {
                    setState(() {
                      _data = _loadData();
                    });
                  },
                )
              else ...[
                MediaSection(
                  title: "Movies Recently Added",
                  items: data.recentlyAdded,
                  collectionArguments: const MediaGridArguments(
                    title: "Movies Recently Added",
                    description: "Newest movie additions.",
                    sourceRoute: "/movies",
                    kind: MediaCollectionKind.latest,
                    includeItemTypes: "Movie",
                  ),
                ),
                MediaSection(
                  title: "Top Rated Movies",
                  items: data.topRated,
                  showRating: true,
                  collectionArguments: const MediaGridArguments(
                    title: "Top Rated Movies",
                    description: "Highest rated movies in your library.",
                    sourceRoute: "/movies",
                    kind: MediaCollectionKind.items,
                    includeItemTypes: "Movie",
                    sortBy: "CommunityRating",
                    sortOrder: "Descending",
                    showRating: true,
                  ),
                ),
                MediaSection(
                  title: "New Releases",
                  items: data.newReleases,
                  collectionArguments: const MediaGridArguments(
                    title: "New Releases",
                    description: "Newest movies by premiere date.",
                    sourceRoute: "/movies",
                    kind: MediaCollectionKind.items,
                    includeItemTypes: "Movie",
                    sortBy: "PremiereDate",
                    sortOrder: "Descending",
                  ),
                ),
              ],
              SizedBox(height: padding.bottom),
            ],
          );
        },
      ),
    );
  }
}

class _MoviesData {
  final List<JellyfinShow> recentlyAdded;
  final List<JellyfinShow> topRated;
  final List<JellyfinShow> newReleases;

  const _MoviesData({
    required this.recentlyAdded,
    required this.topRated,
    required this.newReleases,
  });

  const _MoviesData.empty()
      : recentlyAdded = const [],
        topRated = const [],
        newReleases = const [];
}

class _Loader extends StatelessWidget {
  const _Loader();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2.4),
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
              const Expanded(child: Text("Unable to load movies.")),
              TextButton(onPressed: onRetry, child: const Text("Retry")),
            ],
          ),
        ),
      ),
    );
  }
}
