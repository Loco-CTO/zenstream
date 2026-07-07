import "package:cached_network_image/cached_network_image.dart";
import "package:flutter/material.dart";
import "package:tabler_icons/tabler_icons.dart";

import "../../utils/responsive.dart";

class ResumeBanner extends StatefulWidget {
  final String imageUrl;
  final String title;
  final String subtitle;
  final double? progress;
  final double? width;
  final double? height;

  const ResumeBanner({
    required this.imageUrl,
    required this.title,
    required this.subtitle,
    this.progress,
    this.width,
    this.height,
    super.key,
  });

  @override
  State<ResumeBanner> createState() => _ResumeBannerState();
}

class _ResumeBannerState extends State<ResumeBanner> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final width = widget.width ?? ResponsiveMetrics.resumeWidth(context);
    final imageHeight =
        widget.height ?? ResponsiveMetrics.resumeHeight(context);
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: AnimatedScale(
          scale: _isHovered ? 1.012 : 1,
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          child: SizedBox(
            width: width,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  curve: Curves.easeOutCubic,
                  height: imageHeight,
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _isHovered
                          ? scheme.primary.withAlpha((0.68 * 255).toInt())
                          : scheme.outlineVariant
                              .withAlpha((0.52 * 255).toInt()),
                    ),
                    boxShadow: _isHovered
                        ? [
                            BoxShadow(
                              color: scheme.primary
                                  .withAlpha((0.16 * 255).toInt()),
                              blurRadius: 18,
                              offset: const Offset(0, 10),
                            ),
                          ]
                        : [],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CachedNetworkImage(
                          imageUrl: widget.imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => ColoredBox(
                            color: scheme.surfaceContainerHigh,
                            child: const Center(
                              child: SizedBox(
                                height: 20,
                                width: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => ColoredBox(
                            color: scheme.surfaceContainerHigh,
                            child: Icon(
                              TablerIcons.photo_off,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        const _ResumeGradient(),
                        if (_isHovered) Center(child: _PlayButton()),
                        if (widget.progress != null)
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: _ProgressBar(value: widget.progress!),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 42,
                  child: _ResumeFooter(
                    title: widget.title,
                    subtitle: widget.subtitle,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ResumeGradient extends StatelessWidget {
  const _ResumeGradient();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.black.withAlpha((0.02 * 255).toInt()),
            Colors.black.withAlpha((0.08 * 255).toInt()),
            Colors.black.withAlpha((0.62 * 255).toInt()),
          ],
          stops: const [0, 0.55, 1],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
    );
  }
}

class _ResumeFooter extends StatelessWidget {
  final String title;
  final String subtitle;

  const _ResumeFooter({
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleSmall?.copyWith(
            color: scheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 3),
        Row(
          children: [
            Expanded(
              child: Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ProgressBar extends StatelessWidget {
  final double value;

  const _ProgressBar({required this.value});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final clamped = value.clamp(0, 1).toDouble();

    return Row(
      children: [
        Expanded(
          child: LinearProgressIndicator(
            minHeight: 3,
            value: clamped,
            backgroundColor: Colors.white.withAlpha((0.18 * 255).toInt()),
            valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
          ),
        ),
      ],
    );
  }
}

class _PlayButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.black.withAlpha((0.52 * 255).toInt()),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withAlpha((0.34 * 255).toInt())),
      ),
      child: Padding(
        padding: const EdgeInsets.all(9),
        child: Icon(
          TablerIcons.player_play_filled,
          color: scheme.primary,
          size: 20,
        ),
      ),
    );
  }
}
