import 'package:flutter/material.dart';
import 'account.dart';
import 'kubele.dart';
import 'kubele_screen.dart';
import 'cnicon_screen.dart';
import 'catalog_screen.dart';
import 'profile_screen.dart';
import 'academy_design.dart';

void main() => runApp(const AcademyApp());

class AcademyApp extends StatelessWidget {
  const AcademyApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Rawkode Academy',
        theme: AcademyDesign.theme(Brightness.light),
        darkTheme: AcademyDesign.theme(Brightness.dark),
        debugShowCheckedModeBanner: false,
        home: const AcademyHome(),
      );
}

class AcademyHome extends StatefulWidget {
  const AcademyHome({super.key, this.account});
  final AcademyAccount? account;
  @override
  State<AcademyHome> createState() => _AcademyHomeState();
}

class _AcademyHomeState extends State<AcademyHome> {
  late final account = widget.account ?? AcademyAccount();
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    account.addListener(_accountChanged);
    _restore();
  }

  void _accountChanged() { if (mounted) setState(() {}); }

  @override
  void dispose() {
    account.removeListener(_accountChanged);
    super.dispose();
  }

  Future<void> _restore() async {
    try { await account.restore(); } catch (_) { error = 'Could not connect to your account. Please try again.'; }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _signIn() async {
    setState(() { loading = true; error = null; });
    try {
      if (!await account.signIn()) error = 'Sign-in did not complete.';
    } catch (exception) {
      error = signInErrorMessage(exception);
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _signOut() async {
    try {
      final revoked = await account.signOut();
      error = revoked ? null : 'Signed out on this device, but the server could not revoke the session.';
    } catch (_) { error = 'Could not remove saved credentials. Please try again.'; }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final user = account.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Rawkode Academy'), actions: [
        if (user != null) TextButton(onPressed: _signOut, child: const Text('Sign out')),
      ]),
      body: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 720), child: ListView(padding: const EdgeInsets.all(24), children: [
        const AcademyHeading(label: 'Rawkode Academy', title: 'Learn. Play. Build.', description: 'Practical cloud native learning. A new challenge every day.'),
        const SizedBox(height: 16),
        if (loading) const LinearProgressIndicator()
        else if (user == null) ...[
          const Text('Sign in with your Academy account to play.'),
          const SizedBox(height: 12),
          FilledButton(onPressed: _signIn, child: const Text('Sign in')),
        ] else Text('Welcome, ${user['name']}'),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        if (account.credentialCleanupRequired) TextButton(onPressed: _signOut, child: const Text('Retry removing credentials')),
        const SizedBox(height: 24),
        const AcademyHeading(label: 'Challenge yourself', title: 'Play'),
        Card(child: ListTile(leading: const Icon(Icons.grid_on), title: const Text('Kubele'), subtitle: const Text('Daily cloud native word game'), enabled: user != null && !loading, onTap: user == null ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => KubeleScreen(answer: dailyAnswer(DateTime.now()), account: account))))),
        Card(child: ListTile(leading: const Icon(Icons.extension_outlined), title: const Text('CNIcon'), subtitle: const Text('Weekly cloud native logo game'), enabled: user != null && !loading, onTap: user == null ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CniconScreen(account: account))))),
        if (user != null) Card(child: ListTile(leading: const Icon(Icons.person_outline), title: const Text('Your profile'), subtitle: const Text('Player statistics'), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProfileScreen(account: account))))),
        const SizedBox(height: 24),
        const AcademyHeading(label: 'Keep learning', title: 'Explore'),
        Card(child: ListTile(leading: const Icon(Icons.school_outlined), title: const Text('Learn'), subtitle: const Text('Courses and lessons'), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CatalogScreen(videos: false))))),
        Card(child: ListTile(leading: const Icon(Icons.play_circle_outline), title: const Text('Watch & live'), subtitle: const Text('Sessions and upcoming streams'), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CatalogScreen(videos: true))))),
      ]))),
    );
  }
}
