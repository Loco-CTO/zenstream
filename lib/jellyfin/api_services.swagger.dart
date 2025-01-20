import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:logger/logger.dart';
import 'package:dio/dio.dart';
import 'api_enums.swagger.dart';
import '../environment.dart';

class JellyfinApiService {
  static User? currentUser;

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
    _logger.i("Authenticating user: $username");

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
      return true;
    } else {
      currentUser = null;
      return false;
    }
  }

  Future<List<JellyfinShow>> getLatestShows(String token) async {
    _logger.i("Fetching user's latest shows");

    if (currentUser?.userId == null) {
      _logger.e("No user ID available");
      throw Exception("User not logged in");
    }

    final url =
        "$baseUrl/Users/${currentUser!.userId}/Items/Latest?Limit=14&Recursive=true&IncludeItemTypes=Series&Fields=Id";

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
        final List<dynamic> data = response.data;
        final shows = data.map((item) => JellyfinShow.fromJson(item)).toList();

        final seriesData = <JellyfinShow>[];
        for (var i = 0; i < shows.length; i++) {
          final url =
              "$baseUrl/Users/${currentUser!.userId}/Items/${shows[i].id}?&Fields=Id%2CName%2COverview%2CImageTags";
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
          seriesData.add(JellyfinShow.fromJson(response.data));
        }

        _logger.i("Successfully fetched ${shows.length} latest shows");
        _logger.d("Shows: ${shows.map((show) => show.name).join(", ")}");

        return seriesData;
      } on FormatException catch (e) {
        _logger
            .e("Failed to parse response: $e\nResponse was: ${response.data}");
        throw Exception("Invalid response format");
      }
    } catch (e) {
      _logger.e("Error fetching latest shows: $e");
      throw Exception("Error fetching latest shows: $e");
    }
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
}
