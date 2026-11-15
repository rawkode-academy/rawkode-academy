import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rawkode_academy_mobile/kubele_screen.dart';

void main() {
  testWidgets('validates guesses and completes a game', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KubeleScreen(answer: 'Helm')));
    await tester.ensureVisible(find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'hi');
    await tester.ensureVisible(find.text('Submit guess'));
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('Enter 4 letters.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'helm');
    await tester.ensureVisible(find.text('Submit guess'));
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('You got it in 1 guess!'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });
}
