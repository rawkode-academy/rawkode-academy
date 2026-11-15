import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rawkode_academy_mobile/catalog_service.dart';

void main() {
  final now = DateTime.utc(2026, 11, 15);
  test('loads courses from GraphQL and hides draft and future lessons', () async {
    final requests = <String>[];
    final service = CatalogService(client: MockClient((request) async {
      requests.add('${request.method} ${request.url.host}');
      return http.Response(jsonEncode({'data': {'allCourses': [
        {'id': 'published', 'title': 'Course', 'publishedAt': '2026-01-01T00:00:00Z', 'modules': [
          {'id': 'ready', 'title': 'Ready', 'publishedAt': '2026-01-01T00:00:00Z', 'draft': false, 'order': 1, 'video': {'id': 'video1'}},
          {'id': 'draft', 'publishedAt': '2026-01-01T00:00:00Z', 'draft': true},
          {'id': 'future', 'publishedAt': '2027-01-01T00:00:00Z', 'draft': false},
        ]},
        {'id': 'future-course', 'publishedAt': '2027-01-01T00:00:00Z', 'modules': []},
      ]}}), 200);
    }));
    final courses = await service.load(videos: false, now: now);
    expect(courses, hasLength(1));
    expect(courses.single['lessons'], hasLength(1));
    expect(courses.single['lessons'][0]['videoId'], 'video1');
    expect(requests, ['POST api.rawkode.academy']);
  });
  test('shows published videos and scheduled live sessions only', () async {
    final service = CatalogService(client: MockClient((request) async {
      return http.Response(jsonEncode({'data': {'getAllVideos': [
        {'id': 'past', 'publishedAt': '2026-01-01T00:00:00Z', 'type': 'recorded'},
        {'id': 'scheduled', 'publishedAt': '2027-01-01T00:00:00Z', 'type': 'live'},
        {'id': 'unpublished', 'publishedAt': '2027-01-01T00:00:00Z', 'type': 'recorded'},
      ]}}), 200);
    }));
    expect((await service.load(videos: true, now: now)).map((v) => v['id']), ['past', 'scheduled']);
  });
  test('reports GraphQL errors instead of showing partial data', () async {
    final service = CatalogService(client: MockClient((request) async => http.Response(jsonEncode({
      'data': {'allCourses': []}, 'errors': [{'message': 'Unavailable'}]
    }), 200)));
    await expectLater(service.load(videos: false, now: now), throwsStateError);
  });
}
