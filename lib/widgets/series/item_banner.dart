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
  ItemBannerState createState() => ItemBannerState();
}

class ItemBannerState extends State<ItemBanner> {
  bool _isHovered = false;
  bool _isTitleHovered = false;
  bool _isPlayButtonHovered = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildImageBanner(context),
        _buildTitle(context),
        _buildSubtitle(context),
      ],
    );
  }

  Widget _buildImageBanner(BuildContext context) {
    return Stack(
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
                    width: 1.0,
                    strokeAlign: BorderSide.strokeAlignOutside),
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
                  if (_isHovered) _buildPlayButton(context),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPlayButton(BuildContext context) {
    return Center(
      child: MouseRegion(
        onEnter: (_) => setState(() => _isPlayButtonHovered = true),
        onExit: (_) => setState(() => _isPlayButtonHovered = false),
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
    );
  }

  Widget _buildTitle(BuildContext context) {
    return Padding(
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
    );
  }

  Widget _buildSubtitle(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8.0),
      child: Text(
        widget.subtitle,
        style: Theme.of(context).textTheme.displaySmall?.copyWith(
              fontSize: 12,
              overflow: TextOverflow.ellipsis,
              color: Theme.of(context).textTheme.displaySmall?.color,
            ),
      ),
    );
  }
}
