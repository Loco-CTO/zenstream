import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../jellyfin/api_services.swagger.dart";
import "../utils/preferences.dart";
import "../utils/responsive.dart";
import "../widgets/base_layout.dart";
import "../widgets/brand_mark.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  LoginScreenState createState() => LoginScreenState();
}

class LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final FocusNode _passwordFocusNode = FocusNode();
  String? _errorMessage;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final apiService = JellyfinApiService();
    try {
      final response = await apiService.authenticateByName(
        _usernameController.text.trim(),
        _passwordController.text,
      );

      final token = response["AccessToken"]?.toString();
      if (token == null || token.isEmpty) {
        throw StateError("Missing access token");
      }

      await setPreference("token", token);

      if (mounted) {
        Navigator.pushNamed(context, "/home");
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _errorMessage = "Login failed. Check your username and password.";
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isCompact = ResponsiveMetrics.isCompact(context);
    final panelWidth = ResponsiveMetrics.clamp(
      MediaQuery.sizeOf(context).width - 48,
      320,
      430,
    );
    final shadowAlpha =
        ((theme.brightness == Brightness.dark ? 0.22 : 0.08) * 255).toInt();

    return BaseLayout(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surface,
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 18 : 28,
              vertical: isCompact ? 24 : 42,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: panelWidth),
              child: DecoratedBox(
                decoration: ResponsiveMetrics.panelDecoration(
                  context,
                  radius: 14,
                ).copyWith(
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withAlpha(shadowAlpha),
                      blurRadius: 30,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: Padding(
                  padding: EdgeInsets.all(isCompact ? 24 : 32),
                  child: AutofillGroup(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: const BrandMark(size: 58),
                        ),
                        const SizedBox(height: 24),
                        Text("Welcome back",
                            style: theme.textTheme.displaySmall),
                        const SizedBox(height: 8),
                        Text(
                          "Sign in to your media library.",
                          style: theme.textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 28),
                        TextField(
                          controller: _usernameController,
                          autofillHints: const [AutofillHints.username],
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: "Username",
                            prefixIcon: Icon(TablerIcons.user),
                          ),
                          onSubmitted: (_) => _passwordFocusNode.requestFocus(),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _passwordController,
                          focusNode: _passwordFocusNode,
                          autofillHints: const [AutofillHints.password],
                          textInputAction: TextInputAction.done,
                          decoration: const InputDecoration(
                            labelText: "Password",
                            prefixIcon: Icon(TablerIcons.lock),
                          ),
                          obscureText: true,
                          onSubmitted: (_) => _login(),
                        ),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: _errorMessage == null
                              ? const SizedBox(height: 18)
                              : Padding(
                                  padding:
                                      const EdgeInsets.only(top: 14, bottom: 4),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Icon(
                                        TablerIcons.alert_triangle,
                                        color: scheme.error,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _errorMessage!,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(color: scheme.error),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                        ),
                        const SizedBox(height: 6),
                        ElevatedButton(
                          onPressed: _isSubmitting ? null : _login,
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 160),
                            child: _isSubmitting
                                ? SizedBox(
                                    key: const ValueKey("progress"),
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: scheme.onPrimary,
                                    ),
                                  )
                                : const Text(
                                    "Login",
                                    key: ValueKey("label"),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
