enum JellyfinApiEndpoints {
  authenticateByName,
}

extension JellyfinApiEndpointsExtension on JellyfinApiEndpoints {
  String get path {
    switch (this) {
      case JellyfinApiEndpoints.authenticateByName:
        return "/Users/AuthenticateByName";
    }
  }
}

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

class User {}
