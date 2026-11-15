import 'academy_design.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:video_player/video_player.dart';
import 'catalog_service.dart';
import 'thumbnail_cache.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key, required this.videos, this.service});
  final bool videos;
  final CatalogService? service;
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  late final catalog = widget.service ?? CatalogService();
  List<dynamic> items = [];
  bool loading = true;
  String? error;
  bool showingCached = false;
  bool refreshing = false;
  String search = '';

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    if (refreshing) return;
    refreshing = true;
    var hasCached = false;
    try {
      final cached = await catalog.loadCached(videos: widget.videos);
      if (!mounted) return;
      if (cached != null) {
        hasCached = true;
        setState(() { items = _sorted(cached); loading = false; error = null; showingCached = false; });
      }
      final fresh = await catalog.load(videos: widget.videos);
      if (mounted) setState(() { items = _sorted(fresh); loading = false; error = null; showingCached = false; });
    } catch (_) {
      if (mounted) setState(() {
        loading = false;
        if (hasCached || items.isNotEmpty) { showingCached = true; } else { error = 'Could not load the catalog. Please try again.'; }
      });
    } finally {
      refreshing = false;
    }
  }

  List<dynamic> _sorted(List<dynamic> data) {
    final copy = List<dynamic>.of(data);
    if (widget.videos) copy.sort((a, b) => (b['publishedAt'] as String).compareTo(a['publishedAt'] as String));
    return copy;
  }

  @override
  void dispose() { catalog.close(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final visible = items.where((item) => (item['title'] as String).toLowerCase().contains(search.toLowerCase())).toList();
    return Scaffold(appBar: AppBar(title: Text(widget.videos ? 'Watch & live' : 'Learn')),
      body: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 800), child: CustomScrollView(slivers: [
        SliverToBoxAdapter(child: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(24, 20, 24, 0), child: AcademyHeading(label: widget.videos ? 'Watch & live' : 'Learn', title: widget.videos ? 'Ideas into practice.' : 'Build your knowledge.')),
        Padding(padding: const EdgeInsets.all(16), child: TextField(decoration: const InputDecoration(labelText: 'Search', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()), onChanged: (value) => setState(() => search = value))),
        if (showingCached) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Row(children: [
          const Expanded(child: Text('Showing saved catalog. Could not refresh.')),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ])),
        if (loading) const LinearProgressIndicator()
        else if (error != null) Padding(padding: const EdgeInsets.all(16), child: Column(children: [Text(error!), TextButton(onPressed: () { setState(() { loading = true; error = null; }); _load(); }, child: const Text('Retry'))]))
        else if (visible.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No results found.'))
        ])),
        if (!loading && error == null && visible.isNotEmpty) SliverList(delegate: SliverChildBuilderDelegate((context, index) {
          final item = visible[index] as Map<String, dynamic>;
          final date = widget.videos ? DateTime.tryParse(item['publishedAt'] as String? ?? '')?.toLocal() : null;
          final upcoming = date != null && date.isAfter(DateTime.now());
          final open = () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => widget.videos ? VideoDetail(item: item, upcoming: upcoming) : CourseDetail(item: item)));
          if (widget.videos) return Card(margin: const EdgeInsets.fromLTRB(16, 0, 16, 20), clipBehavior: Clip.antiAlias,
            child: InkWell(onTap: open, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _VideoThumbnail(item: item),
              Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(upcoming ? 'UPCOMING SESSION' : 'WATCH ON DEMAND', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.primary)),
                const SizedBox(height: 10), Text(item['title'] as String, style: Theme.of(context).textTheme.titleLarge),
                if (date != null) ...[const SizedBox(height: 10), Text('${MaterialLocalizations.of(context).formatFullDate(date)} · ${TimeOfDay.fromDateTime(date).format(context)}', style: Theme.of(context).textTheme.bodySmall)],
                const SizedBox(height: 16), Row(children: [Text(upcoming ? 'Session details' : 'Watch session', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)), const SizedBox(width: 8), const Icon(Icons.arrow_forward, size: 18)]),
              ])),
            ])));
          return Card(margin: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: ListTile(
            leading: Text('${index + 1}'.padLeft(2, '0'), style: Theme.of(context).textTheme.labelSmall),
            title: Text(item['title'] as String),
            subtitle: Text(item['description'] as String? ?? '', maxLines: 3, overflow: TextOverflow.ellipsis),
            trailing: const Icon(Icons.arrow_forward), onTap: open,
          ));
        }, childCount: visible.length)),
      ]))));
  }
}

class _VideoThumbnail extends StatelessWidget {
  const _VideoThumbnail({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final supplied = Uri.tryParse(item['thumbnailUrl'] as String? ?? '');
    final id = item['id'] as String?;
    final uri = supplied != null && supplied.scheme == 'https' && supplied.host.isNotEmpty
        ? supplied
        : id == null || id.isEmpty ? null : Uri.https('content.rawkode.academy', '/videos/${Uri.encodeComponent(id)}/thumbnail.webp');
    Widget placeholder() => ColoredBox(color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: const Center(child: Icon(Icons.play_circle_outline)));
    return AspectRatio(aspectRatio: 16 / 9, child: ClipRRect(borderRadius: BorderRadius.zero,
      child: uri == null ? placeholder() : CachedNetworkImage(
        imageUrl: uri.toString(), cacheManager: watchThumbnailCache, fit: BoxFit.cover,
        placeholder: (_, __) => placeholder(), errorWidget: (_, __, ___) => placeholder(),
      ),
    ));
  }
}

class CourseDetail extends StatelessWidget {
  const CourseDetail({super.key, required this.item});
  final Map<String, dynamic> item;
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(item['title'] as String)), body: AcademyBody(children: [
    AcademyHeading(label: 'Course', title: item['title'] as String, description: item['description'] as String?),
    const SizedBox(height: 16),
    Text('Lessons', style: Theme.of(context).textTheme.titleLarge),
    for (final lesson in item['lessons'] as List) Card(child: ListTile(title: Text(lesson['title'] as String), subtitle: Text(lesson['description'] as String? ?? ''), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LessonDetail(item: Map<String, dynamic>.from(lesson as Map)))))),
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
    return Scaffold(appBar: AppBar(title: Text(item['title'] as String)), body: AcademyBody(children: [
      AcademyHeading(label: 'Lesson', title: item['title'] as String, description: item['description'] as String?),
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
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(widget.item['title'] as String)), body: AcademyBody(children: [
    AcademyHeading(label: widget.upcoming ? 'Upcoming session' : 'Watch', title: widget.item['title'] as String),
    if (DateTime.tryParse(widget.item['publishedAt'] as String? ?? '') != null) Padding(padding: const EdgeInsets.only(bottom: 20), child: Text('${MaterialLocalizations.of(context).formatFullDate(DateTime.parse(widget.item['publishedAt'] as String).toLocal())} · ${TimeOfDay.fromDateTime(DateTime.parse(widget.item['publishedAt'] as String).toLocal()).format(context)}')),
    if (widget.upcoming) Card(child: Padding(padding: const EdgeInsets.all(24), child: Column(children: [const Icon(Icons.schedule, size: 32), const SizedBox(height: 12), const Text('This session has not started yet.')])) )
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
