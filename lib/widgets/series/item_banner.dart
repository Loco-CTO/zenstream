import 'package:flutter/material.dart';

class ItemBanner extends StatelessWidget {
  final String imageUrl;

  const ItemBanner({required this.imageUrl, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(8.0),
      width: 200,
      height: 300,
      decoration: BoxDecoration(
        image: DecorationImage(
          image: NetworkImage(imageUrl),
          fit: BoxFit.cover,
        ),
        borderRadius: BorderRadius.circular(16.0),
      ),
    );
  }
}
