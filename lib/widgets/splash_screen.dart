import "package:flutter/material.dart";
import "../utils/responsive.dart";
import "../utils/preferences.dart";
import "base_layout.dart";
import "brand_mark.dart";

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  SplashScreenState createState() => SplashScreenState();
}

class SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(seconds: 2), () {
      _checkLoginStatus();
    });
  }

  void _navigateToLogin() {
    Navigator.pushNamed(context, '/login');
  }

  Future<void> _checkLoginStatus() async {
    final token = await getPreference("token");

    if (!mounted) return;

    if (token == null) {
      _navigateToLogin();
    } else {
      Navigator.pushNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return BaseLayout(
      child: ColoredBox(
        color: scheme.surface,
        child: Center(
          child: DecoratedBox(
            decoration: ResponsiveMetrics.panelDecoration(context, radius: 14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 34, vertical: 30),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandMark(size: 96),
                  const SizedBox(height: 18),
                  Text("ZenStream", style: theme.textTheme.headlineMedium),
                  const SizedBox(height: 10),
                  Text(
                    "Preparing your library",
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 20),
                  const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
