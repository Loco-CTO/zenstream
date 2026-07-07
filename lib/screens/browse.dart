import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/layout.dart";
import "../widgets/media_section.dart";

class BrowseScreen extends StatefulWidget {
  final String? initialSearch;

  const BrowseScreen({this.initialSearch, super.key});

  @override
  State<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends State<BrowseScreen> {
  final JellyfinApiService _apiService = JellyfinApiService();
  late Future<_BrowseData> _data;
  String _selectedFilter = "Trending";
  String? _initialSearch;

  static const List<String> _filters = [
    "Trending",
    "New",
    "Top Rated",
    "Series",
    "Movies",
    "Fantasy",
    "Sci-Fi",
    "Action",
    "Romance",
  ];

  @override
  void initState() {
    super.initState();
    _initialSearch = widget.initialSearch;
    _data = _loadData(searchTerm: _initialSearch);
  }

  Future<_BrowseData> _loadData({String? searchTerm}) async {
    final token = await getPreference("token");
    if (token == null) return const _BrowseData.empty();

    final genre = _genreForFilter(_selectedFilter);
    final includeItemTypes = _includeItemTypesForFilter(_selectedFilter);

    final results = await Future.wait<List<JellyfinShow>>([
      if (searchTerm != null && searchTerm.trim().isNotEmpty)
        _apiService.searchItems(token, searchTerm.trim(), limit: 18),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: includeItemTypes,
        sortBy: "DateCreated",
        sortOrder: "Descending",
        genres: genre,
      ),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: includeItemTypes,
        sortBy: "CommunityRating",
        sortOrder: "Descending",
        genres: genre,
      ),
      _apiService.getResumeItems(token, limit: 18),
      _apiService.getItems(
        token,
        limit: 18,
        includeItemTypes: "Movie",
        sortBy: "DateCreated",
        sortOrder: "Descending",
      ),
    ]);

    var offset = 0;
    final searchResults = searchTerm != null && searchTerm.trim().isNotEmpty
        ? results[offset++]
        : <JellyfinShow>[];

    return _BrowseData(
      searchResults: searchResults,
      recentlyAdded: results[offset++],
      topRated: results[offset++],
      continueWatching: results[offset++],
      moviesRecentlyAdded: results[offset],
    );
  }

  String? _genreForFilter(String filter) {
    switch (filter) {
      case "Fantasy":
      case "Sci-Fi":
      case "Action":
      case "Romance":
        return filter;
      default:
        return null;
    }
  }

  String _includeItemTypesForFilter(String filter) {
    if (filter == "Movies") return "Movie";
    if (filter == "Series") return "Series";
    return "Series,Movie";
  }

  void _selectFilter(String filter) {
    setState(() {
      _selectedFilter = filter;
      _data = _loadData(searchTerm: _initialSearch);
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      currentRoute: "/browse",
      body: FutureBuilder<_BrowseData>(
        future: _data,
        builder: (context, snapshot) {
          final data = snapshot.data ?? const _BrowseData.empty();
          final includeItemTypes = _includeItemTypesForFilter(_selectedFilter);
          final genre = _genreForFilter(_selectedFilter);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _BrowseHeader(
                selectedFilter: _selectedFilter,
                filters: _filters,
                searchTerm: _initialSearch,
                onSelected: _selectFilter,
              ),
              if (snapshot.connectionState == ConnectionState.waiting)
                _PageLoader()
              else if (snapshot.hasError)
                _PageError(
                  onRetry: () {
                    setState(() {
                      _data = _loadData(searchTerm: _initialSearch);
                    });
                  },
                )
              else ...[
                if (data.searchResults.isNotEmpty)
                  MediaSection(
                    title: "Search Results",
                    items: data.searchResults,
                    collectionArguments: MediaGridArguments(
                      title: "Search Results",
                      description: "Showing matches for \"$_initialSearch\".",
                      sourceRoute: "/browse",
                      kind: MediaCollectionKind.search,
                      searchTerm: _initialSearch,
                    ),
                  ),
                MediaSection(
                  title: "Recently Added",
                  items: data.recentlyAdded,
                  collectionArguments: MediaGridArguments(
                    title: "Recently Added",
                    description: "Newest additions in this browse view.",
                    sourceRoute: "/browse",
                    kind: MediaCollectionKind.latest,
                    includeItemTypes: includeItemTypes,
                    genres: genre,
                  ),
                ),
                MediaSection(
                  title: "Top Rated",
                  items: data.topRated,
                  showRating: true,
                  collectionArguments: MediaGridArguments(
                    title: "Top Rated",
                    description: "Highest rated titles in this browse view.",
                    sourceRoute: "/browse",
                    kind: MediaCollectionKind.items,
                    includeItemTypes: includeItemTypes,
                    sortBy: "CommunityRating",
                    sortOrder: "Descending",
                    genres: genre,
                    showRating: true,
                  ),
                ),
                MediaSection(
                  title: "Continue Watching",
                  items: data.continueWatching,
                  showProgress: true,
                  collectionArguments: const MediaGridArguments(
                    title: "Continue Watching",
                    description: "Pick up where you left off.",
                    sourceRoute: "/browse",
                    kind: MediaCollectionKind.resume,
                    cardVariant: MediaCardVariant.resume,
                    includeItemTypes: "Episode,Movie",
                    showProgress: true,
                  ),
                ),
                MediaSection(
                  title: "Movies Recently Added",
                  items: data.moviesRecentlyAdded,
                  collectionArguments: const MediaGridArguments(
                    title: "Movies Recently Added",
                    description: "Newest movie additions.",
                    sourceRoute: "/browse",
                    kind: MediaCollectionKind.latest,
                    includeItemTypes: "Movie",
                  ),
                ),
              ],
              SizedBox(height: ResponsiveMetrics.pagePadding(context).bottom),
            ],
          );
        },
      ),
    );
  }
}

class _BrowseHeader extends StatelessWidget {
  final String selectedFilter;
  final List<String> filters;
  final String? searchTerm;
  final ValueChanged<String> onSelected;

  const _BrowseHeader({
    required this.selectedFilter,
    required this.filters,
    required this.searchTerm,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
        padding.left,
        ResponsiveMetrics.pageTopPadding(context),
        padding.right,
        18,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            searchTerm == null ? "Browse Anime" : "Search Results",
            style: theme.textTheme.displayMedium,
          ),
          const SizedBox(height: 8),
          Text(
            searchTerm == null
                ? "Discover your next adventure."
                : "Showing matches for \"$searchTerm\".",
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: filters
                      .map(
                        (filter) => _FilterChip(
                          label: filter,
                          selected: filter == selectedFilter,
                          icon: filter == "Trending"
                              ? TablerIcons.trending_up
                              : null,
                          onPressed: () => onSelected(filter),
                        ),
                      )
                      .toList(),
                ),
              ),
              const SizedBox(width: 18),
              OutlinedButton.icon(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  foregroundColor: scheme.onSurface,
                  side: BorderSide(color: scheme.outlineVariant),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                ),
                icon: const Icon(TablerIcons.adjustments_horizontal, size: 18),
                label: const Text("Filter"),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback onPressed;

  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return TextButton.icon(
      onPressed: onPressed,
      icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: selected ? scheme.onPrimary : scheme.onSurface,
        backgroundColor: selected ? scheme.primary : scheme.surfaceContainerLow,
        side: BorderSide(
          color: selected ? scheme.primary : scheme.outlineVariant,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: EdgeInsets.only(
          left: icon == null ? 20 : 14,
          right: 20,
          top: 14,
          bottom: 14,
        ),
      ),
    );
  }
}

class _BrowseData {
  final List<JellyfinShow> searchResults;
  final List<JellyfinShow> recentlyAdded;
  final List<JellyfinShow> topRated;
  final List<JellyfinShow> continueWatching;
  final List<JellyfinShow> moviesRecentlyAdded;

  const _BrowseData({
    required this.searchResults,
    required this.recentlyAdded,
    required this.topRated,
    required this.continueWatching,
    required this.moviesRecentlyAdded,
  });

  const _BrowseData.empty()
      : searchResults = const [],
        recentlyAdded = const [],
        topRated = const [],
        continueWatching = const [],
        moviesRecentlyAdded = const [];
}

class _PageLoader extends StatelessWidget {
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

class _PageError extends StatelessWidget {
  final VoidCallback onRetry;

  const _PageError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 26, padding.right, 40),
      child: DecoratedBox(
        decoration: ResponsiveMetrics.panelDecoration(context),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  "Unable to load media.",
                  style: theme.textTheme.bodyLarge,
                ),
              ),
              TextButton(onPressed: onRetry, child: const Text("Retry")),
            ],
          ),
        ),
      ),
    );
  }
}
