import 'package:flutter/material.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'dart:async';
import 'package:zenstream/utils/theme_style.dart';

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
      if (_pageController.page == 3) {
        _pageController.animateToPage(
          0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeIn,
        );
      } else {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeIn,
        );
      }
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
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16.0),
            child: SizedBox(
              height: 300.0,
              child: PageView(
                controller: _pageController,
                children: [
                  Image.network('https://via.placeholder.com/800x300',
                      fit: BoxFit.cover),
                  Image.network('https://via.placeholder.com/800x300',
                      fit: BoxFit.cover),
                  Image.network('https://via.placeholder.com/800x300',
                      fit: BoxFit.cover),
                  Image.network('https://via.placeholder.com/800x300',
                      fit: BoxFit.cover),
                ],
              ),
            ),
          ),
          Positioned(
            bottom: 10,
            child: SmoothPageIndicator(
              controller: _pageController,
              count: 4,
              effect: SlideEffect(
                activeDotColor: ThemeDataStyle.dark.primaryColor,
                dotColor: Colors.grey,
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
