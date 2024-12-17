import 'dart:ui';

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
        '''ある日、魔法使いの姫君が樽に詰められ置き去りにされた。ある日、ひとりの少女が唐突に殺され、犯人が捕まらず時が過ぎた。そしてある日、復讐と魔法をめぐる、時間と空間を超えた戦いが始まった！正気と狂気、理性と知性。自信と確信。悲劇で不合理な世の中で物語は始まる―――。

“はじまりの樹”の加護を受ける魔法使いの一族・鎖部一族。その姫宮にして、最強の魔法使い鎖部葉風。彼女は“はじまりの樹”と対をなし、破壊の力を司る“絶園の樹”を復活させようとする同族の鎖部左門によって、無人島に樽に詰められて置き去りにされてしまう。葉風が孤島から流したメッセージを、妹・愛花を殺した犯人に復讐を誓う少年・不破真広が拾う。真広は犯人を魔法の力で見つけることを条件に、葉風に協力する。そして真広の親友で、愛花の恋人である滝川吉野は、危機を真広に助けられたことから、その復讐劇に巻き込まれることになる。''',
        'http://localhost:8096/Items/da676de3fefca05971961fcb7ac4584a/Images/Backdrop/0?tag=6a3bbf7c2a38bccc8076cac288f1a18d&maxWidth=1920',
      ),
      _buildPageViewItem(
        'コードギアス 反逆のルルーシュ',
        '他人を支配する不思議な力を与えられた後、追放された王子は、すべての強力な帝国に対する反乱の覆面をしたリーダーになります',
        'http://localhost:8096/Items/329e09da86188f42c1f304be2a60946a/Images/Backdrop/0?tag=4a2ee96169101034d153c45e5fc97c88&maxWidth=1280',
      ),
      _buildPageViewItem(
        '陰の実力者になりたくて!',
        '彼は子供の頃から、影の中で活動するシャドウブローカーになりたいと思っていました。 彼は体を鍛え、世界で可能な限りのことをすべて行い、ある日トレーニングセッションの1つで魔法に遭遇するまで、 しかし、これは魔法ではなく、実際には車のヘッドライトでした。 そして、彼は死にました。',
        'http://localhost:8096/Items/3f8de89d877357e6e3921837ec2cb4eb/Images/Backdrop/0?tag=92e53a98106bebf5dc28c52c239c5919&maxWidth=1920',
      ),
      _buildPageViewItem(
        'ようこそ実力至上主義の教室へ',
        'この社会は平等であるか否か。真の『実力』とは何か——。東京都高度育成高等学校。それは徹底した実力至上主義を掲げ、進学率・就職率１００％を誇る進学校である。そこに入学して１年Ｄクラスに配属された綾小路清隆だったが、学校は実力至上主義の看板とは裏腹に、生徒に現金と同価値のポイントを月１０万円分も与え、授業や生活態度についても放任主義を貫く。夢のような高校生活の中で、散財を続け自堕落な日々を送るクラスメイトたち。しかし、間もなく彼らは学校のシステムの真実を知り、絶望の淵に叩き落とされるのだった……！落ちこぼれが集められたＤクラスから少年少女たちが見出すものは、世界の矛盾か、それとも正当なる実力社会か。',
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
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context)
                    .colorScheme
                    .surface
                    .withAlpha((0.6 * 255).toInt()),
                Colors.transparent,
              ],
              stops: [0.0, 0.75],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
          ),
        ),
        Center(
          child: Align(
            alignment: Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: 450),
              child: Padding(
                padding: const EdgeInsets.only(left: 20.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style:
                          Theme.of(context).textTheme.displayMedium?.copyWith(
                                color: Theme.of(context)
                                    .textTheme
                                    .displayMedium
                                    ?.color,
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                    SizedBox(height: 10),
                    Text(
                      description,
                      maxLines: 5,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.displaySmall?.copyWith(
                            color:
                                Theme.of(context).textTheme.displaySmall?.color,
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
          bottom: 50,
          right: 50,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16.0),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10.0, sigmaY: 10.0),
              child: Container(
                color: Theme.of(context)
                    .colorScheme
                    .surface
                    .withAlpha((0.2 * 255).toInt()),
                child: TextButton(
                  onPressed: () {
                    // Handle info button press
                  },
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 36.0, vertical: 24.0),
                  ),
                  child: Text(
                    '詳細を確認',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPageIndicator(ThemeData theme) {
    return Positioned(
      bottom: 10.0,
      child: SmoothPageIndicator(
        controller: _pageController,
        count: 4,
        effect: WormEffect(
          dotColor: theme.colorScheme.surface,
          activeDotColor: theme.colorScheme.primary,
          dotHeight: 12.0,
          dotWidth: 12.0,
        ),
        onDotClicked: (index) {
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeIn,
          );
        },
      ),
    );
  }
}
