import 'package:flutter_test/flutter_test.dart';
import 'package:rawkode_academy_mobile/kubele.dart';

void main() {
  test('matches the website schedule across the epoch and UTC boundaries', () {
    expect(dailyAnswer(DateTime.utc(2026, 10, 13)), 'Helm');
    expect(dailyAnswer(DateTime.utc(2026, 10, 12)), 'Paralus');
    expect(dailyAnswer(DateTime.parse('2026-10-14T00:30:00+02:00')), 'Helm');
  });
  test('marks repeated letters only as often as they occur in the answer', () {
    expect(markGuess('allee', 'apple'), [Mark.correct, Mark.present, Mark.absent, Mark.absent, Mark.correct]);
  });
  test('normalizes spaces and rejects wrong length guesses', () {
    expect(normalize('Service Mesh'), 'SERVICEMESH');
    expect(() => markGuess('a', 'Helm'), throwsArgumentError);
  });
  test('saved games cannot contain guesses after a win or duplicates', () {
    expect(() => KubeleSession(answer: 'Helm', guesses: ['HELM', 'HELP']), throwsFormatException);
    expect(() => KubeleSession(answer: 'Helm', guesses: ['HELP', 'HELP']), throwsFormatException);
    final session = KubeleSession(answer: 'Helm', guesses: ['HELP']);
    session.submit('helm');
    expect(session.won, isTrue);
    expect(() => session.submit('held'), throwsStateError);
  });
  test('share text contains marks without the answer', () {
    final result = shareResult(DateTime.utc(2026, 10, 13), ['HELM'], 'Helm');
    expect(result, contains('Kubele 2026-10-13 1/6'));
    expect(result, contains('🟩🟩🟩🟩'));
    expect(result, isNot(contains('HELM')));
  });
}
