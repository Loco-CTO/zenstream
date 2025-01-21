import "package:flutter/material.dart";
import "dart:ui";
import "package:cached_network_image/cached_network_image.dart";
import "package:solar_icons/solar_icons.dart";

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
  final Map<IconData, bool> _isIconHovered = {};

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
        Center(
          child: MouseRegion(
            onEnter: (_) => setState(() => _isHovered = true),
            onExit: (_) => setState(() => _isHovered = false),
            child: GestureDetector(
              onTap: () {
                // TODO: Handle banner tap
              },
              child: AnimatedScale(
                scale: _isHovered ? 1.02 : 1,
                curve: Curves.easeOutQuint,
                alignment: Alignment.center,
                duration: Duration(milliseconds: 500),
                child: Container(
                  margin: EdgeInsets.all(8),
                  width: 200,
                  height: 300,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: _isHovered
                        ? [
                            BoxShadow(
                              color: Theme.of(context).colorScheme.outline,
                              blurRadius: 4,
                              spreadRadius: 1,
                            )
                          ]
                        : [],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Stack(
                      children: [
                        CachedNetworkImage(
                          imageUrl: widget.imageUrl,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          placeholder: (context, url) => Container(
                            color: Theme.of(context).colorScheme.surface,
                            child: Center(
                              child: CircularProgressIndicator(),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: Theme.of(context).colorScheme.surface,
                            child: Icon(SolarIconsBold.folderError),
                          ),
                        ),
                        if (_isHovered) ...[
                          BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 0.5, sigmaY: 0.5),
                            child: Container(
                              color:
                                  Colors.black.withAlpha((0.65 * 255).toInt()),
                            ),
                          ),
                          _buildPlayButton(context),
                          Positioned(
                            bottom: 8,
                            right: 8,
                            child: Row(
                              children: [
                                _buildIconButton(
                                  context,
                                  icon: Icons.check,
                                  onTap: () {
                                    // TODO: Handle tick option tap
                                  },
                                ),
                                SizedBox(width: 8),
                                _buildIconButton(
                                  context,
                                  icon: Icons.favorite,
                                  onTap: () {
                                    // TODO: Handle heart option tap
                                  },
                                ),
                                SizedBox(width: 8),
                                _buildIconButton(
                                  context,
                                  icon: Icons.more_vert,
                                  onTap: () {
                                    // TODO: Handle other options tap
                                  },
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
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
          child: AnimatedScale(
            duration: Duration(milliseconds: 220),
            scale: _isPlayButtonHovered ? 1.1 : 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(26),
              child: _isPlayButtonHovered
                  ? BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: _buildButtonContent(context),
                    )
                  : _buildButtonContent(context),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildButtonContent(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        color: Colors.black.withAlpha((0.45 * 255).toInt()),
      ),
      child: AnimatedScale(
        duration: Duration(milliseconds: 220),
        scale: _isPlayButtonHovered ? 0.99 : 1,
        child: Icon(
          SolarIconsBold.play,
          color: _isPlayButtonHovered
              ? Theme.of(context).colorScheme.secondary
              : Theme.of(context).colorScheme.primary,
          size: 35,
        ),
      ),
    );
  }

  Widget _buildTitle(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 8),
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
      padding: EdgeInsets.symmetric(horizontal: 8),
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

  Widget _buildIconButton(BuildContext context,
      {required IconData icon, required VoidCallback onTap}) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isIconHovered[icon] = true),
      onExit: (_) => setState(() => _isIconHovered[icon] = false),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedScale(
          duration: Duration(milliseconds: 100),
          scale: _isIconHovered[icon] == true ? 1.2 : 1,
          child: AnimatedContainer(
            duration: Duration(milliseconds: 100),
            padding: EdgeInsets.all(4),
            child: Icon(
              icon,
              color: _isIconHovered[icon] == true
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurface,
              size: 20,
            ),
          ),
        ),
      ),
    );
  }
}
