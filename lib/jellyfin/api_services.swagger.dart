import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:logger/logger.dart';
import 'package:dio/dio.dart';
import 'api_enums.swagger.dart';
import '../environment.dart';

class JellyfinApiService {
  static User? currentUser;
  static const String itemFields =
      "Overview,Genres,PrimaryImageAspectRatio,CommunityRating,ProductionYear,RecursiveItemCount,ParentId,ImageTags,BackdropImageTags,ImageBlurHashes,RemoteTrailers,UserData";
  static const String itemImageTypes = "Primary,Backdrop,Logo,Thumb";

  final String baseUrl;
  final Logger _logger = Logger();
  final Dio _dio;

  JellyfinApiService()
      : baseUrl = Environment.webURL,
        _dio = Dio() {
    _logger.i("Web URL: $baseUrl");
  }

  String _getClient() {
    if (kIsWeb) return "Web";
    if (Platform.isWindows) return "Windows";
    if (Platform.isLinux) return "Linux";
    if (Platform.isMacOS) return "MacOS";
    if (Platform.isAndroid) return "Android";
    if (Platform.isIOS) return "iOS";
    return "Unknown";
  }

  Future<String> _getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    if (kIsWeb) {
      return "Web";
    } else if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id;
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? "Unknown";
    } else if (Platform.isWindows) {
      final windowsInfo = await deviceInfo.windowsInfo;
      return windowsInfo.deviceId;
    } else if (Platform.isLinux) {
      final linuxInfo = await deviceInfo.linuxInfo;
      return linuxInfo.machineId ?? "Unknown";
    } else if (Platform.isMacOS) {
      final macInfo = await deviceInfo.macOsInfo;
      return macInfo.systemGUID ?? "Unknown";
    }
    return "Unknown";
  }

  Future<String> _buildAuthorizationHeader({String? token}) async {
    final client = _getClient();
    final deviceId = await _getDeviceId();
    if (token != null) {
      return 'MediaBrowser Token="$token", Client="$client", Device="ZenStream", DeviceId="$deviceId", Version="0.0.1b"';
    } else {
      return 'MediaBrowser Client="$client", Device="ZenStream", DeviceId="$deviceId", Version="0.0.1b"';
    }
  }

  Future<Map<String, dynamic>> authenticateByName(
      String username, String password) async {
    final url = "$baseUrl/Users/AuthenticateByName";
    _logger.i("Authenticating user: $username at $url");

    try {
      final response = await _dio.post(
        url,
        options: Options(
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": await _buildAuthorizationHeader(),
          },
        ),
        data: {
          "Username": username.trim(),
          "Pw": password.trim(),
        },
      );

      _logger.i("Response status code: ${response.statusCode}");

      if (response.statusCode == 200) {
        final responseData = response.data;
        currentUser = User(
            userId: responseData['User']['Id'],
            username: responseData['User']['Name']);
        _logger.i("Authentication successful for user: $username");
        return responseData;
      } else {
        _logger.e("Authentication failed for user: $username");
        throw Exception("Failed to authenticate");
      }
    } on DioError catch (e) {
      _logger.e("Dio error: ${e.message}");
      throw Exception("Failed to authenticate: ${e.message}");
    }
  }

  Future<bool> checkAuthToken(String token) async {
    final url = "$baseUrl/Users/Me";
    final response = await _dio.get(
      url,
      options: Options(
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": await _buildAuthorizationHeader(token: token),
        },
      ),
    );

    if (response.statusCode == 200) {
      final userData = response.data;
      currentUser = User.fromJson(userData);
      _logger.i("Successfully authenticated user: ${currentUser?.username}");
      return true;
    } else {
      _logger.e("Failed to authenticate user");
      currentUser = null;
      return false;
    }
  }

  void _requireUser() {
    if (currentUser?.userId == null) {
      _logger.e("No user ID available");
      throw Exception("User not logged in");
    }
  }

  Future<Response<dynamic>> _authorizedGet(
    String path,
    String token, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final header = await _buildAuthorizationHeader(token: token);
    final cleanedParameters = <String, dynamic>{};
    queryParameters?.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      cleanedParameters[key] = value;
    });

    return _dio.get(
      "$baseUrl$path",
      queryParameters: cleanedParameters,
      options: Options(
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": header,
        },
      ),
    );
  }

  List<JellyfinShow> _parseItems(dynamic data) {
    final List<dynamic> items;
    if (data is List) {
      items = data;
    } else if (data is Map && data["Items"] is List) {
      items = data["Items"] as List<dynamic>;
    } else {
      return [];
    }

    return items.map((item) => JellyfinShow.fromJson(item)).toList();
  }

  Future<List<JellyfinShow>> getLatestShows(String token) async {
    return getLatestMedia(token, limit: 15);
  }

  Future<List<JellyfinShow>> getLatestMedia(
    String token, {
    int limit = 18,
    String includeItemTypes = "Series,Movie",
  }) async {
    _logger.i("Fetching latest media");
    _requireUser();

    try {
      final response = await _authorizedGet(
        "/Items/Latest",
        token,
        queryParameters: {
          "userId": currentUser!.userId,
          "limit": limit,
          "groupItems": true,
          "includeItemTypes": includeItemTypes,
          "fields": itemFields,
          "enableImages": true,
          "imageTypeLimit": 1,
          "enableImageTypes": itemImageTypes,
          "enableUserData": true,
        },
      );

      _logger.i("Response status code: ${response.statusCode}");

      if (response.statusCode != 200) {
        throw Exception("Server returned ${response.statusCode}");
      }

      if (response.data.isEmpty) {
        _logger.w("Empty response received");
        return [];
      }

      final items = _parseItems(response.data);
      _logger.i("Successfully fetched ${items.length} latest items");
      return items;
    } catch (e) {
      _logger.e("Error fetching latest media: $e");
      throw Exception("Error fetching latest media: $e");
    }
  }

  Future<List<JellyfinShow>> getResumeItems(
    String token, {
    int limit = 18,
    int startIndex = 0,
    String includeItemTypes = "Episode,Movie",
  }) async {
    _logger.i("Fetching resume items");
    _requireUser();

    final response = await _authorizedGet(
      "/UserItems/Resume",
      token,
      queryParameters: {
        "userId": currentUser!.userId,
        "limit": limit,
        "startIndex": startIndex,
        "includeItemTypes": includeItemTypes,
        "fields": itemFields,
        "enableImages": true,
        "imageTypeLimit": 1,
        "enableImageTypes": itemImageTypes,
        "enableUserData": true,
        "enableTotalRecordCount": false,
      },
    );

    if (response.statusCode != 200) {
      throw Exception("Server returned ${response.statusCode}");
    }

    return _parseItems(response.data);
  }

  Future<List<JellyfinShow>> getNextUpItems(
    String token, {
    int limit = 18,
    int startIndex = 0,
  }) async {
    _logger.i("Fetching next up items");
    _requireUser();

    final response = await _authorizedGet(
      "/Shows/NextUp",
      token,
      queryParameters: {
        "userId": currentUser!.userId,
        "limit": limit,
        "startIndex": startIndex,
        "fields": itemFields,
        "enableImages": true,
        "imageTypeLimit": 1,
        "enableImageTypes": itemImageTypes,
        "enableUserData": true,
        "enableTotalRecordCount": false,
        "disableFirstEpisode": true,
        "enableResumable": false,
        "enableRewatching": false,
      },
    );

    if (response.statusCode != 200) {
      throw Exception("Server returned ${response.statusCode}");
    }

    return _parseItems(response.data);
  }

  Future<List<JellyfinShow>> getItems(
    String token, {
    int limit = 18,
    int startIndex = 0,
    String includeItemTypes = "Series,Movie",
    String? sortBy,
    String sortOrder = "Descending",
    String? searchTerm,
    String? genres,
    bool? isFavorite,
  }) async {
    _logger.i("Fetching items");
    _requireUser();

    final response = await _authorizedGet(
      "/Items",
      token,
      queryParameters: {
        "userId": currentUser!.userId,
        "startIndex": startIndex,
        "limit": limit,
        "recursive": true,
        "includeItemTypes": includeItemTypes,
        "sortBy": sortBy,
        "sortOrder": sortOrder,
        "searchTerm": searchTerm,
        "genres": genres,
        "isFavorite": isFavorite,
        "fields": itemFields,
        "enableImages": true,
        "imageTypeLimit": 1,
        "enableImageTypes": itemImageTypes,
        "enableUserData": true,
      },
    );

    if (response.statusCode != 200) {
      throw Exception("Server returned ${response.statusCode}");
    }

    return _parseItems(response.data);
  }

  Future<JellyfinShow> getItem(
    String token,
    String itemId,
  ) async {
    _logger.i("Fetching item details");
    _requireUser();

    final response = await _authorizedGet(
      "/Users/${currentUser!.userId}/Items/$itemId",
      token,
      queryParameters: {
        "fields": itemFields,
        "enableImages": true,
        "imageTypeLimit": 1,
        "enableImageTypes": itemImageTypes,
        "enableUserData": true,
      },
    );

    if (response.statusCode != 200) {
      throw Exception("Server returned ${response.statusCode}");
    }

    return JellyfinShow.fromJson(response.data);
  }

  Future<List<JellyfinShow>> searchItems(
    String token,
    String searchTerm, {
    int limit = 18,
    int startIndex = 0,
    String includeItemTypes = "Series,Movie",
  }) {
    return getItems(
      token,
      limit: limit,
      startIndex: startIndex,
      includeItemTypes: includeItemTypes,
      searchTerm: searchTerm,
      sortBy: "SortName",
      sortOrder: "Ascending",
    );
  }

  Future<List<JellyfinShow>> getFavoriteItems(
    String token, {
    int limit = 24,
    int startIndex = 0,
    String includeItemTypes = "Series,Movie",
  }) {
    return getItems(
      token,
      limit: limit,
      startIndex: startIndex,
      includeItemTypes: includeItemTypes,
      sortBy: "SortName",
      sortOrder: "Ascending",
      isFavorite: true,
    );
  }

  Future<List<JellyfinLibrary>> getUserLibraries(String token) async {
    _logger.i("Fetching user libraries");

    final url = "$baseUrl/UserViews";

    try {
      final header = await _buildAuthorizationHeader(token: token);
      final response = await _dio.get(
        url,
        options: Options(
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": header,
          },
        ),
      );

      _logger.i("Response status code: ${response.statusCode}");

      if (response.statusCode != 200) {
        throw Exception("Server returned ${response.statusCode}");
      }

      if (response.data.isEmpty) {
        _logger.w("Empty response received");
        return [];
      }

      try {
        final data = response.data;
        final items = data["Items"] as List<dynamic>;
        final libraries =
            items.map((item) => JellyfinLibrary.fromJson(item)).toList();

        _logger.i("Successfully fetched ${libraries.length} libraries");
        _logger.d("Libraries: ${libraries.map((lib) => lib.name).join(", ")}");

        return libraries;
      } on FormatException catch (e) {
        _logger
            .e("Failed to parse response: $e\nResponse was: ${response.data}");
        throw Exception("Invalid response format");
      }
    } catch (e) {
      _logger.e("Error fetching libraries: $e");
      throw Exception("Error fetching libraries: $e");
    }
  }

  String primaryImageUrl(
    JellyfinShow item, {
    int width = 520,
    int height = 292,
    int quality = 92,
  }) {
    final tag = item.primaryImageTag;
    return "$baseUrl/Items/${item.id}/Images/Primary?fillWidth=$width&fillHeight=$height&quality=$quality${tag == null ? "" : "&tag=$tag"}";
  }

  String backdropImageUrl(
    JellyfinShow item, {
    int width = 1600,
    int height = 700,
    int quality = 94,
  }) {
    final tag = item.backdropImageTag;
    if (tag == null) return primaryImageUrl(item, width: width, height: height);
    return "$baseUrl/Items/${item.id}/Images/Backdrop/0?fillWidth=$width&fillHeight=$height&quality=$quality&tag=$tag";
  }

  String landscapeImageUrl(
    JellyfinShow item, {
    int width = 520,
    int height = 292,
    int quality = 92,
  }) {
    final thumbTag = item.thumbImageTag;
    if (thumbTag != null) {
      return _imageUrl(
        item.id,
        "Thumb",
        width: width,
        height: height,
        quality: quality,
        tag: thumbTag,
      );
    }

    if (item.parentThumbItemId != null && item.parentThumbImageTag != null) {
      return _imageUrl(
        item.parentThumbItemId!,
        "Thumb",
        width: width,
        height: height,
        quality: quality,
        tag: item.parentThumbImageTag,
      );
    }

    if (item.seriesId != null && item.seriesThumbImageTag != null) {
      return _imageUrl(
        item.seriesId!,
        "Thumb",
        width: width,
        height: height,
        quality: quality,
        tag: item.seriesThumbImageTag,
      );
    }

    if (item.parentId != null && item.parentThumbImageTag != null) {
      return _imageUrl(
        item.parentId!,
        "Thumb",
        width: width,
        height: height,
        quality: quality,
        tag: item.parentThumbImageTag,
      );
    }

    return backdropImageUrl(
      item,
      width: width,
      height: height,
      quality: quality,
    );
  }

  String _imageUrl(
    String itemId,
    String imageType, {
    required int width,
    required int height,
    required int quality,
    String? tag,
  }) {
    return "$baseUrl/Items/$itemId/Images/$imageType?fillWidth=$width&fillHeight=$height&quality=$quality${tag == null ? "" : "&tag=$tag"}";
  }

  String? logoImageUrl(
    JellyfinShow item, {
    int width = 560,
    int height = 180,
    int quality = 94,
  }) {
    final tag = item.logoImageTag;
    if (tag == null) return null;
    return "$baseUrl/Items/${item.id}/Images/Logo?maxWidth=$width&maxHeight=$height&quality=$quality&tag=$tag";
  }
}
