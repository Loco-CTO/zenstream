import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class JellyfinApiService {
  final String baseUrl = dotenv.env['WEB_URL'] ?? '';

  Future<Map<String, dynamic>> authenticateByName(
      String username, String password) async {
    final url = '$baseUrl/Users/AuthenticateByName';
    final response = await http.post(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization':
            'MediaBrowser Client="ZenStream", Device="ZenStream", DeviceId="1234", Version="0.0.1b"',
      },
      body: jsonEncode({
        'Username': username.trim(),
        'Pw': password.trim(),
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to authenticate');
    }
  }

  Future<bool> checkAuthToken(String token) async {
    final url = '$baseUrl/Users/Me';
    final response = await http.get(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization':
            'MediaBrowser Token="$token", Client="ZenStream", Device="ZenStream", DeviceId="1234", Version="0.0.1b"',
      },
    );

    if (response.statusCode == 200) {
      return true;
    } else {
      return false;
    }
  }
}
