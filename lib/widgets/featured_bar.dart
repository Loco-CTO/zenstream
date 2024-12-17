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
    _startTimer();
    _pageController.addListener(_resetTimer);
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 8), (Timer timer) {
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

  void _resetTimer() {
    _timer?.cancel();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.removeListener(_resetTimer);
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(50.0, 15.0, 50.0, 0),
      child: Stack(
        alignment: Alignment.bottomCenter,
        children: [
          _buildPageView(),
          _buildPageIndicator(theme),
        ],
      ),
    );
  }

  Widget _buildPageView() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16.0),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16.0),
        child: SizedBox(
          height: 560,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width,
            ),
            child: GestureDetector(
              onPanUpdate: (details) {
                if (details.delta.dx < 0) {
                  _pageController.nextPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeIn,
                  );
                } else if (details.delta.dx > 0) {
                  _pageController.previousPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeIn,
                  );
                }
              },
              child: PageView(
                controller: _pageController,
                children: _buildPageViewChildren(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildPageViewChildren() {
    return [
      _buildPageViewItem(
        '絶園のテンペスト ～THE CIVILIZATION BLASTER～',
        '''ある日、魔法使いの姫君が樽に詰められ置き去りにされた。ある日、ひとりの少女が唐突に殺され、犯人が捕まらず時が過ぎた。そしてある日、復讐と魔法をめぐる、時間と空間を超えた戦いが始まった！
正気と狂気、理性と知性。自信と確信。悲劇で不合理な世の中で物語は始まる―――。

“はじまりの樹”の加護を受ける魔法使いの一族・鎖部一族。その姫宮にして、最強の魔法使い鎖部葉風。彼女は“はじまりの樹”と対をなし、破壊の力を司る“絶園の樹”を復活させようとする同族の鎖部左門によって、無人島に樽に詰められて置き去りにされてしまう。
葉風が孤島から流したメッセージを、妹・愛花を殺した犯人に復讐を誓う少年・不破真広が拾う。
真広は犯人を魔法の力で見つけることを条件に、葉風に協力する。そして真広の親友で、愛花の恋人である滝川吉野は、危機を真広に助けられたことから、その復讐劇に巻き込まれることになる。''',
        'http://localhost:8096/Items/da676de3fefca05971961fcb7ac4584a/Images/Backdrop/0?tag=6a3bbf7c2a38bccc8076cac288f1a18d&maxWidth=1920',
      ),
      _buildPageViewItem(
        'Show Title 2',
        'Description of Show 2',
        'http://localhost:8096/Items/329e09da86188f42c1f304be2a60946a/Images/Backdrop/0?tag=4a2ee96169101034d153c45e5fc97c88&maxWidth=1280',
      ),
      _buildPageViewItem(
        'Show Title 3',
        'Description of Show 3',
        'http://localhost:8096/Items/3f8de89d877357e6e3921837ec2cb4eb/Images/Backdrop/0?tag=92e53a98106bebf5dc28c52c239c5919&maxWidth=1920',
      ),
      _buildPageViewItem(
        'Show Title 4',
        'Description of Show 4',
        'http://localhost:8096/Items/0b9f7abd2dd49aa0f950dbe0c73dfa88/Images/Backdrop/0?tag=ccc8b33c5e893923c347f6eaad40df2b&maxWidth=1920',
      ),
    ];
  }

  Widget _buildPageViewItem(String title, String description, String imageUrl) {
    return Stack(
      children: [
        Image.network(
          imageUrl,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        ),
        Center(
          child: Align(
            alignment: Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 600),
              child: Padding(
                padding: const EdgeInsets.only(left: 20.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context)
                          .textTheme
                          .headlineLarge
                          ?.copyWith(
                              color: Theme.of(context)
                                  .textTheme
                                  .headlineLarge
                                  ?.color,
                              fontWeight: FontWeight.bold,
                              fontSize: Theme.of(context)
                                  .textTheme
                                  .headlineLarge
                                  ?.fontSize),
                    ),
                    SizedBox(height: 10),
                    Text(
                      description,
                      maxLines: 6,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                            color:
                                Theme.of(context).textTheme.displaySmall?.color,
                            fontWeight: FontWeight.w400,
                            fontSize: 16,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 20,
          right: 20,
          child: IconButton(
            icon: Icon(Icons.info, color: Colors.white),
            onPressed: () {
              // Handle info button press
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPageIndicator(ThemeData theme) {
    return Positioned(
      bottom: 10.0,
      child: GestureDetector(
        onTapDown: (details) {
          RenderBox box = context.findRenderObject() as RenderBox;
          Offset localOffset = box.globalToLocal(details.globalPosition);
          int tappedIndex = (localOffset.dx / (box.size.width / 4)).floor();
          _pageController.animateToPage(
            tappedIndex,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeIn,
          );
        },
        child: SmoothPageIndicator(
          controller: _pageController,
          count: 4,
          effect: WormEffect(
            dotColor: theme.primaryColorLight,
            activeDotColor: theme.primaryColor,
            dotHeight: 12.0,
            dotWidth: 12.0,
          ),
        ),
      ),
    );
  }
}
