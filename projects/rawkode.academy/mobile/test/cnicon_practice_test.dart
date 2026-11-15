import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rawkode_academy_mobile/account.dart';
import 'package:rawkode_academy_mobile/cnicon_screen.dart';

void main() {
  testWidgets('practice never submits or changes weekly progress', (tester) async {
    SharedPreferences.setMockInitialValues({'cnicon:player:2026-11-09': 'saved'});
    final requests = <String>[];
    final rounds = List.generate(5, (i) => {
      'logo': {'name': 'Logo $i', 'iconUrl': 'https://example.com/logo.svg', 'cncfStatus': null},
      'answer': 'Logo $i', 'options': ['Logo $i', 'Other'],
    });
    final account = AcademyAccount(client: MockClient((request) async {
      requests.add('${request.method} ${request.url.path}?${request.url.query}');
      return http.Response(jsonEncode({'week': '2026-11-09', 'poolSize': 10, 'rounds': rounds}), 200);
    }));
    account.user = {'id': 'player', 'name': 'Player'};
    await tester.pumpWidget(MaterialApp(home: CniconScreen(account: account, practice: true,
      loadLogo: (_) async => '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('Start practice'));
    await tester.pump();
    for (var i = 0; i < 5; i++) {
      await tester.tap(find.text('Logo $i'));
      await tester.pump();
      await tester.pump();
    }
    expect(find.text('Your practice result'), findsOneWidget);
    expect(requests, ['GET /api/games/cnicon/rounds?mode=practice']);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('cnicon:player:2026-11-09'), 'saved');
  });
}
