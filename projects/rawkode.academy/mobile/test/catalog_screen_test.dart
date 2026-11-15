import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rawkode_academy_mobile/catalog_screen.dart';
import 'package:rawkode_academy_mobile/catalog_service.dart';

void main() {
  testWidgets('catalog remains scrollable on short screens with enlarged text', (tester) async {
    tester.view.physicalSize = const Size(844, 390);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    final service = CatalogService(client: MockClient((_) async => http.Response('{"data":{"getAllVideos":[]}}', 200)));
    await tester.pumpWidget(MaterialApp(home: MediaQuery(
      data: const MediaQueryData(textScaler: TextScaler.linear(1.6)),
      child: CatalogScreen(videos: true, service: service))));
    await tester.pump(); await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(find.text('No results found.'), 150,
      scrollable: find.descendant(of: find.byType(CustomScrollView), matching: find.byType(Scrollable)).first);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('shows saved videos while refreshing and retains them offline', (tester) async {
    SharedPreferences.setMockInitialValues({'catalog_videos_v1': jsonEncode({'data': {'getAllVideos': [
      {'title': 'Saved video', 'publishedAt': '2020-01-01T00:00:00Z', 'type': 'recorded'},
    ]}})});
    final pending = Completer<http.Response>();
    final service = CatalogService(client: MockClient((_) => pending.future));
    await tester.pumpWidget(MaterialApp(home: CatalogScreen(videos: true, service: service)));
    await tester.pump();
    expect(find.text('Saved video'), findsOneWidget);
    pending.complete(http.Response('offline', 503));
    await tester.pump();
    await tester.pump();
    expect(find.text('Saved video'), findsOneWidget);
    expect(find.text('Showing saved catalog. Could not refresh.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
