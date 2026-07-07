import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/layout.dart";
import "../widgets/series/item_banner.dart";
import "../widgets/series/resume_banner.dart";

class MediaGridScreen extends StatefulWidget {
  final MediaGridArguments arguments;

  const MediaGridScreen({
    required this.arguments,
    super.key,
  });

  @override
  State<MediaGridScreen> createState() => _MediaGridScreenState();
}

class _MediaGridScreenState extends State<MediaGridScreen> {
  static const int _pageSize = 30;

  final JellyfinApiService _apiService = JellyfinApiService();
  final ScrollController _scrollController = ScrollController();

  final List<JellyfinShow> _items = [];
  bool _isLoadingInitial = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
    _loadNextPage(initial: true);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    if (!_scrollController.hasClients ||
        _isLoadingMore ||
        !_hasMore ||
        _errorMessage != null) {
      return;
    }

    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 720) {
      _loadNextPage();
    }
  }

  Future<void> _loadNextPage({bool initial = false}) async {
    if ((!initial && _isLoadingMore) || (!_hasMore && !initial)) return;

    setState(() {
      if (initial) {
        _isLoadingInitial = true;
        _errorMessage = null;
        _items.clear();
        _hasMore = true;
      } else {
        _isLoadingMore = true;
        _errorMessage = null;
      }
    });

    try {
      final token = await getPreference("token");
      if (token == null) {
        if (!mounted) return;
        setState(() {
          _isLoadingInitial = false;
          _isLoadingMore = false;
          _hasMore = false;
        });
        return;
      }

      final nextItems = await _fetchPage(token, _items.length, _pageSize);
      if (!mounted) return;

      setState(() {
        _items.addAll(nextItems);
        _hasMore = nextItems.length == _pageSize;
        _isLoadingInitial = false;
        _isLoadingMore = false;
        _errorMessage = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = "Unable to load media.";
        _isLoadingInitial = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<List<JellyfinShow>> _fetchPage(
    String token,
    int startIndex,
    int limit,
  ) {
    final args = widget.arguments;

    switch (args.kind) {
      case MediaCollectionKind.resume:
        return _apiService.getResumeItems(
          token,
          limit: limit,
          startIndex: startIndex,
          includeItemTypes: args.includeItemTypes,
        );
      case MediaCollectionKind.nextUp:
        return _apiService.getNextUpItems(
          token,
          limit: limit,
          startIndex: startIndex,
        );
      case MediaCollectionKind.favorites:
        return _apiService.getFavoriteItems(
          token,
          limit: limit,
          startIndex: startIndex,
          includeItemTypes: args.includeItemTypes,
        );
      case MediaCollectionKind.search:
        final query = args.searchTerm?.trim() ?? "";
        if (query.isEmpty) return Future.value([]);
        return _apiService.searchItems(
          token,
          query,
          limit: limit,
          startIndex: startIndex,
          includeItemTypes: args.includeItemTypes,
        );
      case MediaCollectionKind.latest:
        return _apiService.getItems(
          token,
          limit: limit,
          startIndex: startIndex,
          includeItemTypes: args.includeItemTypes,
          sortBy: args.sortBy ?? "DateCreated",
          sortOrder: args.sortOrder,
          genres: args.genres,
        );
      case MediaCollectionKind.items:
        return _apiService.getItems(
          token,
          limit: limit,
          startIndex: startIndex,
          includeItemTypes: args.includeItemTypes,
          sortBy: args.sortBy,
          sortOrder: args.sortOrder,
          genres: args.genres,
          searchTerm: args.searchTerm,
        );
    }
  }

  void _retry() => _loadNextPage(initial: _items.isEmpty);

  @override
  Widget build(BuildContext context) {
    return LayoutScaffold(
      currentRoute: widget.arguments.sourceRoute,
      scrollController: _scrollController,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CollectionHeader(arguments: widget.arguments),
          if (_isLoadingInitial)
            const _GridLoader()
          else if (_items.isEmpty && _errorMessage != null)
            _GridError(message: _errorMessage!, onRetry: _retry)
          else if (_items.isEmpty)
            const _GridEmpty()
          else ...[
            _MediaWrap(
              items: _items,
              apiService: _apiService,
              arguments: widget.arguments,
            ),
            if (_isLoadingMore) const _MoreLoader(),
            if (!_hasMore && _errorMessage == null) const _EndMarker(),
            if (_errorMessage != null)
              _InlineGridError(message: _errorMessage!, onRetry: _retry),
          ],
          SizedBox(height: ResponsiveMetrics.pagePadding(context).bottom),
        ],
      ),
    );
  }
}

class _CollectionHeader extends StatelessWidget {
  final MediaGridArguments arguments;

  const _CollectionHeader({required this.arguments});

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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(arguments.title, style: theme.textTheme.displaySmall),
                if (arguments.description != null) ...[
                  const SizedBox(height: 7),
                  Text(
                    arguments.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 16),
          Tooltip(
            message: "Back",
            child: IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(TablerIcons.arrow_left),
              color: scheme.onSurface,
              style: IconButton.styleFrom(
                fixedSize: const Size(42, 42),
                backgroundColor: scheme.surfaceContainerLow,
                side: BorderSide(color: scheme.outlineVariant),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaWrap extends StatelessWidget {
  final List<JellyfinShow> items;
  final JellyfinApiService apiService;
  final MediaGridArguments arguments;

  const _MediaWrap({
    required this.items,
    required this.apiService,
    required this.arguments,
  });

  @override
  Widget build(BuildContext context) {
    final sidePadding = ResponsiveMetrics.scrollerSidePadding(context);
    final isResume = arguments.cardVariant == MediaCardVariant.resume;
    final width = isResume
        ? ResponsiveMetrics.resumeWidth(context)
        : ResponsiveMetrics.posterWidth(context);
    final height = isResume
        ? ResponsiveMetrics.resumeHeight(context)
        : ResponsiveMetrics.posterHeight(context);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: sidePadding - 7),
      child: Wrap(
        spacing: ResponsiveMetrics.gridGap(context),
        runSpacing: isResume ? 18 : 22,
        children: items.map((item) {
          final progress =
              arguments.showProgress && item.playedPercentage != null
                  ? item.playedPercentage! / 100
                  : null;

          if (isResume) {
            return ResumeBanner(
              imageUrl: apiService.landscapeImageUrl(
                item,
                width: 640,
                height: 360,
              ),
              title: item.name,
              subtitle: _subtitle(item),
              progress: progress,
              width: width,
              height: height,
            );
          }

          return ItemBanner(
            imageUrl: apiService.primaryImageUrl(
              item,
              width: 500,
              height: 750,
            ),
            title: item.name,
            subtitle: _subtitle(item),
            rating: arguments.showRating ? item.communityRating : null,
            width: width,
            height: height,
          );
        }).toList(),
      ),
    );
  }

  String _subtitle(JellyfinShow item) {
    if (arguments.showProgress) return item.episodeLabel;
    return item.itemCountLabel;
  }
}

class _GridLoader extends StatelessWidget {
  const _GridLoader();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 58),
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

class _MoreLoader extends StatelessWidget {
  const _MoreLoader();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2.2),
        ),
      ),
    );
  }
}

class _GridEmpty extends StatelessWidget {
  const _GridEmpty();

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
              Icon(TablerIcons.folder_x, color: scheme.primary, size: 34),
              const SizedBox(height: 12),
              Text("No media found", style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                "This collection does not have any items to show.",
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

class _GridError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _GridError({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 28, padding.right, 42),
      child: _ErrorPanel(message: message, onRetry: onRetry),
    );
  }
}

class _InlineGridError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _InlineGridError({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final padding = ResponsiveMetrics.pagePadding(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(padding.left, 24, padding.right, 8),
      child: _ErrorPanel(message: message, onRetry: onRetry),
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

    return DecoratedBox(
      decoration: ResponsiveMetrics.panelDecoration(context),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            const Icon(TablerIcons.alert_triangle, size: 20),
            const SizedBox(width: 12),
            Expanded(child: Text(message, style: theme.textTheme.bodyMedium)),
            const SizedBox(width: 12),
            TextButton(onPressed: onRetry, child: const Text("Retry")),
          ],
        ),
      ),
    );
  }
}

class _EndMarker extends StatelessWidget {
  const _EndMarker();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 8),
      child: Center(
        child: Text(
          "End of collection",
          style: theme.textTheme.labelMedium,
        ),
      ),
    );
  }
}
