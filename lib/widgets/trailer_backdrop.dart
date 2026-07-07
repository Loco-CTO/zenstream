import "dart:async";

import "package:flutter/material.dart";
import "package:webview_all/webview_all.dart";

class TrailerBackdrop extends StatefulWidget {
  final String? trailerUrl;
  final Widget fallback;
  final double zoom;

  const TrailerBackdrop({
    required this.fallback,
    this.trailerUrl,
    this.zoom = 1.28,
    super.key,
  });

  @override
  State<TrailerBackdrop> createState() => _TrailerBackdropState();
}

class _TrailerBackdropState extends State<TrailerBackdrop> {
  Timer? _fadeTimer;
  String? _embedUrl;
  bool _showTrailer = false;

  @override
  void initState() {
    super.initState();
    _embedUrl = _buildYoutubeEmbedUrl(widget.trailerUrl);
    _scheduleFadeIn();
  }

  @override
  void didUpdateWidget(covariant TrailerBackdrop oldWidget) {
    super.didUpdateWidget(oldWidget);

    final nextEmbedUrl = _buildYoutubeEmbedUrl(widget.trailerUrl);
    if (nextEmbedUrl == _embedUrl && oldWidget.zoom == widget.zoom) return;

    _fadeTimer?.cancel();
    _embedUrl = nextEmbedUrl;
    _showTrailer = false;
    _scheduleFadeIn();
  }

  @override
  void dispose() {
    _fadeTimer?.cancel();
    super.dispose();
  }

  void _scheduleFadeIn() {
    if (_embedUrl == null) return;

    _fadeTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      setState(() => _showTrailer = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final embedUrl = _embedUrl;
    if (embedUrl == null) return widget.fallback;

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.fallback,
        AnimatedOpacity(
          opacity: _showTrailer ? 1 : 0,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeOutCubic,
          child: ClipRect(
            child: Transform.scale(
              scale: widget.zoom,
              child: IgnorePointer(
                child: Webview(url: embedUrl),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

String? _buildYoutubeEmbedUrl(String? trailerUrl) {
  final videoId = _youtubeVideoId(trailerUrl);
  if (videoId == null) return null;

  return Uri.https("www.youtube-nocookie.com", "/embed/$videoId", {
    "autoplay": "1",
    "mute": "1",
    "controls": "0",
    "loop": "1",
    "playlist": videoId,
    "playsinline": "1",
    "rel": "0",
    "modestbranding": "1",
    "iv_load_policy": "3",
    "disablekb": "1",
    "fs": "0",
  }).toString();
}

String? _youtubeVideoId(String? trailerUrl) {
  final trimmed = trailerUrl?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;

  final directId = _sanitizeYoutubeVideoId(trimmed);
  if (directId != null) return directId;

  final normalizedUrl = trimmed.startsWith("//") ? "https:$trimmed" : trimmed;
  var uri = Uri.tryParse(normalizedUrl);
  if (uri == null) return null;

  if (uri.host.isEmpty) {
    uri = Uri.tryParse("https://$normalizedUrl");
    if (uri == null) return null;
  }

  final host = uri.host.toLowerCase();
  if (_matchesHost(host, "youtu.be")) {
    if (uri.pathSegments.isEmpty) return null;
    return _sanitizeYoutubeVideoId(uri.pathSegments.first);
  }

  if (!_matchesHost(host, "youtube.com") &&
      !_matchesHost(host, "youtube-nocookie.com")) {
    return null;
  }

  final queryVideoId = _sanitizeYoutubeVideoId(uri.queryParameters["v"]);
  if (queryVideoId != null) return queryVideoId;

  final segments = uri.pathSegments.where((segment) {
    return segment.trim().isNotEmpty;
  }).toList(growable: false);
  if (segments.length < 2) return null;

  switch (segments.first) {
    case "embed":
    case "shorts":
    case "v":
      return _sanitizeYoutubeVideoId(segments[1]);
  }

  return null;
}

bool _matchesHost(String host, String domain) {
  return host == domain || host.endsWith(".$domain");
}

String? _sanitizeYoutubeVideoId(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;

  final id = trimmed.split(RegExp(r"[?&#/]")).first;
  if (RegExp(r"^[A-Za-z0-9_-]{11}$").hasMatch(id)) return id;

  return null;
}
