import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:video_player/video_player.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.videos});
  final bool videos;
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  List<dynamic> items = [];
  bool loading = true;
  String? error;
  String search = '';

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final response = await http.get(Uri.https('rawkode.academy', '/api/mobile/catalog')).timeout(const Duration(seconds: 15));
      if (response.statusCode != 200) throw StateError('Catalog unavailable');
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      items = data[widget.videos ? 'videos' : 'courses'] as List;
      if (widget.videos) {
        items.sort((a, b) => (b['publishedAt'] as String).compareTo(a['publishedAt'] as String));
      }
    } catch (_) { error = 'Could not load the catalog. Please try again.'; }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final visible = items.where((item) => (item['title'] as String).toLowerCase().contains(search.toLowerCase())).toList();
    return Scaffold(appBar: AppBar(title: Text(widget.videos ? 'Watch & live' : 'Learn')),
      body: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 800), child: Column(children: [
        Padding(padding: const EdgeInsets.all(16), child: TextField(decoration: const InputDecoration(labelText: 'Search', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()), onChanged: (value) => setState(() => search = value))),
        if (loading) const LinearProgressIndicator()
        else if (error != null) Padding(padding: const EdgeInsets.all(16), child: Text(error!))
        else if (visible.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No results found.'))
        else Expanded(child: ListView.builder(itemCount: visible.length, itemBuilder: (context, index) {
          final item = visible[index] as Map<String, dynamic>;
          final date = widget.videos ? DateTime.tryParse(item['publishedAt'] as String? ?? '')?.toLocal() : null;
          final upcoming = date != null && date.isAfter(DateTime.now());
          return Card(child: ListTile(
            title: Text(item['title'] as String),
            subtitle: Text(widget.videos && date != null ? '${upcoming ? 'Upcoming · ' : ''}${MaterialLocalizations.of(context).formatFullDate(date)} ${TimeOfDay.fromDateTime(date).format(context)}' : (item['description'] as String? ?? ''), maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => widget.videos ? VideoDetail(item: item, upcoming: upcoming) : CourseDetail(item: item))),
          ));
        })),
      ]))));
  }
}

class CourseDetail extends StatelessWidget {
  const CourseDetail({super.key, required this.item});
  final Map<String, dynamic> item;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(item['title'] as String)), body: ListView(padding: const EdgeInsets.all(24), children: [
    Text(item['description'] as String? ?? ''),
    const SizedBox(height: 16),
    Text('Lessons', style: Theme.of(context).textTheme.titleLarge),
    for (final lesson in item['lessons'] as List) ListTile(title: Text(lesson['title'] as String), subtitle: Text(lesson['description'] as String? ?? ''), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LessonDetail(item: Map<String, dynamic>.from(lesson as Map))))),
  ]));
}


String _plainText(dynamic node) {
  if (node is List) return node.map(_plainText).where((s) => s.isNotEmpty).join();
  if (node is Map) {
    final text = node['text'];
    final children = node['children'] ?? node['content'];
    if (text is String) return text;
    final textContent = _plainText(children);
    final type = node['type'];
    if (type == 'paragraph' || type == 'heading' || type == 'codeBlock' || type == 'listItem') return '$textContent\n\n';
    return textContent;
  }
  return '';
}

class LessonDetail extends StatelessWidget {
  const LessonDetail({super.key, required this.item});
  final Map<String, dynamic> item;
  @override
  Widget build(BuildContext context) {
    final videoId = item['videoId'] as String?;
    final text = _plainText(item['body']);
    return Scaffold(appBar: AppBar(title: Text(item['title'] as String)), body: ListView(padding: const EdgeInsets.all(24), children: [
      Text(item['description'] as String? ?? ''),
      if (videoId != null) FilledButton.icon(icon: const Icon(Icons.play_arrow), label: const Text('Watch lesson'), onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => VideoDetail(item: {'id': videoId, 'title': item['title'], 'description': item['description']}, upcoming: false)))),
      if (text.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 20), child: SelectableText(text)),
    ]));
  }
}

class VideoDetail extends StatefulWidget {
  const VideoDetail({super.key, required this.item, required this.upcoming});
  final Map<String, dynamic> item;
  final bool upcoming;
  @override
  State<VideoDetail> createState() => _VideoDetailState();
}

class _VideoDetailState extends State<VideoDetail> {
  VideoPlayerController? controller;
  String? error;
  @override
  void initState() { super.initState(); if (!widget.upcoming) _initialize(); }
  Future<void> _initialize() async {
    final uri = Uri.https('content.rawkode.academy', '/videos/${Uri.encodeComponent(widget.item['id'] as String)}/stream.m3u8');
    final player = VideoPlayerController.networkUrl(uri);
    controller = player;
    player.addListener(_playerChanged);
    try { await player.initialize(); } catch (_) { error = 'This video could not be loaded on this device.'; }
    if (mounted) setState(() {});
  }
  void _playerChanged() { if (mounted) setState(() {}); }
  @override
  void dispose() { controller?.removeListener(_playerChanged); controller?.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(widget.item['title'] as String)), body: ListView(padding: const EdgeInsets.all(24), children: [
    if (widget.upcoming) const Text('This session has not started yet.')
    else if (error != null) Text(error!)
    else if (controller?.value.isInitialized != true) const Center(child: CircularProgressIndicator())
    else ...[
      AspectRatio(aspectRatio: controller!.value.aspectRatio, child: VideoPlayer(controller!)),
      IconButton(onPressed: () { setState(() { controller!.value.isPlaying ? controller!.pause() : controller!.play(); }); }, icon: Icon(controller!.value.isPlaying ? Icons.pause : Icons.play_arrow), tooltip: controller!.value.isPlaying ? 'Pause' : 'Play'),
      VideoProgressIndicator(controller!, allowScrubbing: true),
    ],
    const SizedBox(height: 16),
    Text(widget.item['description'] as String? ?? ''),
  ]));
}
