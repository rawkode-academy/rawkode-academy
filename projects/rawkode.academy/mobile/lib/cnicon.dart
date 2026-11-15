/// A canonical CNIcon round delivered by the Academy API.
class CniconRound {
  const CniconRound({required this.name, required this.iconUrl, required this.status, required this.options, required this.answer});
  final String name;
  final String iconUrl;
  final String? status;
  final List<String> options;
  final String answer;

  factory CniconRound.fromJson(Map<String, dynamic> json) {
    final logo = json['logo'] as Map<String, dynamic>;
    return CniconRound(
      name: logo['name'] as String,
      iconUrl: logo['iconUrl'] as String,
      status: logo['cncfStatus'] as String?,
      options: (json['options'] as List<dynamic>).cast<String>(),
      answer: json['answer'] as String,
    );
  }
}

/// Matches the website's streak and time-based scoring.
int cniconScore(List<CniconRound> rounds, List<String?> answers, List<int> timeLeftMs) {
  var total = 0;
  var streak = 0;
  for (var i = 0; i < rounds.length; i++) {
    final answer = i < answers.length ? answers[i] : null;
    if (answer != null && answer == rounds[i].answer) {
      streak++;
      final remaining = i < timeLeftMs.length ? timeLeftMs[i] : 0;
      final speed = (500 * (remaining / 15000).clamp(0.0, 1.0)).round();
      final multiplier = (1 + 0.1 * (streak - 1)).clamp(1.0, 1.5);
      total += ((500 + speed) * multiplier).round();
    } else {
      streak = 0;
    }
  }
  return total;
}
