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
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16.0),
              boxShadow: [
                BoxShadow(
                  color: const Color.fromARGB(88, 0, 0, 0),
                  blurRadius: 10.0,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: ClipRRect(
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
          ),
          Positioned(
            bottom: 10,
            child: SmoothPageIndicator(
              controller: _pageController,
              count: 4,
              effect: SlideEffect(
                activeDotColor: Colors.blue,
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
