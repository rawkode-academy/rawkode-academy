import 'package:flutter/material.dart';

/// Native equivalents of packages/design-system/panda.config.ts Academy tokens.
abstract final class AcademyDesign {
  static ThemeData theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final canvas = Color(dark ? 0xff0a1220 : 0xfff4f7fb);
    final panel = Color(dark ? 0xff111d31 : 0xffffffff);
    final border = Color(dark ? 0xff22324d : 0xffcfdae8);
    final ink = Color(dark ? 0xffe8eef8 : 0xff0c1626);
    final muted = Color(dark ? 0xff8fa0b8 : 0xff526178);
    final accent = Color(dark ? 0xffff7ab6 : 0xffc2185b);
    final scheme = ColorScheme.fromSeed(seedColor: accent, brightness: brightness).copyWith(
      primary: accent, onPrimary: Color(dark ? 0xff2a0616 : 0xffffffff),
      secondary: Color(dark ? 0xff7dd3fc : 0xff0369a1),
      tertiary: Color(dark ? 0xffc4b5fd : 0xff6d28d9),
      surface: panel, onSurface: ink, onSurfaceVariant: muted,
      surfaceContainerHighest: Color(dark ? 0xff0d1728 : 0xffeaf0f8),
      outline: muted, outlineVariant: border,
    );
    final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: 'Red Hat Text');
    final text = base.textTheme.apply(bodyColor: ink, displayColor: ink).copyWith(
      headlineLarge: TextStyle(fontFamily: 'Red Hat Display', fontSize: 36, height: 1.12, fontWeight: FontWeight.w800, letterSpacing: -1, color: ink),
      headlineMedium: TextStyle(fontFamily: 'Red Hat Display', fontSize: 28, height: 1.2, fontWeight: FontWeight.w700, letterSpacing: -.6, color: ink),
      titleLarge: TextStyle(fontFamily: 'Red Hat Display', fontSize: 22, height: 1.25, fontWeight: FontWeight.w700, color: ink),
      titleMedium: TextStyle(fontFamily: 'Red Hat Display', fontSize: 18, height: 1.3, fontWeight: FontWeight.w700, color: ink),
      labelSmall: TextStyle(fontFamily: 'Red Hat Mono', fontSize: 11, letterSpacing: 1.2, color: muted),
      bodyLarge: TextStyle(fontFamily: 'Red Hat Text', fontSize: 16, height: 1.6, color: ink),
      bodyMedium: TextStyle(fontFamily: 'Red Hat Text', fontSize: 14, height: 1.5, color: ink),
    );
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(4));
    return base.copyWith(
      scaffoldBackgroundColor: canvas, textTheme: text, dividerColor: border,
      appBarTheme: AppBarTheme(backgroundColor: canvas, foregroundColor: ink, elevation: 0,
        scrolledUnderElevation: 0, centerTitle: false, titleTextStyle: text.titleMedium,
        shape: Border(bottom: BorderSide(color: border))),
      cardTheme: CardTheme(color: panel, elevation: 0, margin: const EdgeInsets.only(bottom: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: border))),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(shape: shape,
        minimumSize: const Size(48, 48), padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontFamily: 'Red Hat Text', fontWeight: FontWeight.w700))),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: shape,
        minimumSize: const Size(48, 48), side: BorderSide(color: border), padding: const EdgeInsets.all(16))),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: canvas,
        contentPadding: const EdgeInsets.all(16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: accent, width: 2))),
      listTileTheme: ListTileThemeData(contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        iconColor: muted, titleTextStyle: text.titleMedium, subtitleTextStyle: text.bodyMedium?.copyWith(color: muted)),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: accent),
    );
  }
}

class AcademyHeading extends StatelessWidget {
  const AcademyHeading({super.key, required this.label, required this.title, this.description});
  final String label;
  final String title;
  final String? description;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(top: 8, bottom: 28), child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.primary)),
      const SizedBox(height: 10), Text(title, style: Theme.of(context).textTheme.headlineLarge),
      if (description != null) ...[const SizedBox(height: 12), Text(description!, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant))],
    ],
  ));
}

class AcademyStat extends StatelessWidget {
  const AcademyStat({super.key, required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(20), child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, children: [Text(value, style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 8), Text(label.toUpperCase(), style: Theme.of(context).textTheme.labelSmall)],
  )));
}
