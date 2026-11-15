import 'dart:convert';
import 'package:http/http.dart' as http;

/// Reads published Academy content from the existing public GraphQL gateway.
class CatalogService {
  CatalogService({http.Client? client}) : _client = client ?? http.Client();
  final http.Client _client;

  void close() => _client.close();
  static const _coursesQuery = '''query MobileCourses {
    allCourses { id title description difficulty publishedAt
      modules { id title description publishedAt draft order body video { id } }
    }
  }''';
  static const _videosQuery = '''query MobileVideos {
    getAllVideos { id slug title description publishedAt type youtubeId }
  }''';

  Future<List<dynamic>> load({required bool videos, DateTime? now}) async {
    final response = await _client.post(Uri.https('api.rawkode.academy', '/'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'query': videos ? _videosQuery : _coursesQuery}),
    ).timeout(const Duration(seconds: 20));
    if (response.statusCode != 200) throw StateError('Catalog unavailable');
    final result = jsonDecode(response.body) as Map<String, dynamic>;
    if (result['errors'] != null || result['data'] is! Map) throw StateError('Catalog unavailable');
    final data = result['data'] as Map<String, dynamic>;
    final source = data[videos ? 'getAllVideos' : 'allCourses'];
    if (source is! List) throw StateError('Catalog unavailable');
    final current = (now ?? DateTime.now()).toUtc();
    bool published(dynamic raw) {
      if (raw is! String) return false;
      final parsed = DateTime.tryParse(raw);
      return parsed != null && !parsed.toUtc().isAfter(current);
    }
    if (videos) {
      return source.whereType<Map<String, dynamic>>().where((item) =>
        published(item['publishedAt']) || (item['type'] == 'live' && DateTime.tryParse(item['publishedAt'] as String? ?? '') != null)
      ).toList();
    }
    return source.whereType<Map<String, dynamic>>().where((course) => published(course['publishedAt'])).map((course) {
      final rawModules = course['modules'];
      final modules = rawModules is List ? rawModules.whereType<Map<String, dynamic>>().where((item) => item['draft'] == false && published(item['publishedAt'])).toList() : <Map<String, dynamic>>[];
      modules.sort((a, b) => ((a['order'] as num?) ?? 0).compareTo((b['order'] as num?) ?? 0));
      return {
        'id': course['id'], 'title': course['title'], 'description': course['description'], 'difficulty': course['difficulty'],
        'lessons': modules.map((module) => {
          'id': module['id'], 'title': module['title'], 'description': module['description'], 'body': module['body'],
          'videoId': module['video'] is Map ? (module['video'] as Map)['id'] : null,
        }).toList(),
      };
    }).toList();
  }
}
