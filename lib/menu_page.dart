import 'package:flutter/material.dart';

class MenuPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Jellyfin Frontend'),
      ),
      body: ListView(
        children: [
          _buildSectionTitle(context, 'Featured'),
          _buildHorizontalList(context, _getFeaturedItems()),
          _buildSectionTitle(context, 'Newly Added'),
          _buildHorizontalList(context, _getNewlyAddedItems()),
          _buildSectionTitle(context, 'Libraries'),
          _buildGridList(context, _getLibraryItems()),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleLarge,
      ),
    );
  }

  Widget _buildHorizontalList(BuildContext context, List<String> items) {
    return Container(
      height: 200,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        itemBuilder: (context, index) {
          return _buildItemCard(context, items[index]);
        },
      ),
    );
  }

  Widget _buildGridList(BuildContext context, List<String> items) {
    return GridView.builder(
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 3 / 2,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        return _buildItemCard(context, items[index]);
      },
    );
  }

  Widget _buildItemCard(BuildContext context, String item) {
    return Card(
      child: Center(
        child: Text(item),
      ),
    );
  }

  List<String> _getFeaturedItems() {
    return ['Featured 1', 'Featured 2', 'Featured 3'];
  }

  List<String> _getNewlyAddedItems() {
    return ['New 1', 'New 2', 'New 3'];
  }

  List<String> _getLibraryItems() {
    return ['Library 1', 'Library 2', 'Library 3', 'Library 4'];
  }
}
