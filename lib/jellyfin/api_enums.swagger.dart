class JellyfinLibrary {
  final String id;
  final String name;
  final String? collectionType;
  final Map<String, String> imageTags;
  final String etag;

  JellyfinLibrary({
    required this.id,
    required this.name,
    this.collectionType,
    required this.imageTags,
    required this.etag,
  });

  factory JellyfinLibrary.fromJson(Map<String, dynamic> json) {
    return JellyfinLibrary(
      id: json["Id"] as String,
      name: json["Name"] as String,
      collectionType: json["CollectionType"] as String?,
      imageTags: Map<String, String>.from(json["ImageTags"] as Map),
      etag: json["Etag"] as String,
    );
  }

  Map<String, dynamic> toJson() => {
        "Id": id,
        "Name": name,
        "CollectionType": collectionType,
        "ImageTags": imageTags,
        "Etag": etag,
      };
}

class JellyfinRemoteTrailer {
  final String? name;
  final String url;

  JellyfinRemoteTrailer({
    required this.url,
    this.name,
  });

  static JellyfinRemoteTrailer? tryParse(Map<String, dynamic> json) {
    final url = _readString(json['Url']) ??
        _readString(json['url']) ??
        _readString(json['ProviderUrl']);
    if (url == null) return null;

    return JellyfinRemoteTrailer(
      url: url,
      name: _readString(json['Name']) ?? _readString(json['name']),
    );
  }

  static String? _readString(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return value;
  }
}

class JellyfinShow {
  final String id;
  final String name;
  final String? type;
  final String? overview;
  final Map<String, dynamic>? imageTags;
  final Map<String, dynamic>? backdropImageTags;
  final Map<String, dynamic>? imageBlurHashes;
  final Map<String, dynamic>? userData;
  final String? parentId;
  final String? seriesId;
  final String? seriesName;
  final String? seasonName;
  final String? parentThumbItemId;
  final String? parentThumbImageTag;
  final String? seriesThumbImageTag;
  final List<String>? tags;
  final List<String>? genres;
  final List<JellyfinRemoteTrailer> remoteTrailers;
  final int? productionYear;
  final int? recursiveItemCount;
  final int? indexNumber;
  final int? parentIndexNumber;
  final double? communityRating;

  JellyfinShow({
    required this.id,
    required this.name,
    this.type,
    this.overview,
    this.imageTags,
    this.backdropImageTags,
    this.imageBlurHashes,
    this.userData,
    this.parentId,
    this.seriesId,
    this.seriesName,
    this.seasonName,
    this.parentThumbItemId,
    this.parentThumbImageTag,
    this.seriesThumbImageTag,
    this.tags,
    this.genres,
    this.remoteTrailers = const [],
    this.productionYear,
    this.recursiveItemCount,
    this.indexNumber,
    this.parentIndexNumber,
    this.communityRating,
  });

  factory JellyfinShow.fromJson(dynamic json) {
    try {
      final Map<String, dynamic> data;
      if (json is List) {
        data = json.first as Map<String, dynamic>;
      } else if (json is Map) {
        data = json as Map<String, dynamic>;
      } else {
        throw FormatException('Invalid JSON type: ${json.runtimeType}');
      }

      if (!data.containsKey('Id') || !data.containsKey('Name')) {
        throw FormatException('Missing required fields (Id or Name)');
      }

      return JellyfinShow(
        id: data['Id'] as String,
        name: data['Name'] as String,
        type: data['Type'] as String?,
        overview: data['Overview'] as String?,
        imageTags: data['ImageTags'] != null
            ? Map<String, dynamic>.from(data['ImageTags'])
            : null,
        backdropImageTags: data['BackdropImageTags'] != null &&
                data['BackdropImageTags'].isNotEmpty
            ? (data['BackdropImageTags'] is List
                ? {data['BackdropImageTags'].first: ''}
                : Map<String, dynamic>.from(data['BackdropImageTags']))
            : null,
        imageBlurHashes: data['ImageBlurHashes'] != null
            ? Map<String, dynamic>.from(data['ImageBlurHashes'])
            : null,
        userData: data['UserData'] != null
            ? Map<String, dynamic>.from(data['UserData'])
            : null,
        parentId: _readString(data['ParentId']),
        seriesId: _readString(data['SeriesId']),
        seriesName: _readString(data['SeriesName']),
        seasonName: _readString(data['SeasonName']),
        parentThumbItemId: _readString(data['ParentThumbItemId']),
        parentThumbImageTag: _readString(data['ParentThumbImageTag']),
        seriesThumbImageTag: _readString(data['SeriesThumbImageTag']),
        tags: data['Tags'] != null ? List<String>.from(data['Tags']) : null,
        genres:
            data['Genres'] != null ? List<String>.from(data['Genres']) : null,
        remoteTrailers: _readRemoteTrailers(data['RemoteTrailers']),
        productionYear: _readInt(data['ProductionYear']),
        recursiveItemCount: _readInt(data['RecursiveItemCount']),
        indexNumber: _readInt(data['IndexNumber']),
        parentIndexNumber: _readInt(data['ParentIndexNumber']),
        communityRating: _readDouble(data['CommunityRating']),
      );
    } catch (e) {
      throw FormatException('Failed to parse JellyfinShow: $e\nJSON: $json');
    }
  }

  static int? _readInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value);
    return null;
  }

  static double? _readDouble(dynamic value) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  static String? _readString(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return value;
  }

  static List<JellyfinRemoteTrailer> _readRemoteTrailers(dynamic value) {
    if (value is! List) return const [];

    final trailers = <JellyfinRemoteTrailer>[];
    for (final trailer in value) {
      if (trailer is! Map) continue;

      final parsed = JellyfinRemoteTrailer.tryParse(
        Map<String, dynamic>.from(trailer),
      );
      if (parsed != null) trailers.add(parsed);
    }

    return List.unmodifiable(trailers);
  }

  String? get primaryImageTag => _readString(imageTags?['Primary']);

  String? get thumbImageTag => _readString(imageTags?['Thumb']);

  String? get parentThumbImageId =>
      _readString(parentThumbItemId) ??
      _readString(seriesId) ??
      _readString(parentId);

  String? get logoImageTag {
    return _readString(imageTags?['Logo']);
  }

  String? get backdropImageTag {
    if (backdropImageTags == null || backdropImageTags!.isEmpty) return null;
    return backdropImageTags!.keys.first.toString();
  }

  String? get firstRemoteTrailerUrl {
    for (final trailer in remoteTrailers) {
      if (trailer.url.isNotEmpty) return trailer.url;
    }
    return null;
  }

  double? get playedPercentage {
    final value = userData?['PlayedPercentage'];
    return _readDouble(value);
  }

  bool get isPlayed => userData?['Played'] == true;

  String get itemCountLabel {
    if (recursiveItemCount != null && recursiveItemCount! > 0) {
      return '$recursiveItemCount Episodes';
    }
    if (productionYear != null) return productionYear.toString();
    if (type == 'Movie') return 'Movie';
    return type ?? 'Series';
  }

  String get episodeLabel {
    if (parentIndexNumber != null && indexNumber != null) {
      return 'S$parentIndexNumber E$indexNumber';
    }
    return itemCountLabel;
  }

  @override
  String toString() {
    return 'JellyfinShow(id: $id, name: $name, type: $type, hasOverview: ${overview != null}, imageTags: $imageTags, backdropImageTags: $backdropImageTags, parentId: $parentId, tags: $tags)';
  }
}

class User {
  final String userId;
  final String username;

  User({
    required this.userId,
    required this.username,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userId: json['Id'] as String,
      username: json['Name'] as String,
    );
  }
}
