import "package:flutter/material.dart";
import "../jellyfin/api_services.swagger.dart";
import "../widgets/layout.dart";
import "preferences.dart";
import "responsive.dart";

class PreCheck extends StatefulWidget {
  final Widget nextPage;

  const PreCheck({super.key, required this.nextPage});

  @override
  PreCheckState createState() => PreCheckState();
}

class PreCheckState extends State<PreCheck> {
  final JellyfinApiService _apiService = JellyfinApiService();
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  Future<void> _checkLoginStatus() async {
    final token = await getPreference("token");
    if (token == null || !(await _apiService.checkAuthToken(token))) {
      deletePreference("token");
      setState(() {
        _errorMessage = "You have been logged out";
      });
      if (mounted) {
        Navigator.pushNamed(context, '/login');
      }
    } else {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) =>
                widget.nextPage,
            transitionDuration: Duration.zero,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return LayoutScaffold(
      body: Center(
        child: DecoratedBox(
          decoration: ResponsiveMetrics.panelDecoration(context, radius: 12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 22),
            child: _errorMessage != null
                ? Text(
                    _errorMessage!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: scheme.error,
                    ),
                  )
                : const SizedBox(
                    width: 26,
                    height: 26,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
          ),
        ),
      ),
    );
  }
}
