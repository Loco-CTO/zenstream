enum JellyfinApiEndpoints {
  authenticateByName,
}

extension JellyfinApiEndpointsExtension on JellyfinApiEndpoints {
  String get path {
    switch (this) {
      case JellyfinApiEndpoints.authenticateByName:
        return '/Users/AuthenticateByName';
    }
  }
}
