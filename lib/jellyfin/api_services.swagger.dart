import "dart:convert";
import "package:http/http.dart" as http;
import "package:platform/platform.dart";
import "package:device_info_plus/device_info_plus.dart";
import "package:flutter_dotenv/flutter_dotenv.dart";
import "package:logger/logger.dart";
import "api_enums.swagger.dart";

class JellyfinApiService {
  final String baseUrl;
  final Logger _logger = Logger();

  JellyfinApiService() : baseUrl = dotenv.env["WEB_URL"] ?? "Unknown";

  String _getClient() {
    final platform = LocalPlatform();
    if (platform.isWindows) return "Windows";
    if (platform.isLinux) return "Linux";
    if (platform.isMacOS) return "MacOS";
    if (platform.isAndroid) return "Android";
    if (platform.isIOS) return "iOS";
    return "Unknown";
  }

  Future<String> _getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();
    if (LocalPlatform().isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      return androidInfo.id;
    } else if (LocalPlatform().isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? "Unknown";
    } else if (LocalPlatform().isWindows) {
      final windowsInfo = await deviceInfo.windowsInfo;
      return windowsInfo.deviceId;
    } else if (LocalPlatform().isLinux) {
      final linuxInfo = await deviceInfo.linuxInfo;
      return linuxInfo.machineId ?? "Unknown";
    } else if (LocalPlatform().isMacOS) {
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
    final response = await http.post(
      Uri.parse(url),
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": await _buildAuthorizationHeader(),
      },
      body: jsonEncode({
        "Username": username.trim(),
        "Pw": password.trim(),
      }),
    );

    _logger.i("Response status code: ${response.statusCode}");

    if (response.statusCode == 200) {
      _logger.i("Authentication successful for user: $username");
      return jsonDecode(response.body);
    } else {
      _logger.e("Authentication failed for user: $username");
      throw Exception("Failed to authenticate");
    }
  }

  Future<bool> checkAuthToken(String token) async {
    final url = "$baseUrl/Users/Me";
    final response = await http.get(
      Uri.parse(url),
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": await _buildAuthorizationHeader(token: token),
      },
    );

    print(response.body);

    if (response.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  }

  Future<List<JellyfinLibrary>> getUserLibraries(String token) async {
    _logger.i("Fetching user libraries");

    final url = "$baseUrl/UserViews";

    try {
      final header = await _buildAuthorizationHeader(token: token);
      final response = await http.get(
        Uri.parse(url),
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": header,
        },
      );

      _logger.i("Response status code: ${response.statusCode}");

      if (response.statusCode != 200) {
        throw Exception("Server returned ${response.statusCode}");
      }

      if (response.body.isEmpty) {
        _logger.w("Empty response received");
        return [];
      }

      try {
        final data = jsonDecode(response.body);
        final items = data["Items"] as List<dynamic>;
        final libraries =
            items.map((item) => JellyfinLibrary.fromJson(item)).toList();

        _logger.i("Successfully fetched ${libraries.length} libraries");
        _logger.d("Libraries: ${libraries.map((lib) => lib.name).join(", ")}");

        return libraries;
      } on FormatException catch (e) {
        _logger
            .e("Failed to parse response: $e\nResponse was: ${response.body}");
        throw Exception("Invalid response format");
      }
    } catch (e) {
      _logger.e("Error fetching libraries: $e");
      throw Exception("Error fetching libraries: $e");
    }
  }
}
