import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// The website's violet scanline treatment, followed by a full-colour reveal.
class CniconLogo extends StatefulWidget {
  const CniconLogo({super.key, required this.svg, required this.revealed});
  final String svg;
  final bool revealed;

  @override
  State<CniconLogo> createState() => _CniconLogoState();
}

class _CniconLogoState extends State<CniconLogo> with SingleTickerProviderStateMixin {
  late final AnimationController scanlines = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  void _updateAnimation() {
    if (widget.revealed || MediaQuery.of(context).disableAnimations) {
      scanlines.stop();
    } else if (!scanlines.isAnimating) {
      scanlines.repeat();
    }
  }

  @override
  void didChangeDependencies() { super.didChangeDependencies(); _updateAnimation(); }
  @override
  void didUpdateWidget(CniconLogo oldWidget) { super.didUpdateWidget(oldWidget); _updateAnimation(); }
  @override
  void dispose() { scanlines.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Preserve luminance detail while replacing the source colours with violet.
    final bias = dark ? 58.0 : 30.0;
    final tint = ColorFilter.matrix([
      .14, .47, .05, 0, bias,
      .10, .34, .03, 0, bias * .7,
      .19, .63, .06, 0, bias * 1.2,
      0, 0, 0, 1, 0,
    ]);
    final theme = Theme.of(context);
    return Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: AspectRatio(aspectRatio: 1, child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: theme.colorScheme.tertiary.withValues(alpha: .05),
          border: Border.all(color: theme.colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Stack(fit: StackFit.expand, children: [
          AnimatedOpacity(
            opacity: widget.revealed ? 0 : 1,
            duration: const Duration(milliseconds: 350),
            child: AnimatedBuilder(animation: scanlines, builder: (context, child) {
              return ShaderMask(
                blendMode: BlendMode.dstIn,
                shaderCallback: (bounds) => const LinearGradient(
                  begin: Alignment.topCenter, end: Alignment.bottomCenter,
                  colors: [Colors.white, Colors.white, Colors.transparent, Colors.transparent],
                  stops: [0, .5, .5, 1], tileMode: TileMode.repeated,
                ).createShader(Rect.fromLTWH(0, -4 * scanlines.value, bounds.width, 4)),
                child: child,
              );
            }, child: ColorFiltered(colorFilter: tint, child: SvgPicture.string(widget.svg, fit: BoxFit.contain))),
          ),
          AnimatedOpacity(key: const ValueKey('cnicon-colour-logo'), opacity: widget.revealed ? 1 : 0, duration: const Duration(milliseconds: 350),
            child: SvgPicture.string(widget.svg, fit: BoxFit.contain)),
        ]),
      )),
    ));
  }
}
