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

class JellyfinShow {
  final String id;
  final String name;
  final String? overview;
  final Map<String, dynamic>? imageTags;
  final Map<String, dynamic>? backdropImageTags;
  final String? parentId;
  final List<String>? tags;

  JellyfinShow({
    required this.id,
    required this.name,
    this.overview,
    this.imageTags,
    this.backdropImageTags,
    this.parentId,
    this.tags,
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
        overview: data['Overview'] as String?,
        imageTags: data['ImageTags'] != null
            ? Map<String, dynamic>.from(data['ImageTags'])
            : null,
        backdropImageTags: data['BackdropImageTags'] != null
            ? (data['BackdropImageTags'] is List
                ? {data['BackdropImageTags'].first: ''}
                : Map<String, dynamic>.from(data['BackdropImageTags']))
            : null,
        parentId: data['ParentId'] as String?,
        tags: data['Tags'] != null ? List<String>.from(data['Tags']) : null,
      );
    } catch (e) {
      throw FormatException('Failed to parse JellyfinShow: $e');
    }
  }

  @override
  String toString() {
    return 'JellyfinShow(id: $id, name: $name, overview: $overview, imageTags: $imageTags, parentId: $parentId, tags: $tags)';
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
