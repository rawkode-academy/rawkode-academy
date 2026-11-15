/// Kubele's frozen v1 answer schedule, shared with the Academy website.
const answers = <String>[
  'Helm', 'Ingress', 'Clusternet', 'Cilium', 'Sidecar', 'KubeStellar',
  'Kyverno', 'Namespace', 'Microcks', 'Prometheus', 'Service Mesh',
  'Inspektor Gadget', 'Envoy', 'Deployment', 'KubeArmor', 'Linkerd',
  'GitOps', 'Paralus',
];

enum Mark { correct, present, absent }

String normalize(String value) => value.toUpperCase().replaceAll(RegExp('[^A-Z]'), '');

String dailyAnswer(DateTime date) {
  final utc = date.toUtc();
  final day = DateTime.utc(utc.year, utc.month, utc.day);
  final index = day.difference(DateTime.utc(2026, 10, 13)).inDays;
  return answers[index % answers.length];
}

List<Mark> markGuess(String guess, String answer) {
  final letters = normalize(guess).split('');
  final remaining = normalize(answer).split('');
  if (letters.length != remaining.length) {
    throw ArgumentError('Guess must match answer length.');
  }
  final marks = List<Mark>.filled(letters.length, Mark.absent);
  for (var i = 0; i < letters.length; i++) {
    if (letters[i] == remaining[i]) {
      marks[i] = Mark.correct;
      remaining[i] = '';
    }
  }
  for (var i = 0; i < letters.length; i++) {
    if (marks[i] == Mark.correct) continue;
    final index = remaining.indexOf(letters[i]);
    if (index != -1) {
      marks[i] = Mark.present;
      remaining[index] = '';
    }
  }
  return marks;
}

/// Validates restored account progress before it is shown or submitted.
class KubeleSession {
  KubeleSession({required this.answer, List<String> guesses = const []}) {
    final target = normalize(answer);
    if (guesses.length > 6) throw const FormatException('Too many guesses');
    for (final guess in guesses) {
      if (!RegExp(r'^[A-Z]+$').hasMatch(guess) ||
          guess.length != target.length ||
          _guesses.contains(guess) ||
          _guesses.contains(target)) {
        throw const FormatException('Invalid saved guesses');
      }
      _guesses.add(guess);
    }
  }

  final String answer;
  final List<String> _guesses = [];
  List<String> get guesses => List.unmodifiable(_guesses);
  bool get won => _guesses.contains(normalize(answer));
  bool get finished => won || _guesses.length == 6;

  void submit(String rawGuess) {
    if (finished) throw StateError('Puzzle already complete');
    final guess = normalize(rawGuess);
    if (guess.length != normalize(answer).length) {
      throw const FormatException('Incorrect guess length');
    }
    if (_guesses.contains(guess)) throw const FormatException('Duplicate guess');
    _guesses.add(guess);
  }
}

/// A spoiler-free share card in the same format as the Academy website.
String shareResult(DateTime date, List<String> guesses, String answer) {
  final day = date.toUtc().toIso8601String().substring(0, 10);
  final won = guesses.contains(normalize(answer));
  final score = won ? '${guesses.length}' : 'X';
  const icons = {Mark.correct: '🟩', Mark.present: '🟨', Mark.absent: '⬛'};
  final rows = guesses.map((guess) => markGuess(guess, answer).map((mark) => icons[mark]!).join()).join('\n');
  return 'Kubele $day $score/6\n$rows\nhttps://rawkode.academy/games/kubele';
}
