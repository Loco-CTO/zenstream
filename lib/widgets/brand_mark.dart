import "package:flutter/material.dart";

class BrandMark extends StatelessWidget {
  final double size;

  const BrandMark({
    this.size = 32,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Image.asset(
        "assets/icons/icon.png",
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return CustomPaint(
            size: Size.square(size),
            painter: _BrandMarkPainter(),
          );
        },
      ),
    );
  }
}

class _BrandMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final shadowPaint = Paint()
      ..color = const Color(0xFF7C3AED).withAlpha((0.36 * 255).toInt())
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7);
    final fillPaint = Paint()
      ..shader = const LinearGradient(
        colors: [
          Color(0xFFC4B5FD),
          Color(0xFF8B5CF6),
          Color(0xFF6D5EF6),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(rect);

    final path = Path()
      ..moveTo(size.width * 0.26, size.height * 0.16)
      ..quadraticBezierTo(
        size.width * 0.20,
        size.height * 0.13,
        size.width * 0.18,
        size.height * 0.24,
      )
      ..lineTo(size.width * 0.18, size.height * 0.76)
      ..quadraticBezierTo(
        size.width * 0.20,
        size.height * 0.87,
        size.width * 0.30,
        size.height * 0.81,
      )
      ..lineTo(size.width * 0.78, size.height * 0.55)
      ..quadraticBezierTo(
        size.width * 0.90,
        size.height * 0.49,
        size.width * 0.78,
        size.height * 0.42,
      )
      ..close();

    canvas.drawPath(path.shift(Offset(size.width * 0.04, 0)), shadowPaint);
    canvas.drawPath(path, fillPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
