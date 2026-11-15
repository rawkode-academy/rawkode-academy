import 'package:flutter_test/flutter_test.dart';
import 'package:rawkode_academy_mobile/cnicon.dart';

void main() {
  const round = CniconRound(name: 'Helm', iconUrl: '/helm.svg', status: 'graduated', options: ['Helm', 'Cilium'], answer: 'Helm');
  test('scores speed, streak, and resets on wrong answer', () {
    expect(cniconScore([round, round, round, round], ['Helm', 'Helm', 'Cilium', 'Helm'], [15000, 7500, 15000, 0]), 2325);
  });
  test('clamps timing and treats missing answers as incorrect', () {
    expect(cniconScore([round, round], ['Helm'], [30000]), 1000);
  });
}
