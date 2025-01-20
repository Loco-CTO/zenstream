import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:flutter/foundation.dart" show kIsWeb;
import "../widgets/base_layout.dart";
import "../jellyfin/api_services.swagger.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  LoginScreenState createState() => LoginScreenState();
}

class LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  String? _errorMessage;

  Future<void> _login() async {
    final apiService = JellyfinApiService();
    try {
      final response = await apiService.authenticateByName(
        _usernameController.text,
        _passwordController.text,
      );

      final token = response["AccessToken"];
      if (!kIsWeb) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString("token", token);
      }

      if (mounted) {
        Navigator.pushNamed(context, '/home');
      }
    } catch (e) {
      setState(() {
        _errorMessage = "Login failed. Please check your credentials.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return BaseLayout(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Center(
          child: Container(
            padding: EdgeInsets.all(50),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceDim,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 10,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  "assets/icons/icon.png",
                  width: 100,
                  height: 100,
                ),
                SizedBox(height: 20),
                Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: SizedBox(
                    width: 350,
                    child: TextField(
                      controller: _usernameController,
                      decoration: InputDecoration(labelText: "Username"),
                      onSubmitted: (_) => _login(),
                    ),
                  ),
                ),
                SizedBox(
                  width: 350,
                  child: TextField(
                    controller: _passwordController,
                    decoration: InputDecoration(labelText: "Password"),
                    obscureText: true,
                    onSubmitted: (_) => _login(),
                  ),
                ),
                SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _login,
                  child: Text("Login"),
                ),
                if (_errorMessage != null) ...[
                  SizedBox(height: 20),
                  Text(
                    _errorMessage!,
                    style: TextStyle(color: Colors.red),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
