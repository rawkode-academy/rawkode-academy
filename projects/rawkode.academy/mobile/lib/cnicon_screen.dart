import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'account.dart';
import 'cnicon.dart';
import 'cnicon_logo.dart';

/// Accept a whole SVG even if the CDN serves it as a complete byte range.
bool isCompleteLogoResponse(http.Response response) {
  if (response.statusCode == 200) return true;
  if (response.statusCode != 206) return false;
  final range = RegExp(r'^bytes 0-(\d+)/(\d+)$').firstMatch(response.headers['content-range'] ?? '');
  if (range == null) return false;
  final end = int.tryParse(range.group(1)!);
  final total = int.tryParse(range.group(2)!);
  return end != null && total != null && end + 1 == total && response.bodyBytes.length == total;
}

class CniconScreen extends StatefulWidget {
  const CniconScreen({super.key, required this.account, this.loadLogo, this.logoClient});
  final AcademyAccount account;
  final Future<String> Function(Uri)? loadLogo;
  final http.Client? logoClient;
  @override
  State<CniconScreen> createState() => _CniconScreenState();
}

class _CniconScreenState extends State<CniconScreen> {
  List<CniconRound> rounds = [];
  final answers = <String?>[];
  final times = <int>[];
  Timer? timer;
  DateTime? deadline;
  int remaining = 15;
  int poolSize = 0;
  String? week;
  String? logoSvg;
  int? revealingIndex;
  String get storageKey => 'cnicon:${widget.account.user!['id']}:$week';
  bool loading = true;
  bool busy = false;
  bool submitted = false;
  bool unavailable = false;
  String? error;
  int? rank;
  int? recordedScore;
  List<dynamic>? leaderboard;
  bool leaderboardUnavailable = false;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { timer?.cancel(); super.dispose(); }

  Future<void> _load() async {
    try {
      final status = await widget.account.get('/api/games/cnicon/status') as Map<String, dynamic>;
      if (status['alreadyPlayed'] == true) {
        submitted = true;
        rank = status['rank'] as int?;
        recordedScore = status['score'] as int?;
        await _loadLeaderboard();
      } else {
        final data = await widget.account.get('/api/games/cnicon/rounds') as Map<String, dynamic>;
        rounds = (data['rounds'] as List).map((e) => CniconRound.fromJson(e as Map<String, dynamic>)).toList();
        poolSize = data['poolSize'] as int;
        week = data['week'] as String;
        if (rounds.length != 5 || poolSize < 5 || week != _weekKey()) throw const FormatException('Invalid rounds');
        final saved = (await SharedPreferences.getInstance()).getString(storageKey);
        if (saved != null) {
          final state = jsonDecode(saved) as Map<String, dynamic>;
          final savedAnswers = (state['answers'] as List).cast<String?>();
          final savedTimes = (state['times'] as List).cast<int>();
          if (savedAnswers.length > 5 || savedTimes.length != savedAnswers.length || savedTimes.any((t) => t < 0 || t > 15000)) throw const FormatException('Invalid saved game');
          for (var i = 0; i < savedAnswers.length; i++) {
            if (savedAnswers[i] != null && !rounds[i].options.contains(savedAnswers[i])) throw const FormatException('Invalid saved answer');
          }
          answers.addAll(savedAnswers);
          times.addAll(savedTimes);
          if (answers.length < 5 && state['deadline'] is String) {
            deadline = DateTime.parse(state['deadline'] as String);
            await _loadLogo();
            if (mounted) _runTimer();
          }
        }
      }
    } catch (_) { deadline = null; unavailable = true; error = 'Could not load CNIcon. Please reopen it to retry.'; }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _loadLeaderboard() async {
    try {
      leaderboard = await widget.account.get('/api/games/cnicon/leaderboard') as List<dynamic>;
      leaderboardUnavailable = false;
    } catch (_) {
      leaderboardUnavailable = true;
    }
    if (mounted) setState(() {});
  }

  String _weekKey() {
    final now = DateTime.now().toUtc();
    final monday = DateTime.utc(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    return monday.toIso8601String().substring(0, 10);
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    final ok = await prefs.setString(storageKey, jsonEncode({'answers': answers, 'times': times, 'deadline': deadline?.toUtc().toIso8601String()}));
    if (!ok) throw StateError('Could not save game');
  }

  Future<void> _loadLogo() async {
    final uri = Uri.parse(rounds[answers.length].iconUrl);
    if (uri.scheme != 'https') throw const FormatException('Invalid logo URL');
    if (widget.loadLogo != null) {
      logoSvg = await widget.loadLogo!(uri);
    } else {
      final response = await (widget.logoClient?.get(uri) ?? http.get(uri)).timeout(const Duration(seconds: 15));
      if (!isCompleteLogoResponse(response) || response.bodyBytes.length > 1024 * 1024) throw const FormatException('Logo unavailable');
      logoSvg = utf8.decode(response.bodyBytes);
    }
  }

  Future<void> _start() async {
    if (week != _weekKey()) { setState(() => error = 'A new week has started. Reopen CNIcon.'); return; }
    setState(() { busy = true; error = null; });
    try {
      await _loadLogo();
    } catch (_) {
      error = 'Could not load the logo. Check your connection and try again.';
      if (mounted) setState(() => busy = false);
      return;
    }
    try {
      deadline = DateTime.now().toUtc().add(const Duration(seconds: 15));
      await _save();
      if (mounted) _runTimer();
    } catch (_) { deadline = null; error = 'Could not save your game on this device. Try again.'; }
    if (mounted) setState(() => busy = false);
  }

  void _runTimer() {
    remaining = 15;
    timer?.cancel();
    timer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      final ms = deadline!.difference(DateTime.now().toUtc()).inMilliseconds;
      if (ms <= 0) { _answer(null); return; }
      if (mounted) setState(() => remaining = (ms / 1000).ceil());
    });
  }

  Future<void> _answer(String? answer) async {
    if (!mounted || deadline == null || busy || answers.length >= rounds.length) return;
    final ms = deadline!.difference(DateTime.now().toUtc()).inMilliseconds.clamp(0, 15000);
    timer?.cancel();
    deadline = null;
    setState(() { busy = true; revealingIndex = answers.length; answers.add(answer); times.add(ms); });
    try { await _save(); } catch (_) {
      unavailable = true;
      revealingIndex = null;
      error = 'Could not save your game. Reopen CNIcon to retry.';
      if (mounted) setState(() => busy = false);
      return;
    }
    if (!mounted) return;
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() { busy = false; revealingIndex = null; });
    if (answers.length == rounds.length) { await _submit(); } else { await _start(); }
  }

  Future<void> _submit() async {
    if (busy) return;
    if (week != _weekKey()) { setState(() => error = 'The challenge has expired. Reopen CNIcon for the new week.'); return; }
    setState(() { busy = true; error = null; });
    final correctNames = <String>[];
    final categories = {'sandbox': 0, 'incubating': 0, 'graduated': 0, 'archived': 0, 'nonCncf': 0};
    var fast = true;
    for (var i = 0; i < rounds.length; i++) {
      if (answers[i] == rounds[i].answer) {
        correctNames.add(rounds[i].name);
        final status = rounds[i].status;
        final category = categories.containsKey(status) ? status! : 'nonCncf';
        categories[category] = categories[category]! + 1;
        if (times[i] <= 7500) fast = false;
      }
    }
    try {
      final result = await widget.account.post('/api/games/cnicon/score', {
        'week': week, 'score': cniconScore(rounds, answers, times), 'correct': correctNames.length,
        'perCategoryCorrect': categories, 'perfect': correctNames.length == 5,
        'fastWeek': correctNames.isNotEmpty && fast, 'correctLogoNames': correctNames, 'poolSize': poolSize,
      }) as Map<String, dynamic>;
      recordedScore = result['score'] as int?;
      rank = result['rank'] as int?;
      submitted = true;
      await _loadLeaderboard();
    } catch (_) { error = 'Your result could not be saved. Retry while this screen is open.'; }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('CNIcon')), body: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 600),
      child: ListView(padding: const EdgeInsets.all(24), children: [
        if (loading) const Center(child: CircularProgressIndicator())
        else if (submitted) ...[
          Text('Your weekly result', style: Theme.of(context).textTheme.headlineSmall),
          Text('Score: ${recordedScore ?? '—'} · Rank: ${rank ?? '—'}'),
          const SizedBox(height: 20),
          Text('This week’s leaderboard', style: Theme.of(context).textTheme.titleLarge),
          if (leaderboardUnavailable) TextButton(onPressed: _loadLeaderboard, child: const Text('Retry leaderboard')),
          if (leaderboard != null && leaderboard!.isEmpty) const Text('No scores yet.'),
          if (leaderboard != null) for (final row in leaderboard!) ListTile(
            leading: Text('${row['rank']}'),
            title: Text(row['personName'] as String? ?? 'Player'),
            trailing: Text('${row['score']}'),
          ),
        ] else if (unavailable || (error != null && rounds.isEmpty)) Text(error ?? 'CNIcon is unavailable.')
        else if (revealingIndex != null && logoSvg != null) ...[
          Text('Round ${revealingIndex! + 1} of ${rounds.length}'),
          const SizedBox(height: 24),
          CniconLogo(svg: logoSvg!, revealed: true),
          const SizedBox(height: 24),
          Text(answers[revealingIndex!] == null
              ? 'Time’s up! The answer was ${rounds[revealingIndex!].answer}.'
              : answers[revealingIndex!] == rounds[revealingIndex!].answer
                  ? 'Correct!'
                  : 'Incorrect. The answer was ${rounds[revealingIndex!].answer}.'),
        ] else if (rounds.isNotEmpty && answers.length == rounds.length) ...[
          Text(error ?? 'Saving your result…'),
          if (!busy) FilledButton(onPressed: _submit, child: const Text('Retry saving')),
        ] else if (rounds.isNotEmpty && deadline == null) ...[
          const Text('Identify five cloud native logos. You have 15 seconds per round.'),
          if (error != null) Text(error!),
          FilledButton(onPressed: busy ? null : _start, child: const Text('Start weekly challenge')),
        ] else if (rounds.isNotEmpty && logoSvg != null) ...[
          Text('Round ${answers.length + 1} of ${rounds.length} · $remaining seconds'),
          const SizedBox(height: 24),
          CniconLogo(svg: logoSvg!, revealed: false),
          const SizedBox(height: 24),
          for (final option in rounds[answers.length].options)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: OutlinedButton(onPressed: busy ? null : () => _answer(option), child: Text(option))),
        ],
      ]),
    )));
  }
}
