import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rawkode_academy_mobile/account.dart';
import 'package:rawkode_academy_mobile/cnicon_screen.dart';

void main() {
  test('accepts only a complete successful logo response', () {
    final bytes = utf8.encode('<svg/>');
    expect(isCompleteLogoResponse(http.Response.bytes(bytes, 200)), isTrue);
    expect(isCompleteLogoResponse(http.Response.bytes(bytes, 206,
      headers: {'content-range': 'bytes 0-5/6'})), isTrue);
    expect(isCompleteLogoResponse(http.Response.bytes(bytes, 206,
      headers: {'content-range': 'bytes 0-5/10'})), isFalse);
    expect(isCompleteLogoResponse(http.Response.bytes(bytes, 206)), isFalse);
    expect(isCompleteLogoResponse(http.Response.bytes(bytes, 404)), isFalse);
  });

  testWidgets('starts the weekly game when a logo is returned as a full byte range', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final now = DateTime.now().toUtc();
    final monday = DateTime.utc(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    final week = monday.toIso8601String().substring(0, 10);
    final rounds = List.generate(5, (i) => {
      'logo': {'name': 'Logo $i', 'iconUrl': 'https://example.com/logo.svg', 'cncfStatus': null},
      'answer': 'Logo $i', 'options': ['Logo $i', 'Other'],
    });
    final account = AcademyAccount(client: MockClient((request) async {
      if (request.url.path.endsWith('/status')) return http.Response('{"alreadyPlayed":false}', 200);
      return http.Response(jsonEncode({'week': week, 'poolSize': 10, 'rounds': rounds}), 200);
    }));
    account.user = {'id': 'player', 'name': 'Player'};
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
    final bytes = utf8.encode(svg);
    final logos = MockClient((_) async => http.Response.bytes(bytes, 206,
      headers: {'content-range': 'bytes 0-${bytes.length - 1}/${bytes.length}'}));
    await tester.pumpWidget(MaterialApp(home: CniconScreen(account: account, logoClient: logos)));
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('Start weekly challenge'));
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('Round 1 of 5'), findsOneWidget);
    expect(find.text('Could not load the logo. Check your connection and try again.'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
