import "dart:async";
import "dart:ui";

import "package:cached_network_image/cached_network_image.dart";
import "package:flutter/material.dart";
import "package:flutter_blurhash/flutter_blurhash.dart";
import "package:smooth_page_indicator/smooth_page_indicator.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "trailer_backdrop.dart";

class FeaturedBar extends StatefulWidget {
  final VoidCallback? onRefresh;

  const FeaturedBar({super.key, this.onRefresh});

  @override
  FeaturedBarState createState() => FeaturedBarState();
}

class _HeroMeta extends StatelessWidget {
  final String label;

  const _HeroMeta({required this.label});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withAlpha((0.28 * 255).toInt()),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: Colors.white.withAlpha((0.08 * 255).toInt()),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.white.withAlpha((0.82 * 255).toInt()),
              ),
        ),
      ),
    );
  }
}

class _HeroActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isPrimary;
  final VoidCallback onPressed;

  const _HeroActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final foreground = isPrimary ? Colors.black : Colors.white;
    final borderRadius = BorderRadius.circular(3);

    return ClipRRect(
      borderRadius: borderRadius,
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: isPrimary ? 0 : 12,
          sigmaY: isPrimary ? 0 : 12,
        ),
        child: Material(
          color: isPrimary
              ? Colors.white
              : Colors.black.withAlpha((0.36 * 255).toInt()),
          shape: RoundedRectangleBorder(
            borderRadius: borderRadius,
            side: BorderSide(
              color: isPrimary
                  ? Colors.white
                  : Colors.white.withAlpha((0.24 * 255).toInt()),
            ),
          ),
          child: InkWell(
            onTap: onPressed,
            customBorder: RoundedRectangleBorder(borderRadius: borderRadius),
            hoverColor: Colors.white.withAlpha((0.10 * 255).toInt()),
            focusColor: Colors.white.withAlpha((0.14 * 255).toInt()),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minWidth: isPrimary ? 136 : 126,
                minHeight: 48,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: foreground, size: 19),
                    const SizedBox(width: 9),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: foreground,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PagerArrow extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const _PagerArrow({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          hoverColor: Colors.white.withAlpha((0.10 * 255).toInt()),
          child: SizedBox.square(
            dimension: 26,
            child: Icon(icon, color: Colors.white, size: 18),
          ),
        ),
      ),
    );
  }
}

const animateToPageDuration = Duration(milliseconds: 260);

class FeaturedBarState extends State<FeaturedBar> {
  final JellyfinApiService _apiService = JellyfinApiService();
  final PageController _pageController = PageController();

  List<JellyfinShow> _shows = [];
  final Map<String, String?> _resolvedTrailerUrls = {};
  final Set<String> _pendingTrailerLookups = {};
  Timer? _timer;
  bool _isLoading = true;
  bool _isRefreshing = false;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController.addListener(_handlePageScroll);
    _fetchLatestShows(initialLoad: true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.removeListener(_handlePageScroll);
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _fetchLatestShows({bool initialLoad = true}) async {
    if (initialLoad) {
      setState(() => _isLoading = true);
    } else {
      setState(() => _isRefreshing = true);
    }

    try {
      final token = await getPreference("token");
      if (token == null) {
        if (mounted) {
          setState(() {
            _shows = [];
            _isLoading = false;
            _isRefreshing = false;
          });
        }
        return;
      }

      final newShows = await _apiService.getItems(
        token,
        limit: 25,
        includeItemTypes: "Series,Movie",
        sortBy: "DateCreated",
        sortOrder: "Descending",
      );
      if (!mounted) return;

      setState(() {
        _shows = newShows;
        _resolvedTrailerUrls
          ..clear()
          ..addEntries(
            newShows
                .where((show) => show.firstRemoteTrailerUrl != null)
                .map((show) => MapEntry(show.id, show.firstRemoteTrailerUrl)),
          );
        _pendingTrailerLookups.clear();
        _isLoading = false;
        _isRefreshing = false;
        _currentPage = 0;
      });

      if (_pageController.hasClients) {
        _pageController.animateToPage(
          0,
          duration: animateToPageDuration,
          curve: Curves.easeOutCubic,
        );
      }
      _resolveTrailerForPage(0);
      _resetTimer();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        if (initialLoad) _shows = [];
        _isLoading = false;
        _isRefreshing = false;
      });
    }
  }

  void refreshContent() {
    _fetchLatestShows(initialLoad: false);
  }

  void _handlePageScroll() {
    if (!_pageController.hasClients) return;

    final nextPage = _pageController.page?.round() ?? 0;
    if (nextPage != _currentPage) {
      setState(() => _currentPage = nextPage);
      _resolveTrailerForPage(nextPage);
      _resetTimer();
    }
  }

  void _startTimer() {
    if (_shows.length < 2) return;

    _timer = Timer.periodic(const Duration(seconds: 8), (Timer timer) {
      if (!_pageController.hasClients || _shows.isEmpty) return;

      final nextPage = (_currentPage + 1) % _shows.length;
      _pageController.animateToPage(
        nextPage,
        duration: animateToPageDuration,
        curve: Curves.easeOutCubic,
      );
    });
  }

  void _resetTimer() {
    _timer?.cancel();
    _startTimer();
  }

  void _showPage(int index) {
    if (!_pageController.hasClients || _shows.length < 2) return;

    _pageController.animateToPage(
      index,
      duration: animateToPageDuration,
      curve: Curves.easeOutCubic,
    );
    _resetTimer();
  }

  void _showRelativePage(int delta) {
    if (_shows.length < 2) return;

    _showPage((_currentPage + delta) % _shows.length);
  }

  @override
  Widget build(BuildContext context) {
    final heroHeight = ResponsiveMetrics.heroHeight(context);
    final compact = ResponsiveMetrics.isCompact(context);
    final scheme = Theme.of(context).colorScheme;
    final hasMultipleFeaturedItems = !_isLoading && _shows.length > 1;

    return Padding(
      padding: ResponsiveMetrics.heroPadding(context),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: scheme.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: scheme.outlineVariant.withAlpha((0.70 * 255).toInt()),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withAlpha((0.26 * 255).toInt()),
                blurRadius: 24,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: SizedBox(
            height: heroHeight,
            child: Stack(
              children: [
                Positioned.fill(
                  child: _isLoading ? _buildLoadingState() : _buildPageView(),
                ),
                if (hasMultipleFeaturedItems)
                  Positioned(
                    left: compact ? 0 : null,
                    right: compact ? 0 : 18,
                    bottom: compact ? 14 : 18,
                    child: compact
                        ? Center(child: _buildPageIndicator(Theme.of(context)))
                        : _buildPageIndicator(Theme.of(context)),
                  ),
                if (_isRefreshing) _buildRefreshingOverlay(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    final scheme = Theme.of(context).colorScheme;

    return ColoredBox(
      color: scheme.surfaceContainerLow,
      child: const Center(
        child: SizedBox(
          height: 28,
          width: 28,
          child: CircularProgressIndicator(strokeWidth: 2.4),
        ),
      ),
    );
  }

  Widget _buildPageView() {
    final children = _buildPageViewChildren();

    if (children.isEmpty) {
      return _buildEmptyState();
    }

    return GestureDetector(
      onPanUpdate: (details) {
        if (details.delta.dx < 0) {
          _pageController.nextPage(
            duration: animateToPageDuration,
            curve: Curves.easeOutCubic,
          );
        } else if (details.delta.dx > 0) {
          _pageController.previousPage(
            duration: animateToPageDuration,
            curve: Curves.easeOutCubic,
          );
        }
      },
      child: PageView(
        controller: _pageController,
        children: children,
      ),
    );
  }

  Widget _buildEmptyState() {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return ColoredBox(
      color: scheme.surfaceContainerLow,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                TablerIcons.folder_x,
                color: scheme.onSurfaceVariant,
                size: 34,
              ),
              const SizedBox(height: 12),
              Text("No featured titles", style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                "Your server did not return featured media.",
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildPageViewChildren() {
    return [
      for (var index = 0; index < _shows.length; index++)
        _buildPageViewChild(index),
    ];
  }

  Widget _buildPageViewChild(int index) {
    final show = _shows[index];
    final String blurHash =
        show.imageBlurHashes?["Backdrop"]?.values.first ?? "";

    return _buildPageViewItem(
      show,
      _apiService.backdropImageUrl(show),
      _apiService.logoImageUrl(show),
      blurHash.length >= 6 ? blurHash : null,
      _trailerUrlFor(show, index),
    );
  }

  String? _trailerUrlFor(JellyfinShow show, int index) {
    if (index != _currentPage) return null;
    if (_resolvedTrailerUrls.containsKey(show.id)) {
      return _resolvedTrailerUrls[show.id];
    }

    return show.firstRemoteTrailerUrl;
  }

  Future<void> _resolveTrailerForPage(int index) async {
    if (index < 0 || index >= _shows.length) return;

    final show = _shows[index];
    if (_resolvedTrailerUrls.containsKey(show.id) ||
        _pendingTrailerLookups.contains(show.id)) {
      return;
    }

    final listTrailerUrl = show.firstRemoteTrailerUrl;
    if (listTrailerUrl != null) {
      if (!mounted) return;
      setState(() => _resolvedTrailerUrls[show.id] = listTrailerUrl);
      return;
    }

    _pendingTrailerLookups.add(show.id);

    try {
      final token = await getPreference("token");
      if (token == null) return;

      final detailedShow = await _apiService.getItem(token, show.id);
      if (!mounted) return;

      setState(() {
        _resolvedTrailerUrls[show.id] = detailedShow.firstRemoteTrailerUrl;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _resolvedTrailerUrls[show.id] = null);
    } finally {
      _pendingTrailerLookups.remove(show.id);
    }
  }

  Widget _buildPageViewItem(
    JellyfinShow item,
    String imageUrl,
    String? logoImageUrl,
    String? blurHash,
    String? trailerUrl,
  ) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final theme = Theme.of(context);
        final scheme = theme.colorScheme;
        final compact = constraints.maxWidth < ResponsiveMetrics.compactWidth;
        final contentPadding = compact ? 22.0 : 38.0;
        final verticalPadding = compact ? 24.0 : 34.0;
        final indicatorClearance = compact ? 46.0 : 50.0;
        final desktopTextWidth = constraints.maxWidth * 0.48;
        final maxTextWidth = compact
            ? constraints.maxWidth - (contentPadding * 2)
            : desktopTextWidth < 650
                ? desktopTextWidth
                : 650.0;
        final tightHero = constraints.maxHeight < 430;
        final description = item.overview ?? "No description available.";
        final titleStyle = (compact
                ? theme.textTheme.displaySmall
                : theme.textTheme.displayLarge)
            ?.copyWith(
          color: Colors.white,
          fontSize: compact ? 27 : 40,
          height: compact ? 1.08 : 1.04,
        );
        final descriptionStyle =
            (compact ? theme.textTheme.bodyMedium : theme.textTheme.bodyLarge)
                ?.copyWith(
          color: Colors.white.withAlpha((0.78 * 255).toInt()),
          height: 1.48,
        );

        return Stack(
          fit: StackFit.expand,
          children: [
            TrailerBackdrop(
              trailerUrl: trailerUrl,
              zoom: compact ? 1.18 : 1.28,
              fallback: _buildBackdrop(imageUrl, blurHash),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    scheme.surface.withAlpha((0.96 * 255).toInt()),
                    scheme.surface.withAlpha((0.78 * 255).toInt()),
                    scheme.surface.withAlpha((0.12 * 255).toInt()),
                  ],
                  stops: compact ? const [0, 0.56, 1] : const [0, 0.42, 1],
                  begin:
                      compact ? Alignment.bottomCenter : Alignment.centerLeft,
                  end: compact ? Alignment.topCenter : Alignment.centerRight,
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: ResponsiveMetrics.clamp(
                constraints.maxHeight * 0.34,
                180,
                270,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      scheme.surface.withAlpha((0.70 * 255).toInt()),
                      scheme.surface,
                    ],
                    stops: const [0, 0.62, 1],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  contentPadding,
                  verticalPadding,
                  contentPadding,
                  indicatorClearance,
                ),
                child: Align(
                  alignment:
                      compact ? Alignment.bottomLeft : Alignment.centerLeft,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxWidth: maxTextWidth),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildTitleMark(
                          item: item,
                          logoImageUrl: logoImageUrl,
                          compact: compact,
                          maxWidth: maxTextWidth,
                          titleStyle: titleStyle,
                        ),
                        SizedBox(height: compact ? 12 : 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (item.productionYear != null)
                              _HeroMeta(label: item.productionYear.toString()),
                            _HeroMeta(label: item.type ?? "Series"),
                            if (item.recursiveItemCount != null)
                              _HeroMeta(
                                label: "${item.recursiveItemCount} Episodes",
                              ),
                            if ((item.genres ?? []).isNotEmpty)
                              _HeroMeta(label: item.genres!.first),
                          ],
                        ),
                        SizedBox(height: compact ? 10 : 12),
                        Text(
                          description,
                          maxLines: tightHero ? 2 : 3,
                          overflow: TextOverflow.ellipsis,
                          softWrap: true,
                          style: descriptionStyle,
                        ),
                        SizedBox(height: compact ? 16 : 20),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _HeroActionButton(
                              label: "Play",
                              icon: TablerIcons.player_play_filled,
                              isPrimary: true,
                              onPressed: () {
                                // Playback is not implemented yet.
                              },
                            ),
                            _HeroActionButton(
                              label: "Add to List",
                              icon: TablerIcons.plus,
                              onPressed: () {
                                // List mutation is not implemented yet.
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTitleMark({
    required JellyfinShow item,
    required String? logoImageUrl,
    required bool compact,
    required double maxWidth,
    required TextStyle? titleStyle,
  }) {
    Widget titleText() {
      return Text(
        item.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        softWrap: true,
        textWidthBasis: TextWidthBasis.parent,
        style: titleStyle,
      );
    }

    if (logoImageUrl == null) return titleText();

    final logoHeight = compact ? 82.0 : 118.0;

    return SizedBox(
      width: maxWidth,
      height: logoHeight,
      child: CachedNetworkImage(
        imageUrl: logoImageUrl,
        alignment: Alignment.centerLeft,
        fit: BoxFit.contain,
        placeholder: (context, url) => const SizedBox.shrink(),
        errorWidget: (context, url, error) => Align(
          alignment: Alignment.centerLeft,
          child: titleText(),
        ),
      ),
    );
  }

  Widget _buildBackdrop(String imageUrl, String? blurHash) {
    final scheme = Theme.of(context).colorScheme;

    if (imageUrl.isEmpty) {
      return ColoredBox(color: scheme.surfaceContainerHigh);
    }

    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      placeholder: (context, url) => blurHash != null
          ? BlurHash(hash: blurHash)
          : ColoredBox(color: scheme.surfaceContainerHigh),
      errorWidget: (context, url, error) => ColoredBox(
        color: scheme.surfaceContainerHigh,
        child: Icon(
          TablerIcons.folder_x,
          color: scheme.onSurfaceVariant,
        ),
      ),
    );
  }

  Widget _buildRefreshingOverlay() {
    final scheme = Theme.of(context).colorScheme;

    return Positioned.fill(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.scrim.withAlpha((0.45 * 255).toInt()),
        ),
        child: const Center(
          child: SizedBox(
            height: 28,
            width: 28,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
        ),
      ),
    );
  }

  Widget _buildPageIndicator(ThemeData theme) {
    final scheme = theme.colorScheme;

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.black.withAlpha((0.40 * 255).toInt()),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: Colors.white.withAlpha((0.10 * 255).toInt()),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PagerArrow(
                  icon: TablerIcons.chevron_left,
                  tooltip: "Previous featured title",
                  onPressed: () => _showRelativePage(-1),
                ),
                const SizedBox(width: 6),
                SmoothPageIndicator(
                  controller: _pageController,
                  count: _shows.length,
                  effect: ScrollingDotsEffect(
                    dotColor: Colors.white.withAlpha((0.32 * 255).toInt()),
                    activeDotColor: scheme.primary,
                    dotHeight: 6.5,
                    dotWidth: 6.5,
                    maxVisibleDots: 5,
                    activeDotScale: 1.35,
                    spacing: 7,
                    radius: 999,
                  ),
                  onDotClicked: _showPage,
                ),
                const SizedBox(width: 6),
                _PagerArrow(
                  icon: TablerIcons.chevron_right,
                  tooltip: "Next featured title",
                  onPressed: () => _showRelativePage(1),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
