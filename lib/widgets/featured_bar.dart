import "dart:ui";

import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:smooth_page_indicator/smooth_page_indicator.dart";
import "dart:async";
import "package:cached_network_image/cached_network_image.dart";
import 'package:flutter_blurhash/flutter_blurhash.dart';

import "../jellyfin/api_services.swagger.dart";

class FeaturedBar extends StatefulWidget {
  const FeaturedBar({super.key});

  @override
  FeaturedBarState createState() => FeaturedBarState();
}

const animateToPageDuration = Duration(milliseconds: 250);

class FeaturedBarState extends State<FeaturedBar> {
  final JellyfinApiService _apiService = JellyfinApiService();
  final PageController _pageController = PageController();

  List<dynamic> _shows = [];
  Timer? _timer;
  bool _isLoading = true;

  Future<void> _fetchLatestShows() async {
    setState(() => _isLoading = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString("token");

      if (token != null) {
        final shows = await _apiService.getLatestShows(token);
        setState(() {
          _shows = shows;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _shows = [];
        _isLoading = false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchLatestShows();
    _startTimer();
    _pageController.addListener(_resetTimer);
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 8), (Timer timer) {
      int nextPage = (_pageController.page?.toInt() ?? 0) + 1;
      if (nextPage >= 5) {
        nextPage = 0;
      }
      _pageController.animateToPage(
        nextPage,
        duration: animateToPageDuration,
        curve: Curves.easeIn,
      );
    });
  }

  void _resetTimer() {
    _timer?.cancel();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.removeListener(_resetTimer);
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(50, 15, 50, 0),
      child: _isLoading
          ? Container(
              height: 760,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceDim,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            )
          : Stack(
              alignment: Alignment.bottomCenter,
              children: [
                _buildPageView(),
                _buildPageIndicator(theme),
              ],
            ),
    );
  }

  Widget _buildPageView() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 760,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width,
            ),
            child: GestureDetector(
              onPanUpdate: (details) {
                if (details.delta.dx < 0) {
                  _pageController.nextPage(
                    duration: animateToPageDuration,
                    curve: Curves.easeIn,
                  );
                } else if (details.delta.dx > 0) {
                  _pageController.previousPage(
                    duration: animateToPageDuration,
                    curve: Curves.easeIn,
                  );
                }
              },
              child: PageView(
                controller: _pageController,
                children: _buildPageViewChildren(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildPageViewChildren() {
    return _shows.map((show) {
      final String? backdropUrl = show.backdropImageTags?.isNotEmpty == true
          ? "https://theatre.lococto.me/Items/${show.id}/Images/Backdrop/0?tag=${show.backdropImageTags!.keys.first}&quality=100"
          : null;

      final String blurHash =
          "${show.imageBlurHashes?['Backdrop']!.values.first}";

      return _buildPageViewItem(
        show.name,
        show.overview ?? "No description available",
        backdropUrl ?? "",
        blurHash,
      );
    }).toList();
  }

  Widget _buildPageViewItem(
      String title, String description, String imageUrl, String? blurHash) {
    return Stack(
      children: [
        CachedNetworkImage(
          imageUrl: imageUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          placeholder: (context, url) => blurHash != null
              ? BlurHash(hash: blurHash)
              : Container(
                  color: Theme.of(context).colorScheme.surfaceDim,
                  child: const Center(
                    child: CircularProgressIndicator(),
                  ),
                ),
          errorWidget: (context, url, error) => Container(
            color: Theme.of(context).colorScheme.surfaceDim,
            child: const Icon(Icons.error),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context)
                    .colorScheme
                    .surface
                    .withAlpha((0.9 * 255).toInt()),
                Theme.of(context)
                    .colorScheme
                    .surface
                    .withAlpha((0.8 * 255).toInt()),
                Colors.transparent,
              ],
              stops: [0, 0.1, 0.75],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
          ),
        ),
        Center(
          child: Align(
            alignment: Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 550),
              child: Padding(
                padding: const EdgeInsets.only(left: 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style:
                          Theme.of(context).textTheme.displayMedium?.copyWith(
                                color: Theme.of(context)
                                    .textTheme
                                    .displayMedium
                                    ?.color,
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                    SizedBox(height: 10),
                    Text(
                      description,
                      maxLines: 10,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                            color:
                                Theme.of(context).textTheme.displaySmall?.color,
                            fontSize: 16,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 50,
          right: 50,
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(50),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withAlpha((0.85 * 255).toInt()),
                    child: IconButton(
                      onPressed: () {
                        // TODO: Handle play button press
                      },
                      icon: const Icon(
                        Icons.play_arrow,
                        color: Colors.white,
                        size: 28,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 18,
                      ),
                    ),
                  ),
                ),
              ),
              SizedBox(width: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(50),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    color: Theme.of(context)
                        .colorScheme
                        .surface
                        .withAlpha((0.5 * 255).toInt()),
                    child: TextButton(
                      onPressed: () {
                        // TODO: Handle info button press
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 36, vertical: 30),
                      ),
                      child: Text(
                        "詳細を確認",
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPageIndicator(ThemeData theme) {
    if (_isLoading || _shows.isEmpty) return const SizedBox.shrink();

    return Positioned(
      bottom: 10,
      child: SmoothPageIndicator(
        controller: _pageController,
        count: _shows.length,
        effect: ScrollingDotsEffect(
            dotColor: theme.colorScheme.onSurface,
            activeDotColor: theme.colorScheme.primary,
            dotHeight: 8,
            dotWidth: 8,
            maxVisibleDots: 7,
            activeDotScale: 1.5,
            spacing: 8,
            radius: 4),
        onDotClicked: (index) => _pageController.animateToPage(
          index,
          duration: animateToPageDuration,
          curve: Curves.easeIn,
        ),
      ),
    );
  }
}
