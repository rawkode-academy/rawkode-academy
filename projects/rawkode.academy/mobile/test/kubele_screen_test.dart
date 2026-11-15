import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:rawkode_academy_mobile/account.dart';
import 'package:rawkode_academy_mobile/kubele_screen.dart';

void main() {
  testWidgets('validates guesses and completes a game', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KubeleScreen(answer: 'Helm')));
    await tester.enterText(find.byType(TextField), 'hi');
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('Enter 4 letters.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'helm');
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('You got it in 1 guess!'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });
  testWidgets('practice does not present a daily share card', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KubeleScreen(answer: 'Helm', practice: true)));
    await tester.enterText(find.byType(TextField), 'helm');
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('You got it in 1 guess!'), findsOneWidget);
    expect(find.text('Copy spoiler-free result'), findsNothing);
  });
  testWidgets('account practice leaves daily progress and APIs untouched', (tester) async {
    final day = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    final key = 'kubele:player:$day';
    SharedPreferences.setMockInitialValues({key: ['HELP']});
    var requests = 0;
    final account = AcademyAccount(client: MockClient((request) async {
      requests++;
      return http.Response('{}', 500);
    }));
    account.user = {'id': 'player', 'name': 'Player'};
    await tester.pumpWidget(MaterialApp(home: KubeleScreen(answer: 'Helm', practice: true, account: account)));
    await tester.enterText(find.byType(TextField), 'helm');
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('You got it in 1 guess!'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList(key), ['HELP']);
    expect(requests, 0);
  });
}
