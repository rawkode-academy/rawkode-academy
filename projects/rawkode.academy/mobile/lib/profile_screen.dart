import 'academy_design.dart';
import 'package:flutter/material.dart';
import 'account.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.account});
  final AcademyAccount account;
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? kubele;
  Map<String, dynamic>? cnicon;
  List<dynamic> achievements = [];
  Set<String> unlocked = {};
  bool loading = true;
  bool failed = false;
  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { loading = true; failed = false; });
    try {
      final data = await Future.wait([
        widget.account.get('/api/games/kubele/stats'),
        widget.account.get('/api/games/cnicon/stats'),
        widget.account.get('/api/games/cnicon/achievements'),
        widget.account.get('/api/mobile/cnicon-achievements'),
      ]);
      kubele = (data[0] as Map<String, dynamic>)['stats'] as Map<String, dynamic>?;
      cnicon = data[1] as Map<String, dynamic>?;
      unlocked = (data[2] as List).map((entry) => entry['achievementId'] as String).toSet();
      achievements = data[3] as List;
    } catch (_) { failed = true; }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Your profile')), body: Center(child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 600),
    child: ListView(padding: const EdgeInsets.all(24), children: [
      AcademyHeading(label: 'Your academy', title: widget.account.user?['name'] as String? ?? 'Player', description: 'Your progress, streaks, and achievements.'),
      if (widget.account.user?['username'] != null) Text('@${widget.account.user!['username']}'),
      const SizedBox(height: 24),
      if (loading) const LinearProgressIndicator()
      else if (failed) TextButton(onPressed: _load, child: const Text('Could not load stats. Retry'))
      else ...[
        Text('Kubele', style: Theme.of(context).textTheme.titleLarge),
        Wrap(spacing: 12, runSpacing: 8, children: [
          AcademyStat(value: '${kubele?['played'] ?? 0}', label: 'Played'),
          AcademyStat(value: '${kubele?['wins'] ?? 0}', label: 'Wins'),
          AcademyStat(value: '${kubele?['streak'] ?? 0}', label: 'Day streak'),
        ]),
        const SizedBox(height: 20),
        Text('CNIcon', style: Theme.of(context).textTheme.titleLarge),
        Wrap(spacing: 12, runSpacing: 8, children: [
          AcademyStat(value: '${cnicon?['weeksPlayed'] ?? 0}', label: 'Weeks played'),
          AcademyStat(value: '${cnicon?['lifetimeCorrect'] ?? 0}', label: 'Correct'),
          AcademyStat(value: '${cnicon?['currentStreak'] ?? 0}', label: 'Week streak'),
        ]),
        const SizedBox(height: 20),
        Text('CNIcon achievements', style: Theme.of(context).textTheme.titleLarge),
        for (final badge in achievements) Card(child: ListTile(
          leading: Text(unlocked.contains(badge['id']) ? '${badge['icon']}' : '🔒'),
          title: Text(badge['name'] as String),
          subtitle: Text(badge['description'] as String),
        )),
      ],
    ]),
  )));
}
