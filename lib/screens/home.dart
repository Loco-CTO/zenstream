import "package:flutter/material.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "../routes/observer.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/featured_bar.dart";
import "../widgets/layout.dart";
import "../widgets/media_section.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  HomeScreenState createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> with RouteAware {
  final _featuredBarKey = GlobalKey<FeaturedBarState>();
  final JellyfinApiService _apiService = JellyfinApiService();
  late Future<_HomeData> _homeData;

  @override
  void initState() {
    super.initState();
    _homeData = _loadHomeData();
  }

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
    setState(() {
      _homeData = _loadHomeData();
    });
  }

  Future<_HomeData> _loadHomeData() async {
    final token = await getPreference("token");
    if (token == null) return const _HomeData.empty();

    final results = await Future.wait<List<JellyfinShow>>([
      _apiService.getResumeItems(token, limit: 18),
      _apiService.getNextUpItems(token, limit: 18),
      _apiService.getItems(
        token,
        limit: 18,
        sortBy: "CommunityRating",
        sortOrder: "Descending",
      ),
      _apiService.getItems(
        token,
        limit: 18,
        sortBy: "PremiereDate",
        sortOrder: "Descending",
      ),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: "Movie",
        sortBy: "DateCreated",
        sortOrder: "Descending",
      ),
      _apiService.getFavoriteItems(token, limit: 18),
    ]);

    return _HomeData(
      continueWatching: results[0],
      nextUp: results[1],
      topRated: results[2],
      newReleases: results[3],
      movies: results[4],
      myList: results[5],
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      currentRoute: "/home",
      extendBodyBehindHeader: true,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FeaturedBar(key: _featuredBarKey),
          FutureBuilder<_HomeData>(
            future: _homeData,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return _LoadingRows();
              }

              if (snapshot.hasError) {
                return _ErrorPanel(
                  message: "Could not load your library.",
                  onRetry: () {
                    setState(() {
                      _homeData = _loadHomeData();
                    });
                  },
                );
              }

              final data = snapshot.data ?? const _HomeData.empty();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  MediaSection(
                    title: "Continue Watching",
                    items: data.continueWatching,
                    showProgress: true,
                    collectionArguments: const MediaGridArguments(
                      title: "Continue Watching",
                      description: "Pick up where you left off.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.resume,
                      cardVariant: MediaCardVariant.resume,
                      includeItemTypes: "Episode,Movie",
                      showProgress: true,
                    ),
                  ),
                  MediaSection(
                    title: "Next Up",
                    items: data.nextUp,
                    showProgress: true,
                    collectionArguments: const MediaGridArguments(
                      title: "Next Up",
                      description: "The next episodes in series you started.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.nextUp,
                      cardVariant: MediaCardVariant.resume,
                      includeItemTypes: "Episode",
                      showProgress: true,
                    ),
                  ),
                  MediaSection(
                    title: "Top Rated Anime",
                    items: data.topRated,
                    showRating: true,
                    collectionArguments: const MediaGridArguments(
                      title: "Top Rated Anime",
                      description: "Highest rated series and movies.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.items,
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
                      description: "Newest releases by premiere date.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.items,
                      sortBy: "PremiereDate",
                      sortOrder: "Descending",
                    ),
                  ),
                  MediaSection(
                    title: "Movies",
                    items: data.movies,
                    collectionArguments: const MediaGridArguments(
                      title: "Movies",
                      description: "Feature-length titles in your library.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.latest,
                      includeItemTypes: "Movie",
                    ),
                  ),
                  MediaSection(
                    title: "My List",
                    items: data.myList,
                    collectionArguments: const MediaGridArguments(
                      title: "My List",
                      description: "Favorites saved from your library.",
                      sourceRoute: "/home",
                      kind: MediaCollectionKind.favorites,
                    ),
                  ),
                  SizedBox(
                      height: ResponsiveMetrics.pagePadding(context).bottom),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _HomeData {
  final List<JellyfinShow> continueWatching;
  final List<JellyfinShow> nextUp;
  final List<JellyfinShow> topRated;
  final List<JellyfinShow> newReleases;
  final List<JellyfinShow> movies;
  final List<JellyfinShow> myList;

  const _HomeData({
    required this.continueWatching,
    required this.nextUp,
    required this.topRated,
    required this.newReleases,
    required this.movies,
    required this.myList,
  });

  const _HomeData.empty()
      : continueWatching = const [],
        nextUp = const [],
        topRated = const [],
        newReleases = const [],
        movies = const [],
        myList = const [];
}

class _LoadingRows extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 36, padding.right, 36),
      child: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            color: scheme.primary,
          ),
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorPanel({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 24, padding.right, 42),
      child: DecoratedBox(
        decoration: ResponsiveMetrics.panelDecoration(context),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Row(
            children: [
              Expanded(
                child: Text(message, style: theme.textTheme.bodyLarge),
              ),
              TextButton(onPressed: onRetry, child: const Text("Retry")),
            ],
          ),
        ),
      ),
    );
  }
}
