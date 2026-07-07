enum MediaCardVariant { poster, resume }

enum MediaCollectionKind { latest, items, resume, nextUp, favorites, search }

class MediaGridArguments {
  final String title;
  final String? description;
  final String sourceRoute;
  final MediaCollectionKind kind;
  final MediaCardVariant cardVariant;
  final String includeItemTypes;
  final String? sortBy;
  final String sortOrder;
  final String? genres;
  final String? searchTerm;
  final bool showProgress;
  final bool showRating;

  const MediaGridArguments({
    required this.title,
    required this.kind,
    this.description,
    this.sourceRoute = "/home",
    this.cardVariant = MediaCardVariant.poster,
    this.includeItemTypes = "Series,Movie",
    this.sortBy,
    this.sortOrder = "Descending",
    this.genres,
    this.searchTerm,
    this.showProgress = false,
    this.showRating = false,
  });
}
