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
