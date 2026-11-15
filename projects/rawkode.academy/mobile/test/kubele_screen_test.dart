import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rawkode_academy_mobile/kubele_screen.dart';

void main() {
  testWidgets('long answers scroll without scaling down the letters', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KubeleScreen(answer: 'Inspektor Gadget')));
    final horizontal = find.byWidgetPredicate((widget) => widget is SingleChildScrollView && widget.scrollDirection == Axis.horizontal);
    expect(horizontal, findsOneWidget);
    expect(find.byType(FittedBox), findsNothing);
    await tester.ensureVisible(horizontal);
    await tester.drag(horizontal, const Offset(-250, 0));
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('validates guesses and completes a game', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: KubeleScreen(answer: 'Helm')));
    final pageScroll = find.descendant(of: find.byType(ListView), matching: find.byType(Scrollable)).first;
    await tester.scrollUntilVisible(find.byType(TextField), 150, scrollable: pageScroll);
    await tester.enterText(find.byType(TextField), 'hi');
    await tester.scrollUntilVisible(find.text('Submit guess'), 100, scrollable: pageScroll);
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    expect(find.text('Enter 4 letters.'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'helm');
    await tester.scrollUntilVisible(find.text('Submit guess'), 100, scrollable: pageScroll);
    await tester.tap(find.text('Submit guess'));
    await tester.pump();
    await tester.scrollUntilVisible(find.text('You got it in 1 guess!'), 100, scrollable: pageScroll);
    expect(find.text('You got it in 1 guess!'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });
}
