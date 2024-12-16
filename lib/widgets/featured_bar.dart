import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'dart:async';

class FeaturedBar extends StatefulWidget {
  const FeaturedBar({super.key});

  @override
  FeaturedBarState createState() => FeaturedBarState();
}

class FeaturedBarState extends State<FeaturedBar> {
  final PageController _pageController = PageController();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 5), (Timer timer) {
      int nextPage = (_pageController.page?.toInt() ?? 0) + 1;
      if (nextPage >= 4) {
        nextPage = 0;
      }
      _pageController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeIn,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 0),
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16.0),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16.0),
              child: SizedBox(
                height: 450,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width,
                  ),
                  child: PageView(
                    controller: _pageController,
                    children: [
                      Image.network(
                          'http://localhost:8096/Items/da676de3fefca05971961fcb7ac4584a/Images/Backdrop/0?tag=6a3bbf7c2a38bccc8076cac288f1a18d&maxWidth=1920',
                          fit: BoxFit.cover),
                      Image.network(
                          'http://localhost:8096/Items/329e09da86188f42c1f304be2a60946a/Images/Backdrop/0?tag=4a2ee96169101034d153c45e5fc97c88&maxWidth=1280',
                          fit: BoxFit.cover),
                      Image.network(
                          'http://localhost:8096/Items/3f8de89d877357e6e3921837ec2cb4eb/Images/Backdrop/0?tag=92e53a98106bebf5dc28c52c239c5919&maxWidth=1920',
                          fit: BoxFit.cover),
                      Image.network(
                          'http://localhost:8096/Items/0b9f7abd2dd49aa0f950dbe0c73dfa88/Images/Backdrop/0?tag=ccc8b33c5e893923c347f6eaad40df2b&maxWidth=1920',
                          fit: BoxFit.cover),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 10,
            child: SmoothPageIndicator(
              controller: _pageController,
              count: 4,
              effect: SlideEffect(
                activeDotColor: theme.colorScheme.primary,
                dotColor: theme.colorScheme.surfaceBright,
                dotHeight: 10,
                dotWidth: 10,
              ),
              onDotClicked: (index) {
                _pageController.animateToPage(
                  index,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeIn,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
