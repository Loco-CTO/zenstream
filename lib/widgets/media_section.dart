import "package:flutter/material.dart";

import "../jellyfin/api_enums.swagger.dart";
import "../jellyfin/api_services.swagger.dart";
import "../models/media_collection.dart";
import "series/item_banner.dart";
import "series/resume_banner.dart";
import "series/scroller.dart";

class MediaSection extends StatelessWidget {
  final String title;
  final List<JellyfinShow> items;
  final bool showProgress;
  final bool showRating;
  final MediaCardVariant? cardVariant;
  final MediaGridArguments? collectionArguments;

  const MediaSection({
    required this.title,
    required this.items,
    this.showProgress = false,
    this.showRating = false,
    this.cardVariant,
    this.collectionArguments,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    final api = JellyfinApiService();
    final variant = cardVariant ??
        (showProgress ? MediaCardVariant.resume : MediaCardVariant.poster);

    return Scroller(
      title: title,
      items: items.map((item) => _buildCard(api, item, variant)).toList(),
      onSeeAll: collectionArguments == null
          ? null
          : () => Navigator.of(context).pushNamed(
                "/media-grid",
                arguments: collectionArguments,
              ),
    );
  }

  Widget _buildCard(
    JellyfinApiService api,
    JellyfinShow item,
    MediaCardVariant variant,
  ) {
    final progress = showProgress && item.playedPercentage != null
        ? item.playedPercentage! / 100
        : null;

    if (variant == MediaCardVariant.resume) {
      return ResumeBanner(
        imageUrl: api.landscapeImageUrl(item, width: 520, height: 292),
        title: item.name,
        subtitle: _subtitle(item),
        progress: progress,
      );
    }

    return ItemBanner(
      imageUrl: api.primaryImageUrl(item, width: 420, height: 630),
      title: item.name,
      subtitle: _subtitle(item),
      rating: showRating ? item.communityRating : null,
    );
  }

  String _subtitle(JellyfinShow item) {
    if (showProgress) return item.episodeLabel;
    if (showRating && item.communityRating != null) return item.itemCountLabel;
    return item.itemCountLabel;
  }
}
