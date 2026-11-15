import 'dart:async';
import 'dart:convert';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:rawkode_academy_mobile/account.dart';

class MemoryStorage implements CredentialStorage {
  final data = <String, String>{'token_pair': jsonEncode({'access': 'old', 'refresh': 'refresh-old'})};
  @override
  Future<String?> read({required String key}) async => data[key];
  @override
  Future<void> write({required String key, required String? value}) async { if (value == null) { data.remove(key); } else { data[key] = value; } }
  @override
  Future<void> delete({required String key}) async { data.remove(key); }
}

class FailingStorage extends MemoryStorage {
  bool fail = true;
  @override
  Future<void> delete({required String key}) async {
    if (fail && key == 'token_pair') throw StateError('Storage unavailable');
    await super.delete(key: key);
  }
}

class FakeAuth extends FlutterAppAuth {
  FakeAuth(this.refresh);
  final Future<TokenResponse> Function() refresh;
  int calls = 0;
  @override
  Future<TokenResponse> token(TokenRequest request) { calls++; return refresh(); }
}

TokenResponse rotated() => TokenResponse('new', 'refresh-new', null, null, 'Bearer', null, null);

http.Client clientFor(List<String> revoked, {List<String>? gameTokens}) => MockClient((request) async {
  final token = request.headers['authorization'];
  if (request.method == 'DELETE') { revoked.add(token ?? ''); return http.Response('{}', 200); }
  if (request.url.host == 'id.rawkode.academy') return http.Response(jsonEncode({'user': {'id': 'u', 'name': 'Player'}}), 200);
  gameTokens?.add(token ?? '');
  if (token == 'Bearer old') return http.Response('{}', 401);
  return http.Response('{"ok":true}', 200);
});

void main() {
  test('concurrent expired requests share one rotating refresh', () async {
    final pending = Completer<TokenResponse>();
    final auth = FakeAuth(() => pending.future);
    final storage = MemoryStorage();
    final account = AcademyAccount(client: clientFor([]), auth: auth, storage: storage);
    expect(await account.restore(), isTrue);
    final requests = Future.wait([account.get('/a'), account.get('/b')]);
    await Future<void>.delayed(Duration.zero);
    expect(auth.calls, 1);
    pending.complete(rotated());
    await requests;
    final pair = jsonDecode(storage.data['token_pair']!) as Map<String, dynamic>;
    expect(pair, {'access': 'new', 'refresh': 'refresh-new'});
  });

  test('transient refresh failure preserves credentials', () async {
    final storage = MemoryStorage();
    final account = AcademyAccount(client: clientFor([]), auth: FakeAuth(() async => throw StateError('offline')), storage: storage);
    await account.restore();
    await expectLater(account.get('/a'), throwsStateError);
    expect(account.user?['id'], 'u');
    expect(jsonDecode(storage.data['token_pair']!)['refresh'], 'refresh-old');
  });

  test('invalid grant removes credentials and signs out', () async {
    final storage = MemoryStorage();
    final auth = FakeAuth(() async => throw FlutterAppAuthPlatformException(
      code: 'token_failed', platformErrorDetails: FlutterAppAuthPlatformErrorDetails(error: 'invalid_grant')));
    final account = AcademyAccount(client: clientFor([]), auth: auth, storage: storage);
    await account.restore();
    await expectLater(account.get('/a'), throwsStateError);
    expect(account.user, isNull);
    expect(storage.data['token_pair'], isNull);
  });

  test('sign out during refresh revokes the rotated token', () async {
    final pending = Completer<TokenResponse>();
    final revoked = <String>[];
    final gameTokens = <String>[];
    final storage = MemoryStorage();
    final account = AcademyAccount(client: clientFor(revoked, gameTokens: gameTokens), auth: FakeAuth(() => pending.future), storage: storage);
    await account.restore();
    final request = account.get('/a');
    final requestResult = expectLater(request, throwsStateError);
    await Future<void>.delayed(Duration.zero);
    final logout = account.signOut();
    pending.complete(rotated());
    await logout;
    await requestResult;
    expect(revoked, contains('Bearer new'));
    expect(gameTokens, ['Bearer old']);
    expect(storage.data['token_pair'], isNull);
    expect(account.user, isNull);
  });
  test('credential deletion failure can be retried', () async {
    final storage = FailingStorage();
    final account = AcademyAccount(client: clientFor([]), auth: FakeAuth(() async => rotated()), storage: storage);
    await account.restore();
    await expectLater(account.signOut(), throwsStateError);
    expect(account.credentialCleanupRequired, isTrue);
    expect(account.user, isNull);
    storage.fail = false;
    await account.signOut();
    expect(account.credentialCleanupRequired, isFalse);
    expect(storage.data['token_pair'], isNull);
  });
  test('failed remote revocation still removes local credentials', () async {
    final storage = MemoryStorage();
    final client = MockClient((request) async {
      if (request.method == 'DELETE') return http.Response('{}', 503);
      return http.Response(jsonEncode({'user': {'id': 'u', 'name': 'Player'}}), 200);
    });
    final account = AcademyAccount(client: client, auth: FakeAuth(() async => rotated()), storage: storage);
    await account.restore();
    expect(await account.signOut(), isFalse);
    expect(storage.data['token_pair'], isNull);
    expect(account.user, isNull);
  });
}
