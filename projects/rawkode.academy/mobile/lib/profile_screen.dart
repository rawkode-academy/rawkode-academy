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
      ]);
      kubele = (data[0] as Map<String, dynamic>)['stats'] as Map<String, dynamic>?;
      cnicon = data[1] as Map<String, dynamic>?;
    } catch (_) { failed = true; }
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Your profile')), body: Center(child: ConstrainedBox(
    constraints: const BoxConstraints(maxWidth: 600),
    child: ListView(padding: const EdgeInsets.all(24), children: [
      Text(widget.account.user?['name'] as String? ?? 'Player', style: Theme.of(context).textTheme.headlineMedium),
      if (widget.account.user?['username'] != null) Text('@${widget.account.user!['username']}'),
      const SizedBox(height: 24),
      if (loading) const LinearProgressIndicator()
      else if (failed) TextButton(onPressed: _load, child: const Text('Could not load stats. Retry'))
      else ...[
        Text('Kubele', style: Theme.of(context).textTheme.titleLarge),
        Text('${kubele?['played'] ?? 0} played · ${kubele?['wins'] ?? 0} wins · ${kubele?['streak'] ?? 0} day streak'),
        const SizedBox(height: 20),
        Text('CNIcon', style: Theme.of(context).textTheme.titleLarge),
        Text('${cnicon?['weeksPlayed'] ?? 0} weeks played · ${cnicon?['lifetimeCorrect'] ?? 0} correct · ${cnicon?['currentStreak'] ?? 0} week streak'),
      ],
    ]),
  )));
}
