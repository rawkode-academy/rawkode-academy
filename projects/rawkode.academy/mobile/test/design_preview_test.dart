import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:rawkode_academy_mobile/academy_design.dart';
import 'package:rawkode_academy_mobile/account.dart';
import 'package:rawkode_academy_mobile/catalog_screen.dart';
import 'package:rawkode_academy_mobile/catalog_service.dart';
import 'package:rawkode_academy_mobile/cnicon_screen.dart';
import 'package:rawkode_academy_mobile/kubele_screen.dart';
import 'package:rawkode_academy_mobile/main.dart';
import 'package:rawkode_academy_mobile/profile_screen.dart';

void main() {
  testWidgets('render every Academy screen in both themes', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    for (final family in ['Text', 'Display', 'Mono']) {
      await (FontLoader('Red Hat $family')..addFont(rootBundle.load('assets/fonts/RedHat$family.ttf'))).load();
    }
    final lesson = {'title': 'Deploy your first workload', 'description': 'Understand the building blocks of a reliable Kubernetes deployment.', 'body': {'type': 'paragraph', 'children': [{'text': 'Learn how deployments manage replicas and keep your applications running.'}]}};
    final course = {'title': 'Kubernetes foundations', 'description': 'Build a practical understanding of cloud native infrastructure, one lesson at a time.', 'lessons': [lesson]};
    for (final brightness in Brightness.values) {
      final catalog = () => CatalogService(client: MockClient((_) async => http.Response(jsonEncode({'data': {
        'getAllVideos': [{'title': 'Building reliable Kubernetes platforms', 'publishedAt': '2026-01-01T12:00:00Z', 'type': 'recorded'}],
        'allCourses': [{'title': course['title'], 'description': course['description'], 'publishedAt': '2026-01-01T12:00:00Z', 'modules': []}],
      }}), 200)));
      final account = AcademyAccount(client: MockClient((request) async {
        if (request.url.path.endsWith('/status')) return http.Response('{"alreadyPlayed":false}', 200);
        if (request.url.path.endsWith('/rounds')) {
          final now = DateTime.now().toUtc();
          final week = DateTime.utc(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1)).toIso8601String().substring(0, 10);
          return http.Response(jsonEncode({'week': week, 'poolSize': 5, 'rounds': List.generate(5, (i) => {'logo': {'name': 'Project $i', 'iconUrl': 'https://example.com/logo.svg', 'cncfStatus': null}, 'answer': 'Project $i', 'options': ['Project $i', 'Another project']})}), 200);
        }
        if (request.url.path.contains('achievements')) return http.Response('[]', 200);
        return http.Response('{"stats":{"played":12,"wins":10,"streak":3},"weeksPlayed":4,"lifetimeCorrect":18,"currentStreak":2}', 200);
      }))..user = {'id': 'preview', 'name': 'Academy player', 'username': 'cloudnative'};
      final screens = <String, Widget>{
        'home': const AcademyHome(),
        'watch': CatalogScreen(videos: true, service: catalog()),
        'learn': CatalogScreen(videos: false, service: catalog()),
        'course': CourseDetail(item: course), 'lesson': LessonDetail(item: lesson),
        'video': const VideoDetail(item: {'title': 'Cloud native live', 'description': 'Join the Academy for a hands-on session.'}, upcoming: true),
        'kubele': const KubeleScreen(answer: 'Helm'),
        'cnicon': CniconScreen(account: account), 'profile': ProfileScreen(account: account),
      };
      for (final entry in screens.entries) {
        final key = GlobalKey();
        await tester.pumpWidget(MaterialApp(theme: AcademyDesign.theme(brightness), home: RepaintBoundary(key: key, child: entry.value)));
        await tester.pump(); await tester.pump(const Duration(milliseconds: 100)); await tester.pump();
        expect(tester.takeException(), isNull, reason: '${entry.key} ${brightness.name}');
        final boundary = key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await boundary.toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final file = File('build/design-previews/${brightness.name}-${entry.key}.png');
          await file.parent.create(recursive: true); await file.writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
        await tester.pumpWidget(const SizedBox());
      }
    }
  });
}
