import 'academy_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'account.dart';
import 'kubele.dart';

/// Presented after the caller has authenticated the player.
class KubeleScreen extends StatefulWidget {
  const KubeleScreen({super.key, required this.answer, this.account});
  final String answer;
  final AcademyAccount? account;

  @override
  State<KubeleScreen> createState() => _KubeleScreenState();
}

class _KubeleScreenState extends State<KubeleScreen> {
  final controller = TextEditingController();
  final boardController = ScrollController();
  late KubeleSession session;
  String? error;
  bool loading = false;
  bool saving = false;
  bool unavailable = false;
  Map<String, dynamic>? stats;
  late final String day;
  String get storageKey => 'kubele:${widget.account!.user!['id']}:$day';
  List<String> get guesses => session.guesses;
  bool get won => session.won;
  bool get finished => session.finished;

  @override
  void initState() {
    super.initState();
    session = KubeleSession(answer: widget.answer);
    day = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    if (widget.account != null) {
      loading = true;
      _restore();
    }
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final local = prefs.getStringList(storageKey) ?? <String>[];
      final result = await widget.account!.get('/api/games/kubele/stats') as Map<String, dynamic>;
      stats = result['stats'] as Map<String, dynamic>?;
      final server = result['today'];
      session = KubeleSession(answer: widget.answer, guesses: server == null ? local : (server as List).cast<String>());
      if (session.finished && server == null) await _saveResult();
    } catch (_) {
      unavailable = true;
      error = 'Could not load your progress. Reopen Kubele to retry.';
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _saveResult() async {
    final result = await widget.account!.post('/api/games/kubele/stats', {'date': day, 'guesses': guesses}) as Map<String, dynamic>;
    stats = result['stats'] as Map<String, dynamic>?;
    final saved = result['today'];
    if (saved is List) session = KubeleSession(answer: widget.answer, guesses: saved.cast<String>());
  }

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!await prefs.setStringList(storageKey, guesses)) throw StateError('Save failed');
      if (finished) await _saveResult();
    } catch (_) {
      unavailable = true;
      error = 'Progress could not sync. Reopen Kubele to retry.';
    }
    if (mounted) setState(() => saving = false);
  }

  @override
  void dispose() {
    controller.dispose();
    boardController.dispose();
    super.dispose();
  }

  void submit() {
    final guess = normalize(controller.text);
    setState(() {
      if (finished || loading || saving || unavailable) return;
      if (DateTime.now().toUtc().toIso8601String().substring(0, 10) != day) {
        error = 'A new puzzle is available. Reopen Kubele to play it.';
        return;
      }
      if (guess.length != normalize(widget.answer).length) {
        error = 'Enter ${normalize(widget.answer).length} letters.';
      } else if (guesses.contains(guess)) {
        error = 'You already tried that guess.';
      } else {
        session.submit(guess);
        controller.clear();
        error = null;
        if (widget.account != null) {
          saving = true;
          _persist();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Kubele')),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: ListView(padding: const EdgeInsets.all(24), children: [
              const AcademyHeading(label: 'Daily challenge', title: 'Kubele', description: 'Six guesses. One cloud native term.'),
              const SizedBox(height: 8),
              Text('Guess the ${normalize(widget.answer).length}-letter term in six attempts.'),
              const SizedBox(height: 20),
              Scrollbar(controller: boardController, thumbVisibility: true, child: SingleChildScrollView(
                controller: boardController, scrollDirection: Axis.horizontal,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var row = 0; row < 6; row++)
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Semantics(label: 'Guess ${row + 1}',
                  child: Row(children: [
                    for (var i = 0; i < normalize(widget.answer).length; i++)
                      Padding(padding: const EdgeInsets.only(right: 4), child: row < guesses.length
                        ? _Tile(letter: guesses[row][i], mark: markGuess(guesses[row], widget.answer)[i])
                        : Container(width: 40, height: 44, decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            border: Border.all(color: Theme.of(context).colorScheme.outlineVariant)),
                            child: Semantics(label: 'Empty'))),
                  ]),
                )),
                ]),
              )),
              const SizedBox(height: 16),
              if (loading || saving) const LinearProgressIndicator(),
              if (error != null && (finished || unavailable)) Text(error!),
              if (!finished) ...[
                TextField(
                  controller: controller,
                  textCapitalization: TextCapitalization.characters,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: InputDecoration(labelText: 'Your guess', errorText: error, border: const OutlineInputBorder()),
                  onSubmitted: (_) => submit(),
                ),
                const SizedBox(height: 12),
                FilledButton(onPressed: loading || saving || unavailable ? null : submit, child: const Text('Submit guess')),
              ] else
                Text(won ? 'You got it in ${guesses.length} ${guesses.length == 1 ? 'guess' : 'guesses'}!' : 'Today’s answer: ${widget.answer}', style: Theme.of(context).textTheme.titleLarge),
              if (finished) TextButton.icon(
                icon: const Icon(Icons.copy),
                label: const Text('Copy spoiler-free result'),
                onPressed: () async {
                  try {
                    await Clipboard.setData(ClipboardData(text: shareResult(DateTime.parse('${day}T00:00:00Z'), guesses, widget.answer)));
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Result copied.')));
                  } catch (_) {
                    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not copy the result.')));
                  }
                },
              ),
              const SizedBox(height: 20),
              const Text('Green: correct place · Amber: in the answer · Grey: absent'),
              if (stats != null) Padding(padding: const EdgeInsets.only(top: 20), child: Text("${stats!['played']} played · ${stats!['wins']} wins · ${stats!['streak']} day streak")),
            ]),
          ),
        ),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.letter, required this.mark});
  final String letter;
  final Mark mark;

  @override
  Widget build(BuildContext context) {
    final color = switch (mark) {
      Mark.correct => const Color(0xff20633a),
      Mark.present => const Color(0xff765500),
      Mark.absent => const Color(0xff50545a),
    };
    final description = switch (mark) {
      Mark.correct => 'correct position',
      Mark.present => 'in the answer, different position',
      Mark.absent => 'absent',
    };
    return Semantics(
      label: '$letter, $description',
      child: Container(
        alignment: Alignment.center,
        width: 40,
        height: 44,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
        child: Stack(alignment: Alignment.center, children: [
          Text(letter, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Red Hat Mono')),
          Positioned(right: 2, bottom: 0, child: ExcludeSemantics(child: Text(switch (mark) { Mark.correct => '✓', Mark.present => '~', Mark.absent => '×' }, style: const TextStyle(color: Colors.white, fontSize: 9)))),
        ]),
      ),
    );
  }
}
