import 'package:flutter/material.dart';
import '../utils/responsive.dart';
import '../widgets/layout.dart';

class TestScreen extends StatelessWidget {
  const TestScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return LayoutScaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: DecoratedBox(
            decoration: ResponsiveMetrics.panelDecoration(context, radius: 12),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text("Test Screen", style: theme.textTheme.headlineMedium),
                  const SizedBox(height: 10),
                  Text(
                    "This route is available for development checks.",
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 22),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("Go back"),
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
