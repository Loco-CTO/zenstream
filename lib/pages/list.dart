import 'package:flutter/material.dart';
import 'package:zenstream/widgets/layout.dart';

class ListPage extends StatelessWidget {
  const ListPage({super.key});

  @override
  Widget build(BuildContext context) {
    final items = List<String>.generate(20, (i) => "Item $i");

    return LayoutScaffold(
      body: ListView.builder(
        itemCount: items.length,
        itemBuilder: (context, index) {
          return ListTile(
            title: Text(items[index]),
          );
        },
      ),
    );
  }
}
