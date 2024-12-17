import 'dart:ui';

import 'package:flutter/material.dart';

class ItemBanner extends StatefulWidget {
  final String imageUrl;
  final String title;
  final String subtitle;

  const ItemBanner({
    required this.imageUrl,
    required this.title,
    required this.subtitle,
    super.key,
  });

  @override
  _ItemBannerState createState() => _ItemBannerState();
}

class _ItemBannerState extends State<ItemBanner> {
  bool _isHovered = false;
  bool _isTitleHovered = false;
  bool _isPlayButtonHovered = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            MouseRegion(
              onEnter: (_) => setState(() => _isHovered = true),
              onExit: (_) => setState(() => _isHovered = false),
              child: GestureDetector(
                onTap: () {
                  // TODO: Handle banner tap
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.all(8.0),
                  width: 200,
                  height: 300,
                  decoration: BoxDecoration(
                    image: DecorationImage(
                      image: NetworkImage(widget.imageUrl),
                      fit: BoxFit.cover,
                    ),
                    borderRadius: BorderRadius.circular(8.0),
                    border: Border.all(
                      color: _isHovered
                          ? Theme.of(context).colorScheme.primary
                          : Colors.transparent,
                      width: 2.0,
                    ),
                  ),
                  child: Stack(
                    children: [
                      if (_isHovered)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8.0),
                          child: Container(
                            color: Theme.of(context)
                                .colorScheme
                                .surface
                                .withAlpha((0.5 * 255).toInt()),
                          ),
                        ),
                      if (_isHovered)
                        Center(
                          child: MouseRegion(
                            onEnter: (_) =>
                                setState(() => _isPlayButtonHovered = true),
                            onExit: (_) =>
                                setState(() => _isPlayButtonHovered = false),
                            child: GestureDetector(
                              onTap: () {
                                // TODO: Handle play button tap
                              },
                              child: Icon(
                                Icons.play_circle_fill,
                                color: _isPlayButtonHovered
                                    ? Theme.of(context).colorScheme.secondary
                                    : Theme.of(context).colorScheme.primary,
                                size: 64,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: MouseRegion(
            onEnter: (_) => setState(() {
              _isTitleHovered = true;
              _isHovered = false;
            }),
            onExit: (_) => setState(() => _isTitleHovered = false),
            child: GestureDetector(
              onTap: () {
                // TODO: Handle title tap
              },
              child: Text(
                widget.title,
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      overflow: TextOverflow.ellipsis,
                      decoration: _isTitleHovered
                          ? TextDecoration.underline
                          : TextDecoration.none,
                      color: _isTitleHovered
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).textTheme.displayMedium?.color,
                    ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: Text(
            widget.subtitle,
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontSize: 12,
                  overflow: TextOverflow.ellipsis,
                ),
          ),
        ),
      ],
    );
  }
}
